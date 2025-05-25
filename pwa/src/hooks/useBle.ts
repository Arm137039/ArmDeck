import { useState, useCallback, useEffect } from 'react';

const ARMDECK_SERVICE_UUID = '7a0b1000-0000-1000-8000-00805f9b34fb';
const KEYMAP_CHARACTERISTIC_UUID = '7a0b1001-0000-1000-8000-00805f9b34fb';
const COMMAND_CHARACTERISTIC_UUID = '7a0b1002-0000-1000-8000-00805f9b34fb';
const BATTERY_CHARACTERISTIC_UUID = '7a0b1004-0000-1000-8000-00805f9b34fb';

// Standard Bluetooth service UUIDs
const DEVICE_INFO_SERVICE_UUID = '0000180a-0000-1000-8000-00805f9b34fb';

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

interface UseBleReturn {
  isAvailable: boolean;
  isConnected: boolean;
  isScanning: boolean;
  batteryLevel: number | null;
  connectionStage: string;
  error: string | null;
  scanForDevices: () => Promise<void>;
  disconnectDevice: () => void;
  sendKeymap: (keymap: string) => Promise<void>;
  sendCommand: (command: string) => Promise<void>;
  readBatteryLevel: () => Promise<number>;
}

const useBle = (): UseBleReturn => {
  const [isAvailable, setIsAvailable] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [connectionStage, setConnectionStage] = useState<string>('Disconnected');
  const [error, setError] = useState<string | null>(null);
  const [bleDevice, setBleDevice] = useState<BleDevice | null>(null);

  useEffect(() => {
    if (navigator.bluetooth) {
      setIsAvailable(true);
    } else {
      setIsAvailable(false);
      setError('Web Bluetooth is not available in this browser');
    }
  }, []);

  const cleanupConnection = useCallback(() => {
    if (bleDevice?.characteristics.battery) {
      try {
        bleDevice.characteristics.battery.stopNotifications().catch(() => {});
      } catch {}
    }
    setIsConnected(false);
    setConnectionStage('Disconnected');
    setBatteryLevel(null);
  }, [bleDevice]);

  const handleDisconnection = useCallback((device: BluetoothDevice) => {
    console.log(`🔌 Device disconnected: ${device.name || 'Unknown device'}`);
    cleanupConnection();
  }, [cleanupConnection]);

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const connectToServices = useCallback(async (device: BluetoothDevice) => {
    try {
      setError(null);
      setConnectionStage('Connecting to GATT...');

      if (!device.gatt) {
        throw new Error('GATT not available');
      }

      const server = await device.gatt.connect();
      console.log('✅ GATT connected');
      setConnectionStage('Connected to GATT');

      // Chrome voit les services, donc on peut être moins conservateur sur le timing
      console.log('⏳ Waiting 5 seconds for ESP32 stability...');
      setConnectionStage('Waiting for ESP32...');
      await delay(5000);

      // Découvrir les services directement car Chrome les voit déjà
      console.log('🔍 Discovering services directly...');
      setConnectionStage('Discovering services...');

      const characteristics: BleDevice['characteristics'] = {};
      let deviceInfoService: BluetoothRemoteGATTService | undefined;
      let armdeckService: BluetoothRemoteGATTService | undefined;

      // 1. Device Info service
      try {
        deviceInfoService = await server.getPrimaryService(DEVICE_INFO_SERVICE_UUID);
        console.log('✅ Device Info service found');
      } catch (e) {
        console.warn('❌ Device Info service not found:', e);
      }

      // 2. ArmDeck service - directement car Chrome le voit
      try {
        console.log('🔍 Getting ArmDeck service directly...');
        armdeckService = await server.getPrimaryService(ARMDECK_SERVICE_UUID);
        console.log('✅ ArmDeck service found!');
      } catch (e) {
        console.error('❌ ArmDeck service not found:', e);

        // Si ça échoue, essayer de lister tous les services pour debug
        try {
          console.log('🔍 Trying to list all services for debug...');
          const allServices = await server.getPrimaryServices();
          console.log(`📋 Found ${allServices.length} services:`);
          allServices.forEach((service, index) => {
            console.log(`  ${index + 1}. ${service.uuid}`);
          });
        } catch (enumError) {
          console.warn('❌ Could not enumerate services:', enumError);
        }
      }

      // 3. Si on a trouvé le service ArmDeck, récupérer ses caractéristiques
      if (armdeckService) {
        console.log('🔍 Getting ArmDeck characteristics...');
        setConnectionStage('Getting characteristics...');

        try {
          // Essayer de récupérer toutes les caractéristiques directement
          console.log('🔍 Getting Keymap characteristic...');
          characteristics.keymap = await armdeckService.getCharacteristic(KEYMAP_CHARACTERISTIC_UUID);
          console.log('✅ Keymap characteristic found');
        } catch (e) {
          console.warn('❌ Keymap characteristic not found:', e);
        }

        try {
          console.log('🔍 Getting Command characteristic...');
          characteristics.cmd = await armdeckService.getCharacteristic(COMMAND_CHARACTERISTIC_UUID);
          console.log('✅ Command characteristic found');
        } catch (e) {
          console.warn('❌ Command characteristic not found:', e);
        }

        try {
          console.log('🔍 Getting Battery characteristic...');
          characteristics.battery = await armdeckService.getCharacteristic(BATTERY_CHARACTERISTIC_UUID);
          console.log('✅ Battery characteristic found');
        } catch (e) {
          console.warn('❌ Battery characteristic not found:', e);
        }

        // Si certaines caractéristiques manquent, essayer l'énumération
        const missingChars = [
          !characteristics.keymap && 'Keymap',
          !characteristics.cmd && 'Command',
          !characteristics.battery && 'Battery'
        ].filter(Boolean);

        if (missingChars.length > 0) {
          console.log(`🔍 Missing ${missingChars.join(', ')}, trying enumeration...`);
          try {
            const allCharacteristics = await armdeckService.getCharacteristics();
            console.log(`📋 Found ${allCharacteristics.length} characteristics by enumeration:`);

            allCharacteristics.forEach((char, index) => {
              console.log(`  ${index + 1}. ${char.uuid}`);
              const uuid = char.uuid.toLowerCase();

              if (uuid.includes('7a0b1001') && !characteristics.keymap) {
                console.log('    ✅ Mapped to Keymap');
                characteristics.keymap = char;
              } else if (uuid.includes('7a0b1002') && !characteristics.cmd) {
                console.log('    ✅ Mapped to Command');
                characteristics.cmd = char;
              } else if (uuid.includes('7a0b1004') && !characteristics.battery) {
                console.log('    ✅ Mapped to Battery');
                characteristics.battery = char;
              }
            });
          } catch (enumError) {
            console.warn('❌ Characteristic enumeration failed:', enumError);
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

      console.log('📊 Connection summary:');
      console.log(`  Device Info service: ${!!deviceInfoService}`);
      console.log(`  ArmDeck service: ${!!armdeckService}`);
      console.log(`  Keymap characteristic: ${hasKeymap}`);
      console.log(`  Command characteristic: ${hasCmd}`);
      console.log(`  Battery characteristic: ${hasBattery}`);

      if (armdeckService && hasKeymap && hasCmd && hasBattery) {
        setConnectionStage('Fully Connected');
        console.log('🎉 FULL FUNCTIONALITY AVAILABLE!');
      } else if (armdeckService && (hasKeymap || hasCmd)) {
        setConnectionStage('Partially Connected');
        console.log('🎉 Partial functionality available');
      } else if (deviceInfoService) {
        setConnectionStage('Basic Connected');
        console.log('🎉 Basic connection (Device Info only)');
      } else {
        setConnectionStage('Connected (Limited)');
        console.log('⚠️ Limited connection');
      }

      // 6. Configuration batterie si disponible
      if (characteristics.battery) {
        try {
          console.log('🔋 Reading initial battery level...');
          const batteryValue = await characteristics.battery.readValue();
          const batteryPercent = batteryValue.getUint8(0);
          setBatteryLevel(batteryPercent);
          console.log('🔋 Initial battery level:', batteryPercent + '%');

          // Essayer d'activer les notifications
          try {
            await characteristics.battery.startNotifications();
            console.log('✅ Battery notifications enabled');
            characteristics.battery.addEventListener('characteristicvaluechanged', (event) => {
              const value = (event.target as BluetoothRemoteGATTCharacteristic).value;
              if (value) {
                const level = value.getUint8(0);
                setBatteryLevel(level);
                console.log('🔋 Battery update:', level + '%');
              }
            });
          } catch (notifyError) {
            console.warn('❌ Battery notifications not supported:', notifyError);
          }
        } catch (batteryError) {
          console.warn('❌ Battery setup failed:', batteryError);
        }
      }

    } catch (err) {
      console.error('❌ Connection failed:', err);
      setIsConnected(false);
      setConnectionStage('Connection failed');
      setError(`Connection error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, []);

  const scanForDevices = useCallback(async () => {
    if (!navigator.bluetooth) {
      setError('Web Bluetooth not available');
      return;
    }

    try {
      setIsScanning(true);
      setError(null);
      setConnectionStage('Scanning...');

      console.log('🔍 Looking for ArmDeck...');

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

      console.log('📱 Found device:', device.name);
      console.log('📱 Device ID:', device.id);

      device.addEventListener('gattserverdisconnected', () => handleDisconnection(device));

      await connectToServices(device);
      setIsScanning(false);

    } catch (err) {
      console.error('❌ Scan failed:', err);
      setIsScanning(false);
      setConnectionStage('Scan failed');

      if (err instanceof Error) {
        if (err.message.includes('cancelled')) {
          setError('Connection cancelled by user');
        } else if (err.message.includes('No devices found')) {
          setError('ArmDeck not found');
        } else {
          setError('Scan error: ' + err.message);
        }
      }
    }
  }, [handleDisconnection, connectToServices]);

  const disconnectDevice = useCallback(() => {
    if (bleDevice?.server?.connected) {
      console.log('🔌 Disconnecting...');
      try {
        bleDevice.server.disconnect();
      } catch (e) {
        console.warn('Disconnect error:', e);
      }
    }
    cleanupConnection();
  }, [bleDevice, cleanupConnection]);

  const sendKeymap = useCallback(async (keymap: string) => {
    if (!bleDevice?.characteristics.keymap) {
      setError('Keymap characteristic not available');
      return;
    }

    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(keymap);
      await bleDevice.characteristics.keymap.writeValue(data);
      console.log('✅ Keymap sent:', keymap);
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('❌ Keymap send error:', err);
      setError('Keymap error: ' + msg);
    }
  }, [bleDevice]);

  const sendCommand = useCallback(async (command: string) => {
    if (!bleDevice?.characteristics.cmd) {
      setError('Command characteristic not available');
      return;
    }

    try {
      let data: Uint8Array;
      if (command.startsWith('0x')) {
        const hex = command.replace('0x', '');
        data = new Uint8Array([parseInt(hex, 16)]);
      } else {
        const encoder = new TextEncoder();
        data = encoder.encode(command);
      }

      await bleDevice.characteristics.cmd.writeValue(data);
      console.log('✅ Command sent:', command);
      setError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('❌ Command send error:', err);
      setError('Command error: ' + msg);
    }
  }, [bleDevice]);

  const readBatteryLevel = useCallback(async (): Promise<number> => {
    if (!bleDevice?.characteristics.battery) {
      setError('Battery characteristic not available');
      return batteryLevel || 0;
    }

    try {
      const value = await bleDevice.characteristics.battery.readValue();
      const level = value.getUint8(0);
      setBatteryLevel(level);
      console.log('🔋 Battery read:', level + '%');
      setError(null);
      return level;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('❌ Battery read error:', err);
      setError('Battery read error: ' + msg);
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