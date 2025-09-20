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
    <div className={`bg-gradient-to-b from-gray-900 to-gray-800 border-r border-gray-700/60 flex flex-col transition-all duration-300 shadow-xl ${
      sidebarOpen ? 'w-60' : 'w-16'
    }`}>
      {/* Sidebar Header */}
      <div className="p-4 border-b border-gray-700/60 flex items-center justify-between sticky top-0 z-10 bg-gradient-to-r from-gray-900/80 to-gray-800/80 backdrop-blur-sm">
        {sidebarOpen && (
          <h1 className="text-lg font-semibold bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent drop-shadow">VLAN Simulator</h1>
        )}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded-md bg-gray-700/80 hover:bg-gray-600/90 ring-1 ring-gray-600/50 hover:ring-blue-400/60 transition-colors"
        >
          {sidebarOpen ? '◀' : '▶'}
        </button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto sidebar-scroll">
        {/* Navigation */}
        <div className="p-4 border-b border-gray-700/60">
        {sidebarOpen && <h2 className="text-[11px] font-semibold text-gray-400 tracking-wider uppercase mb-3">Navigation</h2>}
        <div className="space-y-1">
          {viewButtons.map(({ view, label, icon }) => (
            <button
              key={view}
              onClick={() => setCurrentView(view)}
              className={`group relative w-full flex items-center px-3 py-2 rounded-md transition-colors duration-200 outline outline-1 outline-transparent ${
                currentView === view
                  ? 'bg-blue-600/90 text-white ring-1 ring-blue-400/60 shadow-sm'
                  : 'text-gray-300 hover:bg-gradient-to-r hover:from-gray-700/80 hover:to-gray-600/80 hover:outline-blue-400/30'
              }`}
              title={sidebarOpen ? undefined : label}
            >
              <span className="mr-2.5 inline-flex h-7 w-7 items-center justify-center rounded-md bg-gray-700/60 group-hover:bg-gray-600/70 transition-colors text-base">{icon}</span>
              {sidebarOpen && <span className="text-sm">{label}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Device Palette - only show in topology view */}
      {currentView === ViewType.TOPOLOGY && (
        <div className="p-4 border-b border-gray-700/60">
          {sidebarOpen && <h2 className="text-[11px] font-semibold text-gray-400 tracking-wider uppercase mb-3">Device Palette</h2>}
          <div className="space-y-2">
            {deviceTemplates.map((template) => (
              <div
                key={template.type}
                draggable
                onDragStart={(e) => handleDragStart(e, template)}
                className="flex items-center p-3 bg-gray-700/70 rounded-md cursor-move hover:bg-gray-600/80 transition-colors ring-1 ring-gray-600/40 hover:ring-blue-400/50 shadow-sm"
                title={sidebarOpen ? undefined : template.name}
              >
                <span className="text-2xl drop-shadow-sm">{getDeviceIcon(template.type)}</span>
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
        <div className="p-4">
          <h2 className="text-[11px] font-semibold text-gray-400 tracking-wider uppercase mb-3">
            Devices ({devices.length})
          </h2>
          <div className="space-y-1">
            {devices.map((device) => (
              <button
                key={device.id}
                onClick={() => selectDevice(device.id === selectedDevice ? undefined : device.id)}
                className={`group relative w-full flex items-center px-3 py-2 rounded-md transition-colors duration-200 text-left outline outline-1 outline-transparent ${
                  selectedDevice === device.id
                    ? 'bg-blue-600/90 text-white ring-1 ring-blue-400/60 shadow-sm'
                    : 'text-gray-300 hover:bg-gradient-to-r hover:from-gray-700/80 hover:to-gray-600/80 hover:outline-blue-400/30'
                }`}
              >
                <span className="mr-2.5 inline-flex h-7 w-7 items-center justify-center rounded-md bg-gray-700/60 group-hover:bg-gray-600/70 transition-colors text-base">{getDeviceIcon(device.type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{device.name}</div>
                  <div className="text-[11px] text-gray-400">{device.type}</div>
                </div>
                <div className={`ml-2 w-2 h-2 rounded-full ring-1 ring-white/10 ${
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
        <div className="p-4">
          <h2 className="text-[11px] font-semibold text-gray-400 tracking-wider uppercase mb-3">
            VLANs ({vlans.length})
          </h2>
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {vlans.map((vlan) => (
              <button
                key={vlan.id}
                onClick={() => useAppStore.getState().selectVlan(vlan.id)}
                className={`group relative w-full flex items-center px-3 py-2 rounded-md transition-colors duration-200 text-left outline outline-1 outline-transparent ${
                  vlan.id === useAppStore.getState().selectedVlan ? 'bg-gray-600 ring-1 ring-blue-400 shadow-sm' : 'bg-gray-700/80 hover:bg-gradient-to-r hover:from-gray-700/80 hover:to-gray-600/80 hover:outline-blue-400/30'
                }`}
                title={`Select VLAN ${vlan.id}`}
              >
                <div 
                  className="w-4 h-4 rounded-full mr-3 ring-1 ring-white/10" 
                  style={{ backgroundColor: vlan.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white">VLAN {vlan.id}</div>
                  <div className="text-[11px] text-gray-400 truncate">{vlan.name}</div>
                </div>
                <div className={`ml-2 w-2 h-2 rounded-full ${
                  vlan.status === 'active' ? 'bg-green-400' : 'bg-gray-400'
                }`} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      {sidebarOpen && (
        <div className="p-4 border-t border-gray-700/60">
          <div className="text-xs text-gray-500">
            VLAN Network Simulator v1.0.0
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default Sidebar;