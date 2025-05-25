export interface Macro {
  id: string;
  label: string;
  action: string;
  category: string;
  icon?: string;
  color?: string;
}

export interface Category {
  id: string;
  label: string;
  icon?: string;
}

export const keyboardKeys: Macro[] = [
  { id: 'key-a', label: 'A', action: 'KEY_A', category: 'keyboard' },
  { id: 'key-b', label: 'B', action: 'KEY_B', category: 'keyboard' },
  { id: 'key-c', label: 'C', action: 'KEY_C', category: 'keyboard' },
  { id: 'key-d', label: 'D', action: 'KEY_D', category: 'keyboard' },
  { id: 'key-e', label: 'E', action: 'KEY_E', category: 'keyboard' },
  { id: 'key-f', label: 'F', action: 'KEY_F', category: 'keyboard' },
  { id: 'key-g', label: 'G', action: 'KEY_G', category: 'keyboard' },
  { id: 'key-h', label: 'H', action: 'KEY_H', category: 'keyboard' },
  { id: 'key-i', label: 'I', action: 'KEY_I', category: 'keyboard' },
  { id: 'key-j', label: 'J', action: 'KEY_J', category: 'keyboard' },
  { id: 'key-k', label: 'K', action: 'KEY_K', category: 'keyboard' },
  { id: 'key-l', label: 'L', action: 'KEY_L', category: 'keyboard' },
  { id: 'key-m', label: 'M', action: 'KEY_M', category: 'keyboard' },
  { id: 'key-n', label: 'N', action: 'KEY_N', category: 'keyboard' },
  { id: 'key-o', label: 'O', action: 'KEY_O', category: 'keyboard' },
  { id: 'key-p', label: 'P', action: 'KEY_P', category: 'keyboard' },
  { id: 'key-q', label: 'Q', action: 'KEY_Q', category: 'keyboard' },
  { id: 'key-r', label: 'R', action: 'KEY_R', category: 'keyboard' },
  { id: 'key-s', label: 'S', action: 'KEY_S', category: 'keyboard' },
  { id: 'key-t', label: 'T', action: 'KEY_T', category: 'keyboard' },
  { id: 'key-u', label: 'U', action: 'KEY_U', category: 'keyboard' },
  { id: 'key-v', label: 'V', action: 'KEY_V', category: 'keyboard' },
  { id: 'key-w', label: 'W', action: 'KEY_W', category: 'keyboard' },
  { id: 'key-x', label: 'X', action: 'KEY_X', category: 'keyboard' },
  { id: 'key-y', label: 'Y', action: 'KEY_Y', category: 'keyboard' },
  { id: 'key-z', label: 'Z', action: 'KEY_Z', category: 'keyboard' },

  { id: 'key-0', label: '0', action: 'KEY_0', category: 'keyboard' },
  { id: 'key-1', label: '1', action: 'KEY_1', category: 'keyboard' },
  { id: 'key-2', label: '2', action: 'KEY_2', category: 'keyboard' },
  { id: 'key-3', label: '3', action: 'KEY_3', category: 'keyboard' },
  { id: 'key-4', label: '4', action: 'KEY_4', category: 'keyboard' },
  { id: 'key-5', label: '5', action: 'KEY_5', category: 'keyboard' },
  { id: 'key-6', label: '6', action: 'KEY_6', category: 'keyboard' },
  { id: 'key-7', label: '7', action: 'KEY_7', category: 'keyboard' },
  { id: 'key-8', label: '8', action: 'KEY_8', category: 'keyboard' },
  { id: 'key-9', label: '9', action: 'KEY_9', category: 'keyboard' },

  { id: 'key-f1', label: 'F1', action: 'KEY_F1', category: 'keyboard' },
  { id: 'key-f2', label: 'F2', action: 'KEY_F2', category: 'keyboard' },
  { id: 'key-f3', label: 'F3', action: 'KEY_F3', category: 'keyboard' },
  { id: 'key-f4', label: 'F4', action: 'KEY_F4', category: 'keyboard' },
  { id: 'key-f5', label: 'F5', action: 'KEY_F5', category: 'keyboard' },
  { id: 'key-f6', label: 'F6', action: 'KEY_F6', category: 'keyboard' },
  { id: 'key-f7', label: 'F7', action: 'KEY_F7', category: 'keyboard' },
  { id: 'key-f8', label: 'F8', action: 'KEY_F8', category: 'keyboard' },
  { id: 'key-f9', label: 'F9', action: 'KEY_F9', category: 'keyboard' },
  { id: 'key-f10', label: 'F10', action: 'KEY_F10', category: 'keyboard' },
  { id: 'key-f11', label: 'F11', action: 'KEY_F11', category: 'keyboard' },
  { id: 'key-f12', label: 'F12', action: 'KEY_F12', category: 'keyboard' },

  { id: 'key-enter', label: 'Enter', action: 'KEY_ENTER', category: 'keyboard' },
  { id: 'key-esc', label: 'Esc', action: 'KEY_ESC', category: 'keyboard' },
  { id: 'key-tab', label: 'Tab', action: 'KEY_TAB', category: 'keyboard' },
  { id: 'key-space', label: 'Space', action: 'KEY_SPACE', category: 'keyboard' },
  { id: 'key-backspace', label: 'Backspace', action: 'KEY_BACKSPACE', category: 'keyboard' },
  { id: 'key-delete', label: 'Delete', action: 'KEY_DELETE', category: 'keyboard' },
  { id: 'key-insert', label: 'Insert', action: 'KEY_INSERT', category: 'keyboard' },
  { id: 'key-home', label: 'Home', action: 'KEY_HOME', category: 'keyboard' },
  { id: 'key-end', label: 'End', action: 'KEY_END', category: 'keyboard' },
  { id: 'key-pageup', label: 'Page Up', action: 'KEY_PAGEUP', category: 'keyboard' },
  { id: 'key-pagedown', label: 'Page Down', action: 'KEY_PAGEDOWN', category: 'keyboard' },
  { id: 'key-up', label: '↑', action: 'KEY_UP', category: 'keyboard' },
  { id: 'key-down', label: '↓', action: 'KEY_DOWN', category: 'keyboard' },
  { id: 'key-left', label: '←', action: 'KEY_LEFT', category: 'keyboard' },
  { id: 'key-right', label: '→', action: 'KEY_RIGHT', category: 'keyboard' },

  { id: 'key-shift', label: 'Shift', action: 'KEY_SHIFT', category: 'keyboard' },
  { id: 'key-ctrl', label: 'Ctrl', action: 'KEY_CTRL', category: 'keyboard' },
  { id: 'key-alt', label: 'Alt', action: 'KEY_ALT', category: 'keyboard' },
  { id: 'key-win', label: 'Win', action: 'KEY_WIN', category: 'keyboard' },

  { id: 'key-printscreen', label: 'Print Screen', action: 'KEY_PRINTSCREEN', category: 'keyboard' },
  { id: 'key-scrolllock', label: 'Scroll Lock', action: 'KEY_SCROLLLOCK', category: 'keyboard' },
  { id: 'key-pause', label: 'Pause', action: 'KEY_PAUSE', category: 'keyboard' },
  { id: 'key-capslock', label: 'Caps Lock', action: 'KEY_CAPSLOCK', category: 'keyboard' },
  { id: 'key-numlock', label: 'Num Lock', action: 'KEY_NUMLOCK', category: 'keyboard' },
];

