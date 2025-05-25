import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react'; // or '@testing-library/react-hooks' if older version
import useUnifiedBle from '../../hooks/useUnifiedBle';
import { mockUseWebBle } from '../mocks/webBle';
import { mockUseTauriBle } from '../mocks/tauriApi';

// Mock the underlying hooks
vi.mock('../../hooks/useWebBle', () => ({
  default: vi.fn(() => mockUseWebBle),
}));
vi.mock('../../hooks/useTauriBle', () => ({
  default: vi.fn(() => mockUseTauriBle),
}));

describe('useUnifiedBle', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    // Default to non-Tauri environment
    delete window.__TAURI__;
    // Reset mock hook states (example resets, ensure your mock definitions are flexible or reset here)
    mockUseWebBle.isConnected = false;
    mockUseWebBle.isAvailable = true; // Default assumption
    mockUseWebBle.error = null;
    mockUseWebBle.connectionStage = 'Disconnected';
    
    mockUseTauriBle.isConnected = false;
    mockUseTauriBle.isAvailable = true; // Default assumption
    mockUseTauriBle.error = null;
    // mockUseTauriBle.connectionStage is not directly used by useUnifiedBle's logic,
    // but its components (isConnected, error, isScanning) are.
  });

  afterEach(() => {
    // Ensure __TAURI__ is cleaned up if it was set in a test
    delete window.__TAURI__;
  });

  it('should use useWebBle when not in Tauri environment', () => {
    const { result } = renderHook(() => useUnifiedBle());
    expect(result.current.isAvailable).toBe(mockUseWebBle.isAvailable); // Check a property
    
    // Check if a function from useWebBle is called (using the mapped connect as an example)
    act(() => {
      result.current.connect(); // This should map to webBle.requestDevice
    });
    // Note: useUnifiedBle maps `connect` to `webBle.requestDevice`
    // and `scanForDevices` from the original task description is directly from `useWebBle`
    expect(mockUseWebBle.requestDevice).toHaveBeenCalled(); 
    expect(mockUseTauriBle.scanForDevices).not.toHaveBeenCalled(); // Assuming scanForDevices is the tauri equivalent
  });

  it('should use useTauriBle when in Tauri environment', () => {
    window.__TAURI__ = {}; // Simulate Tauri environment
    const { result } = renderHook(() => useUnifiedBle());
    expect(result.current.isAvailable).toBe(mockUseTauriBle.isAvailable); // Check a property

    act(() => {
      result.current.scanForDevices(); // This should map to tauriBle.scanForDevices
    });
    expect(mockUseTauriBle.scanForDevices).toHaveBeenCalled();
    expect(mockUseWebBle.scanForDevices).not.toHaveBeenCalled(); // scanForDevices is also on webBle
    expect(mockUseWebBle.requestDevice).not.toHaveBeenCalled(); // requestDevice is webBle's connect
  });

  it('should return placeholder for sendFirmwareChunk in WebBLE mode and log error', () => {
    const { result } = renderHook(() => useUnifiedBle());
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    act(() => {
      result.current.sendFirmwareChunk(new ArrayBuffer(0), () => {});
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith('[UnifiedBLE] sendFirmwareChunk not available in Web BLE');
    consoleErrorSpy.mockRestore();
  });
  
  it('should return actual sendFirmwareChunk in Tauri mode', () => {
    window.__TAURI__ = {};
    const { result } = renderHook(() => useUnifiedBle());
    act(() => {
      result.current.sendFirmwareChunk(new ArrayBuffer(0), () => {});
    });
    // Check if the underlying tauriBle.sendFirmwareChunk was called (or the wrapper if any)
    // The mockUseTauriBle.sendFirmwareChunk is called directly by the spread
    expect(mockUseTauriBle.sendFirmwareChunk).toHaveBeenCalled();
  });

  // Test for connectionStage derivation in WebBLE mode
  it('should derive connectionStage from useWebBle in WebBLE mode', () => {
    mockUseWebBle.connectionStage = 'Connecting...';
    const { result } = renderHook(() => useUnifiedBle());
    expect(result.current.connectionStage).toBe('Connecting...');
  });

  it('should derive connectionStage as Error from useWebBle if webBle.error is set and stage is not Disconnected', () => {
    mockUseWebBle.connectionStage = 'SomeStage';
    mockUseWebBle.error = { message: 'Web BLE Error', operation: 'test' };
    const { result } = renderHook(() => useUnifiedBle());
    expect(result.current.connectionStage).toBe('Error: Web BLE Error');
  });
  
  it('should keep Disconnected stage from useWebBle even if webBle.error is set', () => {
    mockUseWebBle.connectionStage = 'Disconnected';
    mockUseWebBle.error = { message: 'Web BLE Error on disconnect', operation: 'test' };
    const { result } = renderHook(() => useUnifiedBle());
    expect(result.current.connectionStage).toBe('Disconnected');
  });


  // Test for connectionStage derivation in Tauri mode
  it('should set connectionStage to Scanning... in Tauri mode when tauriBle.isScanning is true', () => {
    window.__TAURI__ = {};
    mockUseTauriBle.isScanning = true;
    const { result } = renderHook(() => useUnifiedBle());
    expect(result.current.connectionStage).toBe('Scanning...');
    mockUseTauriBle.isScanning = false; // reset for other tests
  });

  it('should set connectionStage to Error in Tauri mode when tauriBle.error is present', () => {
    window.__TAURI__ = {};
    mockUseTauriBle.error = { message: 'Tauri Error', operation: 'test' };
    const { result } = renderHook(() => useUnifiedBle());
    expect(result.current.connectionStage).toBe('Error: Tauri Error');
    mockUseTauriBle.error = null; // reset
  });

  it('should set connectionStage to Connected in Tauri mode when tauriBle.isConnected is true', () => {
    window.__TAURI__ = {};
    mockUseTauriBle.isConnected = true;
    const { result } = renderHook(() => useUnifiedBle());
    expect(result.current.connectionStage).toBe('Connected');
    mockUseTauriBle.isConnected = false; // reset
  });

  it('should default to Disconnected in Tauri mode otherwise', () => {
    window.__TAURI__ = {};
    // Ensuring isScanning, error, isConnected are all false/null
    mockUseTauriBle.isScanning = false;
    mockUseTauriBle.error = null;
    mockUseTauriBle.isConnected = false;
    const { result } = renderHook(() => useUnifiedBle());
    expect(result.current.connectionStage).toBe('Disconnected');
  });

  // Test error propagation
  it('should propagate error object from useWebBle in WebBLE mode', () => {
    const testError = { message: 'WebBLE Test Error', operation: 'web_test' };
    mockUseWebBle.error = testError;
    const { result } = renderHook(() => useUnifiedBle());
    expect(result.current.error).toEqual(testError);
  });

  it('should propagate error object from useTauriBle in Tauri mode', () => {
    window.__TAURI__ = {};
    const testError = { message: 'Tauri Test Error', operation: 'tauri_test' };
    mockUseTauriBle.error = testError;
    const { result } = renderHook(() => useUnifiedBle());
    expect(result.current.error).toEqual(testError);
  });

});
