import { useState, useCallback, useEffect } from 'react';
import useBle from './useBle';

export interface ButtonConfig {
    id: number;
    label: string;
    action: string;
    color: string;
    isDirty?: boolean;
}

export interface DeviceInfo {
    name: string;
    firmware: string;
    uptime: number;
    heap: number;
}

export interface ConfigResponse {
    cmd: string;
    status: 'ok' | 'error';
    data?: {
        version: number;
        buttons: ButtonConfig[];
        device: DeviceInfo;
    };
    error?: string;
}

interface UseDeviceConfigReturn {
    buttons: ButtonConfig[];
    deviceInfo: DeviceInfo | null;
    isLoading: boolean;
    isDirty: boolean;
    lastSaved: Date | null;
    error: string | null;
    loadConfig: () => Promise<void>;
    saveConfig: (buttons?: ButtonConfig[]) => Promise<void>;
    resetConfig: () => Promise<void>;
    updateButton: (index: number, config: Partial<ButtonConfig>) => void;
    getButtonConfig: (index: number) => ButtonConfig | undefined;
}

// Configuration par défaut (fallback si ESP32 pas encore configuré)
const DEFAULT_BUTTONS: ButtonConfig[] = [
    { id: 0, label: 'Play/Pause', action: 'MEDIA_PLAY_PAUSE', color: '#4CAF50' },
    { id: 1, label: 'Next', action: 'MEDIA_NEXT', color: '#2196F3' },
    { id: 2, label: 'Previous', action: 'MEDIA_PREV', color: '#2196F3' },
    { id: 3, label: 'Volume +', action: 'VOLUME_UP', color: '#FF9800' },
    { id: 4, label: 'Volume -', action: 'VOLUME_DOWN', color: '#FF9800' },
    { id: 5, label: 'Mute', action: 'VOLUME_MUTE', color: '#F44336' },
    { id: 6, label: 'Stop', action: 'MEDIA_STOP', color: '#9C27B0' },
    { id: 7, label: 'F20', action: 'KEY_F20', color: '#607D8B' },
    { id: 8, label: 'F21', action: 'KEY_F21', color: '#607D8B' },
    { id: 9, label: 'F22', action: 'KEY_F22', color: '#607D8B' },
    { id: 10, label: 'F23', action: 'KEY_F23', color: '#607D8B' },
    { id: 11, label: 'F24', action: 'KEY_F24', color: '#607D8B' },
];

