// pwa/src/hooks/useUnifiedBle.ts
import { useState, useEffect } from 'react';
import useWebBle from './useWebBle';
import useTauriBle from './useTauriBle';

// Define the common error type, consistent with useWebBle and useTauriBle
interface BleError {
  message: string;
  operation: string;
}

const useUnifiedBle = () => {
  console.log('[UnifiedBLE] Initializing Unified BLE hook...');
  const isTauri = !!window.__TAURI__;

  if (isTauri) {
    console.log('[UnifiedBLE] Using TauriBLE interface.');
  } else {
    console.log('[UnifiedBLE] Using WebBLE interface.');
  }

  const webBle = useWebBle();
  const tauriBle = useTauriBle();

  const [connectionStage, setConnectionStage] = useState<string>('Disconnected');

  useEffect(() => {
    if (isTauri) {
      // Logic to derive a simplified connection stage for Tauri
      // The presence of the tauriBle.error object (even if its message is empty) indicates an error state.
      if (tauriBle.isScanning) {
        setConnectionStage('Scanning...');
      } else if (tauriBle.error) { // Check for the error object itself
        setConnectionStage(`Error: ${tauriBle.error.message || 'Unknown error'}`);
      } else if (tauriBle.isConnected) {
        setConnectionStage('Connected');
      } else {
        setConnectionStage('Disconnected');
      }
    } else {
      // Use connectionStage from useWebBle
      setConnectionStage(webBle.connectionStage);
    }
  }, [isTauri, webBle.connectionStage, tauriBle.isConnected, tauriBle.error, tauriBle.isScanning]);

  if (isTauri) {
    return {
      ...tauriBle,
      connectionStage,
      // Placeholder for functions not in useTauriBle.
      // The `error` object from tauriBle is spread directly.
      sendFirmwareChunk: tauriBle.sendFirmwareChunk || (() => {
        console.error('[UnifiedBLE] sendFirmwareChunk not available in Tauri');
        // Potentially set an error here if this function were to be part of the unified interface
        // and expected to manage its own errors within useUnifiedBle.
        // For now, assuming tauriBle.sendFirmwareChunk itself would set tauriBle.error.
      }),
    };
  } else {
    // For webBle, the error object is also spread directly from webBle.
    // webBle.connectionStage is used, which should reflect errors if webBle itself sets it.
    // If webBle.error exists, webBle.connectionStage should ideally be 'Error' or similar.
    let currentConnectionStage = webBle.connectionStage;
    if (webBle.error && webBle.connectionStage !== 'Disconnected' && !webBle.connectionStage.startsWith('Error')) {
      // If webBle has an error but its stage doesn't reflect it, override.
      currentConnectionStage = `Error: ${webBle.error.message || 'Unknown error'}`;
    }

    return {
      ...webBle,
      connectionStage: currentConnectionStage,
      // Placeholder for functions not in useWebBle
      sendFirmwareChunk: () => {
        console.error('[UnifiedBLE] sendFirmwareChunk not available in Web BLE');
        // Similarly, could set an error if this were a primary unified function.
        // For now, assuming the caller checks the environment or this function is not used.
      },
      // Ensure all functions from useTauriBle that are part of the unified interface have placeholders
      // These are mapped functions; their underlying implementations in useWebBle should handle errors.
      connect: webBle.requestDevice,
      disconnect: webBle.disconnectDevice,
      write: webBle.sendData,
      startNotifications: webBle.startNotifications,
      stopNotifications: webBle.stopNotifications,
      // Add other mappings or placeholders as necessary
    };
  }
};

// Export the BleError type if it's needed by consumers of useUnifiedBle directly,
// though typically they'd just use the `error` object returned by the hook.
export type { BleError };
export default useUnifiedBle;
