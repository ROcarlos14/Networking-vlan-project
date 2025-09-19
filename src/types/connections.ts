/**
 * Network connection between two devices
 */
export interface Connection {
  id: string;
  name?: string;
  sourceDevice: string;
  sourceInterface: string;
  targetDevice: string;
  targetInterface: string;
  connectionType: ConnectionType;
  status: ConnectionStatus;
  bandwidth: number; // in Mbps
  latency?: number; // in ms
  packetLoss?: number; // percentage
}

/**
 * Types of network connections
 */
export enum ConnectionType {
  ETHERNET = 'ethernet',
  FIBER = 'fiber',
  WIRELESS = 'wireless',
  SERIAL = 'serial',
}

/**
 * Connection status
 */
export enum ConnectionStatus {
  UP = 'up',
  DOWN = 'down',
  DEGRADED = 'degraded',
}

/**
 * Network topology representation
 */
export interface NetworkTopology {
  devices: string[]; // device IDs
  connections: Connection[];
  subnets: SubnetInfo[];
}

/**
 * Subnet information
 */
export interface SubnetInfo {
  id: string;
  network: string;
  mask: string;
  vlanId?: number;
  gateway?: string;
  dhcpEnabled?: boolean;
  dhcpRange?: {
    start: string;
    end: string;
  };
}

/**
 * Path between two devices (used for packet routing)
 */
export interface NetworkPath {
  sourceDevice: string;
  targetDevice: string;
  hops: PathHop[];
  totalLatency: number;
  isValid: boolean;
  vlanIds: number[];
}

/**
 * Individual hop in a network path
 */
export interface PathHop {
  deviceId: string;
  inInterface: string;
  outInterface: string;
  vlanId?: number;
}

/**
 * Link aggregation group (LAG) for multiple connections
 */
export interface LinkAggregationGroup {
  id: string;
  name: string;
  memberConnections: string[];
  protocol: 'LACP' | 'PAgP' | 'Static';
  mode: 'active' | 'passive';
}

/**
 * Spanning tree protocol information
 */
export interface SpanningTreeInfo {
  rootBridge: string;
  rootPriority: number;
  rootCost: number;
  portStates: {
    [interfaceId: string]: SpanningTreePortState;
  };
}

/**
 * Spanning tree port states
 */
export enum SpanningTreePortState {
  DISABLED = 'disabled',
  BLOCKING = 'blocking',
  LISTENING = 'listening',
  LEARNING = 'learning',
  FORWARDING = 'forwarding',
}

/**
 * Cable properties for visualization
 */
export interface CableProperties {
  color: string;
  style: 'solid' | 'dashed' | 'dotted';
  width: number;
  animated?: boolean;
}