// Windows macros
export const windowsMacros: Macro[] = [
  { id: 'win-explorer', label: 'Explorer', action: 'WIN+E', category: 'windows', icon: 'folder' },
  { id: 'win-run', label: 'Run', action: 'WIN+R', category: 'windows', icon: 'run' },
  { id: 'win-search', label: 'Search', action: 'WIN+S', category: 'windows', icon: 'search' },
  { id: 'win-settings', label: 'Settings', action: 'WIN+I', category: 'windows', icon: 'settings' },
  { id: 'win-lock', label: 'Lock', action: 'WIN+L', category: 'windows', icon: 'lock' },
  { id: 'win-desktop', label: 'Desktop', action: 'WIN+D', category: 'windows', icon: 'desktop' },
  { id: 'win-task-view', label: 'Task View', action: 'WIN+TAB', category: 'windows', icon: 'task-view' },
  { id: 'win-clipboard', label: 'Clipboard', action: 'WIN+V', category: 'windows', icon: 'clipboard' },

  { id: 'win-snap-left', label: 'Snap Left', action: 'WIN+LEFT', category: 'windows', icon: 'snap-left' },
  { id: 'win-snap-right', label: 'Snap Right', action: 'WIN+RIGHT', category: 'windows', icon: 'snap-right' },
  { id: 'win-snap-up', label: 'Snap Up', action: 'WIN+UP', category: 'windows', icon: 'snap-up' },
  { id: 'win-snap-down', label: 'Snap Down', action: 'WIN+DOWN', category: 'windows', icon: 'snap-down' },
  { id: 'win-min-all', label: 'Minimize All', action: 'WIN+M', category: 'windows', icon: 'minimize' },

  { id: 'win-new-desktop', label: 'New Desktop', action: 'WIN+CTRL+D', category: 'windows', icon: 'add-desktop' },
  { id: 'win-close-desktop', label: 'Close Desktop', action: 'WIN+CTRL+F4', category: 'windows', icon: 'close-desktop' },
  { id: 'win-next-desktop', label: 'Next Desktop', action: 'WIN+CTRL+RIGHT', category: 'windows', icon: 'next-desktop' },
  { id: 'win-prev-desktop', label: 'Prev Desktop', action: 'WIN+CTRL+LEFT', category: 'windows', icon: 'prev-desktop' },

  { id: 'win-task-manager', label: 'Task Manager', action: 'CTRL+SHIFT+ESC', category: 'windows', icon: 'task-manager' },
  { id: 'win-screen-snip', label: 'Screen Snip', action: 'WIN+SHIFT+S', category: 'windows', icon: 'screen-snip' },
  { id: 'win-project', label: 'Project', action: 'WIN+P', category: 'windows', icon: 'project' },
  { id: 'win-action-center', label: 'Action Center', action: 'WIN+A', category: 'windows', icon: 'action-center' },
  { id: 'win-game-bar', label: 'Game Bar', action: 'WIN+G', category: 'windows', icon: 'game' },
];

