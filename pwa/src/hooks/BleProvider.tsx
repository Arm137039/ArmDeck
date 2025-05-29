import React, { createContext, useContext, ReactNode } from 'react';
import useBle, { ButtonConfig } from './useBle';

// Types pour le Context
interface BleContextType {
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

    // Actions
    connect: () => Promise<void>;
    disconnect: () => void;
    updateButton: (index: number, config: Partial<ButtonConfig>) => void;
    saveConfig: () => Promise<void>;
    resetConfig: () => Promise<void>;
}

// Créer le Context
const BleContext = createContext<BleContextType | null>(null);

// Hook pour utiliser le Context
export const useBleContext = (): BleContextType => {
    const context = useContext(BleContext);
    if (!context) {
        throw new Error('useBleContext must be used within a BleProvider');
    }
    return context;
};

// Provider qui utilise le hook unifié
interface BleProviderProps {
    children: ReactNode;
}

export const BleProvider: React.FC<BleProviderProps> = ({ children }) => {
    // 🔥 UN SEUL appel au hook unifié ici
    const bleState = useBle();

    // 🔥 DEBUG: Log des changements d'état
    React.useEffect(() => {
        console.log('🔍 [BleProvider] State change:', {
            isConnected: bleState.isConnected,
            isFullyConnected: bleState.isFullyConnected,
            connectionStage: bleState.connectionStage,
            timestamp: new Date().toISOString()
        });
    }, [bleState.isConnected, bleState.isFullyConnected, bleState.connectionStage]);

    return (
        <BleContext.Provider value={bleState}>
            {children}
        </BleContext.Provider>
    );
};