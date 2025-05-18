// Define types for macros
export interface Macro {
  id: string;
  label: string;
  action: string;
  category: string;
}

// Basic keyboard keys
export const keyboardKeys: Macro[] = [
  { id: 'key-a', label: 'A', action: 'KEY_A', category: 'keyboard' },
  { id: 'key-b', label: 'B', action: 'KEY_B', category: 'keyboard' },
  { id: 'key-c', label: 'C', action: 'KEY_C', category: 'keyboard' },
  { id: 'key-d', label: 'D', action: 'KEY_D', category: 'keyboard' },
  { id: 'key-e', label: 'E', action: 'KEY_E', category: 'keyboard' },
  { id: 'key-f', label: 'F', action: 'KEY_F', category: 'keyboard' },
  { id: 'key-enter', label: 'Enter', action: 'KEY_ENTER', category: 'keyboard' },
  { id: 'key-esc', label: 'Esc', action: 'KEY_ESC', category: 'keyboard' },
  { id: 'key-tab', label: 'Tab', action: 'KEY_TAB', category: 'keyboard' },
  { id: 'key-space', label: 'Space', action: 'KEY_SPACE', category: 'keyboard' },
  { id: 'key-backspace', label: 'Backspace', action: 'KEY_BACKSPACE', category: 'keyboard' },
  { id: 'key-shift', label: 'Shift', action: 'KEY_SHIFT', category: 'keyboard' },
  { id: 'key-ctrl', label: 'Ctrl', action: 'KEY_CTRL', category: 'keyboard' },
  { id: 'key-alt', label: 'Alt', action: 'KEY_ALT', category: 'keyboard' },
  { id: 'key-win', label: 'Win', action: 'KEY_WIN', category: 'keyboard' },
];

// Windows macros
export const windowsMacros: Macro[] = [
  { id: 'win-explorer', label: 'Explorer', action: 'WIN+E', category: 'windows' },
  { id: 'win-run', label: 'Run', action: 'WIN+R', category: 'windows' },
  { id: 'win-search', label: 'Search', action: 'WIN+S', category: 'windows' },
  { id: 'win-settings', label: 'Settings', action: 'WIN+I', category: 'windows' },
  { id: 'win-lock', label: 'Lock', action: 'WIN+L', category: 'windows' },
  { id: 'win-desktop', label: 'Desktop', action: 'WIN+D', category: 'windows' },
  { id: 'win-snap-left', label: 'Snap Left', action: 'WIN+LEFT', category: 'windows' },
  { id: 'win-snap-right', label: 'Snap Right', action: 'WIN+RIGHT', category: 'windows' },
  { id: 'win-task-view', label: 'Task View', action: 'WIN+TAB', category: 'windows' },
  { id: 'win-clipboard', label: 'Clipboard', action: 'WIN+V', category: 'windows' },
];

// Editable macros (initially empty, can be added by user)
export const editableMacros: Macro[] = [
  { id: 'edit-1', label: 'Copy All', action: 'CTRL+A, CTRL+C', category: 'editable' },
  { id: 'edit-2', label: 'Paste Special', action: 'CTRL+ALT+V', category: 'editable' },
  { id: 'edit-3', label: 'Save All', action: 'CTRL+SHIFT+S', category: 'editable' },
];

// All macros combined
export const allMacros = [...keyboardKeys, ...windowsMacros, ...editableMacros];

// Get macros by category
export const getMacrosByCategory = (category: string): Macro[] => {
  return allMacros.filter(macro => macro.category === category);
};

// Categories
export const categories = [
  { id: 'keyboard', label: 'Keyboard Keys' },
  { id: 'windows', label: 'Windows Macros' },
  { id: 'editable', label: 'Editable Macros' },
];