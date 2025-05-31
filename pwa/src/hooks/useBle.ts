import { useState, useCallback, useEffect, useRef } from 'react';

// ========================================
// CONSTANTS & CONFIGURATION
// ========================================

const BLE_CONFIG = {
  SERVICES: {
    ARMDECK: '7a0b1000-0000-1000-8000-00805f9b34fb',
    DEVICE_INFO: '0000180a-0000-1000-8000-00805f9b34fb',
  },
  CHARACTERISTICS: {
    KEYMAP: 'fb349b5f-8000-0080-0010-000001100b7a',
    COMMAND: 'fb349b5f-8000-0080-0010-000002100b7a',
  },
  PROTOCOL: {
    MAGIC_BYTE1: 0xAD,
    MAGIC_BYTE2: 0xDC,
    VERSION: 1,
  },
  TIMING: {
    ESP32_PROCESSING_DELAY: 450,
    RETRY_DELAY: 200,
    BUTTON_SAVE_DELAY: 150,
    AUTO_SAVE_TIMEOUT: 2000,
    CONNECTION_WAIT: 3000,
    SETUP_DELAY: 2000,
  }
} as const;

const COMMANDS = {
  GET_INFO: 0x10,
  GET_CONFIG: 0x20,
  SET_CONFIG: 0x21,
  GET_BUTTON: 0x30,
  SET_BUTTON: 0x31,
  TEST_BUTTON: 0x32,
  RESET_CONFIG: 0x52,
  RESTART: 0xFF,
} as const;

const ERRORS = {
  NONE: 0x00,
  INVALID_CMD: 0x01,
  INVALID_PARAM: 0x02,
  CHECKSUM: 0x03,
} as const;

const ACTION_TYPES = {
  KEY: 0,
  MEDIA: 1,
  MACRO: 2,
  CUSTOM: 3,
} as const;

// ========================================
// TYPES & INTERFACES
// ========================================

interface BleDevice {
  device: BluetoothDevice;
  server?: BluetoothRemoteGATTServer;
  armdeckService?: BluetoothRemoteGATTService;
  characteristics: {
    keymap?: BluetoothRemoteGATTCharacteristic;
    cmd?: BluetoothRemoteGATTCharacteristic;
  };
}

export interface ButtonConfig {
  id: number;
  label: string;
  action: string;
  color: string;
  isDirty?: boolean;
}

export interface DeviceInfo {
  protocol_version: number;
  firmware_major: number;
  firmware_minor: number;
  firmware_patch: number;
  num_buttons: number;
  battery_level: number;
  uptime_seconds: number;
  free_heap: number;
  device_name: string;
}

type CommandMethod = (device: BleDevice, command: number, payload?: Uint8Array) => Promise<Uint8Array | null>;

interface ParsedResponse {
  command: number;
  error: number;
  payload?: Uint8Array;
}

interface UseBleReturn {
  // Connection state
  isAvailable: boolean;
  isConnected: boolean;
  isFullyConnected: boolean;
  isScanning: boolean;
  connectionStage: string;
  error: string | null;

