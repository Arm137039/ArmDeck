import { BleDevice, DeviceInfo } from './types';
import { BLE_CONFIG, COMMANDS, ERRORS } from './constants';
import { buildCommand, parseResponse, delay } from './utils';

export const sendCommandStrict = async (
    device: BleDevice,
    command: number,
    payload?: Uint8Array
): Promise<Uint8Array | null> => {
    if (!device.characteristics.cmd) {
        throw new Error('Command characteristic not available');
    }

    console.log(`[BLE] Sending command: 0x${command.toString(16).padStart(2, '0')}`);

    const packet = buildCommand(command, payload);

    try {
        // Step 1: Write command
        await device.characteristics.cmd.writeValue(packet);

        // Step 2: Wait for ESP32 processing
        await delay(BLE_CONFIG.TIMING.ESP32_PROCESSING_DELAY);

        // Step 3: Read response
        const dataView = await device.characteristics.cmd.readValue();
        const response = new Uint8Array(dataView.buffer);

        if (response.length >= 5 &&
            response[0] === BLE_CONFIG.PROTOCOL.MAGIC_BYTE1 &&
            response[1] === BLE_CONFIG.PROTOCOL.MAGIC_BYTE2) {
            console.log('[BLE] Valid response received');
            return response;
        }

        if (response.length === 0) {
            console.log('[BLE] Empty response, retrying...');
            await delay(BLE_CONFIG.TIMING.RETRY_DELAY);

            const retryDataView = await device.characteristics.cmd.readValue();
            const retryResponse = new Uint8Array(retryDataView.buffer);

            if (retryResponse.length >= 5 &&
                retryResponse[0] === BLE_CONFIG.PROTOCOL.MAGIC_BYTE1 &&
                retryResponse[1] === BLE_CONFIG.PROTOCOL.MAGIC_BYTE2) {
                console.log('[BLE] Retry successful');
                return retryResponse;
            }
        }

        console.log('[BLE] No valid response after retry');
        return null;

    } catch (err) {
        console.error('[BLE] Command failed:', err);
        throw err;
    }
};

export const testCommunication = async (device: BleDevice): Promise<{ success: boolean; deviceInfo?: DeviceInfo }> => {
    console.log('[BLE] Testing communication...');

    try {
        const response = await sendCommandStrict(device, COMMANDS.GET_INFO);

        if (response && response.length > 0) {
            const parsed = parseResponse(response);
            if (parsed && parsed.error === ERRORS.NONE && parsed.payload) {
                const info: DeviceInfo = {
                    protocol_version: parsed.payload[0] || 1,
                    firmware_major: parsed.payload[1] || 1,
                    firmware_minor: parsed.payload[2] || 2,
                    firmware_patch: parsed.payload[3] || 0,
                    num_buttons: parsed.payload[4] || 15,
                    battery_level: parsed.payload[5] || 0,
                    uptime_seconds: parsed.payload.length > 8 ? new DataView(parsed.payload.buffer).getUint32(6, true) : 0,
                    free_heap: parsed.payload.length > 12 ? new DataView(parsed.payload.buffer).getUint32(10, true) : 0,
                    device_name: parsed.payload.length > 16 ?
                        new TextDecoder().decode(parsed.payload.slice(16, 32)).replace(/\0.*$/, '') || 'mDeck' : 'mDeck'
                };

                console.log('[BLE] Communication successful, device info:', info);
                return { success: true, deviceInfo: info };
            }
        }

        console.log('[BLE] Communication failed');
        return { success: false };
    } catch (err) {
        console.error('[BLE] Communication test failed:', err);
        return { success: false };
    }
};

export const testBasicCommunication = async (device: BleDevice): Promise<void> => {
    if (!device.characteristics.cmd) {
        console.log('[BLE] No command characteristic available');
        return;
    }

    try {
        console.log('[BLE] Testing basic communication...');
        const testData = new Uint8Array([0x42, 0x43, 0x44]);

        await device.characteristics.cmd.writeValue(testData);
        console.log('[BLE] Test data sent successfully');

        await delay(200);
        try {
            const response = await device.characteristics.cmd.readValue();
            const responseArray = new Uint8Array(response.buffer);
            console.log('[BLE] Test response:', responseArray);

            if (responseArray.length === 0) {
                console.log('[BLE] ESP32 responded with empty data - this is expected');
            }
        } catch (readError) {
            console.log('[BLE] No response data - this is normal');
        }
    } catch (err) {
        console.error('[BLE] Communication test failed:', err);
    }
};

export const testButtonPress = async (device: BleDevice, buttonId: number): Promise<void> => {
    if (!device.characteristics.cmd || buttonId < 0 || buttonId >= 15) {
        console.log('[BLE] Invalid button test request');
        return;
    }

    try {
        console.log(`[BLE] Testing button ${buttonId} press...`);
        const testData = new Uint8Array([0xFF, buttonId]);

        await device.characteristics.cmd.writeValue(testData);
        console.log(`[BLE] Button ${buttonId} test sent`);
    } catch (err) {
        console.error(`[BLE] Button ${buttonId} test failed:`, err);
    }
};