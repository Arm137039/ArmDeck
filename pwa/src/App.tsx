import { useState, useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import KeyGrid from './components/KeyGrid';
import MacroList from './components/MacroList';
import BatteryWidget from './components/BatteryWidget';
import DebugPanel from './components/DebugPanel';
import useUnifiedBle from './hooks/useBle.ts';

const getInitialTheme = (): 'light' | 'dark' => {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark' || savedTheme === 'light') {
    return savedTheme as 'light' | 'dark';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

function App() {
  const {
    isConnected,
    batteryLevel,
    connectionStage,
    error,
    scanForDevices,
    disconnectDevice,
  } = useUnifiedBle();

  const [otaProgress, setOtaProgress] = useState<number | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme);
  const [showDebug, setShowDebug] = useState<boolean>(true);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('theme')) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  const toggleDebug = () => {
    setShowDebug(!showDebug);
  };

  return (
      <DndProvider backend={HTML5Backend}>
        <div className="app-container">
          <header className="app-header">
            <div className="header-left">
              <h1>ArmDeck</h1>
              <button
                  className="theme-toggle-button"
                  onClick={toggleTheme}
                  aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              >
                {theme === 'light' ? '🌙' : '☀️'}
              </button>
              <button
                  className="debug-toggle-button"
                  onClick={toggleDebug}
                  style={{
                    marginLeft: '10px',
                    padding: '8px 12px',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                    backgroundColor: showDebug ? '#007bff' : '#f8f9fa',
                    color: showDebug ? 'white' : 'black',
                    cursor: 'pointer'
                  }}
              >
                🔧 Debug
              </button>
            </div>
            <div className="connection-status">
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <div style={{ marginBottom: '4px' }}>
                  {isConnected ? (
                      <>
                        <span className="status-connected">✅ {connectionStage}</span>
                        <button className="disconnect-button" onClick={disconnectDevice}>
                          Disconnect
                        </button>
                      </>
                  ) : (
                      <button className="connect-button" onClick={scanForDevices}>
                        Connect to Device
                      </button>
                  )}
                </div>
                {error && (
                    <div style={{
                      fontSize: '12px',
                      color: 'red',
                      maxWidth: '300px',
                      textAlign: 'right',
                      wordBreak: 'break-word'
                    }}>
                      ❌ {error}
                    </div>
                )}
              </div>
            </div>
          </header>

          <div className="app-content">
            <div className="main-content">
              {showDebug && <DebugPanel />}

              <KeyGrid />

              {otaProgress !== null && (
                  <div className="ota-progress">
                    <h3>Firmware Update</h3>
                    <div className="progress-bar">
                      <div className="progress" style={{ width: `${otaProgress}%` }}></div>
                    </div>
                    <span>{otaProgress}%</span>
                  </div>
              )}

              <MacroList />
            </div>

            <div className="right-panel">
              <BatteryWidget alwaysShow={true} />

              <div style={{
                marginTop: '20px',
                padding: '15px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                backgroundColor: theme === 'dark' ? '#2a2a2a' : '#f9f9f9'
              }}>
                <h4 style={{ margin: '0 0 10px 0' }}>📡 Connection Status</h4>
                <div style={{ fontSize: '14px' }}>
                  <p><strong>Status:</strong> {connectionStage}</p>
                  <p><strong>Connected:</strong> {isConnected ? '✅ Yes' : '❌ No'}</p>
                  <p><strong>Battery:</strong> {batteryLevel !== null ? `${batteryLevel}%` : 'N/A'}</p>
                </div>
              </div>

              <div style={{
                marginTop: '20px',
                padding: '15px',
                border: '1px solid #007bff',
                borderRadius: '8px',
                backgroundColor: theme === 'dark' ? '#1a1a2e' : '#e7f3ff'
              }}>
                <h4 style={{ margin: '0 0 10px 0', color: '#007bff' }}>🧪 Test Instructions</h4>
                <div style={{ fontSize: '12px', lineHeight: '1.4' }}>
                  <p>1. Click "Connect to Device"</p>
                  <p>2. Wait for "Fully Connected" status</p>
                  <p>3. Use Debug Panel to test commands</p>
                  <p>4. Check browser console for logs</p>
                </div>
              </div>
            </div>
          </div>

          <footer>
            <p>ArmDeck Configuration Tool - Debug Mode {showDebug ? 'ON' : 'OFF'}</p>
          </footer>
        </div>
      </DndProvider>
  );
}

export default App;