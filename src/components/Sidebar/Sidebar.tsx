import React, { useState } from 'react';
import { useAppStore } from '../../store';
import { ViewType, DeviceType } from '../../types';
import { deviceTemplates } from '../../data/sampleData';

/**
 * Sidebar component with navigation and device palette
 */
const Sidebar: React.FC = () => {
  const { currentView, setCurrentView, devices, vlans, selectedDevice, selectDevice } = useAppStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const viewButtons = [
    { view: ViewType.TOPOLOGY, label: 'Topology', icon: '🌐' },
    { view: ViewType.VLAN_CONFIG, label: 'VLANs', icon: '🔗' },
    { view: ViewType.PACKET_SIM, label: 'Simulation', icon: '📡' },
    { view: ViewType.STATISTICS, label: 'Statistics', icon: '📊' },
  ];

  const getDeviceIcon = (deviceType: DeviceType) => {
    switch (deviceType) {
      case DeviceType.SWITCH: return '🔀';
      case DeviceType.ROUTER: return '📶';
      case DeviceType.PC: return '💻';
      case DeviceType.SERVER: return '🖥️';
      default: return '❓';
    }
  };

  const handleDragStart = (e: React.DragEvent, template: typeof deviceTemplates[0]) => {
    e.dataTransfer.setData('application/json', JSON.stringify({
      type: 'device-template',
      template
    }));
  };

  return (
    <div className={`bg-gray-800 border-r border-gray-700 flex flex-col transition-all duration-300 ${
      sidebarOpen ? 'w-80' : 'w-16'
    }`}>
      {/* Sidebar Header */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        {sidebarOpen && (
          <h1 className="text-lg font-semibold text-white">VLAN Simulator</h1>
        )}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors"
        >
          {sidebarOpen ? '◀' : '▶'}
        </button>
      </div>

      {/* Navigation */}
      <div className="p-4 border-b border-gray-700">
        {sidebarOpen && <h2 className="text-sm font-medium text-gray-300 mb-3">Navigation</h2>}
        <div className="space-y-1">
          {viewButtons.map(({ view, label, icon }) => (
            <button
              key={view}
              onClick={() => setCurrentView(view)}
              className={`w-full flex items-center px-3 py-2 rounded-lg transition-colors ${
                currentView === view
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700'
              }`}
              title={sidebarOpen ? undefined : label}
            >
              <span className="text-lg">{icon}</span>
              {sidebarOpen && <span className="ml-3 text-sm">{label}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Device Palette - only show in topology view */}
      {currentView === ViewType.TOPOLOGY && (
        <div className="p-4 border-b border-gray-700">
          {sidebarOpen && <h2 className="text-sm font-medium text-gray-300 mb-3">Device Palette</h2>}
          <div className="space-y-2">
            {deviceTemplates.map((template) => (
              <div
                key={template.type}
                draggable
                onDragStart={(e) => handleDragStart(e, template)}
                className="flex items-center p-3 bg-gray-700 rounded-lg cursor-move hover:bg-gray-600 transition-colors"
                title={sidebarOpen ? undefined : template.name}
              >
                <span className="text-2xl">{getDeviceIcon(template.type)}</span>
                {sidebarOpen && (
                  <div className="ml-3">
                    <div className="text-sm font-medium text-white">{template.name}</div>
                    <div className="text-xs text-gray-400">{template.type}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Device List - only show in topology view */}
      {currentView === ViewType.TOPOLOGY && sidebarOpen && (
        <div className="p-4 flex-1 overflow-y-auto">
          <h2 className="text-sm font-medium text-gray-300 mb-3">
            Devices ({devices.length})
          </h2>
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {devices.map((device) => (
              <button
                key={device.id}
                onClick={() => selectDevice(device.id === selectedDevice ? undefined : device.id)}
                className={`w-full flex items-center px-3 py-2 rounded-lg transition-colors text-left ${
                  selectedDevice === device.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-700'
                }`}
              >
                <span className="text-lg">{getDeviceIcon(device.type)}</span>
                <div className="ml-3 flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{device.name}</div>
                  <div className="text-xs text-gray-400">{device.type}</div>
                </div>
                <div className={`w-2 h-2 rounded-full ${
                  device.status === 'active' ? 'bg-green-400' : 
                  device.status === 'error' ? 'bg-red-400' : 'bg-gray-400'
                }`} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* VLAN List - only show in VLAN config view */}
      {currentView === ViewType.VLAN_CONFIG && sidebarOpen && (
        <div className="p-4 flex-1 overflow-y-auto">
          <h2 className="text-sm font-medium text-gray-300 mb-3">
            VLANs ({vlans.length})
          </h2>
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {vlans.map((vlan) => (
              <div
                key={vlan.id}
                className="flex items-center px-3 py-2 rounded-lg bg-gray-700"
              >
                <div 
                  className="w-4 h-4 rounded-full mr-3" 
                  style={{ backgroundColor: vlan.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white">VLAN {vlan.id}</div>
                  <div className="text-xs text-gray-400 truncate">{vlan.name}</div>
                </div>
                <div className={`w-2 h-2 rounded-full ${
                  vlan.status === 'active' ? 'bg-green-400' : 'bg-gray-400'
                }`} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      {sidebarOpen && (
        <div className="p-4 border-t border-gray-700">
          <div className="text-xs text-gray-400">
            VLAN Network Simulator v1.0.0
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;