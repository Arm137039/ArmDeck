import { useState, useEffect } from 'react';
import useBle from './useBle';
import useTauriBle from './useTauriBle';

// Check if running in Tauri
const isTauri = !!window.__TAURI__;

/**
 * A unified BLE hook that uses either Web Bluetooth API or Tauri BLE API
 * depending on the environment.
 */
const useUnifiedBle = () => {
  const webBle = useBle();
  const tauriBle = useTauriBle();
  
  // Use the appropriate BLE implementation based on environment
  const activeBle = isTauri ? tauriBle : webBle;
  
  // Add a flag to indicate which implementation is being used
  const [implementation, setImplementation] = useState<'web' | 'tauri' | 'none'>('none');
  
  useEffect(() => {
    if (isTauri) {
      if (tauriBle.isAvailable) {
        setImplementation('tauri');
      } else {
        setImplementation('none');
      }
    } else {
      if (webBle.isAvailable) {
        setImplementation('web');
      } else {
        setImplementation('none');
      }
    }
  }, [webBle.isAvailable, tauriBle.isAvailable]);
  
  return {
    ...activeBle,
    implementation
  };
};

export default useUnifiedBle;