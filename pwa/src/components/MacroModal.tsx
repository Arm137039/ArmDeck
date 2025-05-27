import React, { useState, useEffect, useRef } from 'react';
import { Macro, categories, getMacrosByCategory } from '../data/macros';

interface MacroModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectMacro: (macro: Macro) => void;
    position: { x: number, y: number } | null;
}

const MacroModal: React.FC<MacroModalProps> = ({ isOpen, onClose, onSelectMacro, position }) => {
    const [activeCategory, setActiveCategory] = useState('media');
    const modalRef = useRef<HTMLDivElement>(null);
    const macros = getMacrosByCategory(activeCategory);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('keydown', handleEscape);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isOpen, onClose]);

    if (!isOpen || !position) return null;

    const modalStyle = {
        left: `${Math.min(position.x, window.innerWidth - 450)}px`,
        top: `${Math.min(position.y, window.innerHeight - 500)}px`,
    };

    return (
        <div className="macro-modal__overlay">
            <div
                ref={modalRef}
                className="macro-modal__container"
                style={modalStyle}
            >
                <div className="macro-modal__header">
                    <h3>Select Action</h3>
                    <button onClick={onClose} className="macro-modal__close">
                        ×
                    </button>
                </div>

                <div className="macro-modal__categories">
                    <div className="macro-modal__category-grid">
                        {categories.map(category => (
                            <button
                                key={category.id}
                                onClick={() => setActiveCategory(category.id)}
                                className={`macro-modal__category-button ${
                                    activeCategory === category.id ? 'macro-modal__category-button--active' : ''
                                }`}
                            >
                                {category.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="macro-modal__actions">
                    <div className="macro-modal__actions-grid">
                        {macros.map(macro => (
                            <div
                                key={macro.id}
                                onClick={() => {
                                    onSelectMacro(macro);
                                    onClose();
                                }}
                                className="macro-modal__action-item"
                                title={macro.action}
                            >
                                <div className="label">{macro.label}</div>
                                <div className="action">{macro.action || 'Custom action'}</div>
                            </div>
                        ))}
                    </div>

                    {macros.length === 0 && (
                        <div className="macro-modal__empty">
                            No actions available in this category
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MacroModal;