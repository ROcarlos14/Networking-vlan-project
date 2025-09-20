import {
  NetworkDevice,
  SwitchDevice,
  DeviceType,
  NetworkInterface,
  Connection,
  SpanningTreePortState,
} from '../../types';

/**
 * BPDU (Bridge Protocol Data Unit) types
 */
export enum BPDUType {
  CONFIG = 'config',
  TCN = 'tcn', // Topology Change Notification
}

/**
 * BPDU message structure
 */
export interface BPDU {
  type: BPDUType;
  rootId: string;
  rootPathCost: number;
  bridgeId: string;
  portId: string;
  messageAge: number;
  maxAge: number;
  helloTime: number;
  forwardDelay: number;
  topologyChange: boolean;
  topologyChangeAck: boolean;
  timestamp: Date;
}

/**
 * STP Port information
 */
export interface STPPortInfo {
  portId: string;
  interfaceId: string;
  state: SpanningTreePortState;
  role: STPPortRole;
  designatedBridge: string;
  designatedPort: string;
  designatedRoot: string;
  designatedCost: number;
  pathCost: number;
  priority: number;
  lastBPDU?: BPDU;
  timers: {
    messageAge: number;
    forwardDelay: number;
    blockingTimer: number;
    listeningTimer: number;
    learningTimer: number;
  };
}

/**
 * STP Port roles
 */
export enum STPPortRole {
  ROOT = 'root',
  DESIGNATED = 'designated',
  BLOCKED = 'blocked',
  DISABLED = 'disabled',
}

/**
 * STP Bridge information
 */
export interface STPBridgeInfo {
  bridgeId: string;
  priority: number;
  macAddress: string;
  rootBridge: string;
  rootPathCost: number;
  rootPort?: string;
  ports: Map<string, STPPortInfo>;
  timers: {
    helloTime: number;
    maxAge: number;
    forwardDelay: number;
    lastHello: number;
  };
  isRoot: boolean;
  topologyChangeDetected: boolean;
}

/**
 * STP Configuration
 */
export interface STPConfig {
  bridgePriority: number;
  portPriorities: Map<string, number>;
  pathCosts: Map<string, number>;
  helloTime: number;
  maxAge: number;
  forwardDelay: number;
  enabled: boolean;
}

/**
 * Spanning Tree Protocol Manager
 */
export class SpanningTreeProtocol {
  private bridges: Map<string, STPBridgeInfo> = new Map();
  private topology: Map<string, string[]> = new Map(); // bridge -> connected bridges
  private bpduQueue: BPDU[] = [];
  private isRunning: boolean = false;
  private config: STPConfig;
  private intervalId?: number;

  constructor(config?: Partial<STPConfig>) {
    this.config = {
      bridgePriority: 32768,
      portPriorities: new Map(),
      pathCosts: new Map(),
      helloTime: 2000, // 2 seconds
      maxAge: 20000, // 20 seconds
      forwardDelay: 15000, // 15 seconds
      enabled: true,
      ...config,
    };
  }

  /**
   * Initialize STP for all switches
   */
  initializeSTP(switches: SwitchDevice[], connections: Connection[]): void {
    if (!this.config.enabled) return;

    // Build topology map
    this.buildTopology(switches, connections);

    // Initialize bridge information for each switch
    switches.forEach(sw => {
      if (sw.spanningTreeEnabled) {
        this.initializeBridge(sw, connections);
      }
    });

    // Start STP process
    this.startSTP();
  }

  /**
   * Start STP processing
   */
  startSTP(): void {
    if (this.isRunning) return;

    this.isRunning = true;

    // Initial root bridge election
    this.electRootBridge();

    // Configure port roles and states
    this.configurePortRoles();

    // Start periodic BPDU transmission
    this.intervalId = setInterval(() => {
      this.processSTPTick();
    }, this.config.helloTime) as any;

    console.log('STP: Protocol started');
  }

  /**
   * Stop STP processing
   */
  stopSTP(): void {
    if (!this.isRunning) return;

    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    console.log('STP: Protocol stopped');
  }

  /**
   * Process one STP tick
   */
  processSTPTick(): void {
    // Send hello BPDUs from root ports and designated ports
    this.sendHelloBPDUs();

    // Process received BPDUs
    this.processBPDUQueue();

    // Update port states based on timers
    this.updatePortStates();

    // Detect topology changes
    this.detectTopologyChanges();

    // Age out old BPDU information
    this.ageBPDUs();
  }

