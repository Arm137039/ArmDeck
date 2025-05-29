import { useState, useCallback, useEffect, useRef } from 'react';

// UUIDs
const ARMDECK_SERVICE_UUID = '7a0b1000-0000-1000-8000-00805f9b34fb';
const KEYMAP_CHARACTERISTIC_UUID = 'fb349b5f-8000-0080-0010-000001100b7a';
const COMMAND_CHARACTERISTIC_UUID = 'fb349b5f-8000-0080-0010-000002100b7a';
const DEVICE_INFO_SERVICE_UUID = '0000180a-0000-1000-8000-00805f9b34fb';

interface BleDevice {
  device: BluetoothDevice;
  server?: BluetoothRemoteGATTServer;
  deviceInfoService?: BluetoothRemoteGATTService;
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

  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  updateButton: (index: number, config: Partial<ButtonConfig>) => void;
  saveConfig: () => Promise<void>;
  resetConfig: () => Promise<void>;
}

// Configuration par défaut
const DEFAULT_BUTTONS: ButtonConfig[] = [
  { id: 0, label: 'Play/Pause', action: 'MEDIA_PLAY_PAUSE', color: '#4CAF50' },
  { id: 1, label: 'Next', action: 'MEDIA_NEXT', color: '#2196F3' },
  { id: 2, label: 'Previous', action: 'MEDIA_PREV', color: '#2196F3' },
  { id: 3, label: 'Volume +', action: 'VOLUME_UP', color: '#FF9800' },
  { id: 4, label: 'Volume -', action: 'VOLUME_DOWN', color: '#FF9800' },
  { id: 5, label: 'Mute', action: 'VOLUME_MUTE', color: '#F44336' },
  { id: 6, label: 'Stop', action: 'MEDIA_STOP', color: '#9C27B0' },
  { id: 7, label: 'F20', action: 'KEY_F20', color: '#607D8B' },
  { id: 8, label: 'F21', action: 'KEY_F21', color: '#607D8B' },
  { id: 9, label: 'F22', action: 'KEY_F22', color: '#607D8B' },
  { id: 10, label: 'F23', action: 'KEY_F23', color: '#607D8B' },
  { id: 11, label: 'F24', action: 'KEY_F24', color: '#607D8B' },
];

