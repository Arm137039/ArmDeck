import { useState, useCallback, useEffect } from 'react';
import {
  ARMDECK_SERVICE_UUID,
  KEYMAP_CHARACTERISTIC_UUID,
  COMMAND_CHARACTERISTIC_UUID,
  BATTERY_CHARACTERISTIC_UUID,
  DEVICE_INFO_SERVICE_UUID
} from '../config/bleConfig';

interface BleDevice {
  device: BluetoothDevice;
  server?: BluetoothRemoteGATTServer;
  deviceInfoService?: BluetoothRemoteGATTService;
  armdeckService?: BluetoothRemoteGATTService;
  characteristics: {
    keymap?: BluetoothRemoteGATTCharacteristic;
    cmd?: BluetoothRemoteGATTCharacteristic;
    battery?: BluetoothRemoteGATTCharacteristic;
  };
}

interface BleError {
  message: string;
  operation: string;
}

interface UseBleReturn {
  isAvailable: boolean;
  isConnected: boolean;
  isScanning: boolean;
  batteryLevel: number | null;
  connectionStage: string;
  error: BleError | null;
  scanForDevices: () => Promise<void>;
  disconnectDevice: () => void;
  sendKeymap: (keymap: string) => Promise<void>;
  sendCommand: (command: string) => Promise<void>;
  readBatteryLevel: () => Promise<number>;
}

