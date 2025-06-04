import React from 'react';
import { useBleContext } from '../hooks/BleProvider';

const ConnectionStatusPanel: React.FC = () => {
    const {
        isConnected,
        isFullyConnected,
        connectionStage,
        error,
        connect,
        disconnect,
        isScanning,
        buttons,
        isDirty,
        lastSaved,
        isLoading,
        deviceInfo
    } = useBleContext();

    const configuredButtons = buttons.filter(b => b.action && b.action !== '').length;

    // Déterminer si l'appareil est en train d'initialiser sa connexion
    const isInitializing = isConnected && (!lastSaved || !deviceInfo);

    const getConnectionStatus = () => {
        if (isScanning) return 'Scanning...';
        if (isFullyConnected) return 'Fully Connected';
        if (isConnected) return 'Connected';
        return 'Disconnected';
    };

    const getConnectionClass = () => {
        if (isScanning) return 'connection-status-panel__card--scanning';
        if (isFullyConnected) return 'connection-status-panel__card--fully-connected';
        if (isConnected) return 'connection-status-panel__card--connected';
        return 'connection-status-panel__card--disconnected';
    };

    const getConfigurationStatus = () => {
        if (isLoading) return 'Syncing...';
        if (isDirty) return 'Pending changes';
        if (lastSaved) return 'Synchronized';
        return 'Not synced';
    };

    const getConfigurationClass = () => {
        if (isLoading) return 'value--syncing';
        if (isDirty) return 'value--dirty';
        if (lastSaved) return 'value--synced';
        return 'value--not-synced';
    };

    // Format uptime in a readable way
    const formatUptime = (seconds: number): string => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    };

    // Format memory in KB/MB
    const formatMemory = (bytes: number): string => {
        const kb = Math.floor(bytes / 1024);
        if (kb > 1024) {
            const mb = (kb / 1024).toFixed(1);
            return `${mb}MB`;
        }
        return `${kb}KB`;
    };

    return (
        <div className="connection-status-panel">
            <div className="connection-status-panel__header">
                <h2>Device Connection</h2>

                {isConnected ? (
                    <button
                        onClick={disconnect}
                        className="connection-status-panel__button connection-status-panel__button--disconnect"
                        disabled={isScanning}
                    >
                        Disconnect
                    </button>
                ) : (
                    <button
                        onClick={connect}
                        className="connection-status-panel__button connection-status-panel__button--connect"
                        disabled={isScanning}
                    >
                        {isScanning ? 'Scanning...' : 'Connect Device'}
                    </button>
                )}
            </div>

            <div className="connection-status-panel__grid">
                <div className={`connection-status-panel__card ${getConnectionClass()}`}>
                    <div className="label">CONNECTION</div>
                    <div className={`value ${isFullyConnected ? 'value--fully-connected' : isConnected ? 'value--connected' : 'value--disconnected'}`}>
                        {getConnectionStatus()}
                    </div>
                    <div className="description">
                        <div>{connectionStage}</div>
                        <div className="connection-level">
                            {isFullyConnected ? (
                                <small className="status-success">✅ Full functionality</small>
                            ) : isConnected ? (
                                <small className="status-warning">⚠️ Limited functionality</small>
                            ) : (
                                <small className="status-error">❌ Not connected</small>
                            )}
                        </div>
                    </div>
                </div>

                <div className="connection-status-panel__card">
                    <div className="label">DEVICE</div>
                    <div className="value">
                        {deviceInfo ? deviceInfo.device_name : 'ArmDeck'}
                    </div>
                    <div className="description">
                        {deviceInfo ? (
                            <>
                                <div>Firmware v{deviceInfo.firmware_major}.{deviceInfo.firmware_minor}.{deviceInfo.firmware_patch}</div>
                                <div><small>Protocol v{deviceInfo.protocol_version}</small></div>
                            </>
                        ) : (
                            <>
                                <div>Stream Deck 4x3</div>
                                <div><small>Device info not available</small></div>
                            </>
                        )}
                    </div>
                </div>

                <div className="connection-status-panel__card">
                    <div className="label">CONFIGURATION</div>
                    <div className="value">{configuredButtons}/{deviceInfo?.num_buttons || 15}</div>
                    <div className="description">
                        <div className={getConfigurationClass()}>
                            {getConfigurationStatus()}
                        </div>
                        {!isFullyConnected && isConnected && (
                            <div className="warning-text">
                                <small>⚠️ Need full connection to save</small>
                            </div>
                        )}
                    </div>
                </div>

                <div className="connection-status-panel__card">
                    <div className="label">STATUS</div>
                    <div className={`value ${isLoading || isInitializing ? 'value--syncing' : isFullyConnected ? 'value--ready' : 'value--not-ready'}`}>
                        {isLoading || isInitializing ? 'Busy' : isFullyConnected ? 'Ready' : 'Limited'}
                    </div>
                    <div className="description">
                        {lastSaved ? (
                            <>
                                Last sync: {lastSaved.toLocaleTimeString()}
                                <br />
                                <small className={isDirty ? 'status-dirty' : 'status-clean'}>
                                    {isDirty ? 'Changes pending' : 'Up to date'}
                                </small>
                            </>
                        ) : (
                            'Not synchronized'
                        )}
                    </div>
                </div>

                {/* Device stats - only show when we have device info */}
                {deviceInfo && deviceInfo.battery_level > 0 && (
                    <>
                        <div className="connection-status-panel__card">
                            <div className="label">BATTERY</div>
                            <div className={`value ${
                                deviceInfo.battery_level > 50 ? 'value--good' :
                                    deviceInfo.battery_level > 20 ? 'value--warning' : 'value--critical'
                            }`}>
                                {deviceInfo.battery_level}%
                            </div>
                            <div className="description">
                                <div className="battery-indicator">
                                    <div
                                        className="battery-fill"
                                        style={{
                                            width: `${deviceInfo.battery_level}%`,
                                            backgroundColor: deviceInfo.battery_level > 50 ? '#4CAF50' :
                                                deviceInfo.battery_level > 20 ? '#FF9800' : '#F44336'
                                        }}
                                    />
                                </div>
                                <small>
                                    {deviceInfo.battery_level > 50 ? 'Good' :
                                        deviceInfo.battery_level > 20 ? 'Low' : 'Critical'}
                                </small>
                            </div>
                        </div>

                        <div className="connection-status-panel__card">
                            <div className="label">SYSTEM</div>
                            <div className="value">{formatMemory(deviceInfo.free_heap)}</div>
                            <div className="description">
                                <div>Free Memory</div>
                                <div><small>Uptime: {formatUptime(deviceInfo.uptime_seconds)}</small></div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {error && (
                <div className="connection-status-panel__error">
                    <div className="error-header">
                        <strong>⚠️ Error:</strong>
                    </div>
                    <div className="error-message">
                        {error}
                    </div>
                    {error.includes('not found') && (
                        <div className="error-suggestions">
                            <p><strong>Troubleshooting:</strong></p>
                            <ul>
                                <li>Make sure your ESP32 is powered on</li>
                                <li>Check that Bluetooth is enabled</li>
                                <li>Try refreshing the page</li>
                                <li>Check chrome://bluetooth-internals for detailed info</li>
                                <li>Ensure firmware supports the new protocol</li>
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ConnectionStatusPanel;
