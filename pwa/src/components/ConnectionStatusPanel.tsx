import React from 'react';
import useBle from '../hooks/useBle';
import useDeviceConfig from '../hooks/useDeviceConfig';

const ConnectionStatusPanel: React.FC = () => {
    const {
        isConnected,
        connectionStage,
        error,
        scanForDevices,
        disconnectDevice,
    } = useBle();

    const {
        deviceInfo,
        buttons,
        isDirty,
        lastSaved,
        isLoading
    } = useDeviceConfig();

    const configuredButtons = buttons.filter(b => b.action && b.action !== '').length;

    return (
        <div className="connection-status-panel">
            <div className="connection-status-panel__header">
                <h2>Device Connection</h2>

                {isConnected ? (
                    <button
                        onClick={disconnectDevice}
                        className="connection-status-panel__button connection-status-panel__button--disconnect"
                    >
                        Disconnect
                    </button>
                ) : (
                    <button
                        onClick={scanForDevices}
                        className="connection-status-panel__button connection-status-panel__button--connect"
                    >
                        Connect Device
                    </button>
                )}
            </div>

            <div className="connection-status-panel__grid">
                <div className="connection-status-panel__card">
                    <div className="label">CONNECTION</div>
                    <div className={`value ${isConnected ? 'value--connected' : 'value--disconnected'}`}>
                        {isConnected ? 'Connected' : 'Disconnected'}
                    </div>
                    <div className="description">{connectionStage}</div>
                </div>

                <div className="connection-status-panel__card">
                    <div className="label">DEVICE</div>
                    <div className="value">{deviceInfo?.name || 'ArmDeck'}</div>
                    <div className="description">
                        {deviceInfo?.firmware ? `v${deviceInfo.firmware}` : 'Firmware unknown'}
                    </div>
                </div>

                <div className="connection-status-panel__card">
                    <div className="label">CONFIGURATION</div>
                    <div className="value">{configuredButtons}/12</div>
                    <div className="description">
                        {isDirty ? 'Pending sync' : 'Synchronized'}
                    </div>
                </div>

                <div className="connection-status-panel__card">
                    <div className="label">STATUS</div>
                    <div className={`value ${isLoading ? 'value--syncing' : 'value--ready'}`}>
                        {isLoading ? 'Syncing' : 'Ready'}
                    </div>
                    <div className="description">
                        {lastSaved ? `Last: ${lastSaved.toLocaleTimeString()}` : 'Not synced'}
                    </div>
                </div>
            </div>

            {error && (
                <div className="connection-status-panel__error">
                    <strong>Error:</strong> {error}
                </div>
            )}
        </div>
    );
};

export default ConnectionStatusPanel;