  /**
   * Receive BPDU on port
   */
  receiveBPDU(bridgeId: string, portId: string, bpdu: BPDU): void {
    const bridge = this.bridges.get(bridgeId);
    const port = bridge?.ports.get(portId);

    if (!bridge || !port) return;

    // Store BPDU and process it
    bpdu.timestamp = new Date();
    this.bpduQueue.push(bpdu);
    port.lastBPDU = bpdu;
    port.timers.messageAge = 0; // Reset message age timer

    console.log(`STP: Bridge ${bridgeId} port ${portId} received BPDU from ${bpdu.bridgeId}`);
  }

  /**
   * Get STP information for bridge
   */
  getBridgeInfo(bridgeId: string): STPBridgeInfo | undefined {
    return this.bridges.get(bridgeId);
  }

  /**
   * Get STP port information
   */
  getPortInfo(bridgeId: string, portId: string): STPPortInfo | undefined {
    return this.bridges.get(bridgeId)?.ports.get(portId);
  }

  /**
   * Update STP configuration
   */
  updateConfig(bridgeId: string, updates: Partial<STPConfig>): void {
    Object.assign(this.config, updates);
    
    const bridge = this.bridges.get(bridgeId);
    if (bridge) {
      // Recalculate STP if priority changed
      if (updates.bridgePriority !== undefined) {
        bridge.priority = updates.bridgePriority;
        this.electRootBridge();
        this.configurePortRoles();
      }
    }
  }

  /**
   * Force topology change
   */
  triggerTopologyChange(bridgeId: string): void {
    const bridge = this.bridges.get(bridgeId);
    if (!bridge) return;

    bridge.topologyChangeDetected = true;
    
    // Send topology change BPDUs
    bridge.ports.forEach(port => {
      if (port.role === STPPortRole.ROOT || port.role === STPPortRole.DESIGNATED) {
        this.sendTopologyChangeBPDU(bridgeId, port.portId);
      }
    });

    console.log(`STP: Topology change triggered on bridge ${bridgeId}`);
  }

  /**
   * Get STP statistics
   */
  getStatistics(): {
    totalBridges: number;
    rootBridge: string | null;
    totalPorts: number;
    blockedPorts: number;
    forwardingPorts: number;
  } {
    let totalPorts = 0;
    let blockedPorts = 0;
    let forwardingPorts = 0;
    let rootBridge: string | null = null;

    this.bridges.forEach((bridge) => {
      if (bridge.isRoot) {
        rootBridge = bridge.bridgeId;
      }

      bridge.ports.forEach(port => {
        totalPorts++;
        if (port.state === SpanningTreePortState.BLOCKING) {
          blockedPorts++;
        } else if (port.state === SpanningTreePortState.FORWARDING) {
          forwardingPorts++;
        }
      });
    });

    return {
      totalBridges: this.bridges.size,
      rootBridge,
      totalPorts,
      blockedPorts,
      forwardingPorts,
    };
  }

  /**
   * Build network topology from connections
   */
  private buildTopology(switches: SwitchDevice[], connections: Connection[]): void {
    this.topology.clear();

    switches.forEach(sw => {
      this.topology.set(sw.id, []);
    });

    connections.forEach(conn => {
      const source = conn.sourceDevice;
      const target = conn.targetDevice;

      // Only consider switch-to-switch connections
      if (this.topology.has(source) && this.topology.has(target)) {
        this.topology.get(source)!.push(target);
        this.topology.get(target)!.push(source);
      }
    });
  }

  /**
   * Initialize bridge information
   */
  private initializeBridge(sw: SwitchDevice, connections: Connection[]): void {
    const bridgeId = this.generateBridgeId(sw);
    
    const bridgeInfo: STPBridgeInfo = {
      bridgeId,
      priority: this.config.bridgePriority,
      macAddress: sw.interfaces[0]?.macAddress || '00:00:00:00:00:00',
      rootBridge: bridgeId, // Initially, each bridge thinks it's the root
      rootPathCost: 0,
      ports: new Map(),
      timers: {
        helloTime: this.config.helloTime,
        maxAge: this.config.maxAge,
        forwardDelay: this.config.forwardDelay,
        lastHello: 0,
      },
      isRoot: true, // Initially assume this bridge is root
      topologyChangeDetected: false,
    };

    // Initialize port information
    sw.interfaces.forEach(iface => {
      const connectedConnections = connections.filter(
        c => c.sourceInterface === iface.id || c.targetInterface === iface.id
      );

      if (connectedConnections.length > 0) {
        const portInfo: STPPortInfo = {
          portId: iface.id,
          interfaceId: iface.id,
          state: SpanningTreePortState.BLOCKING,
          role: STPPortRole.DESIGNATED,
          designatedBridge: bridgeId,
          designatedPort: iface.id,
          designatedRoot: bridgeId,
          designatedCost: 0,
          pathCost: this.calculatePathCost(iface),
          priority: this.config.portPriorities.get(iface.id) || 128,
          timers: {
            messageAge: 0,
            forwardDelay: 0,
            blockingTimer: 0,
            listeningTimer: 0,
            learningTimer: 0,
          },
        };

        bridgeInfo.ports.set(iface.id, portInfo);
      }
    });

    this.bridges.set(sw.id, bridgeInfo);
  }