export const mediaMacros: Macro[] = [
  { id: 'media-play-pause', label: 'Play/Pause', action: 'MEDIA_PLAY_PAUSE', category: 'media', icon: 'play-pause' },
  { id: 'media-next', label: 'Next Track', action: 'MEDIA_NEXT', category: 'media', icon: 'next-track' },
  { id: 'media-prev', label: 'Prev Track', action: 'MEDIA_PREV', category: 'media', icon: 'prev-track' },
  { id: 'media-stop', label: 'Stop', action: 'MEDIA_STOP', category: 'media', icon: 'stop' },
  { id: 'media-vol-up', label: 'Volume Up', action: 'VOLUME_UP', category: 'media', icon: 'volume-up' },
  { id: 'media-vol-down', label: 'Volume Down', action: 'VOLUME_DOWN', category: 'media', icon: 'volume-down' },
  { id: 'media-mute', label: 'Mute', action: 'VOLUME_MUTE', category: 'media', icon: 'mute' },
  { id: 'media-brightness-up', label: 'Brightness +', action: 'BRIGHTNESS_UP', category: 'media', icon: 'brightness-up' },
  { id: 'media-brightness-down', label: 'Brightness -', action: 'BRIGHTNESS_DOWN', category: 'media', icon: 'brightness-down' },
];

export const devMacros: Macro[] = [
  { id: 'vscode-quickopen', label: 'Quick Open', action: 'CTRL+P', category: 'developer', icon: 'quick-open', color: '#007ACC' },
  { id: 'vscode-command', label: 'Command Palette', action: 'CTRL+SHIFT+P', category: 'developer', icon: 'command', color: '#007ACC' },
  { id: 'vscode-terminal', label: 'Terminal', action: 'CTRL+`', category: 'developer', icon: 'terminal', color: '#007ACC' },
  { id: 'vscode-problems', label: 'Problems', action: 'CTRL+SHIFT+M', category: 'developer', icon: 'problems', color: '#007ACC' },
  { id: 'vscode-format', label: 'Format', action: 'SHIFT+ALT+F', category: 'developer', icon: 'format', color: '#007ACC' },
  { id: 'vscode-comment', label: 'Toggle Comment', action: 'CTRL+/', category: 'developer', icon: 'comment', color: '#007ACC' },

  { id: 'browser-inspect', label: 'Inspect', action: 'F12', category: 'developer', icon: 'inspect', color: '#4285F4' },
  { id: 'browser-console', label: 'Console', action: 'CTRL+SHIFT+J', category: 'developer', icon: 'console', color: '#4285F4' },
  { id: 'browser-sources', label: 'Sources', action: 'CTRL+SHIFT+I', category: 'developer', icon: 'sources', color: '#4285F4' },

  { id: 'git-commit', label: 'Commit', action: 'CTRL+K', category: 'developer', icon: 'commit', color: '#F05032' },
  { id: 'git-push', label: 'Push', action: 'CTRL+SHIFT+K', category: 'developer', icon: 'push', color: '#F05032' },
  { id: 'git-pull', label: 'Pull', action: 'CTRL+SHIFT+P', category: 'developer', icon: 'pull', color: '#F05032' },
];

