import { useState, useCallback, useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { Macro } from '../data/macros';
import MacroModal from './MacroModal';
import '../styles/KeyGrid.scss';

// Define the type for a key
interface Key {
  id: number;
  label: string;
  action: string;
}

// Define the type for the drag item
interface DragItem {
  type: string;
  id: number | string;
  index?: number;
  label?: string;
  action?: string;
  category?: string;
}

// Key component with drag functionality
const DraggableKey = ({ 
  keyData, 
  index, 
  moveKey,
  onKeyClick
}: { 
  keyData: Key; 
  index: number; 
  moveKey: (dragIndex: number, hoverIndex: number) => void;
  onKeyClick: (index: number, element: HTMLDivElement) => void;
}) => {
  const keyRef = useRef<HTMLDivElement>(null);

  const [{ isDragging }, drag] = useDrag({
    type: 'key',
    item: { type: 'key', id: keyData.id, index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: ['key', 'macro'],
    drop: (item: DragItem) => {
      if (item.type === 'macro' && item.label && item.action) {
        // Handle dropping a macro onto a key
        return { 
          dropEffect: 'copy',
          targetIndex: index
        };
      }
      return undefined;
    },
    hover: (item: DragItem) => {
      if (item.type === 'key' && item.index !== undefined && item.index !== index) {
        moveKey(item.index, index);
        item.index = index;
      }
    },
  });

  const handleClick = () => {
    if (keyRef.current) {
      onKeyClick(index, keyRef.current);
    }
  };

  return (
    <div 
      ref={(node) => {
        drag(drop(node));
      }}
      className={`key ${isDragging ? 'dragging' : ''}`}
      style={{ opacity: isDragging ? 0.5 : 1 }}
      onClick={handleClick}
    >
      <div className="key-content">
        <div className="key-label">{keyData.label}</div>
        <div className="key-action">{keyData.action}</div>
      </div>
    </div>
  );
};

// KeyGrid component
const KeyGrid = () => {
  // Initial state with 12 keys (4x3 grid)
  const [keys, setKeys] = useState<Key[]>([
    { id: 1, label: 'Key 1', action: 'Action 1' },
    { id: 2, label: 'Key 2', action: 'Action 2' },
    { id: 3, label: 'Key 3', action: 'Action 3' },
    { id: 4, label: 'Key 4', action: 'Action 4' },
    { id: 5, label: 'Key 5', action: 'Action 5' },
    { id: 6, label: 'Key 6', action: 'Action 6' },
    { id: 7, label: 'Key 7', action: 'Action 7' },
    { id: 8, label: 'Key 8', action: 'Action 8' },
    { id: 9, label: 'Key 9', action: 'Action 9' },
    { id: 10, label: 'Key 10', action: 'Action 10' },
    { id: 11, label: 'Key 11', action: 'Action 11' },
    { id: 12, label: 'Key 12', action: 'Action 12' },
  ]);

  // State for macro modal
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedKeyIndex, setSelectedKeyIndex] = useState<number | null>(null);
  const [modalPosition, setModalPosition] = useState<{ x: number, y: number } | null>(null);

  // Function to handle key click to show macro modal
  const handleKeyClick = (index: number, element: HTMLDivElement) => {
    const rect = element.getBoundingClientRect();
    setSelectedKeyIndex(index);
    setModalPosition({
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    });
    setModalOpen(true);
  };

  // Function to handle macro selection
  const handleSelectMacro = (macro: Macro) => {
    if (selectedKeyIndex !== null) {
      setKeys(prevKeys => {
        const newKeys = [...prevKeys];
        newKeys[selectedKeyIndex] = {
          ...newKeys[selectedKeyIndex],
          label: macro.label,
          action: macro.action
        };
        return newKeys;
      });
    }
  };

  // Function to move a key from one position to another
  const moveKey = useCallback((dragIndex: number, hoverIndex: number) => {
    setKeys((prevKeys) => {
      const newKeys = [...prevKeys];
      const draggedKey = newKeys[dragIndex];

      // Remove the dragged key
      newKeys.splice(dragIndex, 1);
      // Insert it at the new position
      newKeys.splice(hoverIndex, 0, draggedKey);

      return newKeys;
    });
  }, []);

  // Handle dropping a macro onto a key
  const handleDrop = useCallback((item: DragItem, targetIndex: number) => {
    if (item.type === 'macro' && item.label && item.action) {
      setKeys(prevKeys => {
        const newKeys = [...prevKeys];
        newKeys[targetIndex] = {
          ...newKeys[targetIndex],
          label: item.label as string,
          action: item.action as string
        };
        return newKeys;
      });
    }
  }, []);

  // Monitor drops
  const [, drop] = useDrop({
    accept: 'macro',
    drop: (item: DragItem, monitor) => {
      const dropResult = monitor.getDropResult<{ dropEffect: string, targetIndex: number }>();
      if (dropResult && dropResult.targetIndex !== undefined) {
        handleDrop(item, dropResult.targetIndex);
      }
    }
  });

  // Export keymap to JSON
  const exportKeymap = () => {
    const keymapJson = JSON.stringify(keys, null, 2);
    const blob = new Blob([keymapJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'streamdeck-keymap.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Import keymap from JSON
  const importKeymap = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const importedKeys = JSON.parse(e.target?.result as string) as Key[];
          if (Array.isArray(importedKeys) && importedKeys.length === 12) {
            setKeys(importedKeys);
          } else {
            alert('Invalid keymap format. Must contain exactly 12 keys.');
          }
        } catch (error) {
          alert('Error parsing keymap file.');
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="key-grid-container" ref={drop}>
      <div className="key-grid">
        {keys.map((key, index) => (
          <DraggableKey 
            key={key.id}
            keyData={key}
            index={index} 
            moveKey={moveKey}
            onKeyClick={handleKeyClick}
          />
        ))}
      </div>

      <MacroModal 
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSelectMacro={handleSelectMacro}
        position={modalPosition}
      />

      <div className="key-grid-actions">
        <button onClick={exportKeymap} className="export-button">
          Export Keymap
        </button>
        <label className="import-button">
          Import Keymap
          <input 
            type="file" 
            accept=".json" 
            onChange={importKeymap} 
            style={{ display: 'none' }} 
          />
        </label>
      </div>
    </div>
  );
};

export default KeyGrid;
