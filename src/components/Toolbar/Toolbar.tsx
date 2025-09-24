import React, { useState } from 'react';
import { useAppStore } from '../../store';
import { ViewType } from '../../types';
import { sampleTopology } from '../../data/sampleData';
import { shortcutManager } from '../../theme/keyboardShortcuts';

/**
 * Toolbar component with main actions and controls
 */
const Toolbar: React.FC = () => {
  const { 
    currentView, 
    simulationRunning, 
    startSimulation, 
    stopSimulation,
    clearTopology,
    loadTopology,
    showVlanHighlight,
    toggleVlanHighlight,
    devices,
    connections,
    vlans,
    connectionToolActive,
    toggleConnectionTool,
    showPortLabels,
    togglePortLabels,
  } = useAppStore();

  const [showFileMenu, setShowFileMenu] = useState(false);
  const [showVlanMenu, setShowVlanMenu] = useState(false);

  const handleNewTopology = () => {
    if (devices.length > 0) {
      const confirmed = window.confirm('This will clear the current topology. Are you sure?');
      if (!confirmed) return;
    }
    clearTopology();
    setShowFileMenu(false);
  };

  const handleLoadSample = () => {
    if (devices.length > 0) {
      const confirmed = window.confirm('This will replace the current topology. Are you sure?');
      if (!confirmed) return;
    }
    loadTopology(sampleTopology);
    setShowFileMenu(false);
  };

  const handleExport = () => {
    const data = {
      devices,
      connections,
      vlans,
      exportedAt: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vlan-topology-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setShowFileMenu(false);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = JSON.parse(e.target?.result as string);
            if (data.devices && data.connections && data.vlans) {
              loadTopology(data);
              setShowFileMenu(false);
            } else {
              alert('Invalid file format. Please select a valid topology file.');
            }
          } catch (error) {
            alert('Error reading file. Please make sure it\'s a valid JSON file.');
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };



  const openCommandPalette = () => {
    const cmd = shortcutManager.getAllShortcuts().find(s => s.id === 'tools-command-palette');
    if (cmd) cmd.action();
  };

  return (
    <div className="bg-gradient-to-r from-gray-900 to-gray-800 border-b border-gray-700/60 px-3 py-2 flex items-center justify-between shadow-sm">
      {/* Left side - File operations */}
      <div className="flex items-center space-x-4">
        <div className="relative">
          <button
            onClick={() => setShowFileMenu(!showFileMenu)}
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors flex items-center text-sm"
          >
            📁 File
            <span className="ml-2">▼</span>
          </button>
          
          {showFileMenu && (
            <div className="absolute top-full left-0 mt-1 bg-gray-700 rounded-lg shadow-lg border border-gray-600 z-50 min-w-48">
              <button
                onClick={handleNewTopology}
                className="w-full px-4 py-2 text-left hover:bg-gray-600 rounded-t-lg transition-colors"
              >
                🆕 New Topology
              </button>
              <button
                onClick={handleLoadSample}
                className="w-full px-4 py-2 text-left hover:bg-gray-600 transition-colors"
              >
                📋 Load Sample
              </button>
              <hr className="border-gray-600" />
              <button
                onClick={handleImport}
                className="w-full px-4 py-2 text-left hover:bg-gray-600 transition-colors"
              >
                📥 Import
              </button>
              <button
                onClick={handleExport}
                className="w-full px-4 py-2 text-left hover:bg-gray-600 rounded-b-lg transition-colors"
                disabled={devices.length === 0}
              >
                📤 Export
              </button>
            </div>
          )}
        </div>

        {/* View-specific controls */}
        {currentView === ViewType.TOPOLOGY && (
          <div className="flex items-center space-x-3">
            <div className="relative">
              <button
                onClick={() => setShowVlanMenu(!showVlanMenu)}
                className={`px-2.5 py-1.5 rounded-md transition-colors flex items-center text-sm ${
                  showVlanHighlight 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                }`}
                title="Show VLAN colors"
              >
                🎨 VLAN Colors
              </button>

              {showVlanMenu && (
                <div className="absolute mt-2 left-0 z-50 w-64 rounded-md border border-gray-700/60 bg-gray-800 shadow-lg p-2">
                  <div className="px-2 py-1 text-xs uppercase tracking-wider text-gray-400">Available VLANs</div>
                  <div className="max-h-64 overflow-y-auto pr-1 space-y-1">
                    {vlans.length === 0 && (
                      <div className="px-2 py-2 text-sm text-gray-400">No VLANs configured</div>
                    )}
                    {vlans.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => {
                          useAppStore.getState().selectVlan(v.id);
                          if (!useAppStore.getState().showVlanHighlight) {
                            useAppStore.getState().toggleVlanHighlight();
                          }
                          setShowVlanMenu(false);
                        }}
                        className="w-full flex items-center px-2 py-1.5 rounded hover:bg-gray-700 text-left text-sm"
                        title={`Highlight VLAN ${v.id}`}
                      >
                        <span className="inline-block w-3 h-3 rounded-full mr-2 ring-1 ring-white/10" style={{ backgroundColor: v.color }}></span>
                        <span className="flex-1 truncate">VLAN {v.id} - {v.name}</span>
                      </button>
                    ))}
                  </div>

                  <div className="border-t border-gray-700/60 mt-2 pt-2 flex items-center justify-between">
                    <button
                      onClick={() => {
                        if (useAppStore.getState().showVlanHighlight) {
                          useAppStore.getState().toggleVlanHighlight();
                        }
                        setShowVlanMenu(false);
                      }}
                      className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-200"
                    >
                      Hide Highlights
                    </button>
                    <button
                      onClick={() => {
                        useAppStore.getState().selectVlan(undefined as any);
                        setShowVlanMenu(false);
                      }}
                      className="px-2 py-1 text-xs rounded bg-gray-700 hover:bg-gray-600 text-gray-200"
                    >
                      Clear Selection
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {currentView === ViewType.PACKET_SIM && (
          <div className="flex items-center space-x-3">
            <button
              onClick={() => simulationRunning ? stopSimulation() : startSimulation()}
              className={`px-3 py-1.5 rounded-md transition-colors flex items-center text-sm ${
                simulationRunning
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {simulationRunning ? '⏹️ Stop' : '▶️ Start'}
            </button>
            
            {simulationRunning && (
              <div className="flex items-center space-x-2 text-sm text-gray-300">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span>Running</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Center - Current view title */}
      <div className="flex-1 text-center">
        <h2 className="text-base md:text-lg font-medium text-white">
          {currentView === ViewType.TOPOLOGY && 'Network Topology'}
          {currentView === ViewType.VLAN_CONFIG && 'VLAN Configuration'}
          {currentView === ViewType.PACKET_SIM && 'Packet Simulation'}
          {currentView === ViewType.STP && 'Spanning Tree Protocol'}
          {currentView === ViewType.STATISTICS && 'Network Statistics'}
        </h2>
      </div>

      {/* Right side - Controls and info */}
      <div className="flex items-center space-x-5 text-sm text-gray-300">
        <div className="flex items-center space-x-1">
          <span>🖥️</span>
          <span>{devices.length}</span>
        </div>
        
        {connections.length > 0 && (
          <div className="flex items-center space-x-1">
            <span>🔗</span>
            <span>{connections.length}</span>
          </div>
        )}
        
        {vlans.length > 0 && (
          <div className="flex items-center space-x-1">
            <span>🌐</span>
            <span>{vlans.length}</span>
          </div>
        )}

        {/* Port labels toggle */}
        <button
          onClick={togglePortLabels}
          className={`px-2.5 py-1.5 rounded-md transition-colors text-sm ${showPortLabels ? 'bg-teal-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-200'}`}
          title="Show/Hide port endpoint labels"
        >
          🏷️ Ports
        </button>

        {/* Connect tool */}
        <button
          onClick={toggleConnectionTool}
          className={`px-2.5 py-1.5 rounded-md transition-colors text-sm ${connectionToolActive ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-200'}`}
          title="Connection mode: Click source device then target device"
        >
          🔗 Connect
        </button>


        {/* Command Palette button moved here */}
        <button
          onClick={openCommandPalette}
          className="px-2.5 py-1.5 rounded-md transition-colors bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm"
          title="Open Command Palette (Ctrl+K)"
        >
          ⌨️ Commands
        </button>

        <div className="text-xs text-gray-400">
          {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* Close dropdown when clicking outside */}
      {(showFileMenu || showVlanMenu) && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => { setShowFileMenu(false); setShowVlanMenu(false); }}
        />
      )}
    </div>
  );
};

export default Toolbar;