  // Device config
  buttons: ButtonConfig[];
  isLoading: boolean;
  isDirty: boolean;
  lastSaved: Date | null;
  deviceInfo: DeviceInfo | null;

  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  updateButton: (index: number, config: Partial<ButtonConfig>) => void;
  saveConfig: () => Promise<void>;
  resetConfig: () => Promise<void>;
  getDeviceInfo: () => Promise<void>;
  testCommunication: () => Promise<void>;
  testButtonPress: (buttonId: number) => Promise<void>;
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

const calculateChecksum = (data: Uint8Array): number => {
  return data.reduce((checksum, byte) => checksum ^ byte, 0);
};

const createEmptyButton = (id: number): ButtonConfig => ({
  id,
  label: `Button ${id + 1}`,
  action: '',
  color: '#607D8B',
  isDirty: false
});

const buildCommand = (command: number, payload?: Uint8Array): Uint8Array => {
  const payloadLen = payload?.length || 0;
  const packet = new Uint8Array(4 + payloadLen + 1);

  let pos = 0;
  packet[pos++] = BLE_CONFIG.PROTOCOL.MAGIC_BYTE1;
  packet[pos++] = BLE_CONFIG.PROTOCOL.MAGIC_BYTE2;
  packet[pos++] = command;
  packet[pos++] = payloadLen;

  if (payload && payloadLen > 0) {
    packet.set(payload, pos);
    pos += payloadLen;
  }

  packet[pos] = calculateChecksum(packet.slice(0, pos));
  return packet;
};

const parseResponse = (data: Uint8Array): ParsedResponse | null => {
  if (data.length < 5) {
    console.error('[useBle] Response too short:', data.length);
    return null;
  }

  // Chercher les magic bytes dans les données
  let startIndex = -1;
  for (let i = 0; i <= data.length - 4; i++) {
    if (data[i] === BLE_CONFIG.PROTOCOL.MAGIC_BYTE1 && data[i + 1] === BLE_CONFIG.PROTOCOL.MAGIC_BYTE2) {
      startIndex = i;
      break;
    }
  }

  if (startIndex === -1) {
    console.error('[useBle] No magic bytes found');
    return null;
  }

  const adjustedData = data.slice(startIndex);
  if (adjustedData.length < 5) {
    console.error('[useBle] Adjusted data too short');
    return null;
  }

  const command = adjustedData[2];
  const length = adjustedData[3];
  const expectedLen = 4 + length + 1;

  if (adjustedData.length < expectedLen) {
    console.error('[useBle] Not enough data after magic bytes');
    return null;
  }

  const responseData = adjustedData.slice(0, expectedLen);
  const receivedChecksum = responseData[responseData.length - 1];
  const calculatedChecksum = calculateChecksum(responseData.slice(0, responseData.length - 1));

  if (receivedChecksum !== calculatedChecksum) {
    console.error('[useBle] Checksum validation failed');
    return null;
  }

  const error = responseData[4];
  const payload = length > 1 ? responseData.slice(5, 4 + length) : undefined;

  return { command, error, payload };
};

// Key mappings
const KEY_MAP: Record<number, string> = {
  0x04: 'A', 0x05: 'B', 0x06: 'C', 0x07: 'D', 0x08: 'E', 0x09: 'F',
  0x0A: 'G', 0x0B: 'H', 0x0C: 'I', 0x0D: 'J', 0x0E: 'K', 0x0F: 'L',
  0x10: 'M', 0x11: 'N', 0x12: 'O', 0x13: 'P', 0x14: 'Q', 0x15: 'R',
  0x16: 'S', 0x17: 'T', 0x18: 'U', 0x19: 'V', 0x1A: 'W', 0x1B: 'X',
  0x1C: 'Y', 0x1D: 'Z', 0x1E: '1', 0x1F: '2', 0x20: '3', 0x21: '4',
  0x22: '5', 0x23: '6', 0x24: '7', 0x25: '8', 0x26: '9', 0x27: '0',
  0x28: 'ENTER', 0x29: 'ESCAPE', 0x2A: 'BACKSPACE', 0x2B: 'TAB',
  0x2C: 'SPACE', 0x39: 'CAPS_LOCK',
  0x3A: 'F1', 0x3B: 'F2', 0x3C: 'F3', 0x3D: 'F4', 0x3E: 'F5', 0x3F: 'F6',
  0x40: 'F7', 0x41: 'F8', 0x42: 'F9', 0x43: 'F10', 0x44: 'F11', 0x45: 'F12',
  0x68: 'F13', 0x69: 'F14', 0x6A: 'F15', 0x6B: 'F16', 0x6C: 'F17', 0x6D: 'F18',
  0x6E: 'F19', 0x6F: 'F20', 0x70: 'F21', 0x71: 'F22', 0x72: 'F23', 0x73: 'F24',
  0x4F: 'RIGHT', 0x50: 'LEFT', 0x51: 'DOWN', 0x52: 'UP',
};

const MEDIA_MAP: Record<number, string> = {
  0xCD: 'MEDIA_PLAY_PAUSE',
  0xB5: 'MEDIA_NEXT',
  0xB6: 'MEDIA_PREV',
  0xB7: 'MEDIA_STOP',
  0xE9: 'VOLUME_UP',
  0xEA: 'VOLUME_DOWN',
  0xE2: 'VOLUME_MUTE',
};

const KEY_REVERSE_MAP = Object.fromEntries(
    Object.entries(KEY_MAP).map(([code, name]) => [name, parseInt(code)])
);

const MEDIA_REVERSE_MAP = Object.fromEntries(
    Object.entries(MEDIA_MAP).map(([code, name]) => [name, parseInt(code)])
);

const getKeyName = (keyCode: number): string => KEY_MAP[keyCode] || `0x${keyCode.toString(16).toUpperCase()}`;
const getMediaActionName = (keyCode: number): string => MEDIA_MAP[keyCode] || `MEDIA_0x${keyCode.toString(16).toUpperCase()}`;

// ========================================
// MAIN HOOK
// ========================================

const useBle = (): UseBleReturn => {
  // ========================================
  // STATE
  // ========================================

  // Connection state
  const [isAvailable, setIsAvailable] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isFullyConnected, setIsFullyConnected] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [connectionStage, setConnectionStage] = useState<string>('Disconnected');
  const [error, setError] = useState<string | null>(null);
  const [bleDevice, setBleDevice] = useState<BleDevice | null>(null);

