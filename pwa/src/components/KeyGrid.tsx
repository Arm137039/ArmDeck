import React, { useState, useCallback, useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import useDeviceConfig, { ButtonConfig } from '../hooks/useDeviceConfig';
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
                           isDirty
                         }: {
  buttonConfig: ButtonConfig;
  index: number;
  onKeyClick: (index: number, element: HTMLDivElement) => void;
  isDirty: boolean;
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
          className={`professional-key ${isDirty ? 'professional-key--dirty' : ''} ${isDragging ? 'professional-key--dragging' : ''}`}
      >
        {isDirty && <div className="professional-key__dirty-indicator" />}

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
      </div>
  );
};

const KeyGrid: React.FC = () => {
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

  const handleKeyClick = useCallback((index: number, element: HTMLDivElement) => {
    const rect = element.getBoundingClientRect();
    setSelectedKeyIndex(index);
    setModalPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    });
    setModalOpen(true);
  }, []);

  const handleSelectMacro = useCallback((macro: Macro) => {
    if (selectedKeyIndex !== null) {
      updateButton(selectedKeyIndex, {
        label: macro.label,
        action: macro.action,
        color: macro.color || '#333333'
      });
    }
  }, [selectedKeyIndex, updateButton]);

  const handleDrop = useCallback((item: DragItem, targetIndex: number) => {
    if (item.type === 'macro' && item.label && item.action) {
      updateButton(targetIndex, {
        label: item.label as string,
        action: item.action as string,
        color: '#333333'
      });
    }
  }, [updateButton]);

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
    try {
      await saveConfig();
    } catch (err) {
      console.error('Save failed:', err);
    }
  }, [saveConfig]);

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

  const getStatusClass = () => {
    if (isLoading) return 'key-grid__status--syncing';
    if (isDirty) return 'key-grid__status--dirty';
    if (lastSaved) return 'key-grid__status--saved';
    return 'key-grid__status--ready';
  };

  const getStatusText = () => {
    if (isLoading) return 'Syncing...';
    if (isDirty) return 'Unsaved changes';
    if (lastSaved) return 'Saved';
    return 'Ready';
  };

  return (
      <div className="key-grid" ref={drop}>
        <div className="key-grid__header">
          <div className="title-section">
            <h1>ArmDeck Configuration</h1>
            <p>
              {deviceInfo ? `${deviceInfo.name} v${deviceInfo.firmware}` : 'Configure your StreamDeck layout'}
            </p>
          </div>

          <div className="controls">
            <div className={`key-grid__status ${getStatusClass()}`}>
              {getStatusText()}
            </div>

            <button
                onClick={handleManualSave}
                disabled={isLoading || !isDirty}
                className={`key-grid__button ${isDirty ? 'key-grid__button--save' : ''}`}
            >
              Save All
            </button>

            <button
                onClick={handleReset}
                disabled={isLoading}
                className="key-grid__button key-grid__button--reset"
            >
              Reset
            </button>
          </div>
        </div>

        {error && (
            <div className="key-grid__error">
              {error}
            </div>
        )}

        <div className="key-grid__grid">
          {buttons.map((buttonConfig, index) => (
              <ProfessionalKey
                  key={index}
                  buttonConfig={buttonConfig}
                  index={index}
                  onKeyClick={handleKeyClick}
                  isDirty={buttonConfig.isDirty || false}
              />
          ))}
        </div>

        <div className="key-grid__stats">
          <div className="key-grid__stat-card">
            <div className="label">Configuration</div>
            <div className="value">{configuredButtons}/12</div>
            <div className="description">Buttons configured</div>
          </div>

          <div className="key-grid__stat-card">
            <div className="label">Last Sync</div>
            <div className="value">
              {lastSaved ? lastSaved.toLocaleTimeString() : '--:--'}
            </div>
            <div className="description">
              {isDirty ? 'Pending changes' : 'Up to date'}
            </div>
          </div>

          <div className="key-grid__stat-card">
            <div className="label">Device Memory</div>
            <div className="value">
              {deviceInfo?.heap ? `${Math.round(deviceInfo.heap / 1024)}KB` : '--'}
            </div>
            <div className="description">Free heap</div>
          </div>
        </div>

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