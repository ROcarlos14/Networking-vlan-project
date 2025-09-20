import React from 'react';

export interface KeyboardShortcut {
  id: string;
  key: string;
  description: string;
  category: string;
  action: () => void;
  enabled?: boolean;
  global?: boolean; // Whether shortcut works globally or only in specific context
}

export interface ShortcutCategory {
  id: string;
  name: string;
  description: string;
}

export const shortcutCategories: ShortcutCategory[] = [
  { id: 'navigation', name: 'Navigation', description: 'Switch between views and navigate the interface' },
  { id: 'editing', name: 'Editing', description: 'Create, modify, and delete network elements' },
  { id: 'view', name: 'View', description: 'Control canvas view and zoom' },
  { id: 'simulation', name: 'Simulation', description: 'Control packet simulation' },
  { id: 'file', name: 'File', description: 'File operations and data management' },
  { id: 'selection', name: 'Selection', description: 'Select and manipulate elements' },
  { id: 'tools', name: 'Tools', description: 'Access tools and utilities' },
];

export class KeyboardShortcutManager {
  private shortcuts: Map<string, KeyboardShortcut> = new Map();
  private listeners: Map<string, (event: KeyboardEvent) => void> = new Map();
  private isEnabled: boolean = true;
  private activeModals: Set<string> = new Set();

  constructor() {
    this.bindGlobalListener();
  }

  /**
   * Register a keyboard shortcut
   */
  register(shortcut: KeyboardShortcut): void {
    this.shortcuts.set(shortcut.id, shortcut);
    
    if (shortcut.global !== false) {
      const listener = (event: KeyboardEvent) => {
        if (this.shouldHandleShortcut(shortcut, event)) {
          event.preventDefault();
          event.stopPropagation();
          shortcut.action();
        }
      };
      
      this.listeners.set(shortcut.id, listener);
    }
  }

  /**
   * Unregister a keyboard shortcut
   */
  unregister(shortcutId: string): void {
    this.shortcuts.delete(shortcutId);
    this.listeners.delete(shortcutId);
  }

  /**
   * Get all registered shortcuts
   */
  getAllShortcuts(): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values());
  }

  /**
   * Get shortcuts by category
   */
  getShortcutsByCategory(category: string): KeyboardShortcut[] {
    return Array.from(this.shortcuts.values()).filter(s => s.category === category);
  }

  /**
   * Enable/disable shortcut system
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * Notify when modal opens/closes to disable certain shortcuts
   */
  setModalActive(modalId: string, active: boolean): void {
    if (active) {
      this.activeModals.add(modalId);
    } else {
      this.activeModals.delete(modalId);
    }
  }

  /**
   * Check if shortcut should be handled
   */
  private shouldHandleShortcut(shortcut: KeyboardShortcut, event: KeyboardEvent): boolean {
    if (!this.isEnabled || shortcut.enabled === false) {
      return false;
    }

    // Don't handle shortcuts when typing in input fields
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
      return false;
    }

    // Don't handle certain shortcuts when modals are open
    if (this.activeModals.size > 0 && shortcut.category !== 'tools') {
      return false;
    }

    return this.matchesKey(shortcut.key, event);
  }

  /**
   * Check if event matches shortcut key combination
   */
  private matchesKey(shortcutKey: string, event: KeyboardEvent): boolean {
    const parts = shortcutKey.toLowerCase().split('+');
    const key = parts[parts.length - 1];
    const modifiers = parts.slice(0, -1);

    // Check main key
    const eventKey = event.key.toLowerCase();
    if (eventKey !== key && event.code.toLowerCase() !== key) {
      return false;
    }

    // Check modifiers
    const hasCtrl = modifiers.includes('ctrl') || modifiers.includes('cmd');
    const hasShift = modifiers.includes('shift');
    const hasAlt = modifiers.includes('alt');

    return (
      (hasCtrl ? (event.ctrlKey || event.metaKey) : !event.ctrlKey && !event.metaKey) &&
      (hasShift ? event.shiftKey : !event.shiftKey) &&
      (hasAlt ? event.altKey : !event.altKey)
    );
  }

  /**
   * Bind global keyboard event listener
   */
  private bindGlobalListener(): void {
    document.addEventListener('keydown', (event) => {
      if (!this.isEnabled) return;

      // Handle each registered shortcut
      for (const [id, listener] of this.listeners) {
        const shortcut = this.shortcuts.get(id);
        if (shortcut && this.shouldHandleShortcut(shortcut, event)) {
          listener(event);
          break; // Only handle first matching shortcut
        }
      }
    });
  }

  /**
   * Format shortcut key for display
   */
  static formatShortcutKey(key: string): string {
    return key
      .split('+')
      .map(part => {
        switch (part.toLowerCase()) {
          case 'ctrl': return '⌃';
          case 'cmd': return '⌘';
          case 'alt': return '⌥';
          case 'shift': return '⇧';
          case 'enter': return '↵';
          case 'escape': return '⎋';
          case 'space': return '␣';
          case 'arrowup': return '↑';
          case 'arrowdown': return '↓';
          case 'arrowleft': return '←';
          case 'arrowright': return '→';
          default: return part.toUpperCase();
        }
      })
      .join('');
  }
}

// Global shortcut manager instance
export const shortcutManager = new KeyboardShortcutManager();

/**
 * Hook for using keyboard shortcuts in React components
 */