  // Config state
  const [buttons, setButtons] = useState<ButtonConfig[]>(
      Array.from({ length: 15 }, (_, i) => createEmptyButton(i))
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);

  // Refs
  const connectingRef = useRef<boolean>(false);
  const loadingConfigRef = useRef<boolean>(false);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const workingCommandMethodRef = useRef<CommandMethod | null>(null);

  // ========================================
  // CORE COMMUNICATION
  // ========================================

  const sendCommandStrict = useCallback(async (device: BleDevice, command: number, payload?: Uint8Array): Promise<Uint8Array | null> => {
    if (!device.characteristics.cmd) {
      throw new Error('Command characteristic not available');
    }

    console.log(`[useBle] Sending command: 0x${command.toString(16).padStart(2, '0')}`);

    const packet = buildCommand(command, payload);

    try {
      // Step 1: Write command
      await device.characteristics.cmd.writeValue(packet);
      console.log('[useBle] Command written');

      // Step 2: Wait for ESP32 processing
      await delay(BLE_CONFIG.TIMING.ESP32_PROCESSING_DELAY);

      // Step 3: Read response
      const dataView = await device.characteristics.cmd.readValue();
      const response = new Uint8Array(dataView.buffer);

      if (response.length >= 5 && response[0] === BLE_CONFIG.PROTOCOL.MAGIC_BYTE1 && response[1] === BLE_CONFIG.PROTOCOL.MAGIC_BYTE2) {
        console.log('[useBle] Valid response received');
        return response;
      }

      if (response.length === 0) {
        console.log('[useBle] Empty response, retrying...');
        await delay(BLE_CONFIG.TIMING.RETRY_DELAY);

        const retryDataView = await device.characteristics.cmd.readValue();
        const retryResponse = new Uint8Array(retryDataView.buffer);

        if (retryResponse.length >= 5 && retryResponse[0] === BLE_CONFIG.PROTOCOL.MAGIC_BYTE1 && retryResponse[1] === BLE_CONFIG.PROTOCOL.MAGIC_BYTE2) {
          console.log('[useBle] Retry successful');
          return retryResponse;
        }
      }

      console.log('[useBle] No valid response after retry');
      return null;

    } catch (err) {
      console.error('[useBle] Command failed:', err);
      throw err;
    }
  }, []);

  // ========================================
  // DEVICE INFO & COMMUNICATION TESTING
  // ========================================

