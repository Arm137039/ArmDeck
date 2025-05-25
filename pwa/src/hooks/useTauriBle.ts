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

interface BleError { // Added common error type
  message: string;
  operation: string;
}

interface UseTauriBleReturn {
  isAvailable: boolean;
  isConnected: boolean;
  isScanning: boolean;
  batteryLevel: number | null;
  error: BleError | null; // Updated error type
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
  console.log('[TauriBLE] Initializing Tauri BLE hook...');
  const [isAvailable, setIsAvailable] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [error, setError] = useState<BleError | null>(null); // Updated error state type

  // Helper to format Tauri errors
  const formatTauriError = (err: unknown, operation: string): BleError => {
    console.error(`[TauriBLE] Error in operation '${operation}':`, err); // Added prefix
    let message = 'An unknown Tauri error occurred.';
    if (typeof err === 'string') {
      message = err;
    } else if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
      message = err.message;
    }
    // Simplify common Tauri/Rust error patterns
    if (message.startsWith("Error invoking remote command scan_for_devices:")) message = "Failed to scan for devices. Ensure Bluetooth is enabled.";
    if (message.startsWith("Error invoking remote command connect_to_device:")) message = "Failed to connect to the device.";
    if (message.includes("BLE specific error") || message.includes("IO error")) message = "A Bluetooth communication error occurred with the device.";

