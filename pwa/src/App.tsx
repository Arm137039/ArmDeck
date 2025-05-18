import { useState, useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import KeyGrid from './components/KeyGrid';
import MacroList from './components/MacroList';
import BatteryWidget from './components/BatteryWidget';
import useUnifiedBle from './hooks/useUnifiedBle';

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
    scanForDevices,
    disconnectDevice,
    sendFirmwareChunk
  } = useUnifiedBle();
  const [otaProgress, setOtaProgress] = useState<number | null>(null);

  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme);

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
            </div>
            <div className="connection-status">
              {isConnected ? (
                  <>
                    <span className="status-connected">Connected</span>
                    <button className="disconnect-button" onClick={disconnectDevice}>Disconnect</button>
                  </>
              ) : (
                  <button className="connect-button" onClick={scanForDevices}>Connect to Device</button>
              )}
            </div>
          </header>

          <div className="app-content">
            <div className="main-content">
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
            </div>
          </div>

          <footer>
            <p>ArmDeck Configuration Tool</p>
          </footer>
        </div>
      </DndProvider>
  );
}

export default App;