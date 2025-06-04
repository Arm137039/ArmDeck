import { useState, useCallback, useEffect, useRef } from 'react';
import { BleDevice, ButtonConfig, DeviceInfo, UseBleReturn, CommandMethod } from './types';
import { BLE_CONFIG, COMMANDS, ERRORS } from './constants';
import { createEmptyButton, parseButtonData, buildButtonPayload, parseResponse, delay } from './utils';
import { sendCommandStrict, testCommunication, testBasicCommunication, testButtonPress } from './communication';

const useBle = (): UseBleReturn => {
  // ========================================
  // STATE
  // ========================================
  const [isAvailable, setIsAvailable] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isFullyConnected, setIsFullyConnected] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [connectionStage, setConnectionStage] = useState<string>('Disconnected');
  const [error, setError] = useState<string | null>(null);
  const [bleDevice, setBleDevice] = useState<BleDevice | null>(null);

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
  // CONFIG MANAGEMENT
  // ========================================
  const saveButtonToDevice = useCallback(async (buttonIndex: number) => {
    if (!isFullyConnected || buttonIndex < 0 || buttonIndex >= 15 || !workingCommandMethodRef.current) {
      console.error('[BLE] Cannot save button - invalid state');
      return;
    }

    try {
      console.log(`[BLE] Saving button ${buttonIndex}...`);
      const button = buttons[buttonIndex];
      if (!button) return;

      const payload = buildButtonPayload(button, buttonIndex);
      const response = await workingCommandMethodRef.current(bleDevice!, COMMANDS.SET_BUTTON, payload);

      if (response) {
        const parsed = parseResponse(response);
        if (parsed && parsed.error === ERRORS.NONE) {
          console.log(`[BLE] Button ${buttonIndex} saved successfully`);

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
      console.error(`[BLE] Failed to save button ${buttonIndex}:`, err);
      setError(`Save failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [isFullyConnected, buttons, bleDevice]);

  const loadConfiguration = useCallback(async (device: BleDevice, deviceInfo: DeviceInfo | null) => {
    if (loadingConfigRef.current) return;

    loadingConfigRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      // Initialiser un tableau avec des boutons "en attente" pour visualiser le chargement
      const numButtons = deviceInfo?.num_buttons || 15;
      setButtons(Array.from({ length: numButtons }, (_, i) => ({
        ...createEmptyButton(i),
        isLoading: true,  // Nouvel état pour indiquer qu'un bouton est en cours de chargement
      })));

      for (let i = 0; i < numButtons; i++) {
        try {
          const payload = new Uint8Array([i]);
          const response = await sendCommandStrict(device, COMMANDS.GET_BUTTON, payload);

          let newButton;
          if (response) {
            const parsed = parseResponse(response);
            if (parsed && parsed.error === ERRORS.NONE && parsed.payload) {
              newButton = parseButtonData(parsed.payload, i);
            } else {
              newButton = createEmptyButton(i);
            }
          } else {
            newButton = createEmptyButton(i);
          }

          // Mettre à jour le bouton individuellement dans l'état
          setButtons(prevButtons => {
            const updatedButtons = [...prevButtons];
            updatedButtons[i] = { ...newButton, isLoading: false };
            return updatedButtons;
          });

          // Courte pause entre chaque requête pour ne pas surcharger l'ESP
          await delay(50);
        } catch (err) {
          console.error(`[BLE] Erreur lors du chargement du bouton ${i}:`, err);

          // Mettre à jour l'état du bouton en erreur
          setButtons(prevButtons => {
            const updatedButtons = [...prevButtons];
            updatedButtons[i] = {
              ...createEmptyButton(i),
              isLoading: false,
              label: `Erreur btn ${i+1}`
            };
            return updatedButtons;
          });
        }
      }

      setIsDirty(false);
      setLastSaved(new Date());
    } catch (err) {
      console.error('[BLE] Failed to load config:', err);
      setError(`Failed to load config: ${err instanceof Error ? err.message : String(err)}`);

      // Réinitialiser tous les boutons en cas d'erreur globale
      setButtons(Array.from({ length: deviceInfo?.num_buttons || 15 }, (_, i) => createEmptyButton(i)));
    } finally {
      setIsLoading(false);
      loadingConfigRef.current = false;
    }
  }, []);

  const fetchButtonConfiguration = useCallback(async () => {
    if (!bleDevice || !deviceInfo) return;
    await loadConfiguration(bleDevice, deviceInfo);
  }, [bleDevice, deviceInfo, loadConfiguration]);

  // ========================================
  // CONNECTION MANAGEMENT
  // ========================================
  const cleanupConnection = useCallback(() => {
    console.log('[BLE] Cleaning up connection...');
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
    console.log(`[BLE] Device disconnected: ${device.name}`);
    cleanupConnection();
  }, [cleanupConnection]);

  const connectToServices = useCallback(async (device: BluetoothDevice) => {
    try {
      setError(null);
      setConnectionStage('Connecting to GATT...');

      const server = await device.gatt!.connect();
      console.log('[BLE] GATT connected');

      setConnectionStage('Waiting for ESP32...');
      await delay(BLE_CONFIG.TIMING.CONNECTION_WAIT);

      setConnectionStage('Discovering services...');
      const armdeckService = await server.getPrimaryService(BLE_CONFIG.SERVICES.ARMDECK);
      console.log('[BLE] ArmDeck service found');

      setConnectionStage('Getting characteristics...');
      const characteristics: BleDevice['characteristics'] = {};

      try {
        characteristics.keymap = await armdeckService.getCharacteristic(BLE_CONFIG.CHARACTERISTICS.KEYMAP);
        console.log('[BLE] Keymap characteristic found');
      } catch (e) {
        console.warn('[BLE] Keymap characteristic not found');
      }

      characteristics.cmd = await armdeckService.getCharacteristic(BLE_CONFIG.CHARACTERISTICS.COMMAND);
      console.log('[BLE] Command characteristic found');

      const newBleDevice: BleDevice = {
        device,
        server,
        armdeckService,
        characteristics
      };

      workingCommandMethodRef.current = sendCommandStrict;
      setBleDevice(newBleDevice);

      if (characteristics.cmd) {
        setIsConnected(true);
        setIsFullyConnected(true);
        setConnectionStage('Fully Connected');

        setTimeout(async () => {
          try {
            await delay(BLE_CONFIG.TIMING.SETUP_DELAY);
            const result = await testCommunication(newBleDevice);

            if (result.success) {
              console.log('[BLE] Communication established, loading configuration...');
              setDeviceInfo(result.deviceInfo || null);
              await loadConfiguration(newBleDevice, result.deviceInfo || null);
            } else {
              setError('Cannot communicate with ESP32');
            }
          } catch (err) {
            console.error('[BLE] Setup failed:', err);
            setError(`Setup failed: ${err instanceof Error ? err.message : String(err)}`);
          }
        }, 1000);
      } else {
        throw new Error('Required characteristics not found');
      }

    } catch (err) {
      console.error('[BLE] Connection failed:', err);
      setIsConnected(false);
      setIsFullyConnected(false);
      setConnectionStage('Connection Failed');
      setError(`Connection error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      connectingRef.current = false;
    }
  }, [loadConfiguration]);

  // ========================================
  // PUBLIC API METHODS
  // ========================================
  const connect = useCallback(async () => {
    if (!navigator.bluetooth) {
      setError('Web Bluetooth not available');
      return;
    }

    if (connectingRef.current) {
      console.log('[BLE] Connection already in progress');
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

      console.log('[BLE] Device selected:', device.name);
      device.addEventListener('gattserverdisconnected', () => handleDisconnection(device));

      await connectToServices(device);

    } catch (err) {
      console.error('[BLE] Connection failed:', err);
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
    console.log('[BLE] Disconnect requested');
    if (bleDevice?.server?.connected) {
      try {
        bleDevice.server.disconnect();
      } catch (e) {
        console.warn('[BLE] Disconnect error:', e);
      }
    }
    cleanupConnection();
  }, [bleDevice, cleanupConnection]);

  const updateButton = useCallback((index: number, config: Partial<ButtonConfig>) => {
    if (index < 0 || index >= 15) {
      console.error('[BLE] Invalid button index:', index);
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
        console.log('[BLE] No changes to save');
        setIsLoading(false);
        return;
      }

      console.log(`[BLE] Saving ${dirtyButtons.length} modified buttons...`);

      for (const { index } of dirtyButtons) {
        await saveButtonToDevice(index);
        await delay(BLE_CONFIG.TIMING.BUTTON_SAVE_DELAY);
      }

      setIsDirty(false);
      setLastSaved(new Date());
      console.log('[BLE] All changes saved successfully');

    } catch (err) {
      console.error('[BLE] Save failed:', err);
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
      console.log('[BLE] Resetting configuration...');

      const response = await workingCommandMethodRef.current(bleDevice!, COMMANDS.RESET_CONFIG);

      if (response) {
        const parsed = parseResponse(response);
        if (parsed && parsed.error === ERRORS.NONE) {
          console.log('[BLE] Configuration reset successfully');

          // Récupérer la configuration mise à jour depuis le périphérique après le reset
          await fetchButtonConfiguration();

          setIsDirty(false);
          setLastSaved(new Date());
        } else {
          throw new Error(`Reset failed with error code: ${parsed?.error}`);
        }
      }
    } catch (err) {
      console.error('[BLE] Reset failed:', err);
      setError(`Reset failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  }, [isFullyConnected, bleDevice, fetchButtonConfiguration]);

  const getDeviceInfo = useCallback(async () => {
    if (!isFullyConnected || !workingCommandMethodRef.current) {
      console.log('[BLE] Device not fully connected');
      return;
    }

    try {
      console.log('[BLE] Getting device info...');
      const result = await testCommunication(bleDevice!);

      if (result.success && result.deviceInfo) {
        setDeviceInfo(result.deviceInfo);
        console.log('[BLE] Device info received:', result.deviceInfo);
      }
    } catch (err) {
      console.error('[BLE] Failed to get device info:', err);
    }
  }, [isFullyConnected, bleDevice]);

  const testCommunicationPublic = useCallback(async () => {
    if (!bleDevice) return;
    await testBasicCommunication(bleDevice);
  }, [bleDevice]);

  const testButtonPressPublic = useCallback(async (buttonId: number) => {
    if (!bleDevice) return;
    await testButtonPress(bleDevice, buttonId);
  }, [bleDevice]);

  // ========================================
  // EFFECTS & INITIALIZATION
  // ========================================
  useEffect(() => {
    setIsAvailable(!!navigator.bluetooth);
    if (!navigator.bluetooth) {
      setError('Web Bluetooth not available');
    }
  }, []);

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
    testButtonPress: testButtonPressPublic,
  };
};

export default useBle;

