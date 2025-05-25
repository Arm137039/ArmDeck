import React, { useState, useEffect, useRef } from 'react';
import useUnifiedBle from '../hooks/useBle.ts';

interface LogEntry {
    timestamp: string;
    level: 'info' | 'success' | 'error' | 'warning';
    message: string;
}

const DebugPanel: React.FC = () => {
    const {
        isConnected,
        connectionStage,
        batteryLevel,
        error,
        sendCommand,
        sendKeymap,
        readBatteryLevel
    } = useUnifiedBle();

    const [commandInput, setCommandInput] = useState('0x10');
    const [keymapInput, setKeymapInput] = useState('{"version":1,"buttons":[{"id":0,"key":"a"}]}');
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isLogVisible, setIsLogVisible] = useState(false);
    const logsEndRef = useRef<HTMLDivElement>(null);

    const addLog = (level: LogEntry['level'], message: string) => {
        const newLog: LogEntry = {
            timestamp: new Date().toLocaleTimeString(),
            level,
            message
        };
        setLogs(prev => [...prev.slice(-49), newLog]); // Garder les 50 derniers logs
    };

    // Auto-scroll to bottom of logs
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    // Monitor connection changes
    useEffect(() => {
        if (isConnected) {
            addLog('success', `Connected: ${connectionStage}`);
        } else if (connectionStage !== 'Disconnected') {
            addLog('warning', `Connection status: ${connectionStage}`);
        }
    }, [isConnected, connectionStage]);

    // Monitor errors
    useEffect(() => {
        if (error) {
            addLog('error', `Error: ${error}`);
        }
    }, [error]);

    // Monitor battery level changes
    useEffect(() => {
        if (batteryLevel !== null) {
            addLog('info', `Battery level: ${batteryLevel}%`);
        }
    }, [batteryLevel]);

    const handleSendCommand = async () => {
        if (!isConnected) {
            addLog('error', 'Device not connected');
            return;
        }

        try {
            addLog('info', `Sending command: ${commandInput}`);
            await sendCommand(commandInput);
            addLog('success', 'Command sent successfully');
        } catch (err) {
            addLog('error', `Failed to send command: ${err}`);
        }
    };

    const handleSendKeymap = async () => {
        if (!isConnected) {
            addLog('error', 'Device not connected');
            return;
        }

        try {
            addLog('info', `Sending keymap (${keymapInput.length} chars)`);
            await sendKeymap(keymapInput);
            addLog('success', 'Keymap sent successfully');
        } catch (err) {
            addLog('error', `Failed to send keymap: ${err}`);
        }
    };

    const handleRefreshBattery = async () => {
        if (!isConnected) {
            addLog('error', 'Device not connected');
            return;
        }

        try {
            addLog('info', 'Reading battery level...');
            const level = await readBatteryLevel();
            addLog('success', `Battery level read: ${level}%`);
        } catch (err) {
            addLog('error', `Failed to read battery: ${err}`);
        }
    };

    const clearLogs = () => {
        setLogs([]);
        addLog('info', 'Logs cleared');
    };

    const quickCommands = [
        { name: 'Keep-alive Test', command: '0x10', desc: 'Test HID keep-alive' },
        { name: 'Restart Device', command: '0x01', desc: 'Restart ESP32' },
        { name: 'Status Check', command: '0x20', desc: 'Device status' },
    ];

    const getLogColor = (level: LogEntry['level']) => {
        switch (level) {
            case 'success': return '#28a745';
            case 'error': return '#dc3545';
            case 'warning': return '#ffc107';
            default: return '#6c757d';
        }
    };

    const getLogIcon = (level: LogEntry['level']) => {
        switch (level) {
            case 'success': return '✅';
            case 'error': return '❌';
            case 'warning': return '⚠️';
            default: return 'ℹ️';
        }
    };

    return (
        <div style={{
            padding: '20px',
            border: '2px solid #007bff',
            borderRadius: '12px',
            marginBottom: '20px',
            backgroundColor: '#f8f9fa',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <h3 style={{ margin: 0, color: '#007bff' }}>🔧 ArmDeck Debug Panel</h3>
                <button
                    onClick={() => setIsLogVisible(!isLogVisible)}
                    style={{
                        padding: '6px 12px',
                        backgroundColor: '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    {isLogVisible ? '📄 Hide Logs' : '📄 Show Logs'}
                </button>
            </div>

            {/* Status Grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '15px',
                marginBottom: '20px'
            }}>
                <div style={{
                    padding: '10px',
                    backgroundColor: isConnected ? '#d4edda' : '#f8d7da',
                    border: `1px solid ${isConnected ? '#c3e6cb' : '#f5c6cb'}`,
                    borderRadius: '6px'
                }}>
                    <strong>🔗 Connection:</strong> {isConnected ? '✅ Connected' : '❌ Disconnected'}
                    <br />
                    <small>{connectionStage}</small>
                </div>

                <div style={{
                    padding: '10px',
                    backgroundColor: '#d1ecf1',
                    border: '1px solid #bee5eb',
                    borderRadius: '6px'
                }}>
                    <strong>🔋 Battery:</strong> {batteryLevel !== null ? `${batteryLevel}%` : 'N/A'}
                    <br />
                    <small>Last updated: {batteryLevel !== null ? 'now' : 'never'}</small>
                </div>

                <div style={{
                    padding: '10px',
                    backgroundColor: error ? '#f8d7da' : '#d4edda',
                    border: `1px solid ${error ? '#f5c6cb' : '#c3e6cb'}`,
                    borderRadius: '6px'
                }}>
                    <strong>⚠️ Status:</strong> {error ? 'Error' : 'OK'}
                    <br />
                    <small style={{ color: error ? '#721c24' : '#155724' }}>
                        {error ? error.substring(0, 30) + '...' : 'All systems normal'}
                    </small>
                </div>
            </div>

            {/* Quick Actions */}
            <div style={{ marginBottom: '20px' }}>
                <h4 style={{ marginBottom: '10px' }}>⚡ Quick Actions</h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
                    <button
                        onClick={handleRefreshBattery}
                        disabled={!isConnected}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#17a2b8',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: isConnected ? 'pointer' : 'not-allowed',
                            opacity: isConnected ? 1 : 0.6
                        }}
                    >
                        🔋 Refresh Battery
                    </button>

                    {quickCommands.map((cmd, index) => (
                        <button
                            key={index}
                            onClick={() => {
                                setCommandInput(cmd.command);
                                handleSendCommand();
                            }}
                            disabled={!isConnected}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: '#28a745',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: isConnected ? 'pointer' : 'not-allowed',
                                opacity: isConnected ? 1 : 0.6
                            }}
                            title={cmd.desc}
                        >
                            {cmd.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Custom Command */}
            <div style={{ marginBottom: '20px' }}>
                <h4 style={{ marginBottom: '10px' }}>📝 Custom Command</h4>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <input
                        type="text"
                        value={commandInput}
                        onChange={(e) => setCommandInput(e.target.value)}
                        placeholder="0x10 or text command"
                        style={{
                            padding: '8px',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            flex: 1,
                            maxWidth: '200px'
                        }}
                    />
                    <button
                        onClick={handleSendCommand}
                        disabled={!isConnected}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: isConnected ? 'pointer' : 'not-allowed',
                            opacity: isConnected ? 1 : 0.6
                        }}
                    >
                        Send Command
                    </button>
                </div>
            </div>

            {/* Keymap Test */}
            <div style={{ marginBottom: '20px' }}>
                <h4 style={{ marginBottom: '10px' }}>🎹 Keymap Test</h4>
                <textarea
                    value={keymapInput}
                    onChange={(e) => setKeymapInput(e.target.value)}
                    rows={3}
                    style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        fontFamily: 'monospace',
                        fontSize: '12px'
                    }}
                    placeholder="JSON keymap configuration"
                />
                <div style={{ marginTop: '10px' }}>
                    <button
                        onClick={handleSendKeymap}
                        disabled={!isConnected}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: '#6f42c1',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: isConnected ? 'pointer' : 'not-allowed',
                            opacity: isConnected ? 1 : 0.6
                        }}
                    >
                        Send Keymap
                    </button>
                </div>
            </div>

            {/* Logs */}
            {isLogVisible && (
                <div style={{ marginTop: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <h4 style={{ margin: 0 }}>📋 Live Logs</h4>
                        <button
                            onClick={clearLogs}
                            style={{
                                padding: '4px 8px',
                                backgroundColor: '#6c757d',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '12px',
                                cursor: 'pointer'
                            }}
                        >
                            Clear
                        </button>
                    </div>
                    <div style={{
                        maxHeight: '200px',
                        overflowY: 'auto',
                        backgroundColor: '#2d3748',
                        color: 'white',
                        padding: '10px',
                        borderRadius: '4px',
                        fontFamily: 'monospace',
                        fontSize: '12px',
                        border: '1px solid #4a5568'
                    }}>
                        {logs.length === 0 ? (
                            <div style={{ color: '#a0aec0' }}>No logs yet...</div>
                        ) : (
                            logs.map((log, index) => (
                                <div key={index} style={{ marginBottom: '4px' }}>
                                    <span style={{ color: '#a0aec0' }}>{log.timestamp}</span>{' '}
                                    <span style={{ color: getLogColor(log.level) }}>
                    {getLogIcon(log.level)} {log.message}
                  </span>
                                </div>
                            ))
                        )}
                        <div ref={logsEndRef} />
                    </div>
                </div>
            )}

            {/* Instructions */}
            <div style={{
                fontSize: '12px',
                color: '#6c757d',
                backgroundColor: '#e9ecef',
                padding: '10px',
                borderRadius: '4px',
                marginTop: '15px'
            }}>
                <strong>📊 Pro Tips:</strong>
                <br />
                • Open browser console (F12) for detailed technical logs
                <br />
                • "Keep-alive Test" should show logs on ESP32 if services work
                <br />
                • Wait for "Fully Connected" before testing commands
                <br />
                • Battery readings test the custom service functionality
            </div>
        </div>
    );
};

export default DebugPanel;