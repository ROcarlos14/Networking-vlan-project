import {
  NetworkPacket,
  SimulatedPacket,
  PacketStatus,
  PacketType,
  NetworkProtocol,
  DropReason,
  PacketSimulation,
  TrafficFlow,
  SimulationStats,
} from '../../types/simulation';
import {
  NetworkDevice,
  SwitchDevice,
  RouterDevice,
  PcDevice,
  ServerDevice,
  DeviceType,
  InterfaceStatus,
  InterfaceType,
  Connection,
  Vlan,
  MacAddressEntry,
} from '../../types';
import {
  canSwitchesCommunicate, 
  getInterfaceVlans, 
  getSwitchVlans 
} from '../vlan-logic/vlanConfiguration';
import { PacketAnimationManager } from './packetAnimation';

/**
 * ARP Table Entry
 */
interface ARPEntry {
  ipAddress: string;
  macAddress: string;
  deviceId: string;
  vlanId: number;
  timestamp: Date;
  isStatic: boolean;
}

/**
 * MAC Address Table Entry with enhanced features
 */
interface EnhancedMacEntry extends MacAddressEntry {
  learnedFrom: string; // Interface ID where it was learned
  timestamp: Date;
  isStatic: boolean;
}

/**
 * Forwarding Decision
 */
interface ForwardingDecision {
  action: 'forward' | 'flood' | 'drop' | 'route';
  outInterface?: string;
  outDevice?: string;
  reason: string;
  vlanAllowed: boolean;
}

/**
 * Core simulation engine for network packet simulation
 */
export class SimulationEngine {
  private devices: NetworkDevice[] = [];
  private connections: Connection[] = [];
  private vlans: Vlan[] = [];
  private activeSimulation?: PacketSimulation;
  private animationFrameId?: number;
  private simulationSpeed: number = 1.0;
  private isRunning: boolean = false;
  private autoRun: boolean = true;
  private startTime: Date = new Date();
  private statistics: SimulationStats = this.createEmptyStats();
  
  // Enhanced learning tables
  private macTables: Map<string, Map<string, EnhancedMacEntry>> = new Map();
  private arpTables: Map<string, Map<string, ARPEntry>> = new Map();
  private packetHistory: Map<string, SimulatedPacket[]> = new Map();
  
  // Learning and aging parameters
  private readonly MAC_AGING_TIME = 300000; // 5 minutes in ms
  private readonly ARP_AGING_TIME = 240000; // 4 minutes in ms
  
  // Animation system
  private packetAnimationManager?: PacketAnimationManager;
  private enableAnimation: boolean = true;

  constructor(
    devices: NetworkDevice[],
    connections: Connection[],
    vlans: Vlan[]
  ) {
    this.devices = devices;
    this.connections = connections;
    this.vlans = vlans;
    this.initializeLearningTables();
  }
  
  /**
   * Initialize packet animation manager
   */
  initializeAnimationManager(svgElement: d3.Selection<SVGGElement, unknown, null, undefined>): void {
    this.packetAnimationManager = new PacketAnimationManager(svgElement);
    this.packetAnimationManager.updateTopology(this.devices, this.connections);
  }
  
  /**
   * Initialize learning tables for all switches
   */
  private initializeLearningTables(): void {
    this.devices.forEach(device => {
      if (device.type === DeviceType.SWITCH) {
        this.macTables.set(device.id, new Map());
        this.arpTables.set(device.id, new Map());
        
        // Initialize with any static MAC entries
        const switchDevice = device as SwitchDevice;
        if (switchDevice.macAddressTable) {
          switchDevice.macAddressTable.forEach((entry: MacAddressEntry) => {
            if (entry.type === 'static') {
              this.learnMac(device.id, entry.macAddress, entry.vlanId, entry.interface, true);
            }
          });
        }
      }
    });
  }

  /**
   * Start a new packet simulation
   */
  startSimulation(trafficFlows: TrafficFlow[] = []): PacketSimulation {
    this.stopSimulation();
    
    this.startTime = new Date();
    this.statistics = this.createEmptyStats();
    this.isRunning = true;
    this.autoRun = true;

    this.activeSimulation = {
      id: crypto.randomUUID(),
      packets: [],
      isRunning: true,
      speed: this.simulationSpeed,
      startTime: this.startTime,
    };

    // Generate initial packets from traffic flows
    trafficFlows.forEach(flow => {
      if (flow.isActive) {
        this.generatePacketsFromFlow(flow);
      }
    });

    this.runSimulationLoop();
    return this.activeSimulation;
  }

