import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { NetworkDevice, Connection, Vlan, AppState, ViewType, SimulationScenario, PacketSimulation, TrafficFlow, SimulationStats, SimulatedPacket, DeviceType, InterfaceStatus } from '../types';
import { SimulationEngine, createSimulationEngine } from '../utils/simulation/simulationEngine';

// Main application store interface
interface AppStore extends AppState {
  // Device management
  devices: NetworkDevice[];
  addDevice: (device: NetworkDevice) => void;
  updateDevice: (deviceId: string, updates: Partial<NetworkDevice>) => void;
  updateDevicesPositions: (positions: { id: string; x: number; y: number }[]) => void;
  removeDevice: (deviceId: string) => void;
  selectDevice: (deviceId: string | undefined) => void;

  // Connection management
  connections: Connection[];
  selectedConnections: string[];
  addConnection: (connection: Connection) => void;
  updateConnection: (connectionId: string, updates: Partial<Connection>) => void;
  removeConnection: (connectionId: string) => void;
  toggleSelectConnection: (connectionId: string) => void;
  clearSelectedConnections: () => void;
  removeSelectedConnections: () => void;

  // VLAN management
  vlans: Vlan[];
  addVlan: (vlan: Vlan) => void;
  updateVlan: (vlanId: number, updates: Partial<Vlan>) => void;
  removeVlan: (vlanId: number) => void;
  selectVlan: (vlanId: number | undefined) => void;
  toggleVlanHighlight: () => void;

  // View management
  setCurrentView: (view: ViewType) => void;
  
  // Tools
  connectionToolActive: boolean;
  setConnectionToolActive: (active: boolean) => void;
  toggleConnectionTool: () => void;
  
  // Visualization toggles
  showPortLabels: boolean;
  togglePortLabels: () => void;
  
  // Simulation management
  currentScenario?: SimulationScenario;
  simulationEngine?: SimulationEngine;
  currentSimulation?: PacketSimulation;
  simulationStats: SimulationStats;
  activeTrafficFlows: TrafficFlow[];
  simulationSpeed: number;
  autoRun: boolean;
  setCurrentScenario: (scenario: SimulationScenario | undefined) => void;
  createSimulationEngine: () => void;
  startSimulation: (trafficFlows?: TrafficFlow[]) => void;
  stopSimulation: () => void;
  pauseSimulation: () => void;
  resumeSimulation: () => void;
  setSimulationSpeed: (speed: number) => void;
  setAutoRun: (enabled: boolean) => void;
  stepSimulation: () => void;
  sendTestPacket: (sourceId: string, targetId: string, vlanTag?: number) => void;
  addTrafficFlow: (flow: TrafficFlow) => void;
  removeTrafficFlow: (flowId: string) => void;
  updateTrafficFlow: (flowId: string, updates: Partial<TrafficFlow>) => void;
  clearTrafficFlows: () => void;

  // Error handling
  setError: (error: string | undefined) => void;
  clearError: () => void;

  // Loading state
  setLoading: (loading: boolean) => void;

  // Bulk operations
  clearTopology: () => void;
  loadTopology: (data: { devices: NetworkDevice[], connections: Connection[], vlans: Vlan[] }) => void;
}

