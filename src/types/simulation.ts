/**
 * Network packet for simulation
 */
export interface NetworkPacket {
  id: string;
  type: PacketType;
  sourceDevice: string;
  targetDevice: string;
  sourceMac: string;
  targetMac: string;
  sourceIp?: string;
  targetIp?: string;
  vlanTag?: number;
  size: number; // in bytes
  timestamp: Date;
  ttl?: number;
  protocol: NetworkProtocol;
  payload: any;
}

/**
 * Types of network packets
 */
export enum PacketType {
  ETHERNET = 'ethernet',
  ARP = 'arp',
  IP = 'ip',
  ICMP = 'icmp',
  TCP = 'tcp',
  UDP = 'udp',
  BROADCAST = 'broadcast',
  MULTICAST = 'multicast',
}

/**
 * Network protocols
 */
export enum NetworkProtocol {
  ETHERNET = 'ethernet',
  ARP = 'arp',
  IPv4 = 'ipv4',
  IPv6 = 'ipv6',
  ICMP = 'icmp',
  TCP = 'tcp',
  UDP = 'udp',
  HTTP = 'http',
  HTTPS = 'https',
  DNS = 'dns',
  DHCP = 'dhcp',
}

/**
 * Packet simulation state
 */
export interface PacketSimulation {
  id: string;
  packets: SimulatedPacket[];
  isRunning: boolean;
  speed: number; // simulation speed multiplier
  startTime: Date;
  endTime?: Date;
}

/**
 * Simulated packet with routing information
 */
export interface SimulatedPacket extends NetworkPacket {
  currentPosition: {
    deviceId: string;
    interfaceId?: string;
  };
  path: string[]; // device IDs in order
  status: PacketStatus;
  drops?: PacketDrop[];
  delay: number; // accumulated delay in ms
}

/**
 * Packet status during simulation
 */
export enum PacketStatus {
  QUEUED = 'queued',
  IN_TRANSIT = 'in_transit',
  DELIVERED = 'delivered',
  DROPPED = 'dropped',
  TIMEOUT = 'timeout',
  ERROR = 'error',
}

/**
 * Packet drop information
 */
export interface PacketDrop {
  deviceId: string;
  reason: DropReason;
  timestamp: Date;
  interfaceId?: string;
}

/**
 * Reasons for packet drops
 */
export enum DropReason {
  VLAN_MISMATCH = 'vlan_mismatch',
  NO_ROUTE = 'no_route',
  INTERFACE_DOWN = 'interface_down',
  TTL_EXCEEDED = 'ttl_exceeded',
  BUFFER_FULL = 'buffer_full',
  ACCESS_DENIED = 'access_denied',
  LOOP_DETECTED = 'loop_detected',
}

/**
 * Traffic flow between devices
 */
export interface TrafficFlow {
  id: string;
  sourceDevice: string;
  targetDevice: string;
  vlanId?: number;
  protocol: NetworkProtocol;
  packetsPerSecond: number;
  averagePacketSize: number;
  duration: number; // in seconds
  isActive: boolean;
}

/**
 * Network simulation scenario
 */
export interface SimulationScenario {
  id: string;
  name: string;
  description: string;
  topology: string; // topology configuration ID
  trafficFlows: TrafficFlow[];
  duration: number;
  objectives?: string[];
}

/**
 * Simulation statistics
 */
export interface SimulationStats {
  totalPackets: number;
  deliveredPackets: number;
  droppedPackets: number;
  averageLatency: number;
  throughput: number; // bits per second
  utilizationByDevice: {
    [deviceId: string]: number;
  };
  utilizationByVlan: {
    [vlanId: number]: number;
  };
}