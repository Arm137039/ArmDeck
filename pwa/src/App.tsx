import { useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import KeyGrid from './components/KeyGrid';
import MacroList from './components/MacroList';
import ConnectionStatusPanel from './components/ConnectionStatusPanel';
import useBle from './hooks/useBle';
import useTheme from './hooks/useTheme';
import './styles/main.scss';

function App() {
  const { isConnected, error } = useBle();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.className = `theme-${theme}`;
  }, [theme]);

  return (
      <DndProvider backend={HTML5Backend}>
        <div className="app">
          <header className="app-header">
            <div className="container">
              <div className="header-content">
                <div className="brand">
                  <h1 className="brand-title">ArmDeck</h1>
                  <span className="brand-subtitle">Configuration Tool</span>
                </div>

                <div className="header-controls">
                  <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
                    {isConnected ? 'Connected' : 'Disconnected'}
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
                      <div><strong>Auto-save:</strong> Changes sync automatically</div>
                    </div>
                  </div>

                  {error && (
                      <div className="error-display">
                        <strong>Connection Error:</strong><br />
                        {error.length > 60 ? `${error.substring(0, 60)}...` : error}
                      </div>
                  )}
                </aside>
              </div>
            </div>
          </main>

          <footer className="app-footer">
            ArmDeck Configuration Tool • Built with React + ESP32
          </footer>
        </div>
      </DndProvider>
  );
}

export default App;