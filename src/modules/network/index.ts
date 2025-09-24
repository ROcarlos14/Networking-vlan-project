/**
 * Network Module - Network protocols and management
 * 
 * Handles STP, routing, ARP, DHCP, and other networking protocols
 */

// Network components
export { default as STPPanel } from '../../components/STP/STPPanel';
export { default as StatisticsPanel } from '../../components/Statistics/StatisticsPanel';

// Networking utilities
export * from '../../utils/networking/spanningTreeProtocol';
export * from '../../utils/networking/arpEngine';
export * from '../../utils/networking/ipAddressManager';
export * from '../../utils/networking/advancedNetworkingManager';
export * from '../../utils/networking/linkHealth';
export * from '../../utils/networking/troubleshootingTools';

// Protocol specific utilities - re-export with specific names to avoid conflicts
export { STPSimulation } from '../../protocols/switching/stpSimulation';
export type { STPBridge, STPPort } from '../../protocols/switching/stpSimulation';

// Network types
export type {
  SpanningTreeInfo,
  SpanningTreePortState,
  NetworkTopology,
  NetworkPath,
  PathHop
} from '../../types';