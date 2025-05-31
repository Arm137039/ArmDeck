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
        isLoading
    } = useBleContext();

    const configuredButtons = buttons.filter(b => b.action && b.action !== '').length;

    // Status helpers
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
                    <div className="value">ArmDeck</div>
                    <div className="description">
                        Stream Deck 4x3
                        <div><small>15 programmable buttons</small></div>
                    </div>
                </div>

                <div className="connection-status-panel__card">
                    <div className="label">CONFIGURATION</div>
                    <div className="value">{configuredButtons}/15</div>
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
                    <div className={`value ${isLoading ? 'value--syncing' : isFullyConnected ? 'value--ready' : 'value--not-ready'}`}>
                        {isLoading ? 'Busy' : isFullyConnected ? 'Ready' : 'Limited'}
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
            </div>

            {/* Status bar */}
            <div className="connection-status-panel__status-bar">
                <div className={`status-indicator ${isFullyConnected ? 'ready' : 'not-ready'}`}>
                    <div className="status-icon">
                        {isFullyConnected ? '✅' : isConnected ? '⚠️' : '❌'}
                    </div>
                    <div className="status-text">
                        {isFullyConnected ?
                            'Ready for configuration changes' :
                            isConnected ?
                                'Partial connection - limited functionality' :
                                'Connect device to start configuration'
                        }
                    </div>
                </div>
            </div>

            {/* Debug info */}
            {process.env.NODE_ENV === 'development' && (
                <div className="connection-status-panel__debug">
                    <details>
                        <summary>🔧 Debug Information</summary>
                        <div className="debug-grid">
                            <div><strong>Connected:</strong> {isConnected ? '✅ Yes' : '❌ No'}</div>
                            <div><strong>Fully Connected:</strong> {isFullyConnected ? '✅ Yes' : '❌ No'}</div>
                            <div><strong>Connection Stage:</strong> {connectionStage}</div>
                            <div><strong>Is Scanning:</strong> {isScanning ? '🔄 Yes' : '✅ No'}</div>
                            <div><strong>Is Loading:</strong> {isLoading ? '🔄 Yes' : '✅ No'}</div>
                            <div><strong>Is Dirty:</strong> {isDirty ? '⚠️ Yes' : '✅ No'}</div>
                            <div><strong>Last Saved:</strong> {lastSaved?.toISOString() || 'Never'}</div>
                            <div><strong>Architecture:</strong> Unified Hook ✅</div>
                            <div><strong>Buttons Configured:</strong> {configuredButtons}/15</div>
                        </div>
                    </details>
                </div>
            )}

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
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ConnectionStatusPanel;

