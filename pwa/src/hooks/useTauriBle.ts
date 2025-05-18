import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';

// Define types
interface DeviceInfo {
  id: string;
  name?: string;
}

interface BleStatus {
  is_connected: boolean;
  battery_level?: number;
}

interface UseTauriBleReturn {
  isAvailable: boolean;
  isConnected: boolean;
  isScanning: boolean;
  batteryLevel: number | null;
  error: string | null;
  scanForDevices: () => Promise<void>;
  disconnectDevice: () => Promise<void>;
  sendKeymap: (keymap: string) => Promise<void>;
  sendCommand: (command: string) => Promise<void>;
  sendFirmwareChunk: (chunk: ArrayBuffer, progress: (percent: number) => void) => Promise<void>;
  readBatteryLevel: () => Promise<number | null>;
}

// Check if running in Tauri
const isTauri = !!window.__TAURI__;

export const useTauriBle = (): UseTauriBleReturn => {
  const [isAvailable, setIsAvailable] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Check if Tauri BLE is available
  useEffect(() => {
    const checkAvailability = async () => {
      if (isTauri) {
        try {
          // Just check if we can invoke a simple BLE function
          await invoke('get_ble_status');
          setIsAvailable(true);
        } catch (err) {
          setIsAvailable(false);
          setError(`Tauri BLE is not available: ${err}`);
        }
      } else {
        setIsAvailable(false);
        setError('Not running in Tauri environment');
      }
    };

    checkAvailability();
  }, []);

  // Set up OTA progress listener
  useEffect(() => {
    if (!isTauri) return;

    const unlisten = listen('ota-progress', (event) => {
      const percent = event.payload as number;
      if (typeof percent === 'number') {
        // This will be used by the sendFirmwareChunk function
        // to report progress back to the caller
      }
    });

    return () => {
      unlisten.then(fn => fn());
    };
  }, []);

  // Scan for BLE devices
  const scanForDevices = useCallback(async () => {
    if (!isTauri) {
      setError('Not running in Tauri environment');
      return;
    }

    try {
      setIsScanning(true);
      setError(null);

      // Invoke the Tauri command to scan for devices
      const devices = await invoke<DeviceInfo[]>('scan_for_devices');

      // If devices are found, automatically connect to the first one
      if (devices.length > 0) {
        const deviceId = devices[0].id;
        
        // Connect to the device
        const status = await invoke<BleStatus>('connect_to_device', { deviceId });
        
        setIsConnected(status.is_connected);
        if (status.battery_level !== undefined) {
          setBatteryLevel(status.battery_level);
        }
      } else {
        setError('No StreamDeck BLE devices found');
      }

      setIsScanning(false);
    } catch (err) {
      setIsScanning(false);
      setError(`Error scanning for devices: ${err}`);
    }
  }, []);

  // Disconnect from the BLE device
  const disconnectDevice = useCallback(async () => {
    if (!isTauri) {
      setError('Not running in Tauri environment');
      return;
    }

    try {
      const status = await invoke<BleStatus>('disconnect_device');
      setIsConnected(status.is_connected);
      setBatteryLevel(null);
    } catch (err) {
      setError(`Error disconnecting device: ${err}`);
    }
  }, []);

  // Send keymap to the device
  const sendKeymap = useCallback(async (keymap: string) => {
    if (!isTauri) {
      setError('Not running in Tauri environment');
      return;
    }

    try {
      await invoke('send_keymap', { keymap });
    } catch (err) {
      setError(`Error sending keymap: ${err}`);
    }
  }, []);

  // Send command to the device
  const sendCommand = useCallback(async (command: string) => {
    if (!isTauri) {
      setError('Not running in Tauri environment');
      return;
    }

    try {
      await invoke('send_command', { command });
    } catch (err) {
      setError(`Error sending command: ${err}`);
    }
  }, []);

  // Send firmware chunk to the device
  const sendFirmwareChunk = useCallback(async (chunk: ArrayBuffer, progress: (percent: number) => void) => {
    if (!isTauri) {
      setError('Not running in Tauri environment');
      return;
    }

    try {
      // Convert ArrayBuffer to Uint8Array for Tauri
      const chunkArray = Array.from(new Uint8Array(chunk));
      
      // Set up progress listener
      const unlistenProgress = await listen('ota-progress', (event) => {
        const percent = event.payload as number;
        if (typeof percent === 'number') {
          progress(percent);
        }
      });

      // Send the firmware chunk
      await invoke('send_firmware_chunk', { chunk: chunkArray });
      
      // Clean up listener
      unlistenProgress();
    } catch (err) {
      setError(`Error sending firmware chunk: ${err}`);
    }
  }, []);

  // Read battery level from the device
  const readBatteryLevel = useCallback(async () => {
    if (!isTauri) {
      setError('Not running in Tauri environment');
      return null;
    }

    try {
      const level = await invoke<number | null>('read_battery_level');
      if (level !== null) {
        setBatteryLevel(level);
      }
      return level;
    } catch (err) {
      setError(`Error reading battery level: ${err}`);
      return null;
    }
  }, []);

  // Periodically update the BLE status
  useEffect(() => {
    if (!isTauri) return;

    const updateStatus = async () => {
      try {
        const status = await invoke<BleStatus>('get_ble_status');
        setIsConnected(status.is_connected);
        if (status.battery_level !== undefined) {
          setBatteryLevel(status.battery_level);
        }
      } catch (err) {
        // Silently fail, don't set error
      }
    };

    // Update status immediately and then every 5 seconds
    updateStatus();
    const interval = setInterval(updateStatus, 5000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  return {
    isAvailable,
    isConnected,
    isScanning,
    batteryLevel,
    error,
    scanForDevices,
    disconnectDevice,
    sendKeymap,
    sendCommand,
    sendFirmwareChunk,
    readBatteryLevel
  };
};

export default useTauriBle;