import { useState } from 'react';
import { useDrag } from 'react-dnd';
import { categories, getMacrosByCategory, Macro } from '../data/macros';
import '../styles/MacroList.scss';

// Draggable macro component
const DraggableMacro = ({ macro }: { macro: Macro }) => {
  const [{ isDragging }, drag] = useDrag({
    type: 'macro',
    item: { type: 'macro', ...macro },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  return (
    <div 
      ref={drag} 
      className={`macro-item ${isDragging ? 'dragging' : ''}`}
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      <div className="macro-label">{macro.label}</div>
      <div className="macro-action">{macro.action}</div>
    </div>
  );
};

// MacroList component
const MacroList = () => {
  const [activeCategory, setActiveCategory] = useState('keyboard');
  const macros = getMacrosByCategory(activeCategory);

  return (
    <div className="macro-list-container">
      <h3>Available Macros</h3>
      
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
      
      <div className="macro-list">
        {macros.map(macro => (
          <DraggableMacro key={macro.id} macro={macro} />
        ))}
      </div>
    </div>
  );
};

export default MacroList;