// Create the main store
export const useAppStore = create<AppStore>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        isLoading: false,
        error: undefined,
        currentView: ViewType.TOPOLOGY,
        selectedDevice: undefined,
        selectedVlan: undefined,
        showVlanHighlight: false,
        simulationRunning: false,

        // UI toggles
        showPortLabels: true,

        // Tool state
        connectionToolActive: false,

        devices: [],
        connections: [],
        selectedConnections: [],
        vlans: [],

        // Simulation state
        simulationStats: {
          totalPackets: 0,
          deliveredPackets: 0,
          droppedPackets: 0,
          averageLatency: 0,
          throughput: 0,
          utilizationByDevice: {},
          utilizationByVlan: {},
        },
        activeTrafficFlows: [],
        simulationSpeed: 1.0,
        autoRun: true,

        // Device actions
        addDevice: (device) =>
          set((state) => ({
            devices: [...state.devices, device],
          }), false, 'addDevice'),

        updateDevice: (deviceId, updates) =>
          set((state) => ({
            devices: state.devices.map((device) =>
              device.id === deviceId ? ({ ...device, ...updates } as typeof device) : device
            ),
          }), false, 'updateDevice'),

        updateDevicesPositions: (positions) =>
          set((state) => ({
            devices: state.devices.map((device) => {
              const p = positions.find((pp) => pp.id === device.id);
              return p ? { ...device, position: { x: p.x, y: p.y } } : device;
            }),
          }), false, 'updateDevicesPositions'),

        removeDevice: (deviceId) =>
          set((state) => ({
            devices: state.devices.filter((device) => device.id !== deviceId),
            connections: state.connections.filter(
              (connection) =>
                connection.sourceDevice !== deviceId &&
                connection.targetDevice !== deviceId
            ),
            selectedDevice: state.selectedDevice === deviceId ? undefined : state.selectedDevice,
          }), false, 'removeDevice'),

        selectDevice: (deviceId) =>
          set(() => ({
            selectedDevice: deviceId,
          }), false, 'selectDevice'),

        // Connection actions
        addConnection: (connection) =>
          set((state) => ({
            connections: [...state.connections, connection],
          }), false, 'addConnection'),

        toggleSelectConnection: (connectionId) =>
          set((state) => ({
            selectedConnections: state.selectedConnections.includes(connectionId)
              ? state.selectedConnections.filter((id) => id !== connectionId)
              : [...state.selectedConnections, connectionId],
          }), false, 'toggleSelectConnection'),

        clearSelectedConnections: () =>
          set(() => ({ selectedConnections: [] }), false, 'clearSelectedConnections'),

        removeSelectedConnections: () =>
          set((state) => ({
            connections: state.connections.filter((c) => !state.selectedConnections.includes(c.id)),
            selectedConnections: [],
          }), false, 'removeSelectedConnections'),

        updateConnection: (connectionId, updates) =>
          set((state) => ({
            connections: state.connections.map((connection) =>
              connection.id === connectionId ? { ...connection, ...updates } : connection
            ),
          }), false, 'updateConnection'),

        removeConnection: (connectionId) =>
          set((state) => ({
            connections: state.connections.filter(
              (connection) => connection.id !== connectionId
            ),
          }), false, 'removeConnection'),

        // VLAN actions
        addVlan: (vlan) =>
          set((state) => ({
            vlans: [...state.vlans, vlan],
          }), false, 'addVlan'),

        updateVlan: (vlanId, updates) =>
          set((state) => ({
            vlans: state.vlans.map((vlan) =>
              vlan.id === vlanId ? { ...vlan, ...updates } : vlan
            ),
          }), false, 'updateVlan'),

        removeVlan: (vlanId) =>
          set((state) => ({
            vlans: state.vlans.filter((vlan) => vlan.id !== vlanId),
            selectedVlan: state.selectedVlan === vlanId ? undefined : state.selectedVlan,
          }), false, 'removeVlan'),

        selectVlan: (vlanId) =>
          set(() => ({
            selectedVlan: vlanId,
          }), false, 'selectVlan'),

        toggleVlanHighlight: () =>
          set((state) => ({
            showVlanHighlight: !state.showVlanHighlight,
          }), false, 'toggleVlanHighlight'),

        // View actions
        setCurrentView: (view) =>
          set(() => ({
            currentView: view,
          }), false, 'setCurrentView'),

        // Tool actions
        setConnectionToolActive: (active) =>
          set(() => ({ connectionToolActive: active }), false, 'setConnectionToolActive'),
        toggleConnectionTool: () =>
          set((state) => ({ connectionToolActive: !state.connectionToolActive }), false, 'toggleConnectionTool'),

        // UI toggle actions
        togglePortLabels: () =>
          set((state) => ({ showPortLabels: !state.showPortLabels }), false, 'togglePortLabels'),

        // Simulation actions
        setCurrentScenario: (scenario) =>
          set(() => ({
            currentScenario: scenario,
          }), false, 'setCurrentScenario'),

        createSimulationEngine: () => {
          const state = get();
          const engine = createSimulationEngine(state.devices, state.connections, state.vlans);
          set(() => ({ simulationEngine: engine }), false, 'createSimulationEngine');
        },

        startSimulation: (trafficFlows = []) => {
          const state = get();
          if (!state.simulationEngine) {
            state.createSimulationEngine();
          }
          
          const engine = state.simulationEngine!;
          const simulation = engine.startSimulation([...state.activeTrafficFlows, ...trafficFlows]);
          engine.setAutoRun(get().autoRun);
          
          set(() => ({
            simulationRunning: true,
            currentSimulation: simulation,
          }), false, 'startSimulation');

          // Start periodic stats updates
          const updateStats = () => {
            if (get().simulationRunning && engine) {
              const stats = engine.getSimulationStatistics();
              set(() => ({ simulationStats: stats }), false, 'updateSimulationStats');
              setTimeout(updateStats, 100); // Update every 100ms
            }
          };
          updateStats();
        },

        stopSimulation: () => {
          const state = get();
          if (state.simulationEngine) {
            state.simulationEngine.stopSimulation();
          }
          set(() => ({
            simulationRunning: false,
            currentSimulation: undefined,
          }), false, 'stopSimulation');
        },

        pauseSimulation: () => {
          const state = get();
          if (state.simulationEngine) {
            state.simulationEngine.stopSimulation();
          }
          set(() => ({ simulationRunning: false }), false, 'pauseSimulation');
        },

        resumeSimulation: () => {
          const state = get();
          if (state.simulationEngine && state.currentSimulation) {
            state.simulationEngine.startSimulation(state.activeTrafficFlows);
            state.simulationEngine.setAutoRun(get().autoRun);
            set(() => ({ simulationRunning: true }), false, 'resumeSimulation');
          }
        },

        setSimulationSpeed: (speed) => {
          const state = get();
          if (state.simulationEngine) {
            state.simulationEngine.setSimulationSpeed(speed);
          }
          set(() => ({ simulationSpeed: speed }), false, 'setSimulationSpeed');
        },

        setAutoRun: (enabled) => {
          const state = get();
          if (state.simulationEngine) {
            state.simulationEngine.setAutoRun(enabled);
          }
          set(() => ({ autoRun: enabled }), false, 'setAutoRun');
        },

        stepSimulation: () => {
          const state = get();
          if (!state.simulationEngine) {
            state.createSimulationEngine();
          }
          const engine = state.simulationEngine!;
          engine.setAutoRun(false);
          engine.stepSimulation();
          const stats = engine.getSimulationStatistics();
          set(() => ({ 
            simulationStats: stats,
            currentSimulation: engine.getSimulationState(),
          }), false, 'stepSimulation');
        },

        sendTestPacket: (sourceId, targetId, vlanTag) => {
          const state = get();
          if (!state.simulationEngine) {
            state.createSimulationEngine();
          }
          
          const packet = state.simulationEngine!.createTestPacket(sourceId, targetId, undefined, undefined, vlanTag);
          if (packet) {
            state.simulationEngine!.sendPacket(packet);
            
            // Update current simulation state
            const simulation = state.simulationEngine!.getSimulationState();
            set(() => ({ currentSimulation: simulation }), false, 'sendTestPacket');
          }
        },

        addTrafficFlow: (flow) =>
          set((state) => ({
            activeTrafficFlows: [...state.activeTrafficFlows, flow],
          }), false, 'addTrafficFlow'),

        removeTrafficFlow: (flowId) =>
          set((state) => ({
            activeTrafficFlows: state.activeTrafficFlows.filter(flow => flow.id !== flowId),
          }), false, 'removeTrafficFlow'),

        updateTrafficFlow: (flowId, updates) =>
          set((state) => ({
            activeTrafficFlows: state.activeTrafficFlows.map(flow =>
              flow.id === flowId ? { ...flow, ...updates } : flow
            ),
          }), false, 'updateTrafficFlow'),

        clearTrafficFlows: () =>
          set(() => ({ activeTrafficFlows: [] }), false, 'clearTrafficFlows'),

        // Error handling
        setError: (error) =>
          set(() => ({
            error,
          }), false, 'setError'),

        clearError: () =>
          set(() => ({
            error: undefined,
          }), false, 'clearError'),

        // Loading state
        setLoading: (loading) =>
          set(() => ({
            isLoading: loading,
          }), false, 'setLoading'),

        // Bulk operations
        clearTopology: () =>
          set(() => ({
            devices: [],
            connections: [],
            vlans: [],
            selectedDevice: undefined,
            selectedVlan: undefined,
          }), false, 'clearTopology'),

        loadTopology: ({ devices, connections, vlans }) =>
          set(() => {
            // Auto turn up interfaces that are part of provided connections
            const deviceMap: Record<string, NetworkDevice> = {};
            devices.forEach(d => { deviceMap[d.id] = d; });

            const updatedDevices = devices.map((dev) => {
              // Servers: set all interfaces UP
              if (dev.type === DeviceType.SERVER && (dev as any).interfaces && Array.isArray((dev as any).interfaces)) {
                const devAny = dev as any;
                const newIfaces = devAny.interfaces.map((i: any) => i.status === InterfaceStatus.UP ? i : { ...i, status: InterfaceStatus.UP });
                return { ...dev, interfaces: newIfaces } as NetworkDevice;
              }

              // Switches/Routers: mark connected interfaces UP
              if ((dev as any).interfaces && Array.isArray((dev as any).interfaces)) {
                const devAny = dev as any;
                const newIfaces = devAny.interfaces.map((i: any) => {
                  const used = connections.some(conn =>
                    (conn.sourceDevice === dev.id && conn.sourceInterface === i.id) ||
                    (conn.targetDevice === dev.id && conn.targetInterface === i.id)
                  );
                  if (used && i.status !== InterfaceStatus.UP) {
                    return { ...i, status: InterfaceStatus.UP };
                  }
                  return i;
                });
                return { ...dev, interfaces: newIfaces } as NetworkDevice;
              }

              // PCs: set single interface UP
              if (dev.type === DeviceType.PC && (dev as any).interface) {
                const devAny = dev as any;
                const i = devAny.interface;
                if (i && i.status !== InterfaceStatus.UP) {
                  return { ...dev, interface: { ...i, status: InterfaceStatus.UP } } as NetworkDevice;
                }
                return dev;
              }

              return dev;
            });

            return {
              devices: updatedDevices,
              connections,
              vlans,
              selectedDevice: undefined,
              selectedVlan: undefined,
            };
          }, false, 'loadTopology'),
      }),
      {
        name: 'vlan-simulator-store',
        partialize: (state) => ({
          devices: state.devices,
          connections: state.connections,
          vlans: state.vlans,
          currentView: state.currentView,
          // do not persist selections to avoid confusing restores
        }),
      }
    ),
    {
      name: 'VLAN Simulator Store',
    }
  )
);