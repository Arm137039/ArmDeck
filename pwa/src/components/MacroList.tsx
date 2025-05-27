import React, { useState } from 'react';
import { useDrag } from 'react-dnd';
import {
    Macro,
    Category,
    categories,
    getMacrosByCategory
} from '../data/macros';

// Hook pour obtenir le thème actuel
const useTheme = () => {
    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        const saved = localStorage.getItem('theme');
        return (saved as 'light' | 'dark') || 'dark';
    });

    React.useEffect(() => {
        const handleStorageChange = () => {
            const newTheme = localStorage.getItem('theme') as 'light' | 'dark' || 'dark';
            setTheme(newTheme);
        };

        window.addEventListener('storage', handleStorageChange);
        const interval = setInterval(handleStorageChange, 100);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            clearInterval(interval);
        };
    }, []);

    return theme;
};

// Composant macro draggable
const DraggableMacro = ({ macro, theme }: { macro: Macro; theme: 'light' | 'dark' }) => {
    const [{ isDragging }, drag] = useDrag({
        type: 'macro',
        item: { type: 'macro', ...macro },
        collect: (monitor) => ({
            isDragging: monitor.isDragging(),
        }),
    });

    const getThemedStyle = () => ({
        backgroundColor: theme === 'dark' ? '#0f0f0f' : '#f8f9fa',
        border: `1px solid ${theme === 'dark' ? '#333333' : '#dee2e6'}`,
        textPrimary: theme === 'dark' ? '#ffffff' : '#333333',
        textSecondary: theme === 'dark' ? '#999999' : '#6c757d',
        hoverBg: theme === 'dark' ? '#1a1a1a' : '#e9ecef',
        hoverBorder: theme === 'dark' ? '#555555' : '#adb5bd'
    });

    const themedStyle = getThemedStyle();

    return (
        <div
            ref={drag}
            style={{
                opacity: isDragging ? 0.5 : 1,
                padding: '8px 12px',
                margin: '4px 0',
                backgroundColor: themedStyle.backgroundColor,
                border: themedStyle.border,
                borderRadius: '6px',
                cursor: 'grab',
                transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = themedStyle.hoverBg;
                e.currentTarget.style.borderColor = themedStyle.hoverBorder;
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = themedStyle.backgroundColor;
                e.currentTarget.style.borderColor = themedStyle.border.split(' ')[2];
            }}
        >
            <div style={{ fontSize: '12px', fontWeight: '500', color: themedStyle.textPrimary, marginBottom: '2px' }}>
                {macro.label}
            </div>
            <div style={{ fontSize: '10px', color: themedStyle.textSecondary, fontFamily: 'monospace' }}>
                {macro.action || 'Not configured'}
            </div>
        </div>
    );
};

const getScrollbarStyle = (theme: 'light' | 'dark') => `
  ::-webkit-scrollbar {
    width: 8px;
  }
  ::-webkit-scrollbar-track {
    background: ${theme === 'dark' ? '#2a2a2a' : '#f1f1f1'};
    border-radius: 4px;
  }
  ::-webkit-scrollbar-thumb {
    background: ${theme === 'dark' ? '#555555' : '#c1c1c1'};
    border-radius: 4px;
  }
  ::-webkit-scrollbar-thumb:hover {
    background: ${theme === 'dark' ? '#777777' : '#a1a1a1'};
  }
`;

// Composant principal MacroList
const MacroList: React.FC = () => {
    const theme = useTheme();
    const [activeCategory, setActiveCategory] = useState('media');
    const macros = getMacrosByCategory(activeCategory);

    // Styles dynamiques selon le thème
    const getThemedStyle = () => ({
        background: theme === 'dark' ? '#1a1a1a' : '#ffffff',
        border: theme === 'dark' ? '#333333' : '#dee2e6',
        textPrimary: theme === 'dark' ? '#ffffff' : '#333333',
        textSecondary: theme === 'dark' ? '#999999' : '#6c757d',
        textMuted: theme === 'dark' ? '#666666' : '#999999',
        tabActive: theme === 'dark' ? '#ffffff' : '#007bff',
        tabActiveText: theme === 'dark' ? '#000000' : '#ffffff',
        tabHover: theme === 'dark' ? '#333333' : '#e9ecef'
    });

    const themedStyle = getThemedStyle();

    return (
        <div style={{
            padding: '20px',
            backgroundColor: themedStyle.background,
            border: `1px solid ${themedStyle.border}`,
            borderRadius: '8px'
        }}>
            <h3 style={{
                margin: '0 0 16px 0',
                fontSize: '16px',
                fontWeight: '600',
                color: themedStyle.textPrimary
            }}>
                Available Actions
            </h3>

            {/* Category tabs */}
            <div style={{
                display: 'flex',
                gap: '4px',
                marginBottom: '16px',
                flexWrap: 'wrap'
            }}>
                {categories.map(category => (
                    <button
                        key={category.id}
                        onClick={() => setActiveCategory(category.id)}
                        style={{
                            padding: '6px 12px',
                            border: 'none',
                            borderRadius: '4px',
                            backgroundColor: activeCategory === category.id ? themedStyle.tabActive : 'transparent',
                            color: activeCategory === category.id ? themedStyle.tabActiveText : themedStyle.textSecondary,
                            cursor: 'pointer',
                            fontSize: '11px',
                            fontWeight: '500',
                            transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                            if (activeCategory !== category.id) {
                                e.currentTarget.style.backgroundColor = themedStyle.tabHover;
                                e.currentTarget.style.color = themedStyle.textPrimary;
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (activeCategory !== category.id) {
                                e.currentTarget.style.backgroundColor = 'transparent';
                                e.currentTarget.style.color = themedStyle.textSecondary;
                            }
                        }}
                    >
                        {category.label}
                    </button>
                ))}
            </div>

            {/* Macro list */}
            <div
                style={{
                    maxHeight: '300px',
                    overflowY: 'auto'
                }}
            >
                <style dangerouslySetInnerHTML={{ __html: getScrollbarStyle(theme) }} />
                {macros.map(macro => (
                    <DraggableMacro key={macro.id} macro={macro} theme={theme} />
                ))}
            </div>

            {macros.length === 0 && (
                <div style={{
                    textAlign: 'center',
                    color: themedStyle.textMuted,
                    padding: '20px',
                    fontSize: '12px'
                }}>
                    No actions in this category
                </div>
            )}
        </div>
    );
};

export default MacroList;

