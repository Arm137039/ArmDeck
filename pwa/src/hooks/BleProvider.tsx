import React, { createContext, useContext, ReactNode } from 'react';
import useBle from '../ble/useBle';
import type { ButtonConfig, DeviceInfo } from '../ble';

interface BleContextType {
    isAvailable: boolean;
    isConnected: boolean;
    isFullyConnected: boolean;
    isScanning: boolean;
    connectionStage: string;
    error: string | null;

    buttons: ButtonConfig[];
    isLoading: boolean;
    isDirty: boolean;
    lastSaved: Date | null;
    deviceInfo: DeviceInfo | null;

    connect: () => Promise<void>;
    disconnect: () => void;
    updateButton: (index: number, config: Partial<ButtonConfig>) => void;
    saveConfig: () => Promise<void>;
    resetConfig: () => Promise<void>;
    getDeviceInfo: () => Promise<void>;
    testCommunication: () => Promise<void>;
    testButtonPress: (buttonId: number) => Promise<void>;
}

const BleContext = createContext<BleContextType | null>(null);

export const useBleContext = (): BleContextType => {
    const context = useContext(BleContext);
    if (!context) {
        throw new Error('useBleContext must be used within a BleProvider');
    }
    return context;
};

interface BleProviderProps {
    children: ReactNode;
}

export const BleProvider: React.FC<BleProviderProps> = ({ children }) => {
    const bleState = useBle();

    React.useEffect(() => {
        console.log('🔍 [BleProvider] State change:', {
            isConnected: bleState.isConnected,
            isFullyConnected: bleState.isFullyConnected,
            connectionStage: bleState.connectionStage,
            deviceInfo: bleState.deviceInfo ?
                `${bleState.deviceInfo.device_name} v${bleState.deviceInfo.firmware_major}.${bleState.deviceInfo.firmware_minor}.${bleState.deviceInfo.firmware_patch}`
                : 'None',
            timestamp: new Date().toISOString()
        });
    }, [
        bleState.isConnected,
        bleState.isFullyConnected,
        bleState.connectionStage,
        bleState.deviceInfo
    ]);

    React.useEffect(() => {
        if (bleState.deviceInfo) {
            console.log('📱 [BleProvider] Device info updated:', {
                name: bleState.deviceInfo.device_name,
                firmware: `${bleState.deviceInfo.firmware_major}.${bleState.deviceInfo.firmware_minor}.${bleState.deviceInfo.firmware_patch}`,
                protocol: bleState.deviceInfo.protocol_version,
                buttons: bleState.deviceInfo.num_buttons,
                battery: `${bleState.deviceInfo.battery_level}%`,
                uptime: `${Math.floor(bleState.deviceInfo.uptime_seconds / 60)}min`,
                heap: `${Math.floor(bleState.deviceInfo.free_heap / 1024)}KB`
            });
        }
    }, [bleState.deviceInfo]);

    return (
        <BleContext.Provider value={bleState}>
            {children}
        </BleContext.Provider>
    );
};

export type { DeviceInfo, ButtonConfig };