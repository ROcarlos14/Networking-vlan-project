/**
 * Base interface for all network devices
 */
export interface BaseDevice {
  id: string;
  name: string; // hostname
  type: DeviceType;
  position: Position;
  status: DeviceStatus;
  description?: string;
  password?: string; // optional device password for config GUI
}

/**
 * Position coordinates for device placement on canvas
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * Device types supported in the network simulator
 */
export enum DeviceType {
  SWITCH = 'switch',
  ROUTER = 'router',
  PC = 'pc',
  SERVER = 'server',
}

/**
 * Device operational status
 */
export enum DeviceStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error',
}

/**
 * Network interface/port configuration
 */
export interface NetworkInterface {
  id: string;
  name: string;
  type: InterfaceType;
  status: InterfaceStatus;
  vlanConfig?: VlanInterfaceConfig;
  ipAddress?: string;
  macAddress: string;
  speed: number; // in Mbps
  duplex: 'full' | 'half';
}

/**
 * Interface/port types
 */
export enum InterfaceType {
  ACCESS = 'access',
  TRUNK = 'trunk',
  ETHERNET = 'ethernet',
}

/**
 * Interface status
 */
export enum InterfaceStatus {
  UP = 'up',
  DOWN = 'down',
  ADMIN_DOWN = 'admin_down',
}

/**
 * VLAN configuration for network interfaces
 */
export interface VlanInterfaceConfig {
  accessVlan?: number;
  allowedVlans?: number[];
  nativeVlan?: number;
}

/**
 * Switch device with layer 2 capabilities
 */
export interface SwitchDevice extends BaseDevice {
  type: DeviceType.SWITCH;
  interfaces: NetworkInterface[];
  macAddressTable: MacAddressEntry[];
  vlanDatabase: VlanEntry[];
  spanningTreeEnabled: boolean;
}

/**
 * Router device with layer 3 capabilities
 */
export interface RouterDevice extends BaseDevice {
  type: DeviceType.ROUTER;
  interfaces: NetworkInterface[];
  routingTable: RouteEntry[];
  ospfEnabled?: boolean;
  bgpEnabled?: boolean;
}

/**
 * PC/Workstation device
 */
export interface PcDevice extends BaseDevice {
  type: DeviceType.PC;
  interface: NetworkInterface;
  defaultGateway?: string;
  dnsServers?: string[];
}

/**
 * Server device (similar to PC but with additional server capabilities)
 */
export interface ServerDevice extends BaseDevice {
  type: DeviceType.SERVER;
  interfaces: NetworkInterface[];
  services: string[];
  defaultGateway?: string;
  dnsServers?: string[];
}

/**
 * Union type for all device types
 */
export type NetworkDevice = SwitchDevice | RouterDevice | PcDevice | ServerDevice;

/**
 * MAC address table entry for switches
 */
export interface MacAddressEntry {
  macAddress: string;
  vlanId: number;
  interface: string;
  type: 'dynamic' | 'static';
  age: number; // in seconds
}

/**
 * VLAN database entry
 */
export interface VlanEntry {
  id: number;
  name: string;
  status: 'active' | 'suspended';
}

/**
 * Routing table entry for routers
 */
export interface RouteEntry {
  network: string;
  mask: string;
  nextHop: string;
  interface: string;
  metric: number;
  protocol: 'connected' | 'static' | 'ospf' | 'bgp';
}

/**
 * Device creation template for UI
 */
export interface DeviceTemplate {
  type: DeviceType;
  name: string;
  icon: string;
  defaultConfig: Partial<NetworkDevice>;
}