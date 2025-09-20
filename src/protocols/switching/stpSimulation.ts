import { SwitchDevice, Connection, NetworkDevice } from '../../types';

export interface STPPort {
  interfaceId: string;
  portId: number;
  state: STPPortState;
  role: STPPortRole;
  pathCost: number;
  priority: number;
  designatedBridgeId: string;
  designatedPortId: number;
  designatedCost: number;
}

export enum STPPortState {
  DISABLED = 'disabled',
  BLOCKING = 'blocking',
  LISTENING = 'listening',
  LEARNING = 'learning',
  FORWARDING = 'forwarding',
}

export enum STPPortRole {
  ROOT = 'root',
  DESIGNATED = 'designated',
  ALTERNATE = 'alternate',
  BACKUP = 'backup',
  DISABLED = 'disabled',
}

export interface STPBridge {
  bridgeId: string;
  priority: number;
  macAddress: string;
  rootBridgeId: string;
  rootCost: number;
  rootPortId?: number;
  ports: Map<string, STPPort>;
  maxAge: number;
  helloTime: number;
  forwardDelay: number;
}

export interface STPBPDU {
  protocolId: number;
  version: number;
  type: 'config' | 'tcn';
  rootBridgeId: string;
  rootPathCost: number;
  bridgeId: string;
  portId: number;
  messageAge: number;
  maxAge: number;
  helloTime: number;
  forwardDelay: number;
  topologyChangeFlag: boolean;
  topologyChangeAckFlag: boolean;
}

/**
 * Spanning Tree Protocol simulation engine
 */
export class STPSimulation {
  private bridges: Map<string, STPBridge> = new Map();
  private topology: Map<string, string[]> = new Map();
  private isRunning: boolean = false;
  private convergenceTime: number = 0;
  private topologyChangeCount: number = 0;
  private lastConvergenceTime: number = 0;

  constructor() {
    this.reset();
  }

  /**
   * Initialize STP simulation with network topology
   */
  initialize(devices: NetworkDevice[], connections: Connection[]): void {
    this.reset();
    
    // Create STP bridges for switches
    devices.forEach(device => {
      if (device.type === 'switch') {
        const switchDevice = device as SwitchDevice;
        if (switchDevice.spanningTreeEnabled) {
          this.createBridge(switchDevice);
        }
      }
    });

    // Build topology map
    connections.forEach(connection => {
      const sourceId = connection.sourceDevice;
      const targetId = connection.targetDevice;
      
      if (!this.topology.has(sourceId)) {
        this.topology.set(sourceId, []);
      }
      if (!this.topology.has(targetId)) {
        this.topology.set(targetId, []);
      }
      
      this.topology.get(sourceId)!.push(targetId);
      this.topology.get(targetId)!.push(sourceId);
    });
  }

  /**
   * Start STP simulation
   */
  start(): void {
    this.isRunning = true;
    this.runSTPAlgorithm();
  }

  /**
   * Stop STP simulation
   */
  stop(): void {
    this.isRunning = false;
  }

  /**
   * Get STP state for a specific bridge
   */
  getBridgeState(bridgeId: string): STPBridge | undefined {
    return this.bridges.get(bridgeId);
  }

  /**
   * Get all bridge states
   */
  getAllBridgeStates(): Map<string, STPBridge> {
    return new Map(this.bridges);
  }

  /**
   * Get convergence statistics
   */
  getConvergenceStats() {
    return {
      convergenceTime: this.convergenceTime,
      topologyChangeCount: this.topologyChangeCount,
      lastConvergenceTime: this.lastConvergenceTime,
      isConverged: this.isConverged(),
    };
  }

