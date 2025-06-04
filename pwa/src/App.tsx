import { useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import KeyGrid from './components/KeyGrid';
import MacroList from './components/MacroList';
import ConnectionStatusPanel from './components/ConnectionStatusPanel';
import { BleProvider, useBleContext } from './hooks/BleProvider';
import useTheme from './hooks/useTheme';
import './styles/main.scss';

const AppContent = () => {
  const {
    isConnected,
    isFullyConnected,
    error,
    connectionStage,
    deviceInfo,
  } = useBleContext();

  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.className = `theme-${theme}`;
  }, [theme]);

  // Debug: Log des états de connexion
  useEffect(() => {
    console.log('🔍 [App] Connection state:', {
      isConnected,
      isFullyConnected,
      connectionStage,
      hasError: !!error,
      deviceInfo: deviceInfo ?
          `${deviceInfo.device_name} v${deviceInfo.firmware_major}.${deviceInfo.firmware_minor}.${deviceInfo.firmware_patch}`
          : 'None',
      timestamp: new Date().toISOString()
    });
  }, [isConnected, isFullyConnected, connectionStage, error, deviceInfo]);

  return (
      <DndProvider backend={HTML5Backend}>
        <div className="app">
          <header className="app-header">
            <div className="container">
              <div className="header-content">
                <div className="brand">
                  <h1 className="brand-title">ArmDeck</h1>
                  <span className="brand-subtitle">Configuration Tool</span>
                  {deviceInfo && (
                      <span className="brand-device-info">
                    {deviceInfo.device_name} v{deviceInfo.firmware_major}.{deviceInfo.firmware_minor}.{deviceInfo.firmware_patch}
                  </span>
                  )}
                </div>

                <div className="header-controls">
                  <div className={`connection-status ${isFullyConnected ? 'fully-connected' : isConnected ? 'connected' : 'disconnected'}`}>
                  <span className="connection-status__text">
                    {isFullyConnected ? 'Ready' : isConnected ? 'Partial' : connectionStage || 'Disconnected'}
                  </span>
                    <div className={`connection-status__indicator ${isFullyConnected ? 'fully-connected' : isConnected ? 'connected' : 'disconnected'}`} />
                  </div>

                  <button
                      onClick={toggleTheme}
                      className="theme-toggle"
                      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                  >
                    {theme === 'light' ? '🌙' : '☀️'}
                  </button>
                </div>
              </div>
            </div>
          </header>

          <main className="main-content">
            <div className="container">
              <div className="layout">
                <div className="content-area">
                  <ConnectionStatusPanel />
                  <KeyGrid />
                </div>

                <aside className="sidebar">
                  <MacroList />

                  <div className="quick-guide">
                    <h3>Quick Guide</h3>
                    <div className="guide-content">
                      <div><strong>Connect:</strong> Pair with your ArmDeck device</div>
                      <div><strong>Configure:</strong> Click buttons to assign actions</div>
                      <div><strong>Drag:</strong> Drop macros onto buttons</div>
                      <div><strong>Save:</strong> Apply changes with the save button</div>
                    </div>
                  </div>

                  {/* Device info panel in sidebar */}
                  {deviceInfo && isFullyConnected && deviceInfo.battery_level > 0 && (
                      <div className="device-info-panel">
                        <h3>Device Status</h3>
                        <div className="device-info-content">
                          <div className="info-item">
                            <span className="info-label">Battery:</span>
                            <span className={`info-value ${
                                deviceInfo.battery_level > 50 ? 'status-good' :
                                    deviceInfo.battery_level > 20 ? 'status-warning' : 'status-critical'
                            }`}>
                          {deviceInfo.battery_level}%
                        </span>
                          </div>
                          {deviceInfo.free_heap > 0 && (
                              <div className="info-item">
                                <span className="info-label">Memory:</span>
                                <span className="info-value">
                            {Math.floor(deviceInfo.free_heap / 1024)}KB free
                          </span>
                              </div>
                          )}
                          {deviceInfo.uptime_seconds > 0 && (
                              <div className="info-item">
                                <span className="info-label">Uptime:</span>
                                <span className="info-value">
                            {Math.floor(deviceInfo.uptime_seconds / 60)}min
                          </span>
                              </div>
                          )}
                        </div>
                      </div>
                  )}

                  {/* Debug panel pour le développement */}
                  {process.env.NODE_ENV === 'development' && (
                      <div className="debug-panel">
                        <h4>🔧 Debug Info</h4>
                        <div className="debug-info">
                          <div><strong>Connected:</strong> {isConnected ? 'Yes' : 'No'}</div>
                          <div><strong>Fully Connected:</strong> {isFullyConnected ? 'Yes' : 'No'}</div>
                          <div><strong>Stage:</strong> {connectionStage}</div>
                          <div><strong>Error:</strong> {error ? 'Yes' : 'No'}</div>
                          <div><strong>Device:</strong> {deviceInfo?.device_name || 'None'}</div>
                          <div><strong>Firmware:</strong> {deviceInfo ?
                              `v${deviceInfo.firmware_major}.${deviceInfo.firmware_minor}.${deviceInfo.firmware_patch}` : 'Unknown'}</div>
                          <div><strong>Protocol:</strong> {deviceInfo?.protocol_version || 'Unknown'}</div>
                          <div><strong>Architecture:</strong> Context + Unified Hook v2 ✅</div>
                        </div>
                      </div>
                  )}

                  {error && (
                      <div className="error-display">
                        <strong>Connection Error:</strong><br />
                        {error.length > 80 ? `${error.substring(0, 80)}...` : error}
                      </div>
                  )}
                </aside>
              </div>
            </div>
          </main>

          <footer className="app-footer">
            <div className="container">
              <div className="footer-content">
                <span>ArmDeck Configuration Tool</span>
                <span>Built with React + ESP32</span>
                {deviceInfo && (
                    <span>Connected to {deviceInfo.device_name}</span>
                )}
                {process.env.NODE_ENV === 'development' && (
                    <span className="dev-badge">Development Mode</span>
                )}
              </div>
            </div>
          </footer>
        </div>
      </DndProvider>
  );
};

// Composant principal avec Provider
function App() {
  return (
      <BleProvider>
        <AppContent />
      </BleProvider>
  );
}

export default App;
