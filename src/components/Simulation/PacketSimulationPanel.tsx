import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store';
import { PacketType, NetworkProtocol, PacketStatus, DropReason } from '../../types/simulation';
import { DeviceType } from '../../types';
import { getRecommendedScenarios, scenarioGenerators } from '../../utils/simulation/simulationScenarios';

interface PacketCreationForm {
  sourceDevice: string;
  targetDevice: string;
  packetType: PacketType;
  protocol: NetworkProtocol;
  vlanTag?: number;
  packetSize: number;
}

/**
 * Main packet simulation panel component
 */
const PacketSimulationPanel: React.FC = () => {
  const {
    devices,
    vlans,
    simulationRunning,
    currentSimulation,
    simulationStats,
    simulationSpeed,
    activeTrafficFlows,
    startSimulation,
    stopSimulation,
    pauseSimulation,
    resumeSimulation,
    setSimulationSpeed,
    sendTestPacket,
    addTrafficFlow,
    removeTrafficFlow,
    clearTrafficFlows,
    createSimulationEngine,
  } = useAppStore();

  const [showPacketForm, setShowPacketForm] = useState(false);
  const [packetForm, setPacketForm] = useState<PacketCreationForm>({
    sourceDevice: '',
    targetDevice: '',
    packetType: PacketType.ICMP,
    protocol: NetworkProtocol.ICMP,
    vlanTag: undefined,
    packetSize: 64,
  });

  const [showTrafficFlowForm, setShowTrafficFlowForm] = useState(false);
  const [trafficFlowForm, setTrafficFlowForm] = useState({
    sourceDevice: '',
    targetDevice: '',
    protocol: NetworkProtocol.TCP,
    packetsPerSecond: 10,
    duration: 30,
    vlanId: undefined as number | undefined,
  });

  const [showScenarioSelector, setShowScenarioSelector] = useState(false);
  const [animationEnabled, setAnimationEnabled] = useState(true);
  const [packetTrailsEnabled, setPacketTrailsEnabled] = useState(true);

  // Initialize simulation engine on mount
  useEffect(() => {
    createSimulationEngine();
  }, [devices, createSimulationEngine]);

  const handleSendTestPacket = () => {
    if (packetForm.sourceDevice && packetForm.targetDevice) {
      sendTestPacket(packetForm.sourceDevice, packetForm.targetDevice, packetForm.vlanTag);
      setShowPacketForm(false);
      // Reset form
      setPacketForm({
        ...packetForm,
        sourceDevice: '',
        targetDevice: '',
      });
    }
  };

  const handleCreateTrafficFlow = () => {
    if (trafficFlowForm.sourceDevice && trafficFlowForm.targetDevice) {
      const flow = {
        id: crypto.randomUUID(),
        sourceDevice: trafficFlowForm.sourceDevice,
        targetDevice: trafficFlowForm.targetDevice,
        protocol: trafficFlowForm.protocol,
        packetsPerSecond: trafficFlowForm.packetsPerSecond,
        averagePacketSize: 512,
        duration: trafficFlowForm.duration,
        isActive: true,
        vlanId: trafficFlowForm.vlanId,
      };
      
      addTrafficFlow(flow);
      setShowTrafficFlowForm(false);
    }
  };

  const handleSpeedChange = (speed: number) => {
    setSimulationSpeed(speed);
  };
  
  const handleAnimationToggle = () => {
    const newEnabled = !animationEnabled;
    setAnimationEnabled(newEnabled);
    
    // Update simulation engine animation settings
    const { simulationEngine } = useAppStore.getState();
    if (simulationEngine) {
      simulationEngine.setAnimationEnabled(newEnabled);
    }
  };
  
  const handlePacketTrailsToggle = () => {
    const newEnabled = !packetTrailsEnabled;
    setPacketTrailsEnabled(newEnabled);
    
    // Update simulation engine trails settings
    const { simulationEngine } = useAppStore.getState();
    if (simulationEngine) {
      simulationEngine.setPacketTrailsEnabled(newEnabled);
    }
  };

  const getStatusColor = (status: PacketStatus): string => {
    switch (status) {
      case PacketStatus.QUEUED: return 'text-yellow-400';
      case PacketStatus.IN_TRANSIT: return 'text-blue-400';
      case PacketStatus.DELIVERED: return 'text-green-400';
      case PacketStatus.DROPPED: return 'text-red-400';
      case PacketStatus.TIMEOUT: return 'text-orange-400';
      case PacketStatus.ERROR: return 'text-red-500';
      default: return 'text-gray-400';
    }
  };

  const getDropReasonText = (reason: DropReason): string => {
    switch (reason) {
      case DropReason.VLAN_MISMATCH: return 'VLAN Mismatch';
      case DropReason.NO_ROUTE: return 'No Route';
      case DropReason.INTERFACE_DOWN: return 'Interface Down';
      case DropReason.TTL_EXCEEDED: return 'TTL Exceeded';
      case DropReason.BUFFER_FULL: return 'Buffer Full';
      case DropReason.ACCESS_DENIED: return 'Access Denied';
      case DropReason.LOOP_DETECTED: return 'Loop Detected';
      default: return 'Unknown';
    }
  };

  if (devices.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-400">
          <div className="text-6xl mb-4">📡</div>
          <h3 className="text-xl font-semibold mb-2">No Network Topology</h3>
          <p>Create some devices in the Topology view first to start packet simulation</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      {/* Header with controls */}
      <div className="flex-shrink-0 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Packet Simulation</h2>
          
          {/* Main simulation controls */}
          <div className="flex items-center space-x-2">
            {!simulationRunning ? (
              <button
                onClick={() => startSimulation()}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-md font-medium transition-colors"
              >
                ▶️ Start
              </button>
            ) : (
              <div className="flex space-x-2">
                <button
                  onClick={pauseSimulation}
                  className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-md font-medium transition-colors"
                >
                  ⏸️ Pause
                </button>
                <button
                  onClick={stopSimulation}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-md font-medium transition-colors"
                >
                  ⏹️ Stop
                </button>
              </div>
            )}
            
            {/* Auto-run toggle and Step */}
            <div className="flex items-center space-x-2 ml-4">
              <label className="flex items-center space-x-1 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={useAppStore.getState().autoRun}
                  onChange={(e) => useAppStore.getState().setAutoRun(e.target.checked)}
                />
                <span>Auto-run</span>
              </label>
              <button
                onClick={() => useAppStore.getState().stepSimulation()}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-md text-sm"
                disabled={!simulationRunning || useAppStore.getState().autoRun}
                title={!simulationRunning ? 'Start the simulation to step' : (useAppStore.getState().autoRun ? 'Disable auto-run to step' : 'Step one tick')}
              >
                ⏭️ Step
              </button>
            </div>
            
            {/* Speed control */}
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-300">Speed:</span>
              <input
                type="range"
                min="0.1"
                max="5"
                step="0.1"
                value={simulationSpeed}
                onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
                className="w-20"
              />
              <span className="text-sm text-gray-300 w-8">{simulationSpeed.toFixed(1)}x</span>
            </div>
            
            {/* Animation controls */}
            <div className="flex items-center space-x-3">
              <label className="flex items-center space-x-1 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={animationEnabled}
                  onChange={handleAnimationToggle}
                  className="rounded"
                />
                <span>Animate</span>
              </label>
              <label className="flex items-center space-x-1 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={packetTrailsEnabled}
                  onChange={handlePacketTrailsToggle}
                  className="rounded"
                  disabled={!animationEnabled}
                />
                <span>Trails</span>
              </label>
            </div>
          </div>
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowPacketForm(true)}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-md text-sm font-medium transition-colors"
          >
            🛰️ Send Ping
          </button>
          
          <button
            onClick={() => setShowTrafficFlowForm(true)}
            className="px-3 py-2 bg-purple-600 hover:bg-purple-700 rounded-md text-sm font-medium transition-colors"
          >
            🌊 Create Traffic Flow
          </button>
          
          <button
            onClick={() => setShowScenarioSelector(true)}
            className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-md text-sm font-medium transition-colors"
          >
            🎯 Load Scenario
          </button>
          
          {activeTrafficFlows.length > 0 && (
            <button
              onClick={clearTrafficFlows}
              className="px-3 py-2 bg-gray-600 hover:bg-gray-700 rounded-md text-sm font-medium transition-colors"
            >
              🗑️ Clear Flows ({activeTrafficFlows.length})
            </button>
          )}
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex">
        {/* Left panel - Simulation status and controls */}
        <div className="w-80 border-r border-gray-700 p-4 overflow-y-auto">
          {/* Statistics */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">Statistics</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Total Packets:</span>
                <span className="text-blue-400">{simulationStats.totalPackets}</span>
              </div>
              <div className="flex justify-between">
                <span>Delivered:</span>
                <span className="text-green-400">{simulationStats.deliveredPackets}</span>
              </div>
              <div className="flex justify-between">
                <span>Dropped:</span>
                <span className="text-red-400">{simulationStats.droppedPackets}</span>
              </div>
              <div className="flex justify-between">
                <span>Avg Latency:</span>
                <span className="text-yellow-400">{simulationStats.averageLatency.toFixed(2)}ms</span>
              </div>
              <div className="flex justify-between">
                <span>Throughput:</span>
                <span className="text-purple-400">{(simulationStats.throughput / 1000).toFixed(1)} Kbps</span>
              </div>
            </div>
          </div>

          {/* Active Traffic Flows */}
          {activeTrafficFlows.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">Active Traffic Flows</h3>
              <div className="space-y-2">
                {activeTrafficFlows.map((flow) => (
                  <div key={flow.id} className="bg-gray-800 p-3 rounded-md text-sm">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium">
                        {devices.find(d => d.id === flow.sourceDevice)?.name} → {devices.find(d => d.id === flow.targetDevice)?.name}
                      </span>
                      <button
                        onClick={() => removeTrafficFlow(flow.id)}
                        className="text-red-400 hover:text-red-300 text-xs"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="text-gray-400">
                      {flow.protocol} • {flow.packetsPerSecond} pps
                      {flow.vlanId && ` • VLAN ${flow.vlanId}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Current packets */}
          {currentSimulation && currentSimulation.packets.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Active Packets</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {currentSimulation.packets.slice(0, 20).map((packet) => (
                  <div key={packet.id} className="bg-gray-800 p-3 rounded-md text-sm">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium">{packet.protocol}</span>
                      <span className={`text-xs ${getStatusColor(packet.status)}`}>
                        {packet.status.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-gray-400 text-xs">
                      {devices.find(d => d.id === packet.sourceDevice)?.name} → {devices.find(d => d.id === packet.targetDevice)?.name}
                      {packet.vlanTag && ` • VLAN ${packet.vlanTag}`}
                    </div>
                    {packet.drops && packet.drops.length > 0 && (
                      <div className="text-red-400 text-xs mt-1">
                        Dropped: {getDropReasonText(packet.drops[0].reason)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right panel - Network visualization (placeholder) */}
        <div className="flex-1 p-4">
          <div className="h-full bg-gray-800 rounded-lg flex items-center justify-center">
            <div className="text-center text-gray-400">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-lg font-semibold mb-2">Network Visualization</h3>
              <p className="text-sm">Packet animation will be displayed here</p>
              {simulationRunning && (
                <div className="mt-4 text-green-400">
                  <div className="animate-pulse">Simulation Running...</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Packet Creation Modal */}
      {showPacketForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg w-96">
            <h3 className="text-lg font-bold mb-4">Send Ping</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Source Device</label>
                <select
                  value={packetForm.sourceDevice}
                  onChange={(e) => setPacketForm({ ...packetForm, sourceDevice: e.target.value })}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md"
                >
                  <option value="">Select source device</option>
                  {devices.filter(d => d.type !== DeviceType.SWITCH).map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.name} ({device.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Target Device</label>
                <select
                  value={packetForm.targetDevice}
                  onChange={(e) => setPacketForm({ ...packetForm, targetDevice: e.target.value })}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md"
                >
                  <option value="">Select target device</option>
                  {devices.filter(d => d.type !== DeviceType.SWITCH && d.id !== packetForm.sourceDevice).map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.name} ({device.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Protocol</label>
                <input
                  value="ICMP (Ping)"
                  readOnly
                  className="w-full p-2 bg-gray-800 border border-gray-700 rounded-md text-gray-400"
                />
              </div>

              {vlans.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-1">VLAN Tag (Optional)</label>
                  <select
                    value={packetForm.vlanTag || ''}
                    onChange={(e) => setPacketForm({ ...packetForm, vlanTag: e.target.value ? parseInt(e.target.value) : undefined })}
                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md"
                  >
                    <option value="">No VLAN Tag</option>
                    {vlans.map((vlan) => (
                      <option key={vlan.id} value={vlan.id}>
                        VLAN {vlan.id} - {vlan.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowPacketForm(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSendTestPacket}
                disabled={!packetForm.sourceDevice || !packetForm.targetDevice}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-md font-medium transition-colors"
              >
                Send Ping
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Traffic Flow Creation Modal */}
      {showTrafficFlowForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg w-96">
            <h3 className="text-lg font-bold mb-4">Create Traffic Flow</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Source Device</label>
                <select
                  value={trafficFlowForm.sourceDevice}
                  onChange={(e) => setTrafficFlowForm({ ...trafficFlowForm, sourceDevice: e.target.value })}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md"
                >
                  <option value="">Select source device</option>
                  {devices.map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.name} ({device.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Target Device</label>
                <select
                  value={trafficFlowForm.targetDevice}
                  onChange={(e) => setTrafficFlowForm({ ...trafficFlowForm, targetDevice: e.target.value })}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md"
                >
                  <option value="">Select target device</option>
                  {devices.filter(d => d.id !== trafficFlowForm.sourceDevice).map((device) => (
                    <option key={device.id} value={device.id}>
                      {device.name} ({device.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Protocol</label>
                <select
                  value={trafficFlowForm.protocol}
                  onChange={(e) => setTrafficFlowForm({ ...trafficFlowForm, protocol: e.target.value as NetworkProtocol })}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md"
                >
                  <option value={NetworkProtocol.TCP}>TCP</option>
                  <option value={NetworkProtocol.UDP}>UDP</option>
                  <option value={NetworkProtocol.ICMP}>ICMP</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Packets per Second</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={trafficFlowForm.packetsPerSecond}
                  onChange={(e) => setTrafficFlowForm({ ...trafficFlowForm, packetsPerSecond: parseInt(e.target.value) })}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Duration (seconds)</label>
                <input
                  type="number"
                  min="5"
                  max="300"
                  value={trafficFlowForm.duration}
                  onChange={(e) => setTrafficFlowForm({ ...trafficFlowForm, duration: parseInt(e.target.value) })}
                  className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md"
                />
              </div>

              {vlans.length > 0 && (
                <div>
                  <label className="block text-sm font-medium mb-1">VLAN (Optional)</label>
                  <select
                    value={trafficFlowForm.vlanId || ''}
                    onChange={(e) => setTrafficFlowForm({ ...trafficFlowForm, vlanId: e.target.value ? parseInt(e.target.value) : undefined })}
                    className="w-full p-2 bg-gray-700 border border-gray-600 rounded-md"
                  >
                    <option value="">No VLAN</option>
                    {vlans.map((vlan) => (
                      <option key={vlan.id} value={vlan.id}>
                        VLAN {vlan.id} - {vlan.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowTrafficFlowForm(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTrafficFlow}
                disabled={!trafficFlowForm.sourceDevice || !trafficFlowForm.targetDevice}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-md font-medium transition-colors"
              >
                Create Flow
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scenario Selector Modal */}
      {showScenarioSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg w-96">
            <h3 className="text-lg font-bold mb-4">Select Simulation Scenario</h3>
            
            <div className="space-y-3">
              {getRecommendedScenarios(devices, vlans).map((rec, index) => (
                <div key={index} className={`p-3 rounded-md border ${rec.applicable ? 'border-gray-600 hover:border-blue-500 cursor-pointer' : 'border-gray-700 opacity-50'}`}
                     onClick={() => {
                       if (rec.applicable) {
                         handleLoadScenario(rec.scenario);
                         setShowScenarioSelector(false);
                       }
                     }}>
                  <div className="font-medium">{rec.scenario.charAt(0).toUpperCase() + rec.scenario.slice(1)} Test</div>
                  <div className="text-sm text-gray-400">{rec.description}</div>
                  {!rec.applicable && (
                    <div className="text-xs text-red-400 mt-1">Requires different network topology</div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowScenarioSelector(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function handleLoadScenario(scenarioType: string) {
    let scenario;
    
    switch (scenarioType) {
      case 'ping':
        if (devices.length >= 2) {
          const endDevices = devices.filter(d => d.type !== DeviceType.SWITCH);
          scenario = scenarioGenerators.ping(endDevices[0], endDevices[1]);
        }
        break;
      case 'vlanIsolation':
        scenario = scenarioGenerators.vlanIsolation(devices, vlans);
        break;
      case 'broadcastStorm':
        scenario = scenarioGenerators.broadcastStorm(devices);
        break;
      case 'multiProtocol':
        scenario = scenarioGenerators.multiProtocol(devices);
        break;
      case 'stressTest':
        scenario = scenarioGenerators.stressTest(devices);
        break;
      case 'latencyTest':
        if (devices.length >= 2) {
          const endDevices = devices.filter(d => d.type !== DeviceType.SWITCH);
          scenario = scenarioGenerators.latencyTest(endDevices[0], endDevices[1]);
        }
        break;
      case 'trunkTest':
        scenario = scenarioGenerators.trunkTest(devices, vlans);
        break;
    }
    
    if (scenario) {
      // Clear existing flows
      clearTrafficFlows();
      
      // Add scenario flows
      scenario.trafficFlows.forEach(flow => {
        addTrafficFlow(flow);
      });
    }
  }
};

export default PacketSimulationPanel;