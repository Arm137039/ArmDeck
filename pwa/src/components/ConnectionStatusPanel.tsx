// components/ConnectionStatusPanel.tsx - Thèmes corrigés avec nuances
import React from 'react';
import useUnifiedBle from '../hooks/useBle';
import useDeviceConfig from '../hooks/useDeviceConfig';

// Hook pour obtenir le thème actuel
const useTheme = () => {
    const [theme, setTheme] = React.useState<'light' | 'dark'>(() => {
        const saved = localStorage.getItem('theme');
        return (saved as 'light' | 'dark') || 'dark';
    });

    React.useEffect(() => {
        const handleStorageChange = () => {
            const newTheme = localStorage.getItem('theme') as 'light' | 'dark' || 'dark';
            setTheme(newTheme);
        };

        window.addEventListener('storage', handleStorageChange);
        const interval = setInterval(handleStorageChange, 100);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            clearInterval(interval);
        };
    }, []);

    return theme;
};

const ConnectionStatusPanel: React.FC = () => {
    const theme = useTheme();
    const {
        isConnected,
        connectionStage,
        error,
        scanForDevices,
        disconnectDevice,
    } = useUnifiedBle();

    const {
        deviceInfo,
        buttons,
        isDirty,
        lastSaved,
        isLoading
    } = useDeviceConfig();

    const configuredButtons = buttons.filter(b => b.action && b.action !== '').length;

    // Styles avec nuances de gris
    const getThemedStyle = () => ({
        // Backgrounds
        cardBg: theme === 'dark' ? '#1a1a1a' : '#ffffff',
        itemBg: theme === 'dark' ? '#0f0f0f' : '#f8f9fa',
        border: theme === 'dark' ? '#333333' : '#dee2e6',
        borderLight: theme === 'dark' ? '#222222' : '#e9ecef',

        // Text colors
        textPrimary: theme === 'dark' ? '#ffffff' : '#212529',
        textSecondary: theme === 'dark' ? '#999999' : '#6c757d',
        textMuted: theme === 'dark' ? '#666666' : '#868e96',

        // Button colors
        btnPrimary: theme === 'dark' ? '#ffffff' : '#007bff',
        btnPrimaryText: theme === 'dark' ? '#000000' : '#ffffff',
        btnDanger: '#ff6b35',
        btnDangerHover: '#e55a2b'
    });

    const themedStyle = getThemedStyle();

    return (
        <div style={{
            padding: '20px',
            backgroundColor: themedStyle.cardBg,
            border: `1px solid ${themedStyle.border}`,
            borderRadius: '8px',
            marginBottom: '24px',
            boxShadow: theme === 'light' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none'
        }}>
            {/* Header avec action principale */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px'
            }}>
                <h2 style={{
                    margin: 0,
                    fontSize: '16px',
                    fontWeight: '600',
                    color: themedStyle.textPrimary
                }}>
                    Device Connection
                </h2>

                {isConnected ? (
                    <button
                        onClick={disconnectDevice}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: 'transparent',
                            color: themedStyle.btnDanger,
                            border: `1px solid ${themedStyle.btnDanger}`,
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '500',
                            transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = themedStyle.btnDanger;
                            e.currentTarget.style.color = '#ffffff';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = themedStyle.btnDanger;
                        }}
                    >
                        Disconnect
                    </button>
                ) : (
                    <button
                        onClick={scanForDevices}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: themedStyle.btnPrimary,
                            color: themedStyle.btnPrimaryText,
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '500',
                            transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.opacity = '0.9';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.opacity = '1';
                        }}
                    >
                        Connect Device
                    </button>
                )}
            </div>

            {/* Status Grid avec meilleurs contrastes */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '12px'
            }}>
                {/* Connection */}
                <div style={{
                    padding: '12px',
                    backgroundColor: themedStyle.itemBg,
                    borderRadius: '6px',
                    border: `1px solid ${themedStyle.borderLight}`
                }}>
                    <div style={{ fontSize: '11px', color: themedStyle.textMuted, marginBottom: '4px' }}>
                        CONNECTION
                    </div>
                    <div style={{
                        fontSize: '13px',
                        fontWeight: '600',
                        color: isConnected ? '#28a745' : '#dc3545',
                        marginBottom: '2px'
                    }}>
                        {isConnected ? 'Connected' : 'Disconnected'}
                    </div>
                    <div style={{ fontSize: '10px', color: themedStyle.textSecondary }}>
                        {connectionStage}
                    </div>
                </div>

                {/* Device */}
                <div style={{
                    padding: '12px',
                    backgroundColor: themedStyle.itemBg,
                    borderRadius: '6px',
                    border: `1px solid ${themedStyle.borderLight}`
                }}>
                    <div style={{ fontSize: '11px', color: themedStyle.textMuted, marginBottom: '4px' }}>
                        DEVICE
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: themedStyle.textPrimary, marginBottom: '2px' }}>
                        {deviceInfo?.name || 'ArmDeck'}
                    </div>
                    <div style={{ fontSize: '10px', color: themedStyle.textSecondary }}>
                        {deviceInfo?.firmware ? `v${deviceInfo.firmware}` : 'Firmware unknown'}
                    </div>
                </div>

                {/* Configuration */}
                <div style={{
                    padding: '12px',
                    backgroundColor: themedStyle.itemBg,
                    borderRadius: '6px',
                    border: `1px solid ${themedStyle.borderLight}`
                }}>
                    <div style={{ fontSize: '11px', color: themedStyle.textMuted, marginBottom: '4px' }}>
                        CONFIGURATION
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: themedStyle.textPrimary, marginBottom: '2px' }}>
                        {configuredButtons}/12
                    </div>
                    <div style={{ fontSize: '10px', color: themedStyle.textSecondary }}>
                        {isDirty ? 'Pending sync' : 'Synchronized'}
                    </div>
                </div>

                {/* Status */}
                <div style={{
                    padding: '12px',
                    backgroundColor: themedStyle.itemBg,
                    borderRadius: '6px',
                    border: `1px solid ${themedStyle.borderLight}`
                }}>
                    <div style={{ fontSize: '11px', color: themedStyle.textMuted, marginBottom: '4px' }}>
                        STATUS
                    </div>
                    <div style={{
                        fontSize: '13px',
                        fontWeight: '600',
                        color: isLoading ? '#ffc107' : '#28a745',
                        marginBottom: '2px'
                    }}>
                        {isLoading ? 'Syncing' : 'Ready'}
                    </div>
                    <div style={{ fontSize: '10px', color: themedStyle.textSecondary }}>
                        {lastSaved ? `Last: ${lastSaved.toLocaleTimeString()}` : 'Not synced'}
                    </div>
                </div>
            </div>

            {/* Error (si présent) */}
            {error && (
                <div style={{
                    marginTop: '12px',
                    padding: '10px',
                    backgroundColor: theme === 'dark' ? '#2d1617' : '#f8d7da',
                    border: '1px solid #dc3545',
                    borderRadius: '6px',
                    fontSize: '12px',
                    color: '#dc3545'
                }}>
                    <strong>Error:</strong> {error}
                </div>
            )}
        </div>
    );
};

export default ConnectionStatusPanel;