export const useKeyboardShortcuts = (shortcuts: Omit<KeyboardShortcut, 'id'>[], deps: any[] = []) => {
  React.useEffect(() => {
    const shortcutIds = shortcuts.map((shortcut, index) => {
      const id = `${shortcut.category}-${shortcut.key}-${index}`;
      shortcutManager.register({ ...shortcut, id });
      return id;
    });

    return () => {
      shortcutIds.forEach(id => shortcutManager.unregister(id));
    };
  }, deps);
};

/**
 * Default shortcuts for the application
 */
export const createDefaultShortcuts = (actions: {
  // Navigation
  goToTopology: () => void;
  goToVlanConfig: () => void;
  goToSimulation: () => void;
  goToStatistics: () => void;
  
  // Editing
  createSwitch: () => void;
  createRouter: () => void;
  createPC: () => void;
  createServer: () => void;
  deleteSelected: () => void;
  duplicateSelected: () => void;
  selectAll: () => void;
  
  // View
  zoomIn: () => void;
  zoomOut: () => void;
  zoomFit: () => void;
  zoomReset: () => void;
  toggleGrid: () => void;
  toggleLabels: () => void;
  
  // Simulation
  startStopSimulation: () => void;
  pauseSimulation: () => void;
  resetSimulation: () => void;
  sendTestPacket: () => void;
  
  // File
  newTopology: () => void;
  saveTopology: () => void;
  loadTopology: () => void;
  exportTopology: () => void;
  
  // Tools
  openCommandPalette: () => void;
  openShortcutsHelp: () => void;
  toggleTheme: () => void;
  openSettings: () => void;
}): KeyboardShortcut[] => [
  // Navigation shortcuts
  { id: 'nav-topology', key: 'ctrl+1', category: 'navigation', description: 'Switch to Topology view', action: actions.goToTopology },
  { id: 'nav-vlan', key: 'ctrl+2', category: 'navigation', description: 'Switch to VLAN Config view', action: actions.goToVlanConfig },
  { id: 'nav-simulation', key: 'ctrl+3', category: 'navigation', description: 'Switch to Simulation view', action: actions.goToSimulation },
  { id: 'nav-statistics', key: 'ctrl+4', category: 'navigation', description: 'Switch to Statistics view', action: actions.goToStatistics },
  
  // Editing shortcuts
  { id: 'edit-switch', key: 'ctrl+shift+s', category: 'editing', description: 'Create Switch', action: actions.createSwitch },
  { id: 'edit-router', key: 'ctrl+shift+r', category: 'editing', description: 'Create Router', action: actions.createRouter },
  { id: 'edit-pc', key: 'ctrl+shift+p', category: 'editing', description: 'Create PC', action: actions.createPC },
  { id: 'edit-server', key: 'ctrl+shift+v', category: 'editing', description: 'Create Server', action: actions.createServer },
  { id: 'edit-delete', key: 'delete', category: 'editing', description: 'Delete selected items', action: actions.deleteSelected },
  { id: 'edit-duplicate', key: 'ctrl+d', category: 'editing', description: 'Duplicate selected items', action: actions.duplicateSelected },
  { id: 'edit-select-all', key: 'ctrl+a', category: 'selection', description: 'Select all items', action: actions.selectAll },
  
  // View shortcuts
  { id: 'view-zoom-in', key: 'ctrl+=', category: 'view', description: 'Zoom in', action: actions.zoomIn },
  { id: 'view-zoom-out', key: 'ctrl+-', category: 'view', description: 'Zoom out', action: actions.zoomOut },
  { id: 'view-zoom-fit', key: 'ctrl+0', category: 'view', description: 'Zoom to fit', action: actions.zoomFit },
  { id: 'view-zoom-reset', key: 'ctrl+shift+0', category: 'view', description: 'Reset zoom', action: actions.zoomReset },
  { id: 'view-toggle-grid', key: 'ctrl+g', category: 'view', description: 'Toggle grid', action: actions.toggleGrid },
  { id: 'view-toggle-labels', key: 'ctrl+l', category: 'view', description: 'Toggle labels', action: actions.toggleLabels },
  
  // Simulation shortcuts
  { id: 'sim-start-stop', key: 'space', category: 'simulation', description: 'Start/Stop simulation', action: actions.startStopSimulation },
  { id: 'sim-pause', key: 'ctrl+space', category: 'simulation', description: 'Pause simulation', action: actions.pauseSimulation },
  { id: 'sim-reset', key: 'ctrl+shift+space', category: 'simulation', description: 'Reset simulation', action: actions.resetSimulation },
  { id: 'sim-test-packet', key: 'ctrl+t', category: 'simulation', description: 'Send test packet', action: actions.sendTestPacket },
  
  // File shortcuts
  { id: 'file-new', key: 'ctrl+n', category: 'file', description: 'New topology', action: actions.newTopology },
  { id: 'file-save', key: 'ctrl+s', category: 'file', description: 'Save topology', action: actions.saveTopology },
  { id: 'file-open', key: 'ctrl+o', category: 'file', description: 'Open topology', action: actions.loadTopology },
  { id: 'file-export', key: 'ctrl+e', category: 'file', description: 'Export topology', action: actions.exportTopology },
  
  // Tools shortcuts
  { id: 'tools-command-palette', key: 'ctrl+k', category: 'tools', description: 'Open command palette', action: actions.openCommandPalette },
  { id: 'tools-shortcuts', key: 'ctrl+/', category: 'tools', description: 'Show keyboard shortcuts', action: actions.openShortcutsHelp },
  { id: 'tools-theme', key: 'ctrl+shift+t', category: 'tools', description: 'Toggle theme', action: actions.toggleTheme },
  { id: 'tools-settings', key: 'ctrl+,', category: 'tools', description: 'Open settings', action: actions.openSettings },
];