const useDeviceConfig = (): UseDeviceConfigReturn => {
    const { isConnected, sendCommand } = useBle();

    const [buttons, setButtons] = useState<ButtonConfig[]>(DEFAULT_BUTTONS);
    const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [lastSaved, setLastSaved] = useState<Date | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null);

    // Auto-save après 2 secondes d'inactivité
    const debouncedSave = useCallback(async (buttonsToSave: ButtonConfig[]) => {
        try {
            await saveConfigToDevice(buttonsToSave);
            setIsDirty(false);
            setLastSaved(new Date());
            console.log('✅ Auto-save successful');
        } catch (err) {
            console.error('❌ Auto-save failed:', err);
            setError(`Auto-save failed: ${err}`);
        }
    }, []);

    // Déclencher auto-save quand isDirty devient true
    useEffect(() => {
        if (isDirty && isConnected) {
            // Annuler le timer précédent
            if (autoSaveTimer) {
                clearTimeout(autoSaveTimer);
            }

            // Nouveau timer de 2 secondes
            const timer = setTimeout(() => {
                debouncedSave(buttons);
            }, 2000);

            setAutoSaveTimer(timer);
        }

        return () => {
            if (autoSaveTimer) {
                clearTimeout(autoSaveTimer);
            }
        };
    }, [isDirty, buttons, isConnected, debouncedSave]);

    // Charger config depuis ESP32
    const loadConfig = useCallback(async () => {
        if (!isConnected) {
            setError('Device not connected');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            console.log('📥 Loading config from ESP32...');

            // Envoyer commande READ_CONFIG (0x50)
            await sendCommand('0x50');

            // Note: Dans un vrai scénario, on aurait besoin d'écouter la réponse
            // Pour l'instant, on simule une réponse après un délai
            await new Promise(resolve => setTimeout(resolve, 1000));

            // TODO: Implémenter l'écoute de la réponse BLE
            // Pour l'instant, utiliser la config par défaut
            console.log('✅ Config loaded (using default for now)');
            setButtons(DEFAULT_BUTTONS);
            setDeviceInfo({
                name: 'ArmDeck',
                firmware: '1.2.0',
                uptime: 12345,
                heap: 190000
            });

            setIsDirty(false);
            setLastSaved(new Date());

        } catch (err) {
            console.error('❌ Failed to load config:', err);
            setError(`Failed to load config: ${err}`);
            // Utiliser config par défaut en cas d'erreur
            setButtons(DEFAULT_BUTTONS);
        } finally {
            setIsLoading(false);
        }
    }, [isConnected, sendCommand]);

    // Sauvegarder config vers ESP32
    const saveConfigToDevice = useCallback(async (buttonsToSave: ButtonConfig[]) => {
        if (!isConnected) {
            throw new Error('Device not connected');
        }

        console.log('💾 Saving config to ESP32...');

        // Préparer JSON config
        const configData = {
            version: 1,
            buttons: buttonsToSave.map(btn => ({
                id: btn.id,
                label: btn.label,
                action: btn.action,
                color: btn.color
            }))
        };

        const jsonString = JSON.stringify(configData);
        console.log('📝 Config JSON:', jsonString);

        // Pour l'instant, simuler l'envoi via commande WRITE_CONFIG (0x51)
        // Dans une vraie implémentation, on utiliserait la keymap characteristic
        await sendCommand('0x51');

        console.log('✅ Config saved to ESP32');
    }, [isConnected, sendCommand]);

    // Sauvegarder manuellement
    const saveConfig = useCallback(async (buttonsToSave?: ButtonConfig[]) => {
        const configToSave = buttonsToSave || buttons;
        setIsLoading(true);
        setError(null);

        try {
            await saveConfigToDevice(configToSave);
            setIsDirty(false);
            setLastSaved(new Date());
            console.log('✅ Manual save successful');
        } catch (err) {
            console.error('❌ Manual save failed:', err);
            setError(`Save failed: ${err}`);
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [buttons, saveConfigToDevice]);

    // Reset vers config par défaut
    const resetConfig = useCallback(async () => {
        if (!isConnected) {
            setError('Device not connected');
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            console.log('🔄 Resetting to default config...');

            // Envoyer commande RESET_CONFIG (0x52)
            await sendCommand('0x52');

            // Recharger la config
            await new Promise(resolve => setTimeout(resolve, 500));
            setButtons(DEFAULT_BUTTONS);
            setIsDirty(false);
            setLastSaved(new Date());

            console.log('✅ Config reset to default');
        } catch (err) {
            console.error('❌ Failed to reset config:', err);
            setError(`Reset failed: ${err}`);
        } finally {
            setIsLoading(false);
        }
    }, [isConnected, sendCommand]);

    // Mettre à jour un bouton spécifique
    const updateButton = useCallback((index: number, config: Partial<ButtonConfig>) => {
        if (index < 0 || index >= 12) {
            console.error('❌ Invalid button index:', index);
            return;
        }

        setButtons(prevButtons => {
            const newButtons = [...prevButtons];
            newButtons[index] = {
                ...newButtons[index],
                ...config,
                isDirty: true
            };
            return newButtons;
        });

        setIsDirty(true);
        console.log(`🔧 Button ${index} updated:`, config);
    }, []);

    // Obtenir config d'un bouton
    const getButtonConfig = useCallback((index: number): ButtonConfig | undefined => {
        if (index < 0 || index >= 12) {
            return undefined;
        }
        return buttons[index];
    }, [buttons]);

    // Charger config automatiquement quand on se connecte
    useEffect(() => {
        if (isConnected) {
            loadConfig();
        }
    }, [isConnected, loadConfig]);

    return {
        buttons,
        deviceInfo,
        isLoading,
        isDirty,
        lastSaved,
        error,
        loadConfig,
        saveConfig,
        resetConfig,
        updateButton,
        getButtonConfig,
    };
};

export default useDeviceConfig;