  /**
   * Elect root bridge
   */
  private electRootBridge(): void {
    let rootBridge: STPBridgeInfo | null = null;
    let lowestPriority = Infinity;
    let lowestMac = 'ff:ff:ff:ff:ff:ff';

    // Find bridge with lowest priority (and lowest MAC as tiebreaker)
    this.bridges.forEach(bridge => {
      const isLower = bridge.priority < lowestPriority || 
                     (bridge.priority === lowestPriority && bridge.macAddress < lowestMac);
      
      if (isLower) {
        rootBridge = bridge;
        lowestPriority = bridge.priority;
        lowestMac = bridge.macAddress;
      }
    });

    if (!rootBridge) return;

    // Update all bridges with root information
    this.bridges.forEach(bridge => {
      bridge.isRoot = bridge.bridgeId === rootBridge!.bridgeId;
      bridge.rootBridge = rootBridge!.bridgeId;
      
      if (bridge.isRoot) {
        bridge.rootPathCost = 0;
        bridge.rootPort = undefined;
      }
    });

    console.log(`STP: Root bridge elected: ${rootBridge.bridgeId}`);
  }

  /**
   * Configure port roles
   */
  private configurePortRoles(): void {
    this.bridges.forEach(bridge => {
      if (bridge.isRoot) {
        // All ports on root bridge are designated
        bridge.ports.forEach(port => {
          port.role = STPPortRole.DESIGNATED;
          port.designatedBridge = bridge.bridgeId;
          port.designatedRoot = bridge.bridgeId;
          port.designatedCost = 0;
        });
      } else {
        this.configureNonRootPortRoles(bridge);
      }
    });
  }

  /**
   * Configure port roles for non-root bridges
   */
  private configureNonRootPortRoles(bridge: STPBridgeInfo): void {
    let bestRootPort: STPPortInfo | null = null;
    let lowestCost = Infinity;

    // Find the best path to root (root port)
    bridge.ports.forEach(port => {
      // Calculate path cost to root through this port
      const pathCost = this.calculatePathCostToRoot(bridge.bridgeId, port.portId);
      
      if (pathCost < lowestCost) {
        lowestCost = pathCost;
        bestRootPort = port;
      }
    });

    // Configure root port
    if (bestRootPort) {
      bestRootPort.role = STPPortRole.ROOT;
      bridge.rootPort = bestRootPort.portId;
      bridge.rootPathCost = lowestCost;
    }

    // Configure other ports as designated or blocked
    bridge.ports.forEach(port => {
      if (port === bestRootPort) return; // Skip root port

      if (this.shouldPortBeDesignated(bridge, port)) {
        port.role = STPPortRole.DESIGNATED;
      } else {
        port.role = STPPortRole.BLOCKED;
      }
    });
  }

  /**
   * Send hello BPDUs
   */
  private sendHelloBPDUs(): void {
    this.bridges.forEach(bridge => {
      const now = Date.now();
      
      if (now - bridge.timers.lastHello >= bridge.timers.helloTime) {
        bridge.ports.forEach(port => {
          if (port.role === STPPortRole.ROOT || port.role === STPPortRole.DESIGNATED) {
            this.sendConfigBPDU(bridge, port);
          }
        });
        
        bridge.timers.lastHello = now;
      }
    });
  }

  /**
   * Send configuration BPDU
   */
  private sendConfigBPDU(bridge: STPBridgeInfo, port: STPPortInfo): void {
    const bpdu: BPDU = {
      type: BPDUType.CONFIG,
      rootId: bridge.rootBridge,
      rootPathCost: bridge.rootPathCost,
      bridgeId: bridge.bridgeId,
      portId: port.portId,
      messageAge: 0,
      maxAge: bridge.timers.maxAge,
      helloTime: bridge.timers.helloTime,
      forwardDelay: bridge.timers.forwardDelay,
      topologyChange: bridge.topologyChangeDetected,
      topologyChangeAck: false,
      timestamp: new Date(),
    };

    // Simulate BPDU transmission to connected bridges
    this.transmitBPDU(bridge.bridgeId, port.portId, bpdu);
  }

