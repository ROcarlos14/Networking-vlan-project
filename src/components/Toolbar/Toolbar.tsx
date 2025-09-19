import React, { useState } from 'react';
import { useAppStore } from '../../store';
import { ViewType } from '../../types';
import { sampleTopology } from '../../data/sampleData';

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
    vlans
  } = useAppStore();

  const [showFileMenu, setShowFileMenu] = useState(false);

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

  return (
    <div className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
      {/* Left side - File operations */}
      <div className="flex items-center space-x-4">
        <div className="relative">
          <button
            onClick={() => setShowFileMenu(!showFileMenu)}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors flex items-center"
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
          <div className="flex items-center space-x-2">
            <button
              onClick={toggleVlanHighlight}
              className={`px-3 py-2 rounded-lg transition-colors flex items-center ${
                showVlanHighlight 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
            >
              🎨 VLAN Colors
            </button>
          </div>
        )}

        {currentView === ViewType.PACKET_SIM && (
          <div className="flex items-center space-x-2">
            <button
              onClick={simulationRunning ? stopSimulation : startSimulation}
              className={`px-4 py-2 rounded-lg transition-colors flex items-center ${
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
        <h2 className="text-lg font-medium text-white">
          {currentView === ViewType.TOPOLOGY && 'Network Topology'}
          {currentView === ViewType.VLAN_CONFIG && 'VLAN Configuration'}
          {currentView === ViewType.PACKET_SIM && 'Packet Simulation'}
          {currentView === ViewType.STATISTICS && 'Network Statistics'}
        </h2>
      </div>

      {/* Right side - Status and info */}
      <div className="flex items-center space-x-4 text-sm text-gray-300">
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

        <div className="text-xs text-gray-400">
          {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* Close dropdown when clicking outside */}
      {showFileMenu && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowFileMenu(false)}
        />
      )}
    </div>
  );
};

export default Toolbar;