// Custom application macros
export const appMacros: Macro[] = [
  { id: 'browser-new-tab', label: 'New Tab', action: 'CTRL+T', category: 'applications', icon: 'new-tab', color: '#4285F4' },
  { id: 'browser-new-window', label: 'New Window', action: 'CTRL+N', category: 'applications', icon: 'new-window', color: '#4285F4' },
  { id: 'browser-history', label: 'History', action: 'CTRL+H', category: 'applications', icon: 'history', color: '#4285F4' },
  { id: 'browser-bookmark', label: 'Bookmark', action: 'CTRL+D', category: 'applications', icon: 'bookmark', color: '#4285F4' },
  { id: 'browser-refresh', label: 'Refresh', action: 'F5', category: 'applications', icon: 'refresh', color: '#4285F4' },

  { id: 'office-save', label: 'Save', action: 'CTRL+S', category: 'applications', icon: 'save', color: '#D83B01' },
  { id: 'office-print', label: 'Print', action: 'CTRL+P', category: 'applications', icon: 'print', color: '#D83B01' },
  { id: 'office-new', label: 'New', action: 'CTRL+N', category: 'applications', icon: 'new-doc', color: '#D83B01' },
  { id: 'office-undo', label: 'Undo', action: 'CTRL+Z', category: 'applications', icon: 'undo', color: '#D83B01' },
  { id: 'office-redo', label: 'Redo', action: 'CTRL+Y', category: 'applications', icon: 'redo', color: '#D83B01' },

  { id: 'creative-zoom-in', label: 'Zoom In', action: 'CTRL++', category: 'applications', icon: 'zoom-in', color: '#FF9A00' },
  { id: 'creative-zoom-out', label: 'Zoom Out', action: 'CTRL+-', category: 'applications', icon: 'zoom-out', color: '#FF9A00' },
  { id: 'creative-select-all', label: 'Select All', action: 'CTRL+A', category: 'applications', icon: 'select-all', color: '#FF9A00' },
  { id: 'creative-cut', label: 'Cut', action: 'CTRL+X', category: 'applications', icon: 'cut', color: '#FF9A00' },
  { id: 'creative-copy', label: 'Copy', action: 'CTRL+C', category: 'applications', icon: 'copy', color: '#FF9A00' },
  { id: 'creative-paste', label: 'Paste', action: 'CTRL+V', category: 'applications', icon: 'paste', color: '#FF9A00' },
];

export const sequenceMacros: Macro[] = [
  { id: 'seq-copy-all', label: 'Copy All', action: 'CTRL+A, CTRL+C', category: 'sequences', icon: 'copy-all' },
  { id: 'seq-paste-special', label: 'Paste Special', action: 'CTRL+ALT+V', category: 'sequences', icon: 'paste-special' },
  { id: 'seq-save-all', label: 'Save All', action: 'CTRL+SHIFT+S', category: 'sequences', icon: 'save-all' },
  { id: 'seq-find-replace', label: 'Find & Replace', action: 'CTRL+H', category: 'sequences', icon: 'find-replace' },
  { id: 'seq-select-word', label: 'Select Word', action: 'CTRL+D', category: 'sequences', icon: 'select-word' },
  { id: 'seq-select-line', label: 'Select Line', action: 'HOME, SHIFT+END', category: 'sequences', icon: 'select-line' },
  { id: 'seq-duplicate-line', label: 'Duplicate Line', action: 'CTRL+SHIFT+D', category: 'sequences', icon: 'duplicate' },
  { id: 'seq-move-line-up', label: 'Move Line Up', action: 'ALT+UP', category: 'sequences', icon: 'move-up' },
  { id: 'seq-move-line-down', label: 'Move Line Down', action: 'ALT+DOWN', category: 'sequences', icon: 'move-down' },
  { id: 'seq-indent', label: 'Indent', action: 'TAB', category: 'sequences', icon: 'indent' },
  { id: 'seq-outdent', label: 'Outdent', action: 'SHIFT+TAB', category: 'sequences', icon: 'outdent' },
];

