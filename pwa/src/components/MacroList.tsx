import React, { useState } from 'react';
import { useDrag } from 'react-dnd';
import { Macro, categories, getMacrosByCategory } from '../data/macros';

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
            className={`draggable-macro ${isDragging ? 'draggable-macro--dragging' : ''}`}
        >
            <div className="draggable-macro__label">{macro.label}</div>
            <div className="draggable-macro__action">{macro.action || 'Not configured'}</div>
        </div>
    );
};

const MacroList: React.FC = () => {
    const [activeCategory, setActiveCategory] = useState('media');
    const macros = getMacrosByCategory(activeCategory);

    return (
        <div className="macro-list">
            <h3 className="macro-list__title">Available Actions</h3>

            <div className="macro-list__tabs">
                {categories.map(category => (
                    <button
                        key={category.id}
                        onClick={() => setActiveCategory(category.id)}
                        className={`macro-list__tab ${activeCategory === category.id ? 'macro-list__tab--active' : ''}`}
                    >
                        {category.label}
                    </button>
                ))}
            </div>

            <div className="macro-list__content">
                {macros.map(macro => (
                    <DraggableMacro key={macro.id} macro={macro} />
                ))}
            </div>

            {macros.length === 0 && (
                <div className="macro-list__empty">
                    No actions in this category
                </div>
            )}
        </div>
    );
};

export default MacroList;