  /**
   * Send topology change BPDU
   */
  private sendTopologyChangeBPDU(bridgeId: string, portId: string): void {
    const bridge = this.bridges.get(bridgeId);
    if (!bridge) return;

    const bpdu: BPDU = {
      type: BPDUType.TCN,
      rootId: bridge.rootBridge,
      rootPathCost: bridge.rootPathCost,
      bridgeId: bridge.bridgeId,
      portId: portId,
      messageAge: 0,
      maxAge: bridge.timers.maxAge,
      helloTime: bridge.timers.helloTime,
      forwardDelay: bridge.timers.forwardDelay,
      topologyChange: true,
      topologyChangeAck: false,
      timestamp: new Date(),
    };

    this.transmitBPDU(bridgeId, portId, bpdu);
  }

  /**
   * Transmit BPDU to connected bridge
   */
  private transmitBPDU(sourceBridgeId: string, sourcePortId: string, bpdu: BPDU): void {
    // Find connected bridge through topology
    const connectedBridges = this.topology.get(sourceBridgeId) || [];
    
    connectedBridges.forEach(targetBridgeId => {
      // Simulate BPDU reception on target bridge
      // In real implementation, this would go through the network
      const targetBridge = this.bridges.get(targetBridgeId);
      if (targetBridge) {
        // Find the port on target bridge that connects to source
        targetBridge.ports.forEach(port => {
          this.receiveBPDU(targetBridgeId, port.portId, bpdu);
        });
      }
    });
  }

  /**
   * Process BPDU queue
   */
  private processBPDUQueue(): void {
    while (this.bpduQueue.length > 0) {
      const bpdu = this.bpduQueue.shift()!;
      this.processBPDU(bpdu);
    }
  }

  /**
   * Process individual BPDU
   */
  private processBPDU(bpdu: BPDU): void {
    if (bpdu.type === BPDUType.CONFIG) {
      this.processConfigBPDU(bpdu);
    } else if (bpdu.type === BPDUType.TCN) {
      this.processTopologyChangeBPDU(bpdu);
    }
  }

  /**
   * Process configuration BPDU
   */
  private processConfigBPDU(bpdu: BPDU): void {
    // Find receiving bridge and port
    // This is simplified - in practice we'd know from the receiving port
    this.bridges.forEach(bridge => {
      bridge.ports.forEach(port => {
        if (port.lastBPDU === bpdu) {
          // Check if this BPDU is superior to current information
          if (this.isBPDUSuperior(bridge, port, bpdu)) {
            this.updatePortFromBPDU(bridge, port, bpdu);
            
            // Trigger recalculation if root information changed
            if (bpdu.rootId !== bridge.rootBridge) {
              this.electRootBridge();
              this.configurePortRoles();
            }
          }
        }
      });
    });
  }

  /**
   * Process topology change BPDU
   */
  private processTopologyChangeBPDU(bpdu: BPDU): void {
    // Flush MAC address tables and propagate topology change
    console.log(`STP: Topology change detected from ${bpdu.bridgeId}`);
    
    // In a real implementation, this would flush MAC address tables
    // and propagate the topology change notification
  }

  /**
   * Update port states based on timers
   */
  private updatePortStates(): void {
    const now = Date.now();

    this.bridges.forEach(bridge => {
      bridge.ports.forEach(port => {
        this.updatePortState(port, now);
      });
    });
  }

  /**
   * Update individual port state
   */
  private updatePortState(port: STPPortInfo, now: number): void {
    switch (port.state) {
      case SpanningTreePortState.BLOCKING:
        if (port.role === STPPortRole.ROOT || port.role === STPPortRole.DESIGNATED) {
          port.state = SpanningTreePortState.LISTENING;
          port.timers.listeningTimer = now;
        }
        break;

      case SpanningTreePortState.LISTENING:
        if (now - port.timers.listeningTimer >= this.config.forwardDelay) {
          port.state = SpanningTreePortState.LEARNING;
          port.timers.learningTimer = now;
        }
        break;

      case SpanningTreePortState.LEARNING:
        if (now - port.timers.learningTimer >= this.config.forwardDelay) {
          port.state = SpanningTreePortState.FORWARDING;
        }
        break;

      case SpanningTreePortState.FORWARDING:
        if (port.role === STPPortRole.BLOCKED) {
          port.state = SpanningTreePortState.BLOCKING;
          port.timers.blockingTimer = now;
        }
        break;
    }
  }

