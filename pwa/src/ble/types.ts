export interface BleDevice {
    device: BluetoothDevice;
    server?: BluetoothRemoteGATTServer;
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
    isLoading?: boolean;
}

export interface DeviceInfo {
    protocol_version: number;
    firmware_major: number;
    firmware_minor: number;
    firmware_patch: number;
    num_buttons: number;
    battery_level: number;
    uptime_seconds: number;
    free_heap: number;
    device_name: string;
}

export type CommandMethod = (device: BleDevice, command: number, payload?: Uint8Array) => Promise<Uint8Array | null>;

export interface ParsedResponse {
    command: number;
    error: number;
    payload?: Uint8Array;
}

export interface UseBleReturn {
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
    deviceInfo: DeviceInfo | null;

    // Actions
    connect: () => Promise<void>;
    disconnect: () => void;
    updateButton: (index: number, config: Partial<ButtonConfig>) => void;
    saveConfig: () => Promise<void>;
    resetConfig: () => Promise<void>;
    getDeviceInfo: () => Promise<void>;
    testCommunication: () => Promise<void>;
    testButtonPress: (buttonId: number) => Promise<void>;
}

