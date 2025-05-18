import { useState, useCallback, useEffect } from 'react';

// Define UUIDs for the BLE service and characteristics
const SERVICE_UUID = '00000000-0000-0000-0000-000000000000'; // Replace with actual UUID
const KEYMAP_CHARACTERISTIC_UUID = '00000001-0000-0000-0000-000000000000'; // Replace with actual UUID
const CMD_CHARACTERISTIC_UUID = '00000002-0000-0000-0000-000000000000'; // Replace with actual UUID
const FW_CHUNK_CHARACTERISTIC_UUID = '00000003-0000-0000-0000-000000000000'; // Replace with actual UUID
const BATTERY_CHARACTERISTIC_UUID = '00000004-0000-0000-0000-000000000000'; // Replace with actual UUID

// Define types
interface BleDevice {
  device: BluetoothDevice;
  server?: BluetoothRemoteGATTServer;
  service?: BluetoothRemoteGATTService;
  characteristics: {
    keymap?: BluetoothRemoteGATTCharacteristic;
    cmd?: BluetoothRemoteGATTCharacteristic;
    fwChunk?: BluetoothRemoteGATTCharacteristic;
    battery?: BluetoothRemoteGATTCharacteristic;
  };
}

interface UseBleReturn {
  isAvailable: boolean;
  isConnected: boolean;
  isScanning: boolean;
  batteryLevel: number | null;
  error: string | null;
  scanForDevices: () => Promise<void>;
  connectToDevice: (device: BluetoothDevice) => Promise<void>;
  disconnectDevice: () => void;
  sendKeymap: (keymap: string) => Promise<void>;
  sendCommand: (command: string) => Promise<void>;
  sendFirmwareChunk: (chunk: ArrayBuffer, progress: (percent: number) => void) => Promise<void>;
  readBatteryLevel: () => Promise<number>;
}

export const useBle = (): UseBleReturn => {
  const [isAvailable, setIsAvailable] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bleDevice, setBleDevice] = useState<BleDevice | null>(null);

  // Check if Web Bluetooth is available
  useEffect(() => {
    if (navigator.bluetooth) {
      setIsAvailable(true);
    } else {
      setIsAvailable(false);
      setError('Web Bluetooth is not available in this browser');
    }
  }, []);

  // Scan for BLE devices
  const scanForDevices = useCallback(async () => {
    if (!navigator.bluetooth) {
      setError('Web Bluetooth is not available');
      return;
    }

    try {
      setIsScanning(true);
      setError(null);

      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { services: [SERVICE_UUID] },
          { namePrefix: 'StreamDeck' }
        ],
        optionalServices: [SERVICE_UUID]
      });

      device.addEventListener('gattserverdisconnected', () => {
        setIsConnected(false);
        setBatteryLevel(null);
      });

      setBleDevice({
        device,
        characteristics: {}
      });

      setIsScanning(false);
    } catch (err) {
      setIsScanning(false);
      setError(`Error scanning for devices: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, []);

  // Connect to a BLE device
  const connectToDevice = useCallback(async (device: BluetoothDevice) => {
    try {
      setError(null);

      const server = await device.gatt?.connect();
      if (!server) {
        throw new Error('Failed to connect to GATT server');
      }

      const service = await server.getPrimaryService(SERVICE_UUID);
      
      // Get all required characteristics
      const keymapChar = await service.getCharacteristic(KEYMAP_CHARACTERISTIC_UUID);
      const cmdChar = await service.getCharacteristic(CMD_CHARACTERISTIC_UUID);
      const fwChunkChar = await service.getCharacteristic(FW_CHUNK_CHARACTERISTIC_UUID);
      const batteryChar = await service.getCharacteristic(BATTERY_CHARACTERISTIC_UUID);

      setBleDevice({
        device,
        server,
        service,
        characteristics: {
          keymap: keymapChar,
          cmd: cmdChar,
          fwChunk: fwChunkChar,
          battery: batteryChar
        }
      });

      // Read initial battery level
      const batteryValue = await batteryChar.readValue();
      const batteryPercent = batteryValue.getUint8(0);
      setBatteryLevel(batteryPercent);

      // Set up battery level notifications
      await batteryChar.startNotifications();
      batteryChar.addEventListener('characteristicvaluechanged', (event) => {
        const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
        if (value) {
          const batteryPercent = value.getUint8(0);
          setBatteryLevel(batteryPercent);
        }
      });

      setIsConnected(true);
    } catch (err) {
      setError(`Error connecting to device: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, []);

  // Disconnect from the BLE device
  const disconnectDevice = useCallback(() => {
    if (bleDevice?.server && bleDevice.server.connected) {
      bleDevice.server.disconnect();
    }
    setIsConnected(false);
    setBatteryLevel(null);
  }, [bleDevice]);

  // Send keymap to the device
  const sendKeymap = useCallback(async (keymap: string) => {
    if (!bleDevice?.characteristics.keymap) {
      setError('Device not connected or keymap characteristic not available');
      return;
    }

    try {
      const encoder = new TextEncoder();
      const keymapData = encoder.encode(keymap);
      await bleDevice.characteristics.keymap.writeValue(keymapData);
    } catch (err) {
      setError(`Error sending keymap: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [bleDevice]);

  // Send command to the device
  const sendCommand = useCallback(async (command: string) => {
    if (!bleDevice?.characteristics.cmd) {
      setError('Device not connected or command characteristic not available');
      return;
    }

    try {
      const encoder = new TextEncoder();
      const commandData = encoder.encode(command);
      await bleDevice.characteristics.cmd.writeValue(commandData);
    } catch (err) {
      setError(`Error sending command: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [bleDevice]);

  // Send firmware chunk to the device
  const sendFirmwareChunk = useCallback(async (chunk: ArrayBuffer, progress: (percent: number) => void) => {
    if (!bleDevice?.characteristics.fwChunk) {
      setError('Device not connected or firmware chunk characteristic not available');
      return;
    }

    try {
      // Assuming we're sending chunks of 20 bytes as specified in the requirements
      const chunkSize = 20;
      const totalChunks = Math.ceil(chunk.byteLength / chunkSize);
      
      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, chunk.byteLength);
        const chunkPart = chunk.slice(start, end);
        
        await bleDevice.characteristics.fwChunk.writeValue(chunkPart);
        
        // Update progress
        const percent = Math.round(((i + 1) / totalChunks) * 100);
        progress(percent);
        
        // Small delay to prevent overwhelming the device
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    } catch (err) {
      setError(`Error sending firmware chunk: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [bleDevice]);

  // Read battery level from the device
  const readBatteryLevel = useCallback(async () => {
    if (!bleDevice?.characteristics.battery) {
      setError('Device not connected or battery characteristic not available');
      return 0;
    }

    try {
      const batteryValue = await bleDevice.characteristics.battery.readValue();
      const batteryPercent = batteryValue.getUint8(0);
      setBatteryLevel(batteryPercent);
      return batteryPercent;
    } catch (err) {
      setError(`Error reading battery level: ${err instanceof Error ? err.message : String(err)}`);
      return 0;
    }
  }, [bleDevice]);

  return {
    isAvailable,
    isConnected,
    isScanning,
    batteryLevel,
    error,
    scanForDevices,
    connectToDevice,
    disconnectDevice,
    sendKeymap,
    sendCommand,
    sendFirmwareChunk,
    readBatteryLevel
  };
};

export default useBle;