  /**
   * Calculate path cost for interface
   */
  private calculatePathCost(iface: NetworkInterface): number {
    // STP path cost based on link speed
    // IEEE 802.1D-1998 standard costs
    switch (iface.speed) {
      case 10:    return 100;     // 10 Mbps
      case 100:   return 19;      // 100 Mbps
      case 1000:  return 4;       // 1 Gbps
      case 10000: return 2;       // 10 Gbps
      default:    return 20;      // Default cost
    }
  }

  /**
   * Calculate path cost to root through specific port
   */
  private calculatePathCostToRoot(bridgeId: string, portId: string): number {
    const bridge = this.bridges.get(bridgeId);
    const port = bridge?.ports.get(portId);
    
    if (!bridge || !port || !port.lastBPDU) {
      return Infinity;
    }

    return port.lastBPDU.rootPathCost + port.pathCost;
  }

  /**
   * Check if port should be designated
   */
  private shouldPortBeDesignated(bridge: STPBridgeInfo, port: STPPortInfo): boolean {
    // A port is designated if this bridge has the best path to root
    // through this port compared to what's currently designated
    const currentCost = bridge.rootPathCost;
    const designatedCost = port.designatedCost;
    
    return currentCost <= designatedCost;
  }

  /**
   * Check if received BPDU is superior to current port information
   */
  private isBPDUSuperior(bridge: STPBridgeInfo, port: STPPortInfo, bpdu: BPDU): boolean {
    // BPDU is superior if:
    // 1. Root bridge ID is lower
    // 2. Root path cost is lower (if same root)
    // 3. Bridge ID is lower (if same root and cost)
    // 4. Port ID is lower (if everything else same)

    if (bpdu.rootId < bridge.rootBridge) return true;
    if (bpdu.rootId > bridge.rootBridge) return false;

    if (bpdu.rootPathCost < bridge.rootPathCost) return true;
    if (bpdu.rootPathCost > bridge.rootPathCost) return false;

    if (bpdu.bridgeId < port.designatedBridge) return true;
    if (bpdu.bridgeId > port.designatedBridge) return false;

    return bpdu.portId < port.designatedPort;
  }

  /**
   * Update port information from BPDU
   */
  private updatePortFromBPDU(bridge: STPBridgeInfo, port: STPPortInfo, bpdu: BPDU): void {
    port.designatedRoot = bpdu.rootId;
    port.designatedBridge = bpdu.bridgeId;
    port.designatedPort = bpdu.portId;
    port.designatedCost = bpdu.rootPathCost;
    
    // Update bridge root information if necessary
    if (bpdu.rootId < bridge.rootBridge || 
        (bpdu.rootId === bridge.rootBridge && bpdu.rootPathCost + port.pathCost < bridge.rootPathCost)) {
      bridge.rootBridge = bpdu.rootId;
      bridge.rootPathCost = bpdu.rootPathCost + port.pathCost;
      bridge.isRoot = false;
    }
  }

  /**
   * Detect topology changes
   */
  private detectTopologyChanges(): void {
    // Check for link state changes
    // In practice, this would monitor interface states and connection changes
    
    // Reset topology change flag after processing
    this.bridges.forEach(bridge => {
      if (bridge.topologyChangeDetected) {
        setTimeout(() => {
          bridge.topologyChangeDetected = false;
        }, this.config.forwardDelay * 2);
      }
    });
  }

  /**
   * Age out old BPDU information
   */
  private ageBPDUs(): void {
    const now = Date.now();

    this.bridges.forEach(bridge => {
      bridge.ports.forEach(port => {
        if (port.lastBPDU && now - port.lastBPDU.timestamp.getTime() > bridge.timers.maxAge) {
          // BPDU information is too old, age it out
          port.lastBPDU = undefined;
          
          // Recalculate STP if this was providing root path information
          if (port.role === STPPortRole.ROOT) {
            this.electRootBridge();
            this.configurePortRoles();
          }
        }
      });
    });
  }

  /**
   * Generate bridge ID from switch information
   */
  private generateBridgeId(sw: SwitchDevice): string {
    const priority = this.config.bridgePriority;
    const macAddress = sw.interfaces[0]?.macAddress || '00:00:00:00:00:00';
    return `${priority.toString(16).padStart(4, '0')}.${macAddress}`;
  }
}