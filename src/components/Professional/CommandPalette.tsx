import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTheme } from '../../theme/ThemeProvider';
import { shortcutManager } from '../../theme/keyboardShortcuts';
import { useAppStore } from '../../store';
import { ViewType, DeviceType, DeviceStatus, InterfaceType, InterfaceStatus } from '../../types';

interface Command {
  id: string;
  label: string;
  description: string;
  category: string;
  keywords: string[];
  action: () => void;
  shortcut?: string;
  icon?: string;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * VS Code-style command palette for quick access to all features
 */
const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const { theme } = useTheme();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const {
    setCurrentView,
    devices,
    vlans,
    simulationRunning,
    startSimulation,
    stopSimulation,
    sendTestPacket,
    addDevice,
    clearTopology,
    toggleVlanHighlight,
  } = useAppStore();

  // Create all available commands
  const allCommands = useMemo((): Command[] => [
    // Navigation commands
    {
      id: 'nav-topology',
      label: 'Go to Topology View',
      description: 'Switch to the network topology editor',
      category: 'Navigation',
      keywords: ['topology', 'network', 'diagram', 'editor'],
      action: () => setCurrentView(ViewType.TOPOLOGY),
      shortcut: 'Ctrl+1',
      icon: '🌐',
    },
    {
      id: 'nav-vlan',
      label: 'Go to VLAN Configuration',
      description: 'Configure VLANs and network segmentation',
      category: 'Navigation',
      keywords: ['vlan', 'configuration', 'segmentation'],
      action: () => setCurrentView(ViewType.VLAN_CONFIG),
      shortcut: 'Ctrl+2',
      icon: '🏷️',
    },
    {
      id: 'nav-simulation',
      label: 'Go to Packet Simulation',
      description: 'Run and monitor packet simulations',
      category: 'Navigation',
      keywords: ['simulation', 'packet', 'traffic', 'network'],
      action: () => setCurrentView(ViewType.PACKET_SIM),
      shortcut: 'Ctrl+3',
      icon: '📡',
    },
    {
      id: 'nav-statistics',
      label: 'Go to Statistics Dashboard',
      description: 'View network performance metrics and analytics',
      category: 'Navigation',
      keywords: ['statistics', 'metrics', 'analytics', 'performance'],
      action: () => setCurrentView(ViewType.STATISTICS),
      shortcut: 'Ctrl+4',
      icon: '📊',
    },

    // Device creation commands
    {
      id: 'create-switch',
      label: 'Create Switch',
      description: 'Add a new network switch to the topology',
      category: 'Create',
      keywords: ['switch', 'create', 'add', 'device'],
      action: () => {
        const newSwitch = {
          id: crypto.randomUUID(),
          name: `Switch-${devices.filter(d => d.type === DeviceType.SWITCH).length + 1}`,
          type: DeviceType.SWITCH as const,
          position: { x: 100, y: 100 },
          status: DeviceStatus.ACTIVE,
          interfaces: [],
          macAddressTable: [],
          vlanDatabase: [],
          spanningTreeEnabled: true,
        };
        addDevice(newSwitch);
        setCurrentView(ViewType.TOPOLOGY);
      },
      shortcut: 'Ctrl+Shift+S',
      icon: '🔄',
    },
    {
      id: 'create-router',
      label: 'Create Router',
      description: 'Add a new network router to the topology',
      category: 'Create',
      keywords: ['router', 'create', 'add', 'device'],
      action: () => {
        const newRouter = {
          id: crypto.randomUUID(),
          name: `Router-${devices.filter(d => d.type === DeviceType.ROUTER).length + 1}`,
          type: DeviceType.ROUTER as const,
          position: { x: 150, y: 100 },
          status: DeviceStatus.ACTIVE,
          interfaces: [],
          routingTable: [],
          ospfEnabled: false,
          bgpEnabled: false,
        };
        addDevice(newRouter);
        setCurrentView(ViewType.TOPOLOGY);
      },
      shortcut: 'Ctrl+Shift+R',
      icon: '🚪',
    },
    {
      id: 'create-pc',
      label: 'Create PC',
      description: 'Add a new PC workstation to the topology',
      category: 'Create',
      keywords: ['pc', 'computer', 'workstation', 'create', 'add'],
      action: () => {
        const newPC = {
          id: crypto.randomUUID(),
          name: `PC-${devices.filter(d => d.type === DeviceType.PC).length + 1}`,
          type: DeviceType.PC as const,
          position: { x: 200, y: 100 },
          status: DeviceStatus.ACTIVE,
          interface: {
            id: 'eth0',
            name: 'Ethernet0',
            type: InterfaceType.ETHERNET,
            status: InterfaceStatus.UP,
            macAddress: '00:00:00:00:00:01',
            speed: 1000,
            duplex: 'full' as const,
          },
        };
        addDevice(newPC);
        setCurrentView(ViewType.TOPOLOGY);
      },
      shortcut: 'Ctrl+Shift+P',
      icon: '💻',
    },
    {
      id: 'create-server',
      label: 'Create Server',
      description: 'Add a new server to the topology',
      category: 'Create',
      keywords: ['server', 'create', 'add', 'device'],
      action: () => {
        const newServer = {
          id: crypto.randomUUID(),
          name: `Server-${devices.filter(d => d.type === DeviceType.SERVER).length + 1}`,
          type: DeviceType.SERVER as const,
          position: { x: 250, y: 100 },
          status: DeviceStatus.ACTIVE,
          interfaces: [{
            id: 'eth0',
            name: 'Ethernet0',
            type: InterfaceType.ETHERNET,
            status: InterfaceStatus.UP,
            macAddress: '00:00:00:00:00:02',
            speed: 1000,
            duplex: 'full' as const,
          }],
          services: ['http', 'ssh'],
        };
        addDevice(newServer);
        setCurrentView(ViewType.TOPOLOGY);
      },
      shortcut: 'Ctrl+Shift+V',
      icon: '🖥️',
    },

    // Simulation commands
    {
      id: 'sim-start-stop',
      label: simulationRunning ? 'Stop Simulation' : 'Start Simulation',
      description: simulationRunning ? 'Stop the running packet simulation' : 'Start packet simulation',
      category: 'Simulation',
      keywords: ['simulation', 'start', 'stop', 'run'],
      action: () => {
        if (simulationRunning) {
          stopSimulation();
        } else {
          startSimulation();
        }
        setCurrentView(ViewType.PACKET_SIM);
      },
      shortcut: 'Space',
      icon: simulationRunning ? '⏹️' : '▶️',
    },
    {
      id: 'sim-test-packet',
      label: 'Send Test Packet',
      description: 'Send a test packet between devices',
      category: 'Simulation',
      keywords: ['packet', 'test', 'ping', 'send'],
      action: () => {
        const endDevices = devices.filter(d => d.type === DeviceType.PC || d.type === DeviceType.SERVER);
        if (endDevices.length >= 2) {
          sendTestPacket(endDevices[0].id, endDevices[1].id);
        }
        setCurrentView(ViewType.PACKET_SIM);
      },
      shortcut: 'Ctrl+T',
      icon: '📦',
    },

    // View commands
    {
      id: 'view-toggle-vlan',
      label: 'Toggle VLAN Highlighting',
      description: 'Show/hide VLAN color coding in topology',
      category: 'View',
      keywords: ['vlan', 'highlight', 'color', 'toggle'],
      action: () => {
        toggleVlanHighlight();
        setCurrentView(ViewType.TOPOLOGY);
      },
      icon: '🎨',
    },

    // File commands
    {
      id: 'file-clear',
      label: 'Clear Topology',
      description: 'Remove all devices and connections',
      category: 'File',
      keywords: ['clear', 'reset', 'new', 'empty'],
      action: clearTopology,
      icon: '🗑️',
    },

    // Quick access to VLANs
    ...vlans.map(vlan => ({
      id: `vlan-${vlan.id}`,
      label: `Configure VLAN ${vlan.id} (${vlan.name})`,
      description: `Configure settings for VLAN ${vlan.id}`,
      category: 'VLAN',
      keywords: ['vlan', vlan.name, vlan.id.toString(), 'configure'],
      action: () => {
        setCurrentView(ViewType.VLAN_CONFIG);
        // Could select the specific VLAN here
      },
      icon: '🏷️',
    })),

    // Quick access to devices
    ...devices.map(device => ({
      id: `device-${device.id}`,
      label: `Configure ${device.name}`,
      description: `Configure settings for ${device.type} ${device.name}`,
      category: 'Device',
      keywords: [device.name, device.type, 'configure', 'settings'],
      action: () => {
        setCurrentView(ViewType.TOPOLOGY);
        // Could select the specific device here
      },
      icon: device.type === DeviceType.SWITCH ? '🔄' : 
           device.type === DeviceType.ROUTER ? '🚪' :
           device.type === DeviceType.PC ? '💻' : '🖥️',
    })),
  ], [devices, vlans, simulationRunning]);

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) {
      return allCommands.slice(0, 20); // Show top 20 commands when no query
    }

    const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);
    
    return allCommands
      .map(command => {
        let score = 0;
        const searchableText = [
          command.label,
          command.description,
          command.category,
          ...command.keywords,
        ].join(' ').toLowerCase();

        // Calculate relevance score
        searchTerms.forEach(term => {
          if (command.label.toLowerCase().includes(term)) {
            score += 10; // Higher score for label matches
          } else if (command.description.toLowerCase().includes(term)) {
            score += 5;
          } else if (searchableText.includes(term)) {
            score += 2;
          }
        });

        return { command, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(({ command }) => command);
  }, [allCommands, query]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex(prev => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
            onClose();
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredCommands, onClose]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      shortcutManager.setModalActive('command-palette', true);
    } else {
      shortcutManager.setModalActive('command-palette', false);
    }

    return () => {
      if (isOpen) {
        shortcutManager.setModalActive('command-palette', false);
      }
    };
  }, [isOpen]);

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20"
      style={{ backgroundColor: theme.colors.background.overlay }}
      onClick={handleBackdropClick}
    >
      <div
        ref={containerRef}
        className="w-full max-w-2xl mx-4 rounded-lg shadow-2xl"
        style={{
          backgroundColor: theme.colors.background.elevated,
          border: `1px solid ${theme.colors.border.primary}`,
          boxShadow: theme.shadows.overlay,
        }}
      >
        {/* Search Input */}
        <div className="flex items-center px-4 py-3 border-b" style={{ borderColor: theme.colors.border.primary }}>
          <div className="mr-3 text-xl">⚡</div>
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent outline-none text-lg"
            style={{ color: theme.colors.text.primary }}
          />
          <div className="text-sm ml-3" style={{ color: theme.colors.text.tertiary }}>
            {filteredCommands.length} results
          </div>
        </div>

        {/* Commands List */}
        <div className="max-h-96 overflow-y-auto">
          {filteredCommands.length === 0 ? (
            <div className="p-8 text-center" style={{ color: theme.colors.text.secondary }}>
              <div className="text-4xl mb-4">🔍</div>
              <div className="text-lg mb-2">No commands found</div>
              <div className="text-sm">Try a different search term</div>
            </div>
          ) : (
            filteredCommands.map((command, index) => (
              <div
                key={command.id}
                className={`flex items-center px-4 py-3 cursor-pointer transition-colors ${
                  index === selectedIndex ? 'bg-opacity-10' : ''
                }`}
                style={{
                  backgroundColor: index === selectedIndex ? theme.colors.interactive.primary + '20' : 'transparent',
                  borderLeft: index === selectedIndex ? `3px solid ${theme.colors.interactive.primary}` : '3px solid transparent',
                }}
                onClick={() => {
                  command.action();
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <div className="mr-3 text-lg">{command.icon || '⚙️'}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <div className="font-medium truncate" style={{ color: theme.colors.text.primary }}>
                      {command.label}
                    </div>
                    {command.shortcut && (
                      <div
                        className="text-xs px-2 py-1 rounded ml-2 font-mono"
                        style={{
                          backgroundColor: theme.colors.background.tertiary,
                          color: theme.colors.text.secondary,
                        }}
                      >
                        {command.shortcut}
                      </div>
                    )}
                  </div>
                  <div className="text-sm truncate mt-1" style={{ color: theme.colors.text.secondary }}>
                    {command.description}
                  </div>
                  <div className="text-xs mt-1" style={{ color: theme.colors.text.tertiary }}>
                    {command.category}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-4 py-2 text-xs border-t"
          style={{
            borderColor: theme.colors.border.primary,
            backgroundColor: theme.colors.background.secondary,
            color: theme.colors.text.tertiary,
          }}
        >
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1">
              <kbd className="px-2 py-1 bg-gray-600 rounded text-white">↑</kbd>
              <kbd className="px-2 py-1 bg-gray-600 rounded text-white">↓</kbd>
              <span>navigate</span>
            </div>
            <div className="flex items-center space-x-1">
              <kbd className="px-2 py-1 bg-gray-600 rounded text-white">↵</kbd>
              <span>execute</span>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <kbd className="px-2 py-1 bg-gray-600 rounded text-white">esc</kbd>
            <span>close</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;