  /**
   * Check if STP has converged
   */
  isConverged(): boolean {
    for (const bridge of this.bridges.values()) {
      for (const port of bridge.ports.values()) {
        if (port.state === STPPortState.LISTENING || port.state === STPPortState.LEARNING) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Simulate topology change (link failure/recovery)
   */
  simulateTopologyChange(sourceDevice: string, targetDevice: string, isLinkUp: boolean): void {
    this.topologyChangeCount++;
    
    if (isLinkUp) {
      // Add link
      if (!this.topology.has(sourceDevice)) {
        this.topology.set(sourceDevice, []);
      }
      if (!this.topology.has(targetDevice)) {
        this.topology.set(targetDevice, []);
      }
      
      this.topology.get(sourceDevice)!.push(targetDevice);
      this.topology.get(targetDevice)!.push(sourceDevice);
    } else {
      // Remove link
      const sourceNeighbors = this.topology.get(sourceDevice) || [];
      const targetNeighbors = this.topology.get(targetDevice) || [];
      
      this.topology.set(sourceDevice, sourceNeighbors.filter(n => n !== targetDevice));
      this.topology.set(targetDevice, targetNeighbors.filter(n => n !== sourceDevice));
    }

    // Trigger reconvergence
    this.runSTPAlgorithm();
  }

  /**
   * Create STP bridge from switch device
   */
  private createBridge(switchDevice: SwitchDevice): void {
    const bridge: STPBridge = {
      bridgeId: switchDevice.id,
      priority: 32768, // Default priority
      macAddress: this.generateBridgeMacAddress(switchDevice.id),
      rootBridgeId: switchDevice.id, // Initially, each bridge thinks it's root
      rootCost: 0,
      ports: new Map(),
      maxAge: 20,
      helloTime: 2,
      forwardDelay: 15,
    };

    // Create STP ports for each interface
    switchDevice.interfaces.forEach((iface, index) => {
      const port: STPPort = {
        interfaceId: iface.id,
        portId: index + 1,
        state: STPPortState.BLOCKING,
        role: STPPortRole.DESIGNATED,
        pathCost: this.calculatePortCost(iface.speed),
        priority: 128,
        designatedBridgeId: switchDevice.id,
        designatedPortId: index + 1,
        designatedCost: 0,
      };
      
      bridge.ports.set(iface.id, port);
    });

    this.bridges.set(switchDevice.id, bridge);
  }

  /**
   * Run the main STP algorithm
   */
  private runSTPAlgorithm(): void {
    const startTime = Date.now();
    
    // Phase 1: Root Bridge Selection
    this.selectRootBridge();
    
    // Phase 2: Root Port Selection
    this.selectRootPorts();
    
    // Phase 3: Designated Port Selection
    this.selectDesignatedPorts();
    
    // Phase 4: Port State Transitions
    this.updatePortStates();
    
    this.convergenceTime = Date.now() - startTime;
    this.lastConvergenceTime = Date.now();
  }

  /**
   * Select the root bridge (lowest bridge ID)
   */
  private selectRootBridge(): void {
    let rootBridgeId = '';
    let lowestPriority = Infinity;
    
    for (const [bridgeId, bridge] of this.bridges) {
      const priority = bridge.priority;
      if (priority < lowestPriority || 
          (priority === lowestPriority && bridgeId < rootBridgeId)) {
        lowestPriority = priority;
        rootBridgeId = bridgeId;
      }
    }

    // Update all bridges with the root bridge information
    for (const bridge of this.bridges.values()) {
      bridge.rootBridgeId = rootBridgeId;
      if (bridge.bridgeId === rootBridgeId) {
        bridge.rootCost = 0;
      }
    }
  }

  /**
   * Select root ports for each bridge
   */
  private selectRootPorts(): void {
    for (const bridge of this.bridges.values()) {
      if (bridge.bridgeId === bridge.rootBridgeId) {
        // Root bridge doesn't have a root port
        continue;
      }

      let bestPortId: string | undefined;
      let bestCost = Infinity;
      
      for (const [portId, port] of bridge.ports) {
        const neighborBridgeId = this.getNeighborBridge(bridge.bridgeId, portId);
        if (!neighborBridgeId) continue;
        
        const neighborBridge = this.bridges.get(neighborBridgeId);
        if (!neighborBridge) continue;
        
        const totalCost = neighborBridge.rootCost + port.pathCost;
        
        if (totalCost < bestCost) {
          bestCost = totalCost;
          bestPortId = portId;
        }
      }

      if (bestPortId) {
        bridge.rootPortId = bridge.ports.get(bestPortId)?.portId;
        bridge.rootCost = bestCost;
        
        // Set port role
        for (const [portId, port] of bridge.ports) {
          if (portId === bestPortId) {
            port.role = STPPortRole.ROOT;
          }
        }
      }
    }
  }

  /**
   * Select designated ports
   */
  private selectDesignatedPorts(): void {
    for (const bridge of this.bridges.values()) {
      for (const [portId, port] of bridge.ports) {
        if (port.role === STPPortRole.ROOT) {
          continue; // Skip root ports
        }

        const neighborBridgeId = this.getNeighborBridge(bridge.bridgeId, portId);
        if (!neighborBridgeId) {
          // No neighbor, this is a designated port
          port.role = STPPortRole.DESIGNATED;
          continue;
        }

        const neighborBridge = this.bridges.get(neighborBridgeId);
        if (!neighborBridge) continue;

        // Compare costs to determine designated port
        if (bridge.rootCost < neighborBridge.rootCost) {
          port.role = STPPortRole.DESIGNATED;
        } else if (bridge.rootCost > neighborBridge.rootCost) {
          port.role = STPPortRole.ALTERNATE;
        } else {
          // Equal cost, use bridge ID as tiebreaker
          if (bridge.bridgeId < neighborBridge.bridgeId) {
            port.role = STPPortRole.DESIGNATED;
          } else {
            port.role = STPPortRole.ALTERNATE;
          }
        }
      }
    }
  }

  /**
   * Update port states based on roles
   */
  private updatePortStates(): void {
    for (const bridge of this.bridges.values()) {
      for (const port of bridge.ports.values()) {
        switch (port.role) {
          case STPPortRole.ROOT:
          case STPPortRole.DESIGNATED:
            port.state = STPPortState.FORWARDING;
            break;
          case STPPortRole.ALTERNATE:
          case STPPortRole.BACKUP:
            port.state = STPPortState.BLOCKING;
            break;
          case STPPortRole.DISABLED:
            port.state = STPPortState.DISABLED;
            break;
        }
      }
    }
  }

  /**
   * Get neighboring bridge for a given port
   */
  private getNeighborBridge(bridgeId: string, portId: string): string | undefined {
    const neighbors = this.topology.get(bridgeId);
    if (!neighbors) return undefined;
    
    // This is simplified - in reality, we'd need to map ports to connections
    return neighbors.find(neighbor => this.bridges.has(neighbor));
  }

  /**
   * Calculate port cost based on speed
   */
  private calculatePortCost(speedMbps: number): number {
    // Standard STP port costs
    if (speedMbps >= 10000) return 2;      // 10 Gbps
    if (speedMbps >= 1000) return 4;       // 1 Gbps
    if (speedMbps >= 100) return 19;       // 100 Mbps
    if (speedMbps >= 10) return 100;       // 10 Mbps
    return 10000;                          // < 10 Mbps
  }

  /**
   * Generate a MAC address for bridge ID
   */
  private generateBridgeMacAddress(bridgeId: string): string {
    // Generate a deterministic MAC address based on bridge ID
    const hash = bridgeId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const mac = [];
    
    for (let i = 0; i < 6; i++) {
      const byte = (hash + i) % 256;
      mac.push(byte.toString(16).padStart(2, '0'));
    }
    
    return mac.join(':');
  }

  /**
   * Reset simulation state
   */
  private reset(): void {
    this.bridges.clear();
    this.topology.clear();
    this.convergenceTime = 0;
    this.topologyChangeCount = 0;
    this.lastConvergenceTime = 0;
    this.isRunning = false;
  }

  /**
   * Get blocked ports (for loop prevention visualization)
   */
  getBlockedPorts(): Array<{ bridgeId: string; portId: string; interfaceId: string }> {
    const blockedPorts = [];
    
    for (const [bridgeId, bridge] of this.bridges) {
      for (const [interfaceId, port] of bridge.ports) {
        if (port.state === STPPortState.BLOCKING) {
          blockedPorts.push({
            bridgeId,
            portId: port.portId.toString(),
            interfaceId,
          });
        }
      }
    }
    
    return blockedPorts;
  }

  /**
   * Get root bridge information
   */
  getRootBridgeInfo(): { bridgeId: string; priority: number; macAddress: string } | null {
    for (const bridge of this.bridges.values()) {
      if (bridge.bridgeId === bridge.rootBridgeId) {
        return {
          bridgeId: bridge.bridgeId,
          priority: bridge.priority,
          macAddress: bridge.macAddress,
        };
      }
    }
    return null;
  }
}

// Global STP simulation instance
export const stpSimulation = new STPSimulation();