export const urlMacros: Macro[] = [
  { id: 'url-google', label: 'Google', action: 'URL:https://www.google.com', category: 'urls', icon: 'google', color: '#4285F4' },
  { id: 'url-gmail', label: 'Gmail', action: 'URL:https://mail.google.com', category: 'urls', icon: 'gmail', color: '#D44638' },
  { id: 'url-youtube', label: 'YouTube', action: 'URL:https://www.youtube.com', category: 'urls', icon: 'youtube', color: '#FF0000' },
  { id: 'url-github', label: 'GitHub', action: 'URL:https://github.com', category: 'urls', icon: 'github', color: '#181717' },
  { id: 'url-linkedin', label: 'LinkedIn', action: 'URL:https://www.linkedin.com', category: 'urls', icon: 'linkedin', color: '#0077B5' },
  { id: 'url-twitter', label: 'Twitter', action: 'URL:https://twitter.com', category: 'urls', icon: 'twitter', color: '#1DA1F2' },
  { id: 'url-facebook', label: 'Facebook', action: 'URL:https://www.facebook.com', category: 'urls', icon: 'facebook', color: '#1877F2' },
  { id: 'url-instagram', label: 'Instagram', action: 'URL:https://www.instagram.com', category: 'urls', icon: 'instagram', color: '#E4405F' },
  { id: 'url-amazon', label: 'Amazon', action: 'URL:https://www.amazon.com', category: 'urls', icon: 'amazon', color: '#FF9900' },
  { id: 'url-netflix', label: 'Netflix', action: 'URL:https://www.netflix.com', category: 'urls', icon: 'netflix', color: '#E50914' },
];

export const editableMacros: Macro[] = [
  { id: 'editable-1', label: 'Custom 1', action: '', category: 'editable', icon: 'custom' },
  { id: 'editable-2', label: 'Custom 2', action: '', category: 'editable', icon: 'custom' },
  { id: 'editable-3', label: 'Custom 3', action: '', category: 'editable', icon: 'custom' },
  { id: 'editable-4', label: 'Custom 4', action: '', category: 'editable', icon: 'custom' },
  { id: 'editable-5', label: 'Custom 5', action: '', category: 'editable', icon: 'custom' },
  { id: 'editable-6', label: 'Custom 6', action: '', category: 'editable', icon: 'custom' },
  { id: 'editable-7', label: 'Custom 7', action: '', category: 'editable', icon: 'custom' },
  { id: 'editable-8', label: 'Custom 8', action: '', category: 'editable', icon: 'custom' },
  { id: 'editable-9', label: 'Custom 9', action: '', category: 'editable', icon: 'custom' },
  { id: 'editable-10', label: 'Custom 10', action: '', category: 'editable', icon: 'custom' },
];

export const allMacros = [
  ...keyboardKeys,
  ...windowsMacros,
  ...mediaMacros,
  ...devMacros,
  ...appMacros,
  ...sequenceMacros,
  ...urlMacros,
  ...editableMacros
];

export const getMacrosByCategory = (category: string): Macro[] => {
  return allMacros.filter(macro => macro.category === category);
};

export const categories: Category[] = [
  { id: 'keyboard', label: 'Keyboard Keys', icon: 'keyboard' },
  { id: 'windows', label: 'Windows Shortcuts', icon: 'windows' },
  { id: 'media', label: 'Media Controls', icon: 'media' },
  { id: 'developer', label: 'Developer Tools', icon: 'code' },
  { id: 'applications', label: 'Applications', icon: 'apps' },
  { id: 'sequences', label: 'Key Sequences', icon: 'sequence' },
  { id: 'urls', label: 'Websites', icon: 'globe' },
  { id: 'editable', label: 'Custom Macros', icon: 'custom' },
];

export const searchMacros = (query: string): Macro[] => {
  const lowerQuery = query.toLowerCase();
  return allMacros.filter(macro =>
      macro.label.toLowerCase().includes(lowerQuery) ||
      macro.action.toLowerCase().includes(lowerQuery) ||
      macro.category.toLowerCase().includes(lowerQuery)
  );
};

export const getPopularMacros = (): Macro[] => {
  const popularIds = [
    'win-explorer', 'key-ctrl', 'key-alt', 'media-play-pause',
    'browser-new-tab', 'seq-copy-all', 'vscode-quickopen', 'win-screen-snip'
  ];

  return allMacros.filter(macro => popularIds.includes(macro.id));
};