const useBle = (): UseBleReturn => {
  // Connection state
  const [isAvailable, setIsAvailable] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isFullyConnected, setIsFullyConnected] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [connectionStage, setConnectionStage] = useState<string>('Disconnected');
  const [error, setError] = useState<string | null>(null);
  const [bleDevice, setBleDevice] = useState<BleDevice | null>(null);

  // Config state
  const [buttons, setButtons] = useState<ButtonConfig[]>(DEFAULT_BUTTONS);
  const [isLoading, setIsLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Refs pour éviter les appels multiples
  const connectingRef = useRef<boolean>(false);
  const loadingConfigRef = useRef<boolean>(false);
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check Web Bluetooth availability
  useEffect(() => {
    setIsAvailable(!!navigator.bluetooth);
    if (!navigator.bluetooth) {
      setError('Web Bluetooth not available');
    }
  }, []);

  // Cleanup connection
  const cleanupConnection = useCallback(() => {
    console.log('🧹 [useBle] Cleaning up connection...');
    setIsConnected(false);
    setIsFullyConnected(false);
    setConnectionStage('Disconnected');
    setBleDevice(null);
    connectingRef.current = false;
    loadingConfigRef.current = false;
  }, []);

  // Handle disconnection
  const handleDisconnection = useCallback((device: BluetoothDevice) => {
    console.log(`🔌 [useBle] Device disconnected: ${device.name}`);
    cleanupConnection();
  }, [cleanupConnection]);

  // Delay utility
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Send command to device
  const sendCommand = useCallback(async (command: string) => {
    if (!bleDevice?.characteristics.cmd) {
      throw new Error('Command characteristic not available');
    }

    // 🔥 FIX: Vérifier que la connexion est encore active
    if (!bleDevice.server?.connected) {
      throw new Error('Device disconnected');
    }

    console.log('📤 [useBle] Sending command:', command);

    let data: Uint8Array;
    if (command.startsWith('0x')) {
      const hex = command.replace('0x', '');
      data = new Uint8Array([parseInt(hex, 16)]);
    } else {
      data = new TextEncoder().encode(command);
    }

    try {
      await bleDevice.characteristics.cmd.writeValue(data);
      console.log('✅ [useBle] Command sent successfully');

      // 🔥 FIX: Petite pause après l'envoi pour éviter les conflits GATT
      await delay(100);

    } catch (err) {
      console.error('❌ [useBle] Command send failed:', err);
      throw err;
    }
  }, [bleDevice]);

  // Send keymap to device
  const sendKeymap = useCallback(async (keymap: string) => {
    if (!bleDevice?.characteristics.keymap) {
      throw new Error('Keymap characteristic not available');
    }

    console.log('📤 [useBle] Sending keymap:', keymap.length, 'chars');

    const data = new TextEncoder().encode(keymap);
    console.log('📊 [useBle] Data size:', data.length, 'bytes');

    // 🔥 FIX: Si les données sont trop grandes, les découper
    if (data.length > 500) { // Limite sécurisée de 500 bytes
      console.log('⚠️ [useBle] Data too large, splitting into chunks...');

      const chunkSize = 500;
      const chunks = [];

      for (let i = 0; i < data.length; i += chunkSize) {
        chunks.push(data.slice(i, i + chunkSize));
      }

      console.log(`📦 [useBle] Split into ${chunks.length} chunks`);

      // Envoyer chaque morceau avec un délai
      for (let i = 0; i < chunks.length; i++) {
        console.log(`📤 [useBle] Sending chunk ${i + 1}/${chunks.length} (${chunks[i].length} bytes)`);
        await bleDevice.characteristics.keymap.writeValue(chunks[i]);

        // Délai entre les morceaux pour éviter les conflits GATT
        if (i < chunks.length - 1) {
          await delay(200);
        }
      }

      console.log('✅ [useBle] All chunks sent successfully');
    } else {
      // Données assez petites, envoi direct
      await bleDevice.characteristics.keymap.writeValue(data);
      console.log('✅ [useBle] Keymap sent successfully (single chunk)');
    }
  }, [bleDevice]);

  // Load configuration from device (simplifié - logique principale dans connectToServices)
  const loadConfig = useCallback(async () => {
    console.log('🔄 [useBle] loadConfig called manually with states:', {
      isFullyConnected,
      loadingConfigRef: loadingConfigRef.current,
      bleDevice: !!bleDevice
    });

    if (!isFullyConnected || loadingConfigRef.current || !bleDevice?.characteristics.cmd) {
      console.log('⚠️ [useBle] Load config skipped - not ready or already loading');
      return;
    }

    loadingConfigRef.current = true;
    setIsLoading(true);
    setError(null);

    try {
      console.log('📥 [useBle] Loading config from ESP32 (manual call)...');

      // Send READ_CONFIG command
      const data = new Uint8Array([0x50]);
      await bleDevice.characteristics.cmd.writeValue(data);
      console.log('✅ [useBle] READ_CONFIG command sent');

      // Wait for response
      await delay(1000);

      console.log('✅ [useBle] Config loaded (using defaults)');
      setButtons([...DEFAULT_BUTTONS]);
      setIsDirty(false);
      setLastSaved(new Date());

    } catch (err) {
      console.error('❌ [useBle] Failed to load config:', err);
      setError(`Failed to load config: ${err}`);
      setButtons([...DEFAULT_BUTTONS]);
    } finally {
      setIsLoading(false);
      loadingConfigRef.current = false;
    }
  }, [isFullyConnected, bleDevice]);

  // Connect to services
  const connectToServices = useCallback(async (device: BluetoothDevice) => {
    try {
      setError(null);
      setConnectionStage('Connecting to GATT...');

      const server = await device.gatt!.connect();
      console.log('✅ [useBle] GATT connected');

      setConnectionStage('Waiting for ESP32...');
      await delay(3000); // ESP32 stability wait

      setConnectionStage('Discovering services...');
      console.log('🔍 [useBle] Discovering services...');

      const characteristics: BleDevice['characteristics'] = {};
      let deviceInfoService: BluetoothRemoteGATTService | undefined;
      let armdeckService: BluetoothRemoteGATTService | undefined;

      // Get Device Info service
      try {
        deviceInfoService = await server.getPrimaryService(DEVICE_INFO_SERVICE_UUID);
        console.log('✅ [useBle] Device Info service found');
      } catch (e) {
        console.warn('❌ [useBle] Device Info service not found:', e);
      }

      // Get ArmDeck service
      try {
        armdeckService = await server.getPrimaryService(ARMDECK_SERVICE_UUID);
        console.log('✅ [useBle] ArmDeck service found');
      } catch (e) {
        console.error('❌ [useBle] ArmDeck service not found:', e);
      }

      // Get characteristics
      if (armdeckService) {
        setConnectionStage('Getting characteristics...');

        try {
          characteristics.keymap = await armdeckService.getCharacteristic(KEYMAP_CHARACTERISTIC_UUID);
          console.log('✅ [useBle] Keymap characteristic found');
        } catch (e) {
          console.warn('❌ [useBle] Keymap characteristic not found:', e);
        }

        try {
          characteristics.cmd = await armdeckService.getCharacteristic(COMMAND_CHARACTERISTIC_UUID);
          console.log('✅ [useBle] Command characteristic found');
        } catch (e) {
          console.warn('❌ [useBle] Command characteristic not found:', e);
        }
      }

      // Create device object
      const newBleDevice: BleDevice = {
        device,
        server,
        deviceInfoService,
        armdeckService,
        characteristics
      };

      setBleDevice(newBleDevice);

      // Determine connection level
      const hasKeymap = !!characteristics.keymap;
      const hasCmd = !!characteristics.cmd;
      const hasArmDeckService = !!armdeckService;

      console.log('📊 [useBle] Connection summary:', {
        deviceInfo: !!deviceInfoService,
        armdeckService: hasArmDeckService,
        keymap: hasKeymap,
        command: hasCmd
      });

      if (hasArmDeckService && hasKeymap && hasCmd) {
        console.log('🎉 [useBle] FULLY CONNECTED - All services available');

        // 🔥 FIX: Mettre à jour les états AVANT de charger la config
        setIsConnected(true);
        setIsFullyConnected(true);
        setConnectionStage('Fully Connected');

        // 🔥 FIX: Appeler loadConfig directement ici avec les vraies valeurs
        setTimeout(async () => {
          console.log('🔄 [useBle] Attempting to load config after state update...');

          if (loadingConfigRef.current) {
            console.log('⚠️ [useBle] Load config skipped - already loading');
            return;
          }

          // 🔥 FIX: Pour l'instant, on skip l'envoi de commande et on charge juste les defaults
          // Cela évite de déconnecter l'ESP32 et permet de tester le reste de l'interface
          console.log('📥 [useBle] Loading default config (skipping ESP32 command for now)...');

          setIsLoading(true);
          loadingConfigRef.current = true;

          try {
            // Attendre un peu pour simuler le chargement
            await delay(500);

            console.log('✅ [useBle] Default config loaded successfully');
            setButtons([...DEFAULT_BUTTONS]);
            setIsDirty(false);
            setLastSaved(new Date());

          } catch (err) {
            console.error('❌ [useBle] Failed to load config:', err);
            setError(`Failed to load config: ${err}`);
            setButtons([...DEFAULT_BUTTONS]);
          } finally {
            setIsLoading(false);
            loadingConfigRef.current = false;
          }
        }, 1000); // 🔥 Délai plus long pour laisser l'ESP32 se stabiliser

      } else {
        setConnectionStage('Partially Connected');
        setIsConnected(true);
        setIsFullyConnected(false);
        console.log('⚠️ [useBle] PARTIALLY CONNECTED - Limited functionality');
      }

    } catch (err) {
      console.error('❌ [useBle] Connection failed:', err);
      setIsConnected(false);
      setIsFullyConnected(false);
      setConnectionStage('Connection Failed');
      setError(`Connection error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      connectingRef.current = false;
    }
  }, [loadConfig]);

  // Connect to device
  const connect = useCallback(async () => {
    if (!navigator.bluetooth) {
      setError('Web Bluetooth not available');
      return;
    }

    if (connectingRef.current) {
      console.log('⚠️ [useBle] Connect already in progress');
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
          { services: [DEVICE_INFO_SERVICE_UUID] }
        ],
        optionalServices: [
          DEVICE_INFO_SERVICE_UUID,
          ARMDECK_SERVICE_UUID,
          '00001812-0000-1000-8000-00805f9b34fb', // HID Service
          '0000180f-0000-1000-8000-00805f9b34fb'  // Battery Service
        ]
      });

      console.log('📱 [useBle] Found device:', device.name);
      device.addEventListener('gattserverdisconnected', () => handleDisconnection(device));

      await connectToServices(device);

    } catch (err) {
      console.error('❌ [useBle] Scan failed:', err);
      setConnectionStage('Scan Failed');

      if (err instanceof Error) {
        if (err.message.includes('cancelled')) {
          setError('Connection cancelled by user');
        } else {
          setError(`Scan error: ${err.message}`);
        }
      }
    } finally {
      setIsScanning(false);
      connectingRef.current = false;
    }
  }, [handleDisconnection, connectToServices]);

  // Disconnect device
  const disconnect = useCallback(() => {
    console.log('🔌 [useBle] Disconnect requested');
    if (bleDevice?.server?.connected) {
      try {
        bleDevice.server.disconnect();
      } catch (e) {
        console.warn('Disconnect error:', e);
      }
    }
    cleanupConnection();
  }, [bleDevice, cleanupConnection]);

  // Update button configuration
  const updateButton = useCallback((index: number, config: Partial<ButtonConfig>) => {
    if (index < 0 || index >= 12) {
      console.error('❌ [useBle] Invalid button index:', index);
      return;
    }

    console.log(`🔧 [useBle] Updating button ${index}:`, config);

    setButtons(prevButtons => {
      const newButtons = [...prevButtons];
      newButtons[index] = {
        ...newButtons[index],
        ...config,
        isDirty: true
      };
      return newButtons;
    });

    setIsDirty(true);

    // Auto-save after 2 seconds
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    if (isFullyConnected) {
      autoSaveTimeoutRef.current = setTimeout(() => {
        saveConfig();
      }, 2000);
    }
  }, [isFullyConnected]);

  // Save configuration to device
  const saveConfig = useCallback(async () => {
    if (!isFullyConnected) {
      setError('Device not fully connected');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('💾 [useBle] Saving config to ESP32...');

      // 🔥 FIX: JSON plus compact - supprimer les espaces et propriétés optionnelles
      const configData = {
        v: 1, // version raccourcie
        b: buttons.map(btn => ({
          i: btn.id,
          l: btn.label,
          a: btn.action,
          c: btn.color
        }))
      };

      const jsonString = JSON.stringify(configData);
      console.log('📝 [useBle] Config JSON size:', jsonString.length, 'bytes');
      console.log('📝 [useBle] Config preview:', jsonString.substring(0, 100) + '...');

      // Try to send via keymap characteristic
      await sendKeymap(jsonString);
      await delay(500);

      setIsDirty(false);
      setLastSaved(new Date());
      console.log('✅ [useBle] Config saved successfully');

    } catch (err) {
      console.error('❌ [useBle] Save failed:', err);
      setError(`Save failed: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [isFullyConnected, buttons, sendKeymap]);

  // Reset configuration
  const resetConfig = useCallback(async () => {
    if (!isFullyConnected) {
      setError('Device not fully connected');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('🔄 [useBle] Resetting config...');

      await sendCommand('0x52'); // RESET_CONFIG
      await delay(500);

      setButtons([...DEFAULT_BUTTONS]);
      setIsDirty(false);
      setLastSaved(new Date());

      console.log('✅ [useBle] Config reset successfully');
    } catch (err) {
      console.error('❌ [useBle] Reset failed:', err);
      setError(`Reset failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  }, [isFullyConnected, sendCommand]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

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

    // Actions
    connect,
    disconnect,
    updateButton,
    saveConfig,
    resetConfig,
  };
};

export default useBle;