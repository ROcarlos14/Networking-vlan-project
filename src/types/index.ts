// Device-related types
export * from './devices';

// VLAN-related types
export * from './vlan';

// Connection and topology types
export * from './connections';

// Simulation and packet types
export * from './simulation';

// Application state types
export interface AppState {
  isLoading: boolean;
  error?: string;
  currentView: ViewType;
  selectedDevice?: string;
  selectedVlan?: number;
  showVlanHighlight: boolean;
  simulationRunning: boolean;
}

export enum ViewType {
  TOPOLOGY = 'topology',
  VLAN_CONFIG = 'vlan_config',
  PACKET_SIM = 'packet_sim',
  STATISTICS = 'statistics',
}

// UI state types
export interface UIState {
  sidebarOpen: boolean;
  toolbarVisible: boolean;
  modalState: ModalState;
  canvasZoom: number;
  canvasPosition: { x: number; y: number };
}

export interface ModalState {
  isOpen: boolean;
  type?: ModalType;
  data?: any;
}

export enum ModalType {
  DEVICE_CONFIG = 'device_config',
  VLAN_CONFIG = 'vlan_config',
  CONNECTION_CONFIG = 'connection_config',
  SCENARIO_LOAD = 'scenario_load',
  SETTINGS = 'settings',
}

// Configuration types
export interface AppConfig {
  theme: 'light' | 'dark';
  autoSave: boolean;
  simulationSpeed: number;
  maxDevices: number;
  debugMode: boolean;
}