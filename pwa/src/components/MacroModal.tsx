import { useState, useEffect, useRef } from 'react';
import { categories, getMacrosByCategory, Macro } from '../data/macros';
import '../styles/MacroModal.scss';

interface MacroModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMacro: (macro: Macro) => void;
  position: { x: number, y: number } | null;
}

const MacroModal = ({ isOpen, onClose, onSelectMacro, position }: MacroModalProps) => {
  const [activeCategory, setActiveCategory] = useState('keyboard');
  const modalRef = useRef<HTMLDivElement>(null);
  const macros = getMacrosByCategory(activeCategory);

  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !position) return null;

  // Calculate position to ensure modal stays within viewport
  const modalStyle = {
    left: `${position.x}px`,
    top: `${position.y}px`,
  };

  return (
    <div className="macro-modal-overlay">
      <div 
        ref={modalRef} 
        className="macro-modal" 
        style={modalStyle}
      >
        <div className="macro-modal-header">
          <h3>Select Macro</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="category-tabs">
          {categories.map(category => (
            <button 
              key={category.id}
              className={`category-tab ${activeCategory === category.id ? 'active' : ''}`}
              onClick={() => setActiveCategory(category.id)}
            >
              {category.label}
            </button>
          ))}
        </div>
        
        <div className="macro-grid">
          {macros.map(macro => (
            <div 
              key={macro.id} 
              className="macro-item"
              onClick={() => {
                onSelectMacro(macro);
                onClose();
              }}
            >
              <div className="macro-label">{macro.label}</div>
              <div className="macro-action">{macro.action}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default MacroModal;