// components/MacroModal.tsx - Avec vraies données et thèmes corrigés
import React, { useState, useEffect, useRef } from 'react';
import {
  Macro,
  Category,
  categories,
  getMacrosByCategory
} from '../data/macros';

interface MacroModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMacro: (macro: Macro) => void;
  position: { x: number, y: number } | null;
}

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

const MacroModal: React.FC<MacroModalProps> = ({ isOpen, onClose, onSelectMacro, position }) => {
  const theme = useTheme();
  const [activeCategory, setActiveCategory] = useState('media');
  const modalRef = useRef<HTMLDivElement>(null);
  const macros = getMacrosByCategory(activeCategory);

  // Styles dynamiques selon le thème
  const getThemedStyle = () => ({
    background: theme === 'dark' ? '#1a1a1a' : '#ffffff',
    border: theme === 'dark' ? '#333333' : '#dee2e6',
    textPrimary: theme === 'dark' ? '#ffffff' : '#333333',
    textSecondary: theme === 'dark' ? '#999999' : '#6c757d',
    itemBg: theme === 'dark' ? '#0f0f0f' : '#f8f9fa',
    itemBorder: theme === 'dark' ? '#333333' : '#e9ecef',
    hoverBg: theme === 'dark' ? '#333333' : '#e9ecef',
    hoverBorder: theme === 'dark' ? '#555555' : '#adb5bd'
  });

  const themedStyle = getThemedStyle();

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

  return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.8)',
        zIndex: 1000,
        backdropFilter: 'blur(4px)'
      }}>
        <div
            ref={modalRef}
            style={{
              position: 'fixed',
              left: `${Math.min(position.x, window.innerWidth - 450)}px`,
              top: `${Math.min(position.y, window.innerHeight - 500)}px`,
              backgroundColor: themedStyle.background,
              border: `1px solid ${themedStyle.border}`,
              borderRadius: '8px',
              minWidth: '400px', // Plus large
              maxWidth: '450px',
              maxHeight: '600px', // Plus haut
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
            }}
        >
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '20px', // Plus de padding
            borderBottom: `1px solid ${themedStyle.border}`
          }}>
            <h3 style={{
              margin: 0,
              fontSize: '16px', // Plus gros
              fontWeight: '600',
              color: themedStyle.textPrimary
            }}>
              Select Action
            </h3>
            <button
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '18px', // Plus gros
                  cursor: 'pointer',
                  color: themedStyle.textSecondary,
                  padding: '4px',
                  borderRadius: '4px',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = themedStyle.itemBg;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
            >
              ×
            </button>
          </div>

          {/* Categories */}
          <div style={{
            padding: '20px',
            borderBottom: `1px solid ${themedStyle.border}`
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', // Grille responsive
              gap: '8px'
            }}>
              {categories.map(category => (
                  <button
                      key={category.id}
                      onClick={() => setActiveCategory(category.id)}
                      style={{
                        padding: '8px 12px', // Plus de padding
                        border: 'none',
                        borderRadius: '4px',
                        backgroundColor: activeCategory === category.id ?
                            (theme === 'dark' ? '#ffffff' : '#007bff') : 'transparent',
                        color: activeCategory === category.id ?
                            (theme === 'dark' ? '#000000' : '#ffffff') : themedStyle.textSecondary,
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: '500',
                        transition: 'all 0.2s ease',
                        textAlign: 'center'
                      }}
                      onMouseEnter={(e) => {
                        if (activeCategory !== category.id) {
                          e.currentTarget.style.backgroundColor = themedStyle.hoverBg;
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
          </div>

          {/* Actions grid */}
          <div style={{
            padding: '20px',
            maxHeight: '350px', // Plus haut
            overflowY: 'auto'
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', // Plus large
              gap: '12px' // Plus d'espace
            }}>
              {macros.map(macro => (
                  <div
                      key={macro.id}
                      onClick={() => {
                        onSelectMacro(macro);
                        onClose();
                      }}
                      style={{
                        padding: '12px', // Plus de padding
                        backgroundColor: themedStyle.itemBg,
                        border: `1px solid ${themedStyle.itemBorder}`,
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        textAlign: 'center'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = themedStyle.hoverBg;
                        e.currentTarget.style.borderColor = themedStyle.hoverBorder;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = themedStyle.itemBg;
                        e.currentTarget.style.borderColor = themedStyle.itemBorder;
                      }}
                      title={macro.action} // Tooltip avec l'action
                  >
                    <div style={{
                      fontSize: '13px', // Plus gros
                      fontWeight: '500',
                      color: themedStyle.textPrimary,
                      marginBottom: '4px',
                      lineHeight: '1.2'
                    }}>
                      {macro.label}
                    </div>
                    <div style={{
                      fontSize: '10px',
                      color: themedStyle.textSecondary,
                      fontFamily: 'monospace',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {macro.action || 'Custom action'}
                    </div>
                  </div>
              ))}
            </div>

            {/* Message si aucune macro */}
            {macros.length === 0 && (
                <div style={{
                  textAlign: 'center',
                  color: themedStyle.textSecondary,
                  padding: '40px 20px',
                  fontSize: '14px'
                }}>
                  No actions available in this category
                </div>
            )}
          </div>
        </div>
      </div>
  );
};

export default MacroModal;