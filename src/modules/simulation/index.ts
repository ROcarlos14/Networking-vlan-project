/**
 * Simulation Module - Packet simulation and traffic analysis
 * 
 * Handles network simulation, packet routing, and traffic visualization
 */

// Simulation components
export { default as PacketSimulationPanel } from '../../components/Simulation/PacketSimulationPanel';

// Simulation utilities
export * from '../../utils/simulation/simulationEngine';
export * from '../../utils/simulation/packetAnimation';
export * from '../../utils/simulation/simulationScenarios';

// Routing utilities
export * from '../../utils/routing/routingEngine';

// Packet processing
export * from '../../utils/networking/packetProcessingEngine';

// Simulation types
export type { 
  SimulationScenario,
  PacketSimulation,
  TrafficFlow,
  SimulationStats,
  SimulatedPacket
} from '../../types';