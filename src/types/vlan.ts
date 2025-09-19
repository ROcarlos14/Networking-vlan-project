/**
 * VLAN (Virtual Local Area Network) configuration
 */
export interface Vlan {
  id: number;
  name: string;
  description?: string;
  color: string;
  status: VlanStatus;
  type: VlanType;
  createdAt: Date;
  modifiedAt: Date;
}

/**
 * VLAN status enumeration
 */
export enum VlanStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  SHUTDOWN = 'shutdown',
}

/**
 * VLAN type enumeration
 */
export enum VlanType {
  NORMAL = 'normal',
  MANAGEMENT = 'management',
  VOICE = 'voice',
  DATA = 'data',
  NATIVE = 'native',
}

/**
 * VLAN assignment for devices/interfaces
 */
export interface VlanAssignment {
  deviceId: string;
  interfaceId: string;
  vlanId: number;
  assignmentType: VlanAssignmentType;
  isNative?: boolean;
}

/**
 * VLAN assignment type
 */
export enum VlanAssignmentType {
  ACCESS = 'access',
  TRUNK = 'trunk',
}

/**
 * Broadcast domain - represents devices in the same VLAN
 */
export interface BroadcastDomain {
  vlanId: number;
  deviceIds: string[];
  interfaceIds: string[];
}

/**
 * VLAN configuration for the entire network
 */
export interface VlanConfiguration {
  vlans: Vlan[];
  assignments: VlanAssignment[];
  broadcastDomains: BroadcastDomain[];
  defaultVlan: number;
}

/**
 * VLAN traffic statistics
 */
export interface VlanTrafficStats {
  vlanId: number;
  packetsIn: number;
  packetsOut: number;
  bytesIn: number;
  bytesOut: number;
  errors: number;
  lastUpdated: Date;
}