const useBle = (): UseBleReturn => {
  console.log('[WebBLE] Initializing Web Bluetooth hook...');
  const [isAvailable, setIsAvailable] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [connectionStage, setConnectionStage] = useState<string>('Disconnected');
  const [error, setError] = useState<BleError | null>(null);
  const [bleDevice, setBleDevice] = useState<BleDevice | null>(null);

  useEffect(() => {
    if (navigator.bluetooth) {
      setIsAvailable(true);
      setError(null);
    } else {
      setIsAvailable(false);
      setError({ message: 'Web Bluetooth is not available in this browser.', operation: 'init' });
    }
  }, []);

  const cleanupConnection = useCallback(() => {
    console.log('[WebBLE] cleanupConnection called.');
    if (bleDevice?.characteristics.battery) {
      try {
        console.log('[WebBLE] Stopping battery notifications...');
        bleDevice.characteristics.battery.stopNotifications().catch((e) => console.warn('[WebBLE] Error stopping battery notifications during cleanup:', e));
      } catch (e) {
        console.warn('[WebBLE] Exception stopping battery notifications during cleanup:', e);
      }
    }
    setIsConnected(false);
    setConnectionStage('Disconnected');
    setBatteryLevel(null);
  }, [bleDevice]);

  const handleDisconnection = useCallback((device: BluetoothDevice) => {
    console.log(`[WebBLE] 🔌 Device disconnected: ${device.name || 'Unknown device'}`);
    cleanupConnection();
  }, [cleanupConnection]);

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const connectToServices = useCallback(async (device: BluetoothDevice) => {
    setError(null);
    setError(null);
    console.log('[WebBLE] connectToServices: Starting connection to services for device:', device.name);
    try {
      setConnectionStage('Connecting to GATT...');

      if (!device.gatt) {
        console.error('[WebBLE] GATT not available on device:', device);
        throw new Error('GATT server is not available on the selected Bluetooth device.');
      }

      const server = await device.gatt.connect();
      console.log('[WebBLE] ✅ GATT connected');
      setConnectionStage('Connected to GATT');

      // Chrome voit les services, donc on peut être moins conservateur sur le timing
      console.log('[WebBLE] ⏳ Waiting 5 seconds for ESP32 stability...');
      setConnectionStage('Waiting for ESP32...');
      await delay(5000);

      // Découvrir les services directement car Chrome les voit déjà
      console.log('[WebBLE] 🔍 Discovering services directly...');
      setConnectionStage('Discovering services...');

      const characteristics: BleDevice['characteristics'] = {};
      let deviceInfoService: BluetoothRemoteGATTService | undefined;
      let armdeckService: BluetoothRemoteGATTService | undefined;

      // 1. Device Info service
      try {
        deviceInfoService = await server.getPrimaryService(DEVICE_INFO_SERVICE_UUID);
        console.log('[WebBLE] ✅ Device Info service found');
      } catch (e) {
        console.warn('[WebBLE] ❌ Device Info service not found:', e);
      }

      // 2. ArmDeck service - directement car Chrome le voit
      try {
        console.log('[WebBLE] 🔍 Getting ArmDeck service directly...');
        armdeckService = await server.getPrimaryService(ARMDECK_SERVICE_UUID);
        console.log('[WebBLE] ✅ ArmDeck service found!');
      } catch (e) {
        console.error('[WebBLE] ❌ ArmDeck service not found:', e);

        // Si ça échoue, essayer de lister tous les services pour debug
        try {
          console.log('[WebBLE] 🔍 Trying to list all services for debug...');
          const allServices = await server.getPrimaryServices();
          console.log(`[WebBLE] 📋 Found ${allServices.length} services:`);
          allServices.forEach((service, index) => {
            console.log(`[WebBLE]   ${index + 1}. ${service.uuid}`);
          });
        } catch (enumError) {
          console.warn('[WebBLE] ❌ Could not enumerate services:', enumError);
        }
      }

      // 3. Si on a trouvé le service ArmDeck, récupérer ses caractéristiques
      if (armdeckService) {
        console.log('[WebBLE] 🔍 Getting ArmDeck characteristics...');
        setConnectionStage('Getting characteristics...');

        try {
          // Essayer de récupérer toutes les caractéristiques directement
          console.log('[WebBLE] 🔍 Getting Keymap characteristic...');
          characteristics.keymap = await armdeckService.getCharacteristic(KEYMAP_CHARACTERISTIC_UUID);
          console.log('[WebBLE] ✅ Keymap characteristic found');
        } catch (e) {
          console.warn('[WebBLE] ❌ Keymap characteristic not found:', e);
        }

        try {
          console.log('[WebBLE] 🔍 Getting Command characteristic...');
          characteristics.cmd = await armdeckService.getCharacteristic(COMMAND_CHARACTERISTIC_UUID);
          console.log('[WebBLE] ✅ Command characteristic found');
        } catch (e) {
          console.warn('[WebBLE] ❌ Command characteristic not found:', e);
        }

        try {
          console.log('[WebBLE] 🔍 Getting Battery characteristic...');
          characteristics.battery = await armdeckService.getCharacteristic(BATTERY_CHARACTERISTIC_UUID);
          console.log('[WebBLE] ✅ Battery characteristic found');
        } catch (e) {
          console.warn('[WebBLE] ❌ Battery characteristic not found:', e);
        }

        // Si certaines caractéristiques manquent, essayer l'énumération
        const missingChars = [
          !characteristics.keymap && 'Keymap',
          !characteristics.cmd && 'Command',
          !characteristics.battery && 'Battery'
        ].filter(Boolean);

        if (missingChars.length > 0) {
          console.log(`[WebBLE] 🔍 Missing ${missingChars.join(', ')}, trying enumeration...`);
          try {
            const allCharacteristics = await armdeckService.getCharacteristics();
            console.log(`[WebBLE] 📋 Found ${allCharacteristics.length} characteristics by enumeration:`);

            allCharacteristics.forEach((char, index) => {
              console.log(`[WebBLE]   ${index + 1}. ${char.uuid}`);
              const uuid = char.uuid.toLowerCase();

              if (uuid.includes('7a0b1001') && !characteristics.keymap) {
                console.log('[WebBLE]     ✅ Mapped to Keymap');
                characteristics.keymap = char;
              } else if (uuid.includes('7a0b1002') && !characteristics.cmd) {
                console.log('[WebBLE]     ✅ Mapped to Command');
                characteristics.cmd = char;
              } else if (uuid.includes('7a0b1004') && !characteristics.battery) {
                console.log('[WebBLE]     ✅ Mapped to Battery');
                characteristics.battery = char;
              }
            });
          } catch (enumError) {
            console.warn('[WebBLE] ❌ Characteristic enumeration failed:', enumError);
          }
        }
      }

      // 4. Sauvegarder la configuration
      setBleDevice({
        device,
        server,
        deviceInfoService,
        armdeckService,
        characteristics
      });

      setIsConnected(true);

      // 5. Déterminer le niveau de connexion
      const hasKeymap = !!characteristics.keymap;
      const hasCmd = !!characteristics.cmd;
      const hasBattery = !!characteristics.battery;

      console.log('[WebBLE] 📊 Connection summary:');
      console.log(`[WebBLE]   Device Info service: ${!!deviceInfoService}`);
      console.log(`[WebBLE]   ArmDeck service: ${!!armdeckService}`);
      console.log(`[WebBLE]   Keymap characteristic: ${hasKeymap}`);
      console.log(`[WebBLE]   Command characteristic: ${hasCmd}`);
      console.log(`[WebBLE]   Battery characteristic: ${hasBattery}`);

      if (armdeckService && hasKeymap && hasCmd && hasBattery) {
        setConnectionStage('Fully Connected');
        console.log('[WebBLE] 🎉 FULL FUNCTIONALITY AVAILABLE!');
      } else if (armdeckService && (hasKeymap || hasCmd)) {
        setConnectionStage('Partially Connected');
        console.log('[WebBLE] 🎉 Partial functionality available');
      } else if (deviceInfoService) {
        setConnectionStage('Basic Connected');
        console.log('[WebBLE] 🎉 Basic connection (Device Info only)');
      } else {
        setConnectionStage('Connected (Limited)');
        console.log('[WebBLE] ⚠️ Limited connection');
      }

      // 6. Configuration batterie si disponible
      if (characteristics.battery) {
        try {
          console.log('[WebBLE] 🔋 Reading initial battery level...');
          const batteryValue = await characteristics.battery.readValue();
          const batteryPercent = batteryValue.getUint8(0);
          setBatteryLevel(batteryPercent);
          console.log('[WebBLE] 🔋 Initial battery level:', batteryPercent + '%');

          // Essayer d'activer les notifications
          try {
            await characteristics.battery.startNotifications();
            console.log('[WebBLE] ✅ Battery notifications enabled');
            characteristics.battery.addEventListener('characteristicvaluechanged', (event) => {
              const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
              if (value) {
                const level = value.getUint8(0);
                setBatteryLevel(level);
                console.log('[WebBLE] 🔋 Battery update:', level + '%');
              }
            });
          } catch (notifyError) {
            console.warn('[WebBLE] ❌ Battery notifications not supported:', notifyError);
          }
        } catch (batteryError) {
          console.warn('[WebBLE] ❌ Battery setup failed:', batteryError);
        }
      }
      console.log('[WebBLE] connectToServices: Successfully connected and set up services.');
    } catch (err) {
      console.error('[WebBLE] ❌ Connection to services failed:', err);
      setIsConnected(false);
      setConnectionStage('Connection failed');
      let message = 'Failed to connect to device services.';
      if (err instanceof Error) {
        if (err.name === 'NetworkError') {
          message = 'Network error during GATT connection. Ensure device is in range.';
        } else if (err.message.includes('GATT operation already in progress')) {
          message = 'Connection process already in progress. Please wait.';
        } else {
          message = err.message;
        }
      }
      setError({ message, operation: 'connect_services' });
    }
  }, []);

  const scanForDevices = useCallback(async () => {
    if (!navigator.bluetooth) {
      setError({ message: 'Web Bluetooth is not available in this browser.', operation: 'scan' });
      return;
    }
    setError(null);
    setError(null);
    console.log('[WebBLE] scanForDevices: Starting device scan...');
    try {
      setIsScanning(true);
      setConnectionStage('Scanning...');

      console.log('[WebBLE] 🔍 Looking for ArmDeck...');

      const device = await navigator.bluetooth.requestDevice({
        filters: [
          { name: 'ArmDeck' },
          { namePrefix: 'ArmDeck' }
        ],
        optionalServices: [
          DEVICE_INFO_SERVICE_UUID,
          ARMDECK_SERVICE_UUID
        ]
      });

      console.log('[WebBLE] 📱 Found device:', device.name);
      console.log('[WebBLE] 📱 Device ID:', device.id);

      device.addEventListener('gattserverdisconnected', () => handleDisconnection(device));

      await connectToServices(device);
      setIsScanning(false);
      console.log('[WebBLE] scanForDevices: Scan and connection attempt complete.');
    } catch (err) {
      console.error('[WebBLE] ❌ Scan failed:', err);
      setIsScanning(false);
      setConnectionStage('Scan failed');
      let message = 'Failed to scan for devices.';
      if (err instanceof Error) {
        switch (err.name) {
          case 'NotFoundError':
            message = 'No ArmDeck devices found. Ensure it is powered on and in range.';
            break;
          case 'NotAllowedError':
            message = 'Bluetooth scanning not allowed by user or browser policy.';
            break;
          case 'SecurityError':
            message = 'Bluetooth scanning blocked due to security settings.';
            break;
          default:
            if (err.message.includes('cancelled')) {
              message = 'Device selection cancelled by user.';
            } else {
              message = err.message;
            }
        }
      }
      setError({ message, operation: 'scan' });
    }
  }, [handleDisconnection, connectToServices]);

  const disconnectDevice = useCallback(() => {
    console.log('[WebBLE] disconnectDevice: Attempting to disconnect...');
    if (bleDevice?.server?.connected) {
      console.log('[WebBLE] 🔌 Disconnecting from device:', bleDevice.device.name);
      try {
        bleDevice.server.disconnect();
        console.log('[WebBLE] Disconnect call successful.');
      } catch (e) {
        console.warn('[WebBLE] Disconnect error:', e);
      }
    } else {
      console.log('[WebBLE] No device connected or server not available.');
    }
    cleanupConnection();
  }, [bleDevice, cleanupConnection]);

  const sendKeymap = useCallback(async (keymap: string) => {
    console.log('[WebBLE] sendKeymap: Attempting to send keymap. Length:', keymap.length);
    if (!bleDevice?.characteristics.keymap) {
      console.warn('[WebBLE] Keymap characteristic not available.');
      setError({ message: 'Keymap characteristic not available. Cannot send keymap.', operation: 'send_keymap' });
      return;
    }
    setError(null);
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(keymap);
      console.log('[WebBLE] Writing keymap data to characteristic...');
      await bleDevice.characteristics.keymap.writeValue(data);
      console.log('[WebBLE] ✅ Keymap sent successfully.');
    } catch (err) {
      console.error('[WebBLE] ❌ Keymap send error:', err);
      const message = err instanceof Error ? err.message : 'Unknown error sending keymap.';
      setError({ message: `Failed to send keymap: ${message}`, operation: 'send_keymap' });
    }
  }, [bleDevice]);

  const sendCommand = useCallback(async (command: string) => {
    console.log('[WebBLE] sendCommand: Attempting to send command:', command);
    if (!bleDevice?.characteristics.cmd) {
      console.warn('[WebBLE] Command characteristic not available.');
      setError({ message: 'Command characteristic not available. Cannot send command.', operation: 'send_command' });
      return;
    }
    setError(null);
    try {
      let data: Uint8Array;
      if (command.startsWith('0x')) {
        const hex = command.replace('0x', '');
        data = new Uint8Array([parseInt(hex, 16)]);
      } else {
        const encoder = new TextEncoder();
        data = encoder.encode(command);
      }

      console.log('[WebBLE] Writing command data to characteristic...');
      await bleDevice.characteristics.cmd.writeValue(data);
      console.log('[WebBLE] ✅ Command sent successfully.');
    } catch (err) {
      console.error('[WebBLE] ❌ Command send error:', err);
      const message = err instanceof Error ? err.message : 'Unknown error sending command.';
      setError({ message: `Failed to send command: ${message}`, operation: 'send_command' });
    }
  }, [bleDevice]);

  const readBatteryLevel = useCallback(async (): Promise<number> => {
    console.log('[WebBLE] readBatteryLevel: Attempting to read battery level...');
    if (!bleDevice?.characteristics.battery) {
      console.warn('[WebBLE] Battery characteristic not available.');
      setError({ message: 'Battery characteristic not available. Cannot read battery level.', operation: 'read_battery' });
      return batteryLevel || 0;
    }
    setError(null);
    try {
      console.log('[WebBLE] Reading battery value from characteristic...');
      const value = await bleDevice.characteristics.battery.readValue();
      const level = value.getUint8(0);
      setBatteryLevel(level);
      console.log('[WebBLE] 🔋 Battery read successfully:', level + '%');
      return level;
    } catch (err) {
      console.error('[WebBLE] ❌ Battery read error:', err);
      const message = err instanceof Error ? err.message : 'Unknown error reading battery level.';
      setError({ message: `Failed to read battery level: ${message}`, operation: 'read_battery' });
      return batteryLevel || 0;
    }
  }, [bleDevice, batteryLevel]);

  return {
    isAvailable,
    isConnected,
    isScanning,
    batteryLevel,
    connectionStage,
    error,
    scanForDevices,
    disconnectDevice,
    sendKeymap,
    sendCommand,
    readBatteryLevel
  };
};

export default useBle;