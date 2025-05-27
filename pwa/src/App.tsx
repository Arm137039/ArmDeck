// App.tsx - Interface responsive avec thèmes corrigés
import { useState, useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import KeyGrid from './components/KeyGrid';
import MacroList from './components/MacroList';
import ConnectionStatusPanel from './components/ConnectionStatusPanel';
import useUnifiedBle from './hooks/useBle.ts';

const getInitialTheme = (): 'light' | 'dark' => {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark' || savedTheme === 'light') {
    return savedTheme as 'light' | 'dark';
  }
  return 'dark'; // Default to dark for professional look
};

function App() {
  const {
    isConnected,
    connectionStage,
    error,
  } = useUnifiedBle();

  const [theme, setTheme] = useState<'light' | 'dark'>(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);

    // Apply theme globally
    document.body.style.backgroundColor = theme === 'dark' ? '#0a0a0a' : '#f8f9fa';
    document.body.style.color = theme === 'dark' ? '#ffffff' : '#333333';
    document.body.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  // Dynamic styles based on theme
  const getThemedStyle = () => ({
    background: theme === 'dark' ? '#0a0a0a' : '#f8f9fa',
    color: theme === 'dark' ? '#ffffff' : '#333333',
    headerBg: theme === 'dark' ? '#0f0f0f' : '#ffffff',
    border: theme === 'dark' ? '#222222' : '#e0e0e0',
    cardBg: theme === 'dark' ? '#1a1a1a' : '#ffffff',
    textPrimary: theme === 'dark' ? '#ffffff' : '#333333',
    textSecondary: theme === 'dark' ? '#999999' : '#666666',
    textMuted: theme === 'dark' ? '#666666' : '#999999'
  });

  const themedStyle = getThemedStyle();

  return (
      <DndProvider backend={HTML5Backend}>
        <div style={{
          minHeight: '100vh',
          backgroundColor: themedStyle.background,
          color: themedStyle.textPrimary,
          transition: 'all 0.3s ease'
        }}>
          {/* Header responsive */}
          <header style={{
            padding: '16px 24px',
            backgroundColor: themedStyle.headerBg,
            borderBottom: `1px solid ${themedStyle.border}`,
            position: 'sticky',
            top: 0,
            zIndex: 100,
            backdropFilter: 'blur(8px)'
          }}>
            <div style={{
              maxWidth: '1400px', // Augmenté pour plus d'espace
              margin: '0 auto',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              {/* Logo/Title */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <h1 style={{
                  margin: 0,
                  fontSize: '20px',
                  fontWeight: '600',
                  letterSpacing: '-0.025em',
                  color: themedStyle.textPrimary
                }}>
                  ArmDeck
                </h1>
                <div style={{
                  padding: '4px 8px',
                  backgroundColor: themedStyle.cardBg,
                  border: `1px solid ${themedStyle.border}`,
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontWeight: '500',
                  color: themedStyle.textSecondary
                }}>
                  Configuration Tool
                </div>
              </div>

              {/* Status et contrôles */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px'
              }}>
                {/* Connection status - CORRIGÉ */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '6px 12px',
                  backgroundColor: isConnected ?
                      (theme === 'dark' ? '#0f1419' : '#f0f9ff') :
                      (theme === 'dark' ? '#2d1617' : '#fef2f2'),
                  border: `1px solid ${isConnected ? '#4ade80' : '#ff6b35'}`,
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '500',
                  color: isConnected ? '#4ade80' : '#ff6b35'
                }}>
                  <div style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: isConnected ? '#4ade80' : '#ff6b35'
                  }} />
                  {isConnected ? 'Connected' : 'Disconnected'}
                </div>

                {/* Theme toggle */}
                <button
                    onClick={toggleTheme}
                    style={{
                      padding: '8px',
                      borderRadius: '6px',
                      border: `1px solid ${themedStyle.border}`,
                      backgroundColor: 'transparent',
                      color: themedStyle.textPrimary,
                      cursor: 'pointer',
                      fontSize: '14px',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = themedStyle.cardBg;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                    title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                >
                  {theme === 'light' ? '🌙' : '☀️'}
                </button>
              </div>
            </div>
          </header>

          {/* Main content - Layout responsive amélioré */}
          <main style={{
            maxWidth: '1400px', // Augmenté pour plus d'espace
            margin: '0 auto'
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(800px, 1fr) 320px', // Min-width pour éviter l'écrasement
              gap: '24px',
              alignItems: 'start',
              padding: '24px'
            }}>
              {/* Zone principale */}
              <div style={{ minWidth: 0 }}> {/* Permet au contenu de se rétrécir */}
                {/* Connection panel */}
                <ConnectionStatusPanel />

                {/* Key Grid principal */}
                <KeyGrid />
              </div>

              {/* Sidebar fixe */}
              <div style={{
                position: 'sticky',
                top: '100px',
                minWidth: '320px' // Largeur fixe pour la sidebar
              }}>
                {/* Macro List */}
                <MacroList />

                {/* Quick Guide */}
                <div style={{
                  marginTop: '24px',
                  padding: '16px',
                  backgroundColor: themedStyle.cardBg,
                  border: `1px solid ${themedStyle.border}`,
                  borderRadius: '8px'
                }}>
                  <h3 style={{
                    margin: '0 0 12px 0',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: themedStyle.textPrimary
                  }}>
                    Quick Guide
                  </h3>
                  <div style={{
                    fontSize: '12px',
                    lineHeight: '1.5',
                    color: themedStyle.textSecondary
                  }}>
                    <div style={{ marginBottom: '6px' }}>
                      <strong style={{ color: themedStyle.textPrimary }}>Connect:</strong> Pair with your ArmDeck device
                    </div>
                    <div style={{ marginBottom: '6px' }}>
                      <strong style={{ color: themedStyle.textPrimary }}>Configure:</strong> Click buttons to assign actions
                    </div>
                    <div style={{ marginBottom: '6px' }}>
                      <strong style={{ color: themedStyle.textPrimary }}>Drag:</strong> Drop macros onto buttons
                    </div>
                    <div>
                      <strong style={{ color: themedStyle.textPrimary }}>Auto-save:</strong> Changes sync automatically
                    </div>
                  </div>
                </div>

                {/* Error display in sidebar */}
                {error && (
                    <div style={{
                      marginTop: '16px',
                      padding: '12px',
                      backgroundColor: theme === 'dark' ? '#2d1617' : '#fef2f2',
                      border: '1px solid #ff6b35',
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: '#ff6b35'
                    }}>
                      <strong>Connection Error:</strong><br />
                      {error.length > 60 ? `${error.substring(0, 60)}...` : error}
                    </div>
                )}
              </div>
            </div>
          </main>

          {/* Footer minimal */}
          <footer style={{
            padding: '24px',
            textAlign: 'center',
            fontSize: '11px',
            color: themedStyle.textMuted,
            borderTop: `1px solid ${themedStyle.border}`,
            marginTop: '48px'
          }}>
            ArmDeck Configuration Tool • Built with React + ESP32
          </footer>
        </div>
      </DndProvider>
  );
}

export default App;