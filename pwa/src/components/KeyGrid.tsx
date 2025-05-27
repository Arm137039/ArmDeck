// components/KeyGrid.tsx - Version responsive avec thèmes corrigés
import React, { useState, useCallback, useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import useDeviceConfig, { ButtonConfig } from '../hooks/useDeviceConfig';
import { Macro } from '../data/macros';
import MacroModal from './MacroModal';

// Interface pour le drag & drop
interface DragItem {
  type: string;
  id: number | string;
  index?: number;
  label?: string;
  action?: string;
  category?: string;
}

// Hook pour obtenir le thème actuel
const useTheme = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved as 'light' | 'dark') || 'dark';
  });

  // Écouter les changements de thème
  React.useEffect(() => {
    const handleStorageChange = () => {
      const newTheme = localStorage.getItem('theme') as 'light' | 'dark' || 'dark';
      setTheme(newTheme);
    };

    window.addEventListener('storage', handleStorageChange);
    // Vérifier aussi périodiquement (pour les changements dans la même page)
    const interval = setInterval(handleStorageChange, 100);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  return theme;
};

// Composant bouton individuel
const ProfessionalKey = ({
                           buttonConfig,
                           index,
                           onKeyClick,
                           isDirty,
                           theme
                         }: {
  buttonConfig: ButtonConfig;
  index: number;
  onKeyClick: (index: number, element: HTMLDivElement) => void;
  isDirty: boolean;
  theme: 'light' | 'dark';
}) => {
  const keyRef = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag] = useDrag({
    type: 'key',
    item: { type: 'key', id: buttonConfig.id, index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: ['macro'],
    drop: (item: DragItem) => {
      if (item.type === 'macro' && item.label && item.action) {
        return {
          dropEffect: 'copy',
          targetIndex: index
        };
      }
      return undefined;
    },
  });

  const handleClick = () => {
    if (keyRef.current) {
      onKeyClick(index, keyRef.current);
    }
  };

  const getButtonStyle = () => ({
    backgroundColor: theme === 'dark' ? '#1a1a1a' : '#f8f9fa',
    border: isDirty ? '1px solid #ff6b35' : `1px solid ${theme === 'dark' ? '#333333' : '#dee2e6'}`,
    borderRadius: '8px',
    padding: '16px 12px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    position: 'relative' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100px',
    opacity: isDragging ? 0.6 : 1,
    transform: isDragging ? 'scale(0.98)' : 'scale(1)',
    boxShadow: isDirty ? '0 0 0 1px #ff6b35' : 'none'
  });

  const hoverStyle = {
    borderColor: theme === 'dark' ? '#555555' : '#adb5bd',
    backgroundColor: theme === 'dark' ? '#222222' : '#e9ecef'
  };

  return (
      <div
          ref={(node) => {
            keyRef.current = node;
            drag(drop(node));
          }}
          onClick={handleClick}
          style={getButtonStyle()}
          onMouseEnter={(e) => {
            Object.assign(e.currentTarget.style, hoverStyle);
          }}
          onMouseLeave={(e) => {
            const style = getButtonStyle();
            e.currentTarget.style.borderColor = style.border.split(' ')[2];
            e.currentTarget.style.backgroundColor = style.backgroundColor;
          }}
          className="professional-key"
      >
        {/* Indicateur de changement non sauvegardé */}
        {isDirty && (
            <div style={{
              position: 'absolute',
              top: '6px',
              right: '6px',
              width: '6px',
              height: '6px',
              backgroundColor: '#ff6b35',
              borderRadius: '50%'
            }} />
        )}

        {/* Numéro du bouton */}
        <div style={{
          position: 'absolute',
          top: '6px',
          left: '8px',
          fontSize: '10px',
          fontWeight: '500',
          color: theme === 'dark' ? '#666666' : '#6c757d',
          fontFamily: 'monospace'
        }}>
          {String(index + 1).padStart(2, '0')}
        </div>

        {/* Contenu principal */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '8px',
          width: '100%'
        }}>
          {/* Label principal */}
          <div style={{
            fontSize: '13px',
            fontWeight: '600',
            color: theme === 'dark' ? '#ffffff' : '#333333',
            textAlign: 'center',
            lineHeight: '1.2',
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {buttonConfig.label}
          </div>

          {/* Action/Code */}
          <div style={{
            fontSize: '10px',
            color: theme === 'dark' ? '#999999' : '#6c757d',
            textAlign: 'center',
            fontFamily: 'monospace',
            backgroundColor: theme === 'dark' ? '#0f0f0f' : '#e9ecef',
            padding: '2px 6px',
            borderRadius: '3px',
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {buttonConfig.action}
          </div>
        </div>
      </div>
  );
};

// Composant principal KeyGrid
const KeyGrid: React.FC = () => {
  const theme = useTheme();
  const {
    buttons,
    deviceInfo,
    isLoading,
    isDirty,
    lastSaved,
    error,
    saveConfig,
    resetConfig,
    updateButton,
  } = useDeviceConfig();

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedKeyIndex, setSelectedKeyIndex] = useState<number | null>(null);
  const [modalPosition, setModalPosition] = useState<{ x: number, y: number } | null>(null);

  // Styles dynamiques selon le thème
  const getThemedStyle = () => ({
    background: theme === 'dark' ? '#0a0a0a' : '#ffffff',
    cardBg: theme === 'dark' ? '#1a1a1a' : '#ffffff',
    border: theme === 'dark' ? '#333333' : '#dee2e6',
    textPrimary: theme === 'dark' ? '#ffffff' : '#333333',
    textSecondary: theme === 'dark' ? '#999999' : '#6c757d',
    gridBg: theme === 'dark' ? '#0f0f0f' : '#f8f9fa',
    gridBorder: theme === 'dark' ? '#222222' : '#e9ecef'
  });

  const themedStyle = getThemedStyle();

  // Gérer le clic sur un bouton
  const handleKeyClick = useCallback((index: number, element: HTMLDivElement) => {
    const rect = element.getBoundingClientRect();
    setSelectedKeyIndex(index);
    setModalPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    });
    setModalOpen(true);
  }, []);

  // Gérer la sélection d'une macro
  const handleSelectMacro = useCallback((macro: Macro) => {
    if (selectedKeyIndex !== null) {
      updateButton(selectedKeyIndex, {
        label: macro.label,
        action: macro.action,
        color: macro.color || '#333333'
      });
    }
  }, [selectedKeyIndex, updateButton]);

  // Gérer le drop d'une macro
  const handleDrop = useCallback((item: DragItem, targetIndex: number) => {
    if (item.type === 'macro' && item.label && item.action) {
      updateButton(targetIndex, {
        label: item.label as string,
        action: item.action as string,
        color: '#333333'
      });
    }
  }, [updateButton]);

  // Monitor global des drops
  const [, drop] = useDrop({
    accept: 'macro',
    drop: (item: DragItem, monitor) => {
      const dropResult = monitor.getDropResult<{ dropEffect: string, targetIndex: number }>();
      if (dropResult && dropResult.targetIndex !== undefined) {
        handleDrop(item, dropResult.targetIndex);
      }
    }
  });

  // Sauvegarder manuellement
  const handleManualSave = useCallback(async () => {
    try {
      await saveConfig();
    } catch (err) {
      console.error('Save failed:', err);
    }
  }, [saveConfig]);

  // Reset configuration
  const handleReset = useCallback(async () => {
    if (window.confirm('Reset all buttons to default configuration?')) {
      try {
        await resetConfig();
      } catch (err) {
        console.error('Reset failed:', err);
      }
    }
  }, [resetConfig]);

  const configuredButtons = buttons.filter(b => b.action && b.action !== '').length;

  return (
      <div style={{
        padding: '24px',
        maxWidth: '100%', // Responsive
        margin: '0 auto'
      }} ref={drop}>
        {/* Header */}
        <div style={{
          marginBottom: '32px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            <h1 style={{
              margin: '0 0 8px 0',
              fontSize: '24px',
              fontWeight: '700',
              color: themedStyle.textPrimary,
              letterSpacing: '-0.025em'
            }}>
              ArmDeck Configuration
            </h1>
            <p style={{
              margin: 0,
              color: themedStyle.textSecondary,
              fontSize: '14px',
              fontWeight: '400'
            }}>
              {deviceInfo ? `${deviceInfo.name} v${deviceInfo.firmware}` : 'Configure your StreamDeck layout'}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {/* Status */}
            <div style={{
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '500',
              backgroundColor: isDirty ?
                  (theme === 'dark' ? '#2d1b0f' : '#fff3cd') :
                  (lastSaved ? (theme === 'dark' ? '#0f1419' : '#d1edda') : themedStyle.cardBg),
              color: isDirty ? '#ff6b35' : (lastSaved ? '#4ade80' : themedStyle.textSecondary),
              border: `1px solid ${isDirty ? '#ff6b35' : (lastSaved ? '#4ade80' : themedStyle.border)}`
            }}>
              {isLoading ? 'Syncing...' :
                  isDirty ? 'Unsaved changes' :
                      lastSaved ? 'Saved' :
                          'Ready'}
            </div>

            {/* Actions */}
            <button
                onClick={handleManualSave}
                disabled={isLoading || !isDirty}
                style={{
                  padding: '8px 16px',
                  backgroundColor: isDirty ? (theme === 'dark' ? '#ffffff' : '#007bff') : themedStyle.border,
                  color: isDirty ? (theme === 'dark' ? '#000000' : '#ffffff') : themedStyle.textSecondary,
                  border: 'none',
                  borderRadius: '6px',
                  cursor: isDirty ? 'pointer' : 'not-allowed',
                  fontSize: '12px',
                  fontWeight: '500',
                  transition: 'all 0.2s ease'
                }}
            >
              Save All
            </button>

            <button
                onClick={handleReset}
                disabled={isLoading}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'transparent',
                  color: '#ff6b35',
                  border: '1px solid #ff6b35',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: '500',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#ff6b35';
                  e.currentTarget.style.color = '#ffffff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#ff6b35';
                }}
            >
              Reset
            </button>
          </div>
        </div>

        {/* Error display */}
        {error && (
            <div style={{
              padding: '12px 16px',
              backgroundColor: theme === 'dark' ? '#2d1617' : '#f8d7da',
              border: '1px solid #ff6b35',
              borderRadius: '8px',
              color: '#ff6b35',
              marginBottom: '24px',
              fontSize: '14px',
              fontWeight: '400'
            }}>
              {error}
            </div>
        )}

        {/* Grille principale - Plus large et responsive */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gridTemplateRows: 'repeat(3, 1fr)',
          gap: '16px', // Plus d'espace
          aspectRatio: '4/3',
          marginBottom: '32px',
          padding: '32px', // Plus de padding
          backgroundColor: themedStyle.gridBg,
          borderRadius: '12px',
          border: `1px solid ${themedStyle.gridBorder}`,
          width: '100%',
          maxWidth: '900px', // Plus large
          margin: '0 auto 32px auto'
        }}>
          {buttons.map((buttonConfig, index) => (
              <ProfessionalKey
                  key={index}
                  buttonConfig={buttonConfig}
                  index={index}
                  onKeyClick={handleKeyClick}
                  isDirty={buttonConfig.isDirty || false}
                  theme={theme}
              />
          ))}
        </div>

        {/* Stats bar - Plus lisible */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', // Plus large
          gap: '16px',
          marginBottom: '24px',
          maxWidth: '900px',
          margin: '0 auto 24px auto'
        }}>
          <div style={{
            padding: '20px', // Plus de padding
            backgroundColor: themedStyle.cardBg,
            border: `1px solid ${themedStyle.border}`,
            borderRadius: '8px'
          }}>
            <div style={{ fontSize: '12px', color: themedStyle.textSecondary, marginBottom: '6px' }}>
              Configuration
            </div>
            <div style={{ fontSize: '20px', fontWeight: '600', color: themedStyle.textPrimary }}>
              {configuredButtons}/12
            </div>
            <div style={{ fontSize: '11px', color: themedStyle.textSecondary }}>
              Buttons configured
            </div>
          </div>

          <div style={{
            padding: '20px',
            backgroundColor: themedStyle.cardBg,
            border: `1px solid ${themedStyle.border}`,
            borderRadius: '8px'
          }}>
            <div style={{ fontSize: '12px', color: themedStyle.textSecondary, marginBottom: '6px' }}>
              Last Sync
            </div>
            <div style={{ fontSize: '20px', fontWeight: '600', color: themedStyle.textPrimary }}>
              {lastSaved ? lastSaved.toLocaleTimeString() : '--:--'}
            </div>
            <div style={{ fontSize: '11px', color: themedStyle.textSecondary }}>
              {isDirty ? 'Pending changes' : 'Up to date'}
            </div>
          </div>

          <div style={{
            padding: '20px',
            backgroundColor: themedStyle.cardBg,
            border: `1px solid ${themedStyle.border}`,
            borderRadius: '8px'
          }}>
            <div style={{ fontSize: '12px', color: themedStyle.textSecondary, marginBottom: '6px' }}>
              Device Memory
            </div>
            <div style={{ fontSize: '20px', fontWeight: '600', color: themedStyle.textPrimary }}>
              {deviceInfo?.heap ? `${Math.round(deviceInfo.heap / 1024)}KB` : '--'}
            </div>
            <div style={{ fontSize: '11px', color: themedStyle.textSecondary }}>
              Free heap
            </div>
          </div>
        </div>

        {/* Modal */}
        <MacroModal
            isOpen={modalOpen}
            onClose={() => setModalOpen(false)}
            onSelectMacro={handleSelectMacro}
            position={modalPosition}
        />
      </div>
  );
};

export default KeyGrid;