  const testCommunication = useCallback(async (device: BleDevice): Promise<boolean> => {
    console.log('[useBle] Testing communication...');

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
            // Utiliser les valeurs correctes dans l'ordre approprié depuis le payload
            uptime_seconds: parsed.payload.length > 8 ? new DataView(parsed.payload.buffer).getUint32(6, true) : 0,
            free_heap: parsed.payload.length > 12 ? new DataView(parsed.payload.buffer).getUint32(10, true) : 0,
            device_name: parsed.payload.length > 16 ?
                new TextDecoder().decode(parsed.payload.slice(16, 32)).replace(/\0.*$/, '') || 'mDeck' : 'mDeck'
          };

          console.log('[useBle] Communication successful, device info:', info);
          setDeviceInfo(info);
          workingCommandMethodRef.current = sendCommandStrict;
          return true;
        }
      }

      console.log('[useBle] Communication failed');
      return false;
    } catch (err) {
      console.error('[useBle] Communication test failed:', err);
      return false;
    }
  }, [sendCommandStrict]);

  // ========================================
  // CONFIGURATION MANAGEMENT
  // ========================================

  const parseButtonData = useCallback((buttonData: Uint8Array, buttonId: number): ButtonConfig => {
    if (buttonData.length < 16) {
      console.warn(`[useBle] Button ${buttonId} data too short`);
      return createEmptyButton(buttonId);
    }

    const actionType = buttonData[1];
    const keyCode = buttonData[2];
    const r = buttonData[4];
    const g = buttonData[5];
    const b = buttonData[6];

    const labelBytes = buttonData.slice(8, 16);
    let label = '';
    for (let j = 0; j < labelBytes.length; j++) {
      if (labelBytes[j] === 0) break;
      label += String.fromCharCode(labelBytes[j]);
    }

    let action = '';
    switch (actionType) {
      case ACTION_TYPES.KEY:
        action = `KEY_${getKeyName(keyCode)}`;
        break;
      case ACTION_TYPES.MEDIA:
        action = getMediaActionName(keyCode);
        break;
      case ACTION_TYPES.MACRO:
        action = 'MACRO';
        break;
      case ACTION_TYPES.CUSTOM:
        action = 'CUSTOM';
        break;
      default:
        action = 'UNKNOWN';
    }

    const color = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;

    return {
      id: buttonId,
      label: label || `Button ${buttonId + 1}`,
      action,
      color,
      isDirty: false
    };
  }, []);

  const buildButtonPayload = useCallback((button: ButtonConfig, buttonIndex: number): Uint8Array => {
    // Convert color hex to RGB
    const colorHex = button.color.replace('#', '');
    const r = parseInt(colorHex.substr(0, 2), 16);
    const g = parseInt(colorHex.substr(2, 2), 16);
    const b = parseInt(colorHex.substr(4, 2), 16);

    let actionType: number = ACTION_TYPES.KEY;
    let keyCode = 0x04;
    const modifier = 0;

    if (button.action.startsWith('MEDIA_')) {
      actionType = ACTION_TYPES.MEDIA;
      keyCode = MEDIA_REVERSE_MAP[button.action] || 0xCD;
    } else if (button.action.startsWith('KEY_')) {
      actionType = ACTION_TYPES.KEY;
      const keyName = button.action.replace('KEY_', '');
      keyCode = KEY_REVERSE_MAP[keyName] || 0x04;
    }

    const payload = new Uint8Array(16);
    payload[0] = buttonIndex;
    payload[1] = actionType;
    payload[2] = keyCode;
    payload[3] = modifier;
    payload[4] = r;
    payload[5] = g;
    payload[6] = b;
    payload[7] = 0;

    // Label (8 bytes, null-terminated)
    const labelBytes = new TextEncoder().encode(button.label.slice(0, 7));
    payload.set(labelBytes, 8);

    return payload;
  }, []);

  const saveButtonToDevice = useCallback(async (buttonIndex: number) => {
    if (!isFullyConnected || buttonIndex < 0 || buttonIndex >= 15 || !workingCommandMethodRef.current) {
      console.error('[useBle] Cannot save button - invalid state');
      return;
    }

    try {
      console.log(`[useBle] Saving button ${buttonIndex}...`);
      const button = buttons[buttonIndex];
      if (!button) return;

      const payload = buildButtonPayload(button, buttonIndex);
      const response = await workingCommandMethodRef.current(bleDevice!, COMMANDS.SET_BUTTON, payload);

      if (response) {
        const parsed = parseResponse(response);
        if (parsed && parsed.error === ERRORS.NONE) {
          console.log(`[useBle] Button ${buttonIndex} saved successfully`);

          setButtons(prevButtons => {
            const newButtons = [...prevButtons];
            newButtons[buttonIndex] = { ...newButtons[buttonIndex], isDirty: false };
            return newButtons;
          });

          setLastSaved(new Date());

          const stillDirty = buttons.some((btn, idx) => idx !== buttonIndex && btn.isDirty);
          if (!stillDirty) {
            setIsDirty(false);
          }
        } else {
          throw new Error(`Save failed with error code: ${parsed?.error}`);
        }
      }
    } catch (err) {
      console.error(`[useBle] Failed to save button ${buttonIndex}:`, err);
      setError(`Save failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [isFullyConnected, buttons, bleDevice, buildButtonPayload]);

  // ========================================
  // CONNECTION MANAGEMENT
  // ========================================

  const cleanupConnection = useCallback(() => {
    console.log('[useBle] Cleaning up connection...');
    setIsConnected(false);
    setIsFullyConnected(false);
    setConnectionStage('Disconnected');
    setBleDevice(null);
    setDeviceInfo(null);
    workingCommandMethodRef.current = null;
    connectingRef.current = false;
    loadingConfigRef.current = false;
  }, []);

  const handleDisconnection = useCallback((device: BluetoothDevice) => {
    console.log(`[useBle] Device disconnected: ${device.name}`);
    cleanupConnection();
  }, [cleanupConnection]);

  const connectToServices = useCallback(async (device: BluetoothDevice) => {
    try {
      setError(null);
      setConnectionStage('Connecting to GATT...');

      const server = await device.gatt!.connect();
      console.log('[useBle] GATT connected');

      setConnectionStage('Waiting for ESP32...');
      await delay(BLE_CONFIG.TIMING.CONNECTION_WAIT);

      setConnectionStage('Discovering services...');
      const armdeckService = await server.getPrimaryService(BLE_CONFIG.SERVICES.ARMDECK);
      console.log('[useBle] ArmDeck service found');

      setConnectionStage('Getting characteristics...');
      const characteristics: BleDevice['characteristics'] = {};

      try {
        characteristics.keymap = await armdeckService.getCharacteristic(BLE_CONFIG.CHARACTERISTICS.KEYMAP);
        console.log('[useBle] Keymap characteristic found');
      } catch (e) {
        console.warn('[useBle] Keymap characteristic not found');
      }

      characteristics.cmd = await armdeckService.getCharacteristic(BLE_CONFIG.CHARACTERISTICS.COMMAND);
      console.log('[useBle] Command characteristic found');

      const newBleDevice: BleDevice = {
        device,
        server,
        armdeckService,
        characteristics
      };

      // Définir la méthode de commande immédiatement
      const commandMethod = sendCommandStrict;
      workingCommandMethodRef.current = commandMethod;

      setBleDevice(newBleDevice);

      if (characteristics.cmd) {
        setIsConnected(true);
        setIsFullyConnected(true);
        setConnectionStage('Fully Connected');

        // Fonction locale pour charger la configuration
        const loadConfigWithDevice = async (deviceInfo: DeviceInfo | null) => {
          if (loadingConfigRef.current) return;

          loadingConfigRef.current = true;
          setIsLoading(true);
          setError(null);

          try {
            const loadedButtons: ButtonConfig[] = [];
            const numButtons = deviceInfo?.num_buttons || 15;

            for (let i = 0; i < numButtons; i++) {
              try {
                const payload = new Uint8Array([i]);
                const response = await commandMethod(newBleDevice, COMMANDS.GET_BUTTON, payload);

                if (response) {
                  const parsed = parseResponse(response);
                  if (parsed && parsed.error === ERRORS.NONE && parsed.payload) {
                    const button = parseButtonData(parsed.payload, i);
                    loadedButtons.push(button);
                  } else {
                    loadedButtons.push(createEmptyButton(i));
                  }
                } else {
                  loadedButtons.push(createEmptyButton(i));
                }

                await delay(100);
              } catch (err) {
                loadedButtons.push(createEmptyButton(i));
              }
            }

            // S'assurer du bon nombre de boutons
            while (loadedButtons.length < numButtons) {
              loadedButtons.push(createEmptyButton(loadedButtons.length));
            }

            setButtons(loadedButtons);
            setIsDirty(false);
            setLastSaved(new Date());
          } catch (err) {
            console.error('[useBle] Failed to load config:', err);
            setError(`Failed to load config: ${err instanceof Error ? err.message : String(err)}`);

            // En cas d'erreur, utiliser des boutons par défaut
            const defaultButtons = Array.from({ length: deviceInfo?.num_buttons || 15 }, (_, i) => createEmptyButton(i));
            setButtons(defaultButtons);
          } finally {
            setIsLoading(false);
            loadingConfigRef.current = false;
          }
        };

        setTimeout(async () => {
          try {
            await delay(BLE_CONFIG.TIMING.SETUP_DELAY);
            const success = await testCommunication(newBleDevice);

            if (success) {
              console.log('[useBle] Communication established, loading configuration...');
              await loadConfigWithDevice(deviceInfo);
            } else {
              setError('Cannot communicate with ESP32');
            }
          } catch (err) {
            console.error('[useBle] Setup failed:', err);
            setError(`Setup failed: ${err instanceof Error ? err.message : String(err)}`);
          }
        }, 1000);
      } else {
        throw new Error('Required characteristics not found');
      }

    } catch (err) {
      console.error('[useBle] Connection failed:', err);
      setIsConnected(false);
      setIsFullyConnected(false);
      setConnectionStage('Connection Failed');
      setError(`Connection error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      connectingRef.current = false;
    }
  }, [testCommunication, parseButtonData, sendCommandStrict, deviceInfo]);

  // ========================================
  // PUBLIC API METHODS
  // ========================================

  const connect = useCallback(async () => {
    if (!navigator.bluetooth) {
      setError('Web Bluetooth not available');
      return;
    }

    if (connectingRef.current) {
      console.log('[useBle] Connection already in progress');
      return;
    }

    connectingRef.current = true;
    setIsScanning(true);
    setError(null);
    setConnectionStage('Scanning...');

    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { name: 'ArmDeck' },
          { namePrefix: 'ArmDeck' },
          { services: [BLE_CONFIG.SERVICES.DEVICE_INFO] }
        ],
        optionalServices: [
          BLE_CONFIG.SERVICES.DEVICE_INFO,
          BLE_CONFIG.SERVICES.ARMDECK,
          '00001812-0000-1000-8000-00805f9b34fb',
          '0000180f-0000-1000-8000-00805f9b34fb'
        ]
      });

      console.log('[useBle] Device selected:', device.name);
      device.addEventListener('gattserverdisconnected', () => handleDisconnection(device));

      await connectToServices(device);

    } catch (err) {
      console.error('[useBle] Connection failed:', err);
      setConnectionStage('Connection Failed');

      if (err instanceof Error) {
        if (err.message.includes('cancelled')) {
          setError('Connection cancelled by user');
        } else {
          setError(`Connection error: ${err.message}`);
        }
      }
    } finally {
      setIsScanning(false);
      connectingRef.current = false;
    }
  }, [handleDisconnection, connectToServices]);

  const disconnect = useCallback(() => {
    console.log('[useBle] Disconnect requested');
    if (bleDevice?.server?.connected) {
      try {
        bleDevice.server.disconnect();
      } catch (e) {
        console.warn('[useBle] Disconnect error:', e);
      }
    }
    cleanupConnection();
  }, [bleDevice, cleanupConnection]);

  const updateButton = useCallback((index: number, config: Partial<ButtonConfig>) => {
    if (index < 0 || index >= 15) {
      console.error('[useBle] Invalid button index:', index);
      return;
    }

    setButtons(prevButtons => {
      const newButtons = [...prevButtons];
      newButtons[index] = { ...newButtons[index], ...config, isDirty: true };
      return newButtons;
    });

    setIsDirty(true);

    // Auto-save
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    if (isFullyConnected) {
      autoSaveTimeoutRef.current = setTimeout(() => {
        saveButtonToDevice(index);
      }, BLE_CONFIG.TIMING.AUTO_SAVE_TIMEOUT);
    }
  }, [isFullyConnected, saveButtonToDevice]);

  const saveConfig = useCallback(async () => {
    if (!isFullyConnected) {
      setError('Device not fully connected');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const dirtyButtons = buttons
          .map((button, index) => ({ button, index }))
          .filter(({ button }) => button.isDirty);

      if (dirtyButtons.length === 0) {
        console.log('[useBle] No changes to save');
        setIsLoading(false);
        return;
      }

      console.log(`[useBle] Saving ${dirtyButtons.length} modified buttons...`);

      for (const { index } of dirtyButtons) {
        await saveButtonToDevice(index);
        await delay(BLE_CONFIG.TIMING.BUTTON_SAVE_DELAY);
      }

      setIsDirty(false);
      setLastSaved(new Date());
      console.log('[useBle] All changes saved successfully');

    } catch (err) {
      console.error('[useBle] Save failed:', err);
      setError(`Save failed: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [isFullyConnected, buttons, saveButtonToDevice]);

  const resetConfig = useCallback(async () => {
    if (!isFullyConnected || !workingCommandMethodRef.current) {
      setError('Device not fully connected');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('[useBle] Resetting configuration...');

      const response = await workingCommandMethodRef.current(bleDevice!, COMMANDS.RESET_CONFIG);

      if (response) {
        const parsed = parseResponse(response);
        if (parsed && parsed.error === ERRORS.NONE) {
          setButtons(Array.from({ length: 15 }, (_, i) => createEmptyButton(i)));
          setIsDirty(false);
          setLastSaved(new Date());
          console.log('[useBle] Configuration reset successfully');
        } else {
          throw new Error(`Reset failed with error code: ${parsed?.error}`);
        }
      }
    } catch (err) {
      console.error('[useBle] Reset failed:', err);
      setError(`Reset failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  }, [isFullyConnected, bleDevice]);

  const getDeviceInfo = useCallback(async () => {
    if (!isFullyConnected || !workingCommandMethodRef.current) {
      console.log('[useBle] Device not fully connected');
      return;
    }

    try {
      console.log('[useBle] Getting device info...');
      const response = await workingCommandMethodRef.current(bleDevice!, COMMANDS.GET_INFO);

      if (response) {
        const parsed = parseResponse(response);
        if (parsed && parsed.error === ERRORS.NONE && parsed.payload) {
          const info: DeviceInfo = {
            protocol_version: parsed.payload[0],
            firmware_major: parsed.payload[1],
            firmware_minor: parsed.payload[2],
            firmware_patch: parsed.payload[3],
            num_buttons: parsed.payload[4],
            battery_level: parsed.payload[5],
            uptime_seconds: new DataView(parsed.payload.buffer).getUint32(6, true),
            free_heap: new DataView(parsed.payload.buffer).getUint32(10, true),
            device_name: new TextDecoder().decode(parsed.payload.slice(16, 32)).replace(/\0.*$/, '') || 'mDeck'
          };

          setDeviceInfo(info);
          console.log('[useBle] Device info received:', info);
        }
      }
    } catch (err) {
      console.error('[useBle] Failed to get device info:', err);
    }
  }, [isFullyConnected, bleDevice]);

  const testCommunicationPublic = useCallback(async () => {
    if (!bleDevice?.characteristics.cmd) {
      console.log('[useBle] No command characteristic available');
      return;
    }

    try {
      console.log('[useBle] Testing basic communication...');
      const testData = new Uint8Array([0x42, 0x43, 0x44]);

      await bleDevice.characteristics.cmd.writeValue(testData);
      console.log('[useBle] Test data sent successfully');

      await delay(200);
      try {
        const response = await bleDevice.characteristics.cmd.readValue();
        const responseArray = new Uint8Array(response.buffer);
        console.log('[useBle] Test response:', responseArray);

        if (responseArray.length === 0) {
          console.log('[useBle] ESP32 responded with empty data - this is expected');
        }
      } catch (readError) {
        console.log('[useBle] No response data - this is normal');
      }
    } catch (err) {
      console.error('[useBle] Communication test failed:', err);
    }
  }, [bleDevice]);

  const testButtonPress = useCallback(async (buttonId: number) => {
    if (!bleDevice?.characteristics.cmd || buttonId < 0 || buttonId >= 15) {
      console.log('[useBle] Invalid button test request');
      return;
    }

    try {
      console.log(`[useBle] Testing button ${buttonId} press...`);
      const testData = new Uint8Array([0xFF, buttonId]);

      await bleDevice.characteristics.cmd.writeValue(testData);
      console.log(`[useBle] Button ${buttonId} test sent`);
    } catch (err) {
      console.error(`[useBle] Button ${buttonId} test failed:`, err);
    }
  }, [bleDevice]);

  // ========================================
  // EFFECTS & INITIALIZATION
  // ========================================

  // Check Web Bluetooth availability
  useEffect(() => {
    setIsAvailable(!!navigator.bluetooth);
    if (!navigator.bluetooth) {
      setError('Web Bluetooth not available');
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  // ========================================
  // RETURN API
  // ========================================

  return {
    // Connection state
    isAvailable,
    isConnected,
    isFullyConnected,
    isScanning,
    connectionStage,
    error,

    // Device config
    buttons,
    isLoading,
    isDirty,
    lastSaved,
    deviceInfo,

    // Actions
    connect,
    disconnect,
    updateButton,
    saveConfig,
    resetConfig,
    getDeviceInfo,
    testCommunication: testCommunicationPublic,
    testButtonPress,
  };
};

export default useBle;
