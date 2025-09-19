import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { NetworkDevice, Connection, Vlan, AppState, ViewType, SimulationScenario } from '../types';

// Main application store interface
interface AppStore extends AppState {
  // Device management
  devices: NetworkDevice[];
  addDevice: (device: NetworkDevice) => void;
  updateDevice: (deviceId: string, updates: Partial<NetworkDevice>) => void;
  removeDevice: (deviceId: string) => void;
  selectDevice: (deviceId: string | undefined) => void;

  // Connection management
  connections: Connection[];
  addConnection: (connection: Connection) => void;
  updateConnection: (connectionId: string, updates: Partial<Connection>) => void;
  removeConnection: (connectionId: string) => void;

  // VLAN management
  vlans: Vlan[];
  addVlan: (vlan: Vlan) => void;
  updateVlan: (vlanId: number, updates: Partial<Vlan>) => void;
  removeVlan: (vlanId: number) => void;
  selectVlan: (vlanId: number | undefined) => void;
  toggleVlanHighlight: () => void;

  // View management
  setCurrentView: (view: ViewType) => void;
  
  // Simulation management
  currentScenario?: SimulationScenario;
  setCurrentScenario: (scenario: SimulationScenario | undefined) => void;
  startSimulation: () => void;
  stopSimulation: () => void;

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

        devices: [],
        connections: [],
        vlans: [],

        // Device actions
        addDevice: (device) =>
          set((state) => ({
            devices: [...state.devices, device],
          }), false, 'addDevice'),

        updateDevice: (deviceId, updates) =>
          set((state) => ({
            devices: state.devices.map((device) =>
              device.id === deviceId ? { ...device, ...updates } : device
            ),
          }), false, 'updateDevice'),

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

        // Simulation actions
        setCurrentScenario: (scenario) =>
          set(() => ({
            currentScenario: scenario,
          }), false, 'setCurrentScenario'),

        startSimulation: () =>
          set(() => ({
            simulationRunning: true,
          }), false, 'startSimulation'),

        stopSimulation: () =>
          set(() => ({
            simulationRunning: false,
          }), false, 'stopSimulation'),

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
          set(() => ({
            devices,
            connections,
            vlans,
            selectedDevice: undefined,
            selectedVlan: undefined,
          }), false, 'loadTopology'),
      }),
      {
        name: 'vlan-simulator-store',
        partialize: (state) => ({
          devices: state.devices,
          connections: state.connections,
          vlans: state.vlans,
          currentView: state.currentView,
        }),
      }
    ),
    {
      name: 'VLAN Simulator Store',
    }
  )
);