  /**
   * Stop the current simulation
   */
  stopSimulation(): void {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = undefined;
    }
    if (this.activeSimulation) {
      this.activeSimulation.isRunning = false;
      this.activeSimulation.endTime = new Date();
    }
  }

  /**
   * Enable/disable auto-run (continuous simulation)
   */
  setAutoRun(enabled: boolean): void {
    this.autoRun = enabled;
    if (enabled && this.isRunning) {
      this.runSimulationLoop();
    }
  }

  /**
   * Execute a single simulation tick (step-through)
   */
  stepSimulation(): void {
    if (!this.activeSimulation) {
      // Initialize an empty simulation state if none exists
      this.activeSimulation = {
        id: crypto.randomUUID(),
        packets: [],
        isRunning: this.isRunning,
        speed: this.simulationSpeed,
        startTime: new Date(),
      };
    }
    this.processSimulationTick();
  }

  /**
   * Create a single packet for testing/demonstration
   */
  createTestPacket(
    sourceDeviceId: string,
    targetDeviceId: string,
    packetType: PacketType = PacketType.IP,
    protocol: NetworkProtocol = NetworkProtocol.ICMP,
    vlanTag?: number
  ): SimulatedPacket | null {
    const sourceDevice = this.devices.find(d => d.id === sourceDeviceId);
    const targetDevice = this.devices.find(d => d.id === targetDeviceId);

    if (!sourceDevice || !targetDevice) {
      return null;
    }

    const packet: NetworkPacket = {
      id: crypto.randomUUID(),
      type: packetType,
      sourceDevice: sourceDeviceId,
      targetDevice: targetDeviceId,
      sourceMac: this.getDeviceMacAddress(sourceDevice),
      targetMac: this.getDeviceMacAddress(targetDevice),
      sourceIp: this.getDeviceIpAddress(sourceDevice),
      targetIp: this.getDeviceIpAddress(targetDevice),
      vlanTag,
      size: this.getDefaultPacketSize(packetType),
      timestamp: new Date(),
      ttl: 64,
      protocol,
      payload: this.generatePayload(packetType, protocol),
    };

    return this.createSimulatedPacket(packet);
  }

  /**
   * Send a packet through the network
   */
  sendPacket(packet: SimulatedPacket): void {
    if (!this.activeSimulation) {
      this.activeSimulation = {
        id: crypto.randomUUID(),
        packets: [],
        isRunning: this.isRunning,
        speed: this.simulationSpeed,
        startTime: new Date(),
      };
    }

    // Calculate the path for the packet
    const path = this.calculatePacketPath(packet);
    packet.path = path;
    packet.status = PacketStatus.QUEUED;

    this.activeSimulation.packets.push(packet);
    this.updateStatistics(packet, 'created');
    
    // Start packet animation if enabled
    if (this.enableAnimation && this.packetAnimationManager && packet.path.length > 1) {
      this.packetAnimationManager.animatePacket(packet);
    }
    
    // Add to packet history for debugging
    const history = this.packetHistory.get(packet.sourceDevice) || [];
    history.push(packet);
    this.packetHistory.set(packet.sourceDevice, history.slice(-50)); // Keep last 50 packets
  }

  /**
   * Get current simulation state
   */
  getSimulationState(): PacketSimulation | undefined {
    return this.activeSimulation;
  }

  /**
   * Get current simulation statistics
   */
  getSimulationStatistics(): SimulationStats {
    return { ...this.statistics };
  }

  /**
   * Set simulation speed
   */
  setSimulationSpeed(speed: number): void {
    this.simulationSpeed = Math.max(0.1, Math.min(10.0, speed));
    if (this.activeSimulation) {
      this.activeSimulation.speed = this.simulationSpeed;
    }
    
    // Update animation speed
    if (this.packetAnimationManager) {
      this.packetAnimationManager.setAnimationSpeed(speed);
    }
  }
  
  /**
   * Enable/disable packet animation
   */
  setAnimationEnabled(enabled: boolean): void {
    this.enableAnimation = enabled;
    
    if (!enabled && this.packetAnimationManager) {
      this.packetAnimationManager.clearAnimations();
    }
  }
  
  /**
   * Set packet trails visibility
   */
  setPacketTrailsEnabled(enabled: boolean): void {
    if (this.packetAnimationManager) {
      this.packetAnimationManager.setPacketTrails(enabled);
    }
  }
  
  /**
   * Get MAC address table for a specific device
   */
  getMacTable(deviceId: string): EnhancedMacEntry[] {
    const table = this.macTables.get(deviceId);
    return table ? Array.from(table.values()) : [];
  }
  
  /**
   * Get ARP table for a specific device
   */
  getArpTable(deviceId: string): ARPEntry[] {
    const table = this.arpTables.get(deviceId);
    return table ? Array.from(table.values()) : [];
  }
  
  /**
   * Get packet history for a device
   */
  getPacketHistory(deviceId: string): SimulatedPacket[] {
    return this.packetHistory.get(deviceId) || [];
  }
  
  /**
   * Simulate broadcast packet (ARP request, etc.)
   */
  sendBroadcastPacket(
    sourceDeviceId: string,
    protocol: NetworkProtocol = NetworkProtocol.ARP,
    vlanTag?: number
  ): SimulatedPacket[] {
    const sourceDevice = this.devices.find(d => d.id === sourceDeviceId);
    if (!sourceDevice) return [];

    const broadcastPackets: SimulatedPacket[] = [];
    
    // Constrain broadcast to VLAN-reachable devices
    const vlanId = vlanTag || this.inferPacketVlan({
      id: '', type: PacketType.ARP, sourceDevice: sourceDeviceId, targetDevice: '',
      sourceMac: '', targetMac: '', timestamp: new Date(), size: 64, protocol: NetworkProtocol.ARP, payload: {}
    } as any, this.devices.find(d => d.id === sourceDeviceId)!) || 1;

    const reachable = new Set(this.getVlanReachableDevices(sourceDeviceId, vlanId));
    const targetDevices = this.devices.filter(d => d.id !== sourceDeviceId && d.type !== DeviceType.SWITCH && reachable.has(d.id));

    targetDevices.forEach(targetDevice => {
      const packet = this.createTestPacket(
        sourceDeviceId,
        targetDevice.id,
        PacketType.BROADCAST,
        protocol,
        vlanTag
      );
      
      if (packet) {
        // Set broadcast MAC addresses
        packet.targetMac = 'FF:FF:FF:FF:FF:FF';
        this.sendPacket(packet);
        broadcastPackets.push(packet);
      }
    });

    return broadcastPackets;
  }

  /**
   * Main simulation loop
   */
  private runSimulationLoop(): void {
    if (!this.isRunning || !this.activeSimulation || !this.autoRun) {
      return;
    }

    this.processSimulationTick();

    // Continue simulation loop
    this.animationFrameId = requestAnimationFrame(() => this.runSimulationLoop());
  }

  /**
   * Process one simulation tick (shared by auto-run and step)
   */
  private processSimulationTick(): void {
    if (!this.activeSimulation) return;

    const deltaTime = 16 * this.simulationSpeed; // ~60fps adjusted by speed

    // Process all active packets
    this.activeSimulation.packets.forEach(packet => {
      this.processPacket(packet, deltaTime);
    });

    // Aging for MAC/ARP tables
    this.ageLearningTables();

    // Remove completed packets (delivered or dropped)
    this.activeSimulation.packets = this.activeSimulation.packets.filter(
      packet => packet.status === PacketStatus.IN_TRANSIT || packet.status === PacketStatus.QUEUED
    );
  }

  /**
   * Process a single packet's movement and state
   */
  private processPacket(packet: SimulatedPacket, deltaTime: number): void {
    switch (packet.status) {
      case PacketStatus.QUEUED:
        this.startPacketTransmission(packet);
        break;
      case PacketStatus.IN_TRANSIT:
        this.updatePacketPosition(packet, deltaTime);
        break;
    }
    
    // Update animation system
    if (this.enableAnimation && this.packetAnimationManager) {
      this.packetAnimationManager.updatePacketAnimation(packet);
    }
  }

  /**
   * Start packet transmission
   */
  private startPacketTransmission(packet: SimulatedPacket): void {
    if (packet.path.length === 0) {
      this.dropPacket(packet, DropReason.NO_ROUTE);
      return;
    }

    // Validate packet can be sent from source
    const sourceDevice = this.devices.find(d => d.id === packet.sourceDevice);
    if (!sourceDevice || !this.canDeviceSendPacket(sourceDevice, packet)) {
      this.dropPacket(packet, DropReason.ACCESS_DENIED);
      return;
    }

    // Optionally simulate ARP resolution before first hop for L3
    if (packet.protocol !== NetworkProtocol.ARP && packet.vlanTag) {
      this.simulateArpResolution(packet);
    }

    packet.status = PacketStatus.IN_TRANSIT;
    packet.currentPosition = { deviceId: packet.path[0] };
    this.updateStatistics(packet, 'transmitted');
  }

  /**
   * Update packet position during transmission
   */
  private updatePacketPosition(packet: SimulatedPacket, deltaTime: number): void {
    // Decrement TTL per hop; drop if expired
    packet.ttl = (packet.ttl ?? 64) - 1;
    if (packet.ttl <= 0) {
      this.dropPacket(packet, DropReason.TTL_EXCEEDED);
      return;
    }

    const currentIndex = packet.path.indexOf(packet.currentPosition.deviceId);
    const nextIndex = currentIndex + 1;

    if (nextIndex >= packet.path.length) {
      // Packet reached destination
      this.deliverPacket(packet);
      return;
    }

    const currentDevice = this.devices.find(d => d.id === packet.path[currentIndex]);
    const nextDevice = this.devices.find(d => d.id === packet.path[nextIndex]);

    if (!currentDevice || !nextDevice) {
      this.dropPacket(packet, DropReason.NO_ROUTE);
      return;
    }

    // Check if packet can traverse the link
    if (!this.canPacketTraverseLink(packet, currentDevice, nextDevice)) {
      this.dropPacket(packet, DropReason.VLAN_MISMATCH);
      return;
    }

    // MAC learning on arrival at nextDevice (switches only)
    const connection = this.getConnectionBetweenDevices(currentDevice.id, nextDevice.id);
    const ingressIfOnNext = connection
      ? (connection.sourceDevice === nextDevice.id ? connection.sourceInterface : connection.targetInterface)
      : undefined;
    if (nextDevice.type === DeviceType.SWITCH) {
      this.learnMac(nextDevice.id, packet.sourceMac, packet.vlanTag, ingressIfOnNext);
    }

    // Simulate transmission delay
    const transmissionDelay = connection ? this.calculateTransmissionDelay(packet.size) : 100;
    
    packet.delay += transmissionDelay;
    
    // Move to next device (simplified - in reality this would be animated)
    packet.currentPosition.deviceId = packet.path[nextIndex];
    
    // Update device utilization statistics
    this.updateDeviceUtilization(currentDevice.id, packet.size);
    if (packet.vlanTag) {
      this.updateVlanUtilization(packet.vlanTag, packet.size);
    }
  }

  /**
   * Deliver packet successfully
   */
  private deliverPacket(packet: SimulatedPacket): void {
    packet.status = PacketStatus.DELIVERED;
    this.updateStatistics(packet, 'delivered');
  }

  /**
   * Drop packet with specified reason
   */
  private dropPacket(packet: SimulatedPacket, reason: DropReason): void {
    packet.status = PacketStatus.DROPPED;
    packet.drops = packet.drops || [];
    packet.drops.push({
      deviceId: packet.currentPosition.deviceId,
      reason,
      timestamp: new Date(),
      interfaceId: packet.currentPosition.interfaceId,
    });
    this.updateStatistics(packet, 'dropped');
  }

  /**
   * Calculate packet path through the network
   */
  private calculatePacketPath(packet: SimulatedPacket): string[] {
    const sourceDevice = this.devices.find(d => d.id === packet.sourceDevice);
    const targetDevice = this.devices.find(d => d.id === packet.targetDevice);

    if (!sourceDevice || !targetDevice) {
      return [];
    }

    // Infer VLAN if not specified
    const vlanId = this.inferPacketVlan(packet, sourceDevice) ?? packet.vlanTag;
    if (vlanId && !packet.vlanTag) {
      packet.vlanTag = vlanId;
    }

    // VLAN-aware BFS
    const path = this.findVlanAwarePath(sourceDevice.id, targetDevice.id, vlanId);
    return path;
  }

  /**
   * Find shortest path between two devices (simplified implementation)
   */
  private findShortestPath(sourceId: string, targetId: string): string[] {
    if (sourceId === targetId) {
      return [sourceId];
    }

    // Build adjacency graph
    const graph = new Map<string, string[]>();
    this.devices.forEach(device => {
      graph.set(device.id, []);
    });

    this.connections.forEach(connection => {
      graph.get(connection.sourceDevice)?.push(connection.targetDevice);
      graph.get(connection.targetDevice)?.push(connection.sourceDevice);
    });

    // BFS to find shortest path
    const queue: { deviceId: string; path: string[] }[] = [{ deviceId: sourceId, path: [sourceId] }];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { deviceId, path } = queue.shift()!;
      
      if (deviceId === targetId) {
        return path;
      }

      if (visited.has(deviceId)) {
        continue;
      }
      visited.add(deviceId);

      const neighbors = graph.get(deviceId) || [];
      neighbors.forEach(neighbor => {
        if (!visited.has(neighbor)) {
          queue.push({ deviceId: neighbor, path: [...path, neighbor] });
        }
      });
    }

    return []; // No path found
  }

  /**
   * VLAN-aware BFS path (only traverse connections that allow the VLAN if vlanId is provided)
   */
  private findVlanAwarePath(sourceId: string, targetId: string, vlanId?: number): string[] {
    if (sourceId === targetId) return [sourceId];

    const visited = new Set<string>();
    const queue: { deviceId: string; path: string[] }[] = [{ deviceId: sourceId, path: [sourceId] }];

    while (queue.length > 0) {
      const { deviceId, path } = queue.shift()!;
      if (deviceId === targetId) return path;
      if (visited.has(deviceId)) continue;
      visited.add(deviceId);

      // Explore neighbors via connections
      this.connections.forEach(conn => {
        let next: string | undefined;
        if (conn.sourceDevice === deviceId) next = conn.targetDevice;
        else if (conn.targetDevice === deviceId) next = conn.sourceDevice;
        if (!next || visited.has(next)) return;
        if (vlanId) {
          if (!this.isVlanAllowedOnConnection(conn, vlanId)) return;
        }
        queue.push({ deviceId: next, path: [...path, next] });
      });
    }

    return [];
  }

  /**
   * Infer VLAN for a packet if not explicitly set: derive from access/trunk config on first-hop switch
   */
  private inferPacketVlan(packet: SimulatedPacket, sourceDevice: NetworkDevice): number | undefined {
    if (packet.vlanTag) return packet.vlanTag;

    // If source is an end-host with single interface, find its uplink to a switch and infer VLAN from switch-side port
    const uplink = this.connections.find(c => c.sourceDevice === sourceDevice.id || c.targetDevice === sourceDevice.id);
    if (!uplink) return undefined;
    const switchId = uplink.sourceDevice === sourceDevice.id ? uplink.targetDevice : uplink.sourceDevice;
    const sw = this.devices.find(d => d.id === switchId && d.type === DeviceType.SWITCH) as SwitchDevice | undefined;
    if (!sw) return undefined;

    const swIfId = uplink.sourceDevice === sw.id ? uplink.sourceInterface : uplink.targetInterface;
    const swIf = sw.interfaces.find(i => i.id === swIfId);
    if (!swIf) return undefined;

    if (swIf.type === InterfaceType.ACCESS) {
      // Untagged host traffic is in the access VLAN
      return swIf.vlanConfig?.accessVlan;
    }
    if (swIf.type === InterfaceType.TRUNK) {
      // Untagged host traffic would map to native VLAN on a trunk (though hosts usually aren't on trunks)
      return swIf.vlanConfig?.nativeVlan;
    }
    return undefined;
  }

  /**
   * Check if device can send packet (considering VLAN restrictions)
   */
  private canDeviceSendPacket(device: NetworkDevice, packet: SimulatedPacket): boolean {
    // Check device status
    if (device.status !== 'active') {
      return false;
    }

    // For switches, check VLAN configuration
    if (device.type === DeviceType.SWITCH) {
      const switchDevice = device as SwitchDevice;
      if (packet.vlanTag) {
        const switchVlans = getSwitchVlans(switchDevice);
        return switchVlans.includes(packet.vlanTag);
      }
    }

    return true;
  }

  /**
   * Check if packet can traverse link between devices
   */
  private canPacketTraverseLink(packet: SimulatedPacket, currentDevice: NetworkDevice, nextDevice: NetworkDevice): boolean {
    // Enforce VLAN allowance on the actual connection between the two devices
    if (packet.vlanTag) {
      const conn = this.getConnectionBetweenDevices(currentDevice.id, nextDevice.id);
      if (conn && !this.isVlanAllowedOnConnection(conn, packet.vlanTag)) {
        return false;
      }
    }

    // For switch-to-switch, optionally trigger ARP learning if unknown
    if (currentDevice.type === DeviceType.SWITCH && nextDevice.type === DeviceType.SWITCH && packet.vlanTag) {
      if (packet.protocol !== NetworkProtocol.ARP) {
        const macKnown = this.lookupMac(nextDevice.id, packet.targetMac, packet.vlanTag) !== undefined;
        if (!macKnown) {
          this.simulateArpResolution(packet);
        }
      }
    }

    return true;
  }

  /**
   * Get connection between two devices
   */
  private getConnectionBetweenDevices(device1Id: string, device2Id: string): Connection | undefined {
    return this.connections.find(conn =>
      (conn.sourceDevice === device1Id && conn.targetDevice === device2Id) ||
      (conn.sourceDevice === device2Id && conn.targetDevice === device1Id)
    );
  }

  /**
   * Calculate transmission delay for packet
   */
  private calculateTransmissionDelay(packetSize: number): number {
    // Simple delay calculation - in reality this would consider bandwidth, latency, etc.
    const baseDelay = 1; // 1ms base delay
    const sizeDelay = packetSize / 1000; // Additional delay based on packet size
    return baseDelay + sizeDelay;
  }

  /**
   * Create a simulated packet from a network packet
   */
  private createSimulatedPacket(packet: NetworkPacket): SimulatedPacket {
    return {
      ...packet,
      currentPosition: { deviceId: packet.sourceDevice },
      path: [],
      status: PacketStatus.QUEUED,
      delay: 0,
    };
  }

  /**
   * Generate packets from traffic flow
   */
  private generatePacketsFromFlow(flow: TrafficFlow): void {
    // Generate initial burst of packets based on packetsPerSecond
    const packetsToGenerate = Math.min(flow.packetsPerSecond / 10, 10); // Limit initial burst
    
    for (let i = 0; i < packetsToGenerate; i++) {
      const packet = this.createTestPacket(
        flow.sourceDevice,
        flow.targetDevice,
        this.protocolToPacketType(flow.protocol),
        flow.protocol,
        flow.vlanId
      );
      
      if (packet) {
        this.sendPacket(packet);
      }
    }
  }

  /**
   * Learning table utilities
   */
  private macKey(mac: string, vlan?: number): string {
    return `${(vlan ?? 0)}|${mac.toLowerCase()}`;
  }

  private ensureMacTable(deviceId: string): Map<string, EnhancedMacEntry> {
    if (!this.macTables.has(deviceId)) {
      this.macTables.set(deviceId, new Map());
    }
    return this.macTables.get(deviceId)!;
  }

  private learnMac(deviceId: string, mac: string, vlan?: number, learnedFrom?: string, isStatic: boolean = false): void {
    const table = this.ensureMacTable(deviceId);
    const key = this.macKey(mac, vlan);
    const entry: EnhancedMacEntry = {
      macAddress: mac,
      vlanId: vlan ?? 0,
      interface: learnedFrom || 'unknown',
      type: isStatic ? 'static' : 'dynamic',
      age: 0,
      learnedFrom: learnedFrom || 'unknown',
      timestamp: new Date(),
      isStatic,
    };
    table.set(key, entry);
    
    // Log MAC learning for debugging
    console.debug(`MAC learned: ${mac} on device ${deviceId}, interface ${learnedFrom}, VLAN ${vlan}`);
  }

  private lookupMac(deviceId: string, mac: string, vlan?: number): EnhancedMacEntry | undefined {
    const table = this.macTables.get(deviceId);
    if (!table) return undefined;
    const key = this.macKey(mac, vlan);
    return table.get(key);
  }

  private ageLearningTables(): void {
    const now = Date.now();
    this.macTables.forEach((table) => {
      const toDelete: string[] = [];
      table.forEach((entry, key) => {
        const ageMs = now - entry.timestamp.getTime();
        if (!entry.isStatic && ageMs > this.MAC_AGING_TIME) {
          toDelete.push(key);
        }
      });
      toDelete.forEach(k => table.delete(k));
    });

    this.arpTables.forEach((table) => {
      const toDelete: string[] = [];
      table.forEach((entry, ip) => {
        const ageMs = now - entry.timestamp.getTime();
        if (!entry.isStatic && ageMs > this.ARP_AGING_TIME) {
          toDelete.push(ip);
        }
      });
      toDelete.forEach(ip => table.delete(ip));
    });
  }

  /**
   * Simulate ARP request/reply resolution along the path (approximate, no flood)
   */
  private simulateArpResolution(packet: SimulatedPacket): void {
    if (!packet.vlanTag) return;
    // Populate MAC entries for the target MAC on switches along the path
    packet.path.forEach((deviceId, idx) => {
      const dev = this.devices.find(d => d.id === deviceId);
      if (dev && dev.type === DeviceType.SWITCH) {
        // Use the inbound interface from the previous hop if available
        const prevId = idx > 0 ? packet.path[idx - 1] : undefined;
        const conn = prevId ? this.getConnectionBetweenDevices(deviceId, prevId) : undefined;
        const ingressIf = conn ? (conn.sourceDevice === deviceId ? conn.sourceInterface : conn.targetInterface) : undefined;
        this.learnMac(deviceId, packet.targetMac, packet.vlanTag, ingressIf);
      }
    });

    // Optionally add ARP req/reply packets for visualization
    const arpReq: NetworkPacket = {
      id: crypto.randomUUID(),
      type: PacketType.ARP,
      sourceDevice: packet.sourceDevice,
      targetDevice: packet.targetDevice,
      sourceMac: packet.sourceMac,
      targetMac: 'ff:ff:ff:ff:ff:ff',
      sourceIp: packet.sourceIp,
      targetIp: packet.targetIp,
      vlanTag: packet.vlanTag,
      size: 64,
      timestamp: new Date(),
      ttl: 64,
      protocol: NetworkProtocol.ARP,
      payload: { op: 'request' },
    };
    const arpRep: NetworkPacket = {
      ...arpReq,
      id: crypto.randomUUID(),
      targetMac: packet.sourceMac,
      payload: { op: 'reply' },
    };

    const simReq = this.createSimulatedPacket(arpReq);
    simReq.path = [...packet.path];
    const simRep = this.createSimulatedPacket(arpRep);
    simRep.path = [...packet.path].reverse();

    if (this.activeSimulation) {
      this.activeSimulation.packets.push(simReq, simRep);
    }
  }

  /**
   * Helper methods for packet creation
   */
  private getDeviceMacAddress(device: NetworkDevice): string {
    if ('interface' in device && device.interface) {
      return device.interface.macAddress;
    }
    if ('interfaces' in device && device.interfaces && device.interfaces.length > 0) {
      return device.interfaces[0].macAddress;
    }
    return '00:00:00:00:00:00';
  }

  private getDeviceIpAddress(device: NetworkDevice): string | undefined {
    if ('interface' in device && device.interface) {
      return device.interface.ipAddress;
    }
    if ('interfaces' in device && device.interfaces && device.interfaces.length > 0) {
      return device.interfaces.find((iface: any) => iface.ipAddress)?.ipAddress;
    }
    return undefined;
  }

  private getDefaultPacketSize(packetType: PacketType): number {
    switch (packetType) {
      case PacketType.ARP: return 42;
      case PacketType.ICMP: return 98;
      case PacketType.TCP: return 1500;
      case PacketType.UDP: return 512;
      default: return 64;
    }
  }

  private generatePayload(packetType: PacketType, protocol: NetworkProtocol): any {
    return {
      type: packetType,
      protocol,
      data: `Simulated ${protocol} packet`,
    };
  }

  private protocolToPacketType(protocol: NetworkProtocol): PacketType {
    switch (protocol) {
      case NetworkProtocol.ARP: return PacketType.ARP;
      case NetworkProtocol.ICMP: return PacketType.ICMP;
      case NetworkProtocol.TCP: return PacketType.TCP;
      case NetworkProtocol.UDP: return PacketType.UDP;
      default: return PacketType.IP;
    }
  }

  /**
   * Enhanced VLAN-aware packet routing with MAC learning
   */
  private enhancedCalculatePacketPath(packet: SimulatedPacket): string[] {
    const sourceDevice = this.devices.find(d => d.id === packet.sourceDevice);
    const targetDevice = this.devices.find(d => d.id === packet.targetDevice);

    if (!sourceDevice || !targetDevice) {
      return [];
    }

    // For ARP packets, use broadcast behavior
    if (packet.protocol === NetworkProtocol.ARP) {
      return this.calculateARPPath(packet, sourceDevice);
    }

    // For regular packets, use learned MAC addresses
    return this.calculateLearnedPath(packet, sourceDevice, targetDevice);
  }

  /**
   * Calculate path for ARP packets (broadcast in VLAN)
   */
  private calculateARPPath(packet: SimulatedPacket, sourceDevice: NetworkDevice): string[] {
    const vlanId = packet.vlanTag || 1;
    const reachableDevices = this.getVlanReachableDevices(sourceDevice.id, vlanId);
    
    // ARP should reach all devices in the same VLAN
    return reachableDevices.filter(deviceId => deviceId !== sourceDevice.id);
  }

  /**
   * Calculate path using MAC address learning
   */
  private calculateLearnedPath(packet: SimulatedPacket, sourceDevice: NetworkDevice, targetDevice: NetworkDevice): string[] {
    // Learn source MAC address
    this.learnMacAddress(sourceDevice.id, packet.sourceMac, packet.vlanTag || 1);

    // Look up target MAC in forwarding tables
    const path = this.lookupMacForwarding(packet.targetMac, sourceDevice.id, packet.vlanTag || 1);
    
    if (path.length === 0) {
      // Unknown unicast - flood in VLAN
      const reachableDevices = this.getVlanReachableDevices(sourceDevice.id, packet.vlanTag || 1);
      return reachableDevices.filter(deviceId => deviceId !== sourceDevice.id);
    }

    return path;
  }

  /**
   * Learn MAC address on switch interfaces
   */
  private learnMacAddress(deviceId: string, macAddress: string, vlanId: number, interfaceId?: string): void {
    const device = this.devices.find(d => d.id === deviceId);
    if (!device || device.type !== DeviceType.SWITCH) {
      return;
    }

    if (!this.macTables.has(deviceId)) {
      this.macTables.set(deviceId, new Map());
    }

    const macTable = this.macTables.get(deviceId)!;
    const entry: EnhancedMacEntry = {
      macAddress,
      vlanId,
      interface: interfaceId || 'unknown',
      type: 'dynamic',
      age: 0,
      learnedFrom: interfaceId || 'unknown',
      timestamp: new Date(),
      isStatic: false,
    };

    macTable.set(macAddress, entry);
  }

  /**
   * Get devices reachable in the same VLAN
   */
  private getVlanReachableDevices(sourceDeviceId: string, vlanId: number): string[] {
    const reachable = new Set<string>();
    const queue = [sourceDeviceId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const currentDevice = queue.shift()!;
      if (visited.has(currentDevice)) {
        continue;
      }
      visited.add(currentDevice);
      reachable.add(currentDevice);

      // Find connected devices that support this VLAN
      this.connections.forEach(conn => {
        let nextDevice: string | undefined;
        
        if (conn.sourceDevice === currentDevice) {
          nextDevice = conn.targetDevice;
        } else if (conn.targetDevice === currentDevice) {
          nextDevice = conn.sourceDevice;
        }

        if (nextDevice && !visited.has(nextDevice)) {
          if (this.isVlanAllowedOnConnection(conn, vlanId)) {
            queue.push(nextDevice);
          }
        }
      });
    }

    return Array.from(reachable);
  }

  /**
   * Check if VLAN is allowed on a connection
   */
  private isVlanAllowedOnConnection(connection: Connection, vlanId: number): boolean {
    const sourceDevice = this.devices.find(d => d.id === connection.sourceDevice);
    const targetDevice = this.devices.find(d => d.id === connection.targetDevice);

    if (!sourceDevice || !targetDevice) {
      return false;
    }

    // Helper to check a switch interface allows a VLAN
    const switchInterfaceAllowsVlan = (sw: SwitchDevice, ifaceId: string | undefined, vlanId: number): boolean => {
      if (!ifaceId) return false;
      const iface = sw.interfaces.find(i => i.id === ifaceId);
      if (!iface || !iface.vlanConfig) return false;
      if (iface.type === InterfaceType.ACCESS) {
        return iface.vlanConfig.accessVlan === vlanId;
      }
      if (iface.type === InterfaceType.TRUNK) {
        const allowed = iface.vlanConfig.allowedVlans || [];
        return allowed.includes(vlanId);
      }
      return false;
    };

    // Switch-to-switch: both sides must allow VLAN
    if (sourceDevice.type === DeviceType.SWITCH && targetDevice.type === DeviceType.SWITCH) {
      const sw1 = sourceDevice as SwitchDevice;
      const sw2 = targetDevice as SwitchDevice;
      const sw1If = connection.sourceDevice === sw1.id ? connection.sourceInterface : connection.targetInterface;
      const sw2If = connection.sourceDevice === sw2.id ? connection.sourceInterface : connection.targetInterface;
      return switchInterfaceAllowsVlan(sw1, sw1If, vlanId) && switchInterfaceAllowsVlan(sw2, sw2If, vlanId);
    }

    // Switch-to-host: the switch-side interface must allow VLAN
    if (sourceDevice.type === DeviceType.SWITCH || targetDevice.type === DeviceType.SWITCH) {
      const sw = (sourceDevice.type === DeviceType.SWITCH ? sourceDevice : targetDevice) as SwitchDevice;
      const swIf = sw.id === connection.sourceDevice ? connection.sourceInterface : connection.targetInterface;
      return switchInterfaceAllowsVlan(sw, swIf, vlanId);
    }

    // Host-to-host: VLAN not applicable at L2 in this model
    return true;
  }

  /**
   * Lookup MAC address in forwarding tables
   */
  private lookupMacForwarding(macAddress: string, sourceDeviceId: string, vlanId: number): string[] {
    // Map MAC to device (end-hosts own MACs). If found, use VLAN-aware path.
    const targetDevice = this.devices.find(d => this.getDeviceMacAddress(d).toLowerCase() === macAddress.toLowerCase());
    if (targetDevice) {
      return this.findVlanAwarePath(sourceDeviceId, targetDevice.id, vlanId);
    }
    return [];
  }


  /**
   * Age out old MAC and ARP entries
   */
  private ageOutEntries(): void {
    const now = Date.now();

    // Age out MAC entries
    this.macTables.forEach((macTable) => {
      const toRemove: string[] = [];
      
      macTable.forEach((entry, macAddress) => {
        if (!entry.isStatic && now - entry.timestamp.getTime() > this.MAC_AGING_TIME) {
          toRemove.push(macAddress);
        }
      });
      
      toRemove.forEach(mac => macTable.delete(mac));
    });

    // Age out ARP entries
    this.arpTables.forEach((arpTable) => {
      const toRemove: string[] = [];
      
      arpTable.forEach((entry, ipAddress) => {
        if (!entry.isStatic && now - entry.timestamp.getTime() > this.ARP_AGING_TIME) {
          toRemove.push(ipAddress);
        }
      });
      
      toRemove.forEach(ip => arpTable.delete(ip));
    });
  }

  /**
   * Statistics management
   */
  private createEmptyStats(): SimulationStats {
    return {
      totalPackets: 0,
      deliveredPackets: 0,
      droppedPackets: 0,
      averageLatency: 0,
      throughput: 0,
      utilizationByDevice: {},
      utilizationByVlan: {},
    };
  }

  private updateStatistics(packet: SimulatedPacket, event: 'created' | 'transmitted' | 'delivered' | 'dropped'): void {
    switch (event) {
      case 'created':
        this.statistics.totalPackets++;
        break;
      case 'delivered':
        this.statistics.deliveredPackets++;
        this.updateLatencyStats(packet);
        break;
      case 'dropped':
        this.statistics.droppedPackets++;
        break;
    }

    // Update throughput (simplified calculation)
    const runningTime = (Date.now() - this.startTime.getTime()) / 1000;
    if (runningTime > 0) {
      const totalBits = this.statistics.deliveredPackets * 64 * 8; // Assume average 64 bytes per packet
      this.statistics.throughput = totalBits / runningTime;
    }
  }

  private updateLatencyStats(packet: SimulatedPacket): void {
    const currentLatency = packet.delay;
    const totalPackets = this.statistics.deliveredPackets;
    
    // Running average calculation
    this.statistics.averageLatency = 
      ((this.statistics.averageLatency * (totalPackets - 1)) + currentLatency) / totalPackets;
  }

  private updateDeviceUtilization(deviceId: string, packetSize: number): void {
    if (!this.statistics.utilizationByDevice[deviceId]) {
      this.statistics.utilizationByDevice[deviceId] = 0;
    }
    this.statistics.utilizationByDevice[deviceId] += packetSize;
  }

  private updateVlanUtilization(vlanId: number, packetSize: number): void {
    if (!this.statistics.utilizationByVlan[vlanId]) {
      this.statistics.utilizationByVlan[vlanId] = 0;
    }
    this.statistics.utilizationByVlan[vlanId] += packetSize;
  }
}

/**
 * Factory function to create simulation engine
 */
export const createSimulationEngine = (
  devices: NetworkDevice[],
  connections: Connection[],
  vlans: Vlan[]
): SimulationEngine => {
  return new SimulationEngine(devices, connections, vlans);
};