import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { useBleContext } from '../hooks/BleProvider'; // 🔥 Context au lieu du hook direct
import { ButtonConfig } from '../hooks/useBle';
import { Macro } from '../data/macros';
import MacroModal from './MacroModal';

interface DragItem {
  type: string;
  id: number | string;
  index?: number;
  label?: string;
  action?: string;
  category?: string;
}

const ProfessionalKey = ({
                           buttonConfig,
                           index,
                           onKeyClick,
                           isDirty,
                           isConnectionReady
                         }: {
  buttonConfig: ButtonConfig;
  index: number;
  onKeyClick: (index: number, element: HTMLDivElement) => void;
  isDirty: boolean;
  isConnectionReady: boolean;
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

  const combineRefs = useCallback((node: HTMLDivElement | null) => {
    // Assigner la référence
    (keyRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    // Combiner les refs de drag et drop
    drag(drop(node));
  }, [drag, drop]);

  return (
      <div
          ref={combineRefs}
          onClick={handleClick}
          className={`professional-key 
        ${isDirty ? 'professional-key--dirty' : ''} 
        ${isDragging ? 'professional-key--dragging' : ''}
        ${!isConnectionReady ? 'professional-key--disabled' : ''}
      `}
          title={!isConnectionReady ? 'Device not fully connected - changes will not be saved' : ''}
      >
        {isDirty && <div className="professional-key__dirty-indicator" />}
        {!isConnectionReady && <div className="professional-key__warning-indicator">⚠️</div>}

        <div className="professional-key__number">
          {String(index + 1).padStart(2, '0')}
        </div>

        <div className="professional-key__content">
          <div className="professional-key__label">
            {buttonConfig.label}
          </div>
          <div className="professional-key__action">
            {buttonConfig.action}
          </div>
        </div>

        <div className="professional-key__color-indicator"
             style={{ backgroundColor: buttonConfig.color || '#333333' }} />
      </div>
  );
};

const KeyGrid: React.FC = () => {
  // 🔥 Context au lieu du hook direct
  const {
    isFullyConnected,
    buttons,
    isLoading,
    isDirty,
    lastSaved,
    error,
    saveConfig,
    resetConfig,
    updateButton,
    connectionStage
  } = useBleContext();

  // 🔥 DEBUG: Log des changements d'état
  useEffect(() => {
    console.log('🔍 [KeyGrid] isFullyConnected changed to:', isFullyConnected);
  }, [isFullyConnected]);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedKeyIndex, setSelectedKeyIndex] = useState<number | null>(null);
  const [modalPosition, setModalPosition] = useState<{ x: number, y: number } | null>(null);

  const handleKeyClick = (index: number, element: HTMLDivElement) => {
    // 🔥 FIX: Fonction simple, pas de useCallback - utilisera toujours la valeur actuelle
    console.log('🔍 [KeyGrid] handleKeyClick called with isFullyConnected:', isFullyConnected);

    if (!isFullyConnected) {
      console.warn('🚫 [KeyGrid] Configuration disabled - device not fully connected');
      return;
    }

    const rect = element.getBoundingClientRect();
    setSelectedKeyIndex(index);
    setModalPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    });
    setModalOpen(true);
  };

  const handleSelectMacro = useCallback((macro: Macro) => {
    if (selectedKeyIndex !== null) {
      console.log(`🎯 [KeyGrid] Applying macro to button ${selectedKeyIndex}:`, macro);
      updateButton(selectedKeyIndex, {
        label: macro.label,
        action: macro.action,
        color: macro.color || '#333333'
      });
    }
    setModalOpen(false);
  }, [selectedKeyIndex, updateButton]);

  const handleDrop = (item: DragItem, targetIndex: number) => {
    // 🔥 FIX: Fonction simple, pas de useCallback
    console.log('🔍 [KeyGrid] handleDrop called with isFullyConnected:', isFullyConnected);

    if (!isFullyConnected) {
      console.warn('🚫 [KeyGrid] Drop disabled - device not fully connected');
      return;
    }

    if (item.type === 'macro' && item.label && item.action) {
      console.log(`🎯 [KeyGrid] Dropping macro on button ${targetIndex}:`, {
        label: item.label,
        action: item.action
      });
      updateButton(targetIndex, {
        label: item.label as string,
        action: item.action as string,
        color: '#333333'
      });
    }
  };

  const [, drop] = useDrop({
    accept: 'macro',
    drop: (item: DragItem, monitor) => {
      const dropResult = monitor.getDropResult<{ dropEffect: string, targetIndex: number }>();
      if (dropResult && dropResult.targetIndex !== undefined) {
        handleDrop(item, dropResult.targetIndex);
      }
    }
  });

  const handleManualSave = useCallback(async () => {
    console.log('💾 [KeyGrid] Manual save button clicked');

    if (!isFullyConnected) {
      console.error('🚫 [KeyGrid] Save disabled - device not fully connected');
      return;
    }

    try {
      await saveConfig();
      console.log('✅ [KeyGrid] Manual save completed successfully');
    } catch (err) {
      console.error('❌ [KeyGrid] Manual save failed:', err);
    }
  }, [saveConfig, isFullyConnected]);

  const handleReset = useCallback(async () => {
    if (!isFullyConnected) {
      console.error('🚫 [KeyGrid] Reset disabled - device not fully connected');
      return;
    }

    if (window.confirm('Reset all buttons to default configuration? This cannot be undone.')) {
      console.log('🔄 [KeyGrid] Reset confirmed by user');
      try {
        await resetConfig();
        console.log('✅ [KeyGrid] Reset completed successfully');
      } catch (err) {
        console.error('❌ [KeyGrid] Reset failed:', err);
      }
    }
  }, [resetConfig, isFullyConnected]);

  const configuredButtons = buttons.filter(b => b.action && b.action !== '').length;
  const connectionReady = isFullyConnected; // 🔥 Simplifié

  // 🔥 Device info mockée pour le moment (peut être ajoutée au hook plus tard)
  const deviceInfo = {
    name: 'ArmDeck',
    firmware: '1.2.0',
    heap: 190000
  };

  const getStatusClass = () => {
    if (!connectionReady) return 'key-grid__status--disabled';
    if (isLoading) return 'key-grid__status--syncing';
    if (isDirty) return 'key-grid__status--dirty';
    if (lastSaved) return 'key-grid__status--saved';
    return 'key-grid__status--ready';
  };

  const getStatusText = () => {
    if (!connectionReady) return 'Connection required';
    if (isLoading) return 'Syncing...';
    if (isDirty) return 'Unsaved changes';
    if (lastSaved) return `Saved at ${lastSaved.toLocaleTimeString()}`;
    return 'Ready';
  };

  return (
      <div className="key-grid" ref={drop}>
        <div className="key-grid__header">
          <div className="title-section">
            <h1>ArmDeck Configuration</h1>
            <p>
              {deviceInfo ?
                  `${deviceInfo.name} v${deviceInfo.firmware} • ${configuredButtons}/12 buttons configured` :
                  'Configure your StreamDeck layout • Drag macros or click buttons to assign actions'
              }
              {!connectionReady && (
                  <span className="warning-text"> • ⚠️ Full connection required for changes</span>
              )}
            </p>
            {/* 🔥 Ajout du status de connexion pour debug */}
            {process.env.NODE_ENV === 'development' && (
                <div className="debug-status">
                  <small>Connection Stage: {connectionStage} | Fully Connected: {isFullyConnected ? 'Yes' : 'No'}</small>
                </div>
            )}
          </div>

          <div className="controls">
            <div className={`key-grid__status ${getStatusClass()}`}>
              <span className="status-text">{getStatusText()}</span>
              {isLoading && <div className="spinner" />}
              {!connectionReady && <span className="warning-icon">⚠️</span>}
            </div>

            <button
                onClick={handleManualSave}
                disabled={isLoading || !isDirty || !connectionReady}
                className={`key-grid__button ${isDirty && connectionReady ? 'key-grid__button--save' : ''}`}
                title={
                  !connectionReady ? 'Device not fully connected' :
                      !isDirty ? 'No changes to save' :
                          'Save pending changes'
                }
            >
              {isLoading ? 'Saving...' : 'Save All'}
            </button>

            <button
                onClick={handleReset}
                disabled={isLoading || !connectionReady}
                className="key-grid__button key-grid__button--reset"
                title={
                  !connectionReady ? 'Device not fully connected' :
                      'Reset all buttons to default configuration'
                }
            >
              Reset
            </button>
          </div>
        </div>

        {/* Message d'avertissement si pas connecté */}
        {!connectionReady && (
            <div className="key-grid__connection-warning">
              <div className="warning-icon">⚠️</div>
              <div className="warning-content">
                <strong>Device not fully connected</strong>
                <div>
                  Configuration changes are disabled until a full connection is established.
                  Current status: <strong>{connectionStage}</strong>
                  <br />
                  Please ensure your ESP32 is properly connected and all services are available.
                </div>
              </div>
            </div>
        )}

        {error && (
            <div className="key-grid__error">
              <div className="error-icon">⚠️</div>
              <div className="error-content">
                <strong>Configuration Error:</strong>
                <div>{error}</div>
              </div>
            </div>
        )}

        <div className="key-grid__grid">
          {buttons.map((buttonConfig, index) => (
              <ProfessionalKey
                  key={`button-${index}`}
                  buttonConfig={buttonConfig}
                  index={index}
                  onKeyClick={handleKeyClick}
                  isDirty={buttonConfig.isDirty || false}
                  isConnectionReady={connectionReady}
              />
          ))}
        </div>

        <div className="key-grid__stats">
          <div className="key-grid__stat-card">
            <div className="label">Configuration</div>
            <div className="value">{configuredButtons}/12</div>
            <div className="description">
              Buttons configured
              {configuredButtons === 12 && (
                  <div className="completion-badge">Complete! 🎉</div>
              )}
            </div>
          </div>

          <div className="key-grid__stat-card">
            <div className="label">Connection</div>
            <div className={`value ${connectionReady ? 'status-ready' : 'status-warning'}`}>
              {connectionReady ? 'Ready' : 'Limited'}
            </div>
            <div className="description">
            <span className={connectionReady ? 'status-ready' : 'status-warning'}>
              {connectionReady ? 'Full functionality' : 'Read-only mode'}
            </span>
              {/* 🔥 Plus de détails sur l'état de connexion */}
              {!connectionReady && (
                  <div><small>Status: {connectionStage}</small></div>
              )}
            </div>
          </div>

          <div className="key-grid__stat-card">
            <div className="label">Last Sync</div>
            <div className="value">
              {lastSaved ? lastSaved.toLocaleTimeString() : '--:--'}
            </div>
            <div className="description">
            <span className={isDirty ? 'status-dirty' : 'status-clean'}>
              {isDirty ? 'Pending changes' : 'Up to date'}
            </span>
            </div>
          </div>

          <div className="key-grid__stat-card">
            <div className="label">Device Memory</div>
            <div className="value">
              {deviceInfo?.heap ? `${Math.round(deviceInfo.heap / 1024)}KB` : '--'}
            </div>
            <div className="description">
              Free heap
              {deviceInfo?.heap && (
                  <div className="memory-bar">
                    <div
                        className="memory-used"
                        style={{ width: `${Math.max(0, 100 - (deviceInfo.heap / 2000))}%` }}
                    />
                  </div>
              )}
            </div>
          </div>
        </div>

        <MacroModal
            isOpen={modalOpen && connectionReady} // Only open if connected
            onClose={() => {
              setModalOpen(false);
              setSelectedKeyIndex(null);
              setModalPosition(null);
            }}
            onSelectMacro={handleSelectMacro}
            position={modalPosition}
            selectedButtonIndex={selectedKeyIndex}
        />
      </div>
  );
};

export default KeyGrid;