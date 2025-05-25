// pwa/src/__tests__/mocks/tauriApi.ts
import { vi } from 'vitest';

export const mockInvoke = vi.fn();
export const mockListen = vi.fn().mockResolvedValue(() => {}); // Returns a mock unlisten function

export const mockUseTauriBle = {
  isAvailable: true,
  isConnected: false,
  isScanning: false,
  batteryLevel: null,
  error: null,
  scanForDevices: vi.fn().mockResolvedValue(undefined),
  disconnectDevice: vi.fn().mockResolvedValue(undefined),
  sendKeymap: vi.fn().mockResolvedValue(undefined),
  sendCommand: vi.fn().mockResolvedValue(undefined),
  sendFirmwareChunk: vi.fn().mockResolvedValue(undefined),
  readBatteryLevel: vi.fn().mockResolvedValue(80),
  // Add any other functions/properties returned by the actual useTauriBle hook
};
