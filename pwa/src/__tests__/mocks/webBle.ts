// pwa/src/__tests__/mocks/webBle.ts
import { vi } from 'vitest';

export const mockBluetoothDevice = {
  id: 'test-device-id',
  name: 'Test Device',
  gatt: {
    connect: vi.fn().mockResolvedValue(null), // Mock connect and other GATT server methods as needed
    // Add other GATT server properties/methods if your hook uses them directly
    // For instance, if disconnect is called on the server:
    // disconnect: vi.fn(), 
  },
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  // Add other BluetoothDevice properties/methods if your hook uses them directly
};

export const mockNavigatorBluetooth = {
  requestDevice: vi.fn().mockResolvedValue(mockBluetoothDevice),
  getAvailability: vi.fn().mockResolvedValue(true),
  // Add other bluetooth methods if needed by useWebBle's availability check
};

// This is a mock of the useWebBle hook itself, which useUnifiedBle consumes.
export const mockUseWebBle = {
  isAvailable: true,
  isConnected: false,
  isScanning: false,
  batteryLevel: null,
  connectionStage: 'Disconnected',
  error: null,
  scanForDevices: vi.fn().mockResolvedValue(undefined), // Renamed from requestDevice to match hook's exposed function
  disconnectDevice: vi.fn(),
  sendKeymap: vi.fn().mockResolvedValue(undefined),
  sendCommand: vi.fn().mockResolvedValue(undefined),
  readBatteryLevel: vi.fn().mockResolvedValue(75),
  // Mapped functions from the useUnifiedBle requirements
  requestDevice: vi.fn().mockResolvedValue(mockBluetoothDevice), // This is the underlying function for 'connect' in webBle
  sendData: vi.fn().mockResolvedValue(undefined), // Underlying for 'write'
  startNotifications: vi.fn().mockResolvedValue(undefined),
  stopNotifications: vi.fn().mockResolvedValue(undefined),
  // Add any other functions/properties returned by the actual useWebBle hook
};
