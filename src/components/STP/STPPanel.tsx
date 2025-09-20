import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../../store';
import { SwitchDevice, DeviceType } from '../../types';
import { stpSimulation, STPPortState, STPPortRole } from '../../protocols/switching/stpSimulation';

/**
 * STP (Spanning Tree Protocol) management and visualization panel
 */
const STPPanel: React.FC = () => {
  const { devices, connections, updateDevice } = useAppStore();
  const [stpEnabled, setStpEnabled] = useState(false);
  const [convergenceStats, setConvergenceStats] = useState({
    convergenceTime: 0,
    topologyChangeCount: 0,
    lastConvergenceTime: 0,
    isConverged: false,
  });
  const [selectedBridge, setSelectedBridge] = useState<string | undefined>();
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Filter switches from devices
  const switches = useMemo(
    () => devices.filter(d => d.type === DeviceType.SWITCH) as SwitchDevice[],
    [devices]
  );

  // Initialize STP simulation when topology changes
  useEffect(() => {
    if (switches.length >= 2 && connections.length > 0) {
      stpSimulation.initialize(devices, connections);
    }
  }, [devices, connections, switches.length]);

  // Auto-refresh STP state
  useEffect(() => {
    if (!autoRefresh || !stpEnabled) return;

    const interval = setInterval(() => {
      const stats = stpSimulation.getConvergenceStats();
      setConvergenceStats(stats);
    }, 1000);

    return () => clearInterval(interval);
  }, [autoRefresh, stpEnabled]);

  // Handle STP enable/disable
  const handleStpToggle = () => {
    const newEnabled = !stpEnabled;
    setStpEnabled(newEnabled);

    if (newEnabled) {
      // Enable STP on all switches
      switches.forEach(sw => {
        updateDevice(sw.id, {
          ...sw,
          spanningTreeEnabled: true
        } as SwitchDevice);
      });
      
      // Start STP simulation
      stpSimulation.start();
      setConvergenceStats(stpSimulation.getConvergenceStats());
    } else {
      // Disable STP
      switches.forEach(sw => {
        updateDevice(sw.id, {
          ...sw,
          spanningTreeEnabled: false
        } as SwitchDevice);
      });
      
      stpSimulation.stop();
    }
  };

  // Simulate topology change (link failure/recovery)
  const handleTopologyChange = (device1Id: string, device2Id: string, isLinkUp: boolean) => {
    stpSimulation.simulateTopologyChange(device1Id, device2Id, isLinkUp);
    setConvergenceStats(stpSimulation.getConvergenceStats());
  };

  // Force STP reconvergence
  const handleForceReconvergence = () => {
    stpSimulation.stop();
    stpSimulation.start();
    setConvergenceStats(stpSimulation.getConvergenceStats());
  };

  // Get port state color for visualization
  const getPortStateColor = (state: STPPortState): string => {
    switch (state) {
      case STPPortState.FORWARDING:
        return 'text-green-400';
      case STPPortState.BLOCKING:
        return 'text-red-400';
      case STPPortState.LEARNING:
        return 'text-yellow-400';
      case STPPortState.LISTENING:
        return 'text-orange-400';
      case STPPortState.DISABLED:
        return 'text-gray-400';
      default:
        return 'text-gray-400';
    }
  };

  // Get port role color for visualization
  const getPortRoleColor = (role: STPPortRole): string => {
    switch (role) {
      case STPPortRole.ROOT:
        return 'bg-blue-600';
      case STPPortRole.DESIGNATED:
        return 'bg-green-600';
      case STPPortRole.ALTERNATE:
        return 'bg-yellow-600';
      case STPPortRole.BACKUP:
        return 'bg-orange-600';
      case STPPortRole.DISABLED:
        return 'bg-gray-600';
      default:
        return 'bg-gray-600';
    }
  };

  if (switches.length < 2) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-400">
          <div className="text-6xl mb-4">🌳</div>
          <h3 className="text-xl font-semibold mb-2">Spanning Tree Protocol</h3>
          <p>Add at least two switches to enable STP simulation</p>
        </div>
      </div>
    );
  }

  const rootBridge = stpSimulation.getRootBridgeInfo();
  const blockedPorts = stpSimulation.getBlockedPorts();

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4 bg-gray-900 text-white">
      {/* Header with controls */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Spanning Tree Protocol</h2>
          
          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={stpEnabled}
                onChange={handleStpToggle}
                className="rounded"
              />
              <span className="text-sm">Enable STP</span>
            </label>
            
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Auto Refresh</span>
            </label>
            
            <button
              onClick={handleForceReconvergence}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-sm"
              disabled={!stpEnabled}
            >
              Force Reconvergence
            </button>
          </div>
        </div>

        {/* Convergence Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="bg-gray-700 p-3 rounded">
            <div className="text-gray-300">Convergence Time</div>
            <div className="text-lg font-semibold text-white">{convergenceStats.convergenceTime}ms</div>
          </div>
          <div className="bg-gray-700 p-3 rounded">
            <div className="text-gray-300">Topology Changes</div>
            <div className="text-lg font-semibold text-white">{convergenceStats.topologyChangeCount}</div>
          </div>
          <div className="bg-gray-700 p-3 rounded">
            <div className="text-gray-300">Status</div>
            <div className={`text-lg font-semibold ${convergenceStats.isConverged ? 'text-green-400' : 'text-red-400'}`}>
              {convergenceStats.isConverged ? 'Converged' : 'Converging'}
            </div>
          </div>
          <div className="bg-gray-700 p-3 rounded">
            <div className="text-gray-300">Blocked Ports</div>
            <div className="text-lg font-semibold text-white">{blockedPorts.length}</div>
          </div>
        </div>
      </div>

      {/* Root Bridge Information */}
      {rootBridge && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-3 flex items-center">
            <span className="w-3 h-3 bg-yellow-400 rounded-full mr-2"></span>
            Root Bridge
          </h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <div className="text-gray-400">Bridge ID</div>
              <div className="text-white font-mono">{rootBridge.bridgeId}</div>
            </div>
            <div>
              <div className="text-gray-400">Priority</div>
              <div className="text-white">{rootBridge.priority}</div>
            </div>
            <div>
              <div className="text-gray-400">MAC Address</div>
              <div className="text-white font-mono">{rootBridge.macAddress}</div>
            </div>
          </div>
        </div>
      )}

      {/* Bridge Details */}
      <div className="space-y-3">
        {switches.map(sw => {
          const bridgeState = stpSimulation.getBridgeState(sw.id);
          if (!bridgeState) return null;

          const isRootBridge = bridgeState.rootBridgeId === sw.id;
          const isSelected = selectedBridge === sw.id;

          return (
            <div key={sw.id} className="bg-gray-800 border border-gray-700 rounded-lg">
              <button
                onClick={() => setSelectedBridge(isSelected ? undefined : sw.id)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-700 rounded-t-lg hover:bg-gray-600"
              >
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${isRootBridge ? 'bg-yellow-400' : 'bg-gray-400'}`}></div>
                  <span className="font-medium text-white">{sw.name}</span>
                  {isRootBridge && <span className="text-xs bg-yellow-600 px-2 py-1 rounded text-black">ROOT</span>}
                </div>
                <div className="flex items-center space-x-4 text-sm text-gray-300">
                  <span>Ports: {bridgeState.ports.size}</span>
                  <span>Cost: {bridgeState.rootCost}</span>
                </div>
              </button>

              {/* Port Details */}
              {isSelected && (
                <div className="p-4 space-y-3">
                  <div className="text-sm text-gray-300 mb-2">Port States:</div>
                  {Array.from(bridgeState.ports.entries()).map(([interfaceId, port]) => {
                    const iface = sw.interfaces.find(i => i.id === interfaceId);
                    if (!iface) return null;

                    return (
                      <div key={interfaceId} className="flex items-center justify-between bg-gray-700 p-3 rounded">
                        <div className="flex items-center space-x-3">
                          <div className={`px-2 py-1 rounded text-xs text-white ${getPortRoleColor(port.role)}`}>
                            {port.role.toUpperCase()}
                          </div>
                          <span className="text-white">{iface.name}</span>
                        </div>
                        
                        <div className="flex items-center space-x-4 text-sm">
                          <span className={getPortStateColor(port.state)}>
                            {port.state.toUpperCase()}
                          </span>
                          <span className="text-gray-400">Cost: {port.pathCost}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Topology Change Simulation */}
      {stpEnabled && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-3">Topology Change Simulation</h3>
          <div className="text-sm text-gray-300 mb-3">
            Simulate link failures to observe STP reconvergence:
          </div>
          
          <div className="space-y-2">
            {connections.map(conn => {
              const sourceDevice = devices.find(d => d.id === conn.sourceDevice);
              const targetDevice = devices.find(d => d.id === conn.targetDevice);
              
              if (!sourceDevice || !targetDevice) return null;
              
              // Only show switch-to-switch connections
              if (sourceDevice.type !== DeviceType.SWITCH || targetDevice.type !== DeviceType.SWITCH) {
                return null;
              }

              return (
                <div key={conn.id} className="flex items-center justify-between bg-gray-700 p-2 rounded">
                  <span className="text-sm text-white">
                    {sourceDevice.name} ↔ {targetDevice.name}
                  </span>
                  <div className="space-x-2">
                    <button
                      onClick={() => handleTopologyChange(conn.sourceDevice, conn.targetDevice, false)}
                      className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
                    >
                      Fail Link
                    </button>
                    <button
                      onClick={() => handleTopologyChange(conn.sourceDevice, conn.targetDevice, true)}
                      className="px-2 py-1 bg-green-600 hover:bg-green-700 rounded text-xs"
                    >
                      Restore Link
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default STPPanel;