    return { message, operation };
  };
  
  // Check if Tauri BLE is available
  useEffect(() => {
    const checkAvailability = async () => {
      if (isTauri) {
        console.log('[TauriBLE] Checking Tauri BLE availability...');
        try {
          setError(null);
          await invoke('get_ble_status');
          setIsAvailable(true);
          console.log('[TauriBLE] Tauri BLE is available.');
        } catch (err) {
          setIsAvailable(false);
          console.error('[TauriBLE] Tauri BLE not available:', err);
          setError(formatTauriError(err, 'init_check_availability'));
        }
      } else {
        setIsAvailable(false);
        console.log('[TauriBLE] Not running in Tauri environment.');
        setError({ message: 'Not running in Tauri environment. Web Bluetooth will be used if available.', operation: 'init_env_check' });
      }
    };

    checkAvailability();
  }, []);

  // Set up OTA progress listener
  useEffect(() => {
    if (!isTauri) return;
    console.log('[TauriBLE] Setting up OTA progress listener.');
    const unlisten = listen('ota-progress', (event) => {
      const percent = event.payload as number;
      if (typeof percent === 'number') {
        // This will be used by the sendFirmwareChunk function
        // to report progress back to the caller
        // console.log(`[TauriBLE] OTA Progress: ${percent}%`); // Logging progress here can be very noisy
      }
    });

    return () => {
      console.log('[TauriBLE] Cleaning up OTA progress listener.');
      unlisten.then(fn => fn());
    };
  }, []);

  // Scan for BLE devices
  const scanForDevices = useCallback(async () => {
    console.log('[TauriBLE] scanForDevices: Starting device scan...');
    if (!isTauri) {
      console.warn('[TauriBLE] Not running in Tauri environment.');
      setError({ message: 'Not running in Tauri environment.', operation: 'scan' });
      return;
    }
    setError(null);
    setIsScanning(true);
    try {
      const devices = await invoke<DeviceInfo[]>('scan_for_devices');
      console.log(`[TauriBLE] Found ${devices.length} devices:`, devices.map(d => d.name || d.id));

      if (devices.length > 0) {
        const deviceToConnect = devices.find(d => d.name?.includes("ArmDeck")) || devices[0];
        const deviceId = deviceToConnect.id;
        const deviceName = deviceToConnect.name || 'Unknown Device';
        console.log(`[TauriBLE] Attempting to connect to device ID: ${deviceId} (Name: ${deviceName})`);
        
        const status = await invoke<BleStatus>('connect_to_device', { deviceId });
        console.log('[TauriBLE] Connection status after connect_to_device:', status);
        
        setIsConnected(status.is_connected);
        if (status.is_connected) {
          console.log(`[TauriBLE] Successfully connected to ${deviceName}.`);
        } else {
          console.warn(`[TauriBLE] Failed to connect to ${deviceName} (status indicates not connected).`);
        }
        if (status.battery_level !== undefined) {
          setBatteryLevel(status.battery_level);
          console.log(`[TauriBLE] Battery level: ${status.battery_level}%`);
        }
      } else {
        console.log('[TauriBLE] No ArmDeck BLE devices found.');
        setError({ message: 'No ArmDeck BLE devices found.', operation: 'scan_no_devices' });
      }
    } catch (err) {
      console.error('[TauriBLE] Error during scan and connect:', err);
      setError(formatTauriError(err, 'scan'));
    } finally {
      setIsScanning(false);
      console.log('[TauriBLE] scanForDevices: Scan complete.');
    }
  }, []);

  // Disconnect from the BLE device
  const disconnectDevice = useCallback(async () => {
    console.log('[TauriBLE] disconnectDevice: Attempting to disconnect...');
    if (!isTauri) {
      console.warn('[TauriBLE] Not running in Tauri environment.');
      setError({ message: 'Not running in Tauri environment.', operation: 'disconnect' });
      return;
    }
    setError(null);
    try {
      const status = await invoke<BleStatus>('disconnect_device');
      setIsConnected(status.is_connected);
      setBatteryLevel(null);
      if (!status.is_connected) {
        console.log('[TauriBLE] Successfully disconnected.');
      } else {
        console.warn('[TauriBLE] Disconnect call completed, but status indicates still connected.');
      }
    } catch (err) {
      console.error('[TauriBLE] Error disconnecting device:', err);
      setError(formatTauriError(err, 'disconnect'));
    }
  }, []);

  // Send keymap to the device
  const sendKeymap = useCallback(async (keymap: string) => {
    console.log('[TauriBLE] sendKeymap: Attempting to send keymap. Length:', keymap.length);
    if (!isTauri) {
      console.warn('[TauriBLE] Not running in Tauri environment.');
      setError({ message: 'Not running in Tauri environment.', operation: 'send_keymap' });
      return;
    }
    setError(null);
    try {
      await invoke('send_keymap', { keymap });
      console.log('[TauriBLE] Keymap sent successfully.');
    } catch (err) {
      console.error('[TauriBLE] Error sending keymap:', err);
      setError(formatTauriError(err, 'send_keymap'));
    }
  }, []);

  // Send command to the device
  const sendCommand = useCallback(async (command: string) => {
    console.log('[TauriBLE] sendCommand: Attempting to send command:', command);
    if (!isTauri) {
      console.warn('[TauriBLE] Not running in Tauri environment.');
      setError({ message: 'Not running in Tauri environment.', operation: 'send_command' });
      return;
    }
    setError(null);
    try {
      await invoke('send_command', { command });
      console.log('[TauriBLE] Command sent successfully.');
    } catch (err) {
      console.error('[TauriBLE] Error sending command:', err);
      setError(formatTauriError(err, 'send_command'));
    }
  }, []);

  // Send firmware chunk to the device
  const sendFirmwareChunk = useCallback(async (chunk: ArrayBuffer, progress: (percent: number) => void) => {
    console.log('[TauriBLE] sendFirmwareChunk: Attempting to send firmware chunk. Chunk size:', chunk.byteLength);
    if (!isTauri) {
      console.warn('[TauriBLE] Not running in Tauri environment.');
      setError({ message: 'Not running in Tauri environment.', operation: 'send_firmware_chunk' });
      return;
    }
    setError(null);
    try {
      const chunkArray = Array.from(new Uint8Array(chunk));
      
      const unlistenProgress = await listen('ota-progress', (event) => {
        const percent = event.payload as number;
        if (typeof percent === 'number') {
          // console.log(`[TauriBLE] OTA Progress via listener: ${percent}%`); // Can be noisy
          progress(percent);
        }
      });
      console.log('[TauriBLE] Invoking send_firmware_chunk backend command...');
      await invoke('send_firmware_chunk', { chunk: chunkArray });
      console.log('[TauriBLE] Firmware chunk sending process completed by backend.');
      
      unlistenProgress();
    } catch (err) {
      console.error('[TauriBLE] Error sending firmware chunk:', err);
      setError(formatTauriError(err, 'send_firmware_chunk'));
    }
  }, []);

  // Read battery level from the device
  const readBatteryLevel = useCallback(async () => {
    console.log('[TauriBLE] readBatteryLevel: Attempting to read battery level...');
    if (!isTauri) {
      console.warn('[TauriBLE] Not running in Tauri environment.');
      setError({ message: 'Not running in Tauri environment.', operation: 'read_battery' });
      return null;
    }
    setError(null);
    try {
      const level = await invoke<number | null>('read_battery_level');
      if (level !== null) {
        setBatteryLevel(level);
        console.log(`[TauriBLE] Battery level read: ${level}%`);
      } else {
        console.log('[TauriBLE] Battery level not available or read as null.');
      }
      return level;
    } catch (err) {
      console.error('[TauriBLE] Error reading battery level:', err);
      setError(formatTauriError(err, 'read_battery'));
      return null;
    }
  }, []);

  // Periodically update the BLE status
  useEffect(() => {
    if (!isTauri) return;
    let intervalId: NodeJS.Timeout | null = null;

    const updateStatus = async () => {
      // console.log('[TauriBLE] Periodic status update check...'); // Can be noisy
      try {
        const status = await invoke<BleStatus>('get_ble_status');
        setIsConnected(status.is_connected);
        if (status.battery_level !== undefined) {
          setBatteryLevel(status.battery_level);
          // console.log(`[TauriBLE] Periodic status: Connected=${status.is_connected}, Battery=${status.battery_level}%`);
        } else {
          // console.log(`[TauriBLE] Periodic status: Connected=${status.is_connected}, Battery=N/A`);
        }
      } catch (err) {
        // console.warn('[TauriBLE] Error during periodic status update:', err); // Usually silent
      }
    };

    // Update status immediately and then every 5 seconds
    updateStatus();
    intervalId = setInterval(updateStatus, 5000);
    console.log('[TauriBLE] Started periodic BLE status update.');

    return () => {
      if (intervalId) clearInterval(intervalId);
      console.log('[TauriBLE] Stopped periodic BLE status update.');
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