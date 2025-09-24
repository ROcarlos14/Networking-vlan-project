import { Device, Connection } from '../../types';

/**
 * Packet Types
 */
export enum PacketType {
  ETHERNET = 'ethernet',
  IP = 'ip',
  ARP = 'arp',
  ICMP = 'icmp',
  TCP = 'tcp',
  UDP = 'udp',
  DHCP = 'dhcp',
  STP = 'stp',
  VTP = 'vtp',
  DTP = 'dtp',
  LLDP = 'lldp'
}

/**
 * QoS Classes
 */
export enum QosClass {
  BEST_EFFORT = 'best-effort',
  BRONZE = 'bronze',
  SILVER = 'silver',
  GOLD = 'gold',
  VOICE = 'voice',
  VIDEO = 'video',
  CRITICAL = 'critical',
  NETWORK_CONTROL = 'network-control'
}

/**
 * Packet Header Information
 */
export interface PacketHeader {
  // Layer 2 (Ethernet)
  srcMac: string;
  dstMac: string;
  vlanId?: number;
  etherType: number;
  
  // Layer 3 (IP)
  srcIp?: string;
  dstIp?: string;
  protocol?: number;
  ttl?: number;
  dscp?: number; // Differentiated Services Code Point
  ecn?: number;  // Explicit Congestion Notification
  
  // Layer 4 (TCP/UDP)
  srcPort?: number;
  dstPort?: number;
  tcpFlags?: number;
  
  // QoS
  qosClass: QosClass;
  priority: number; // 0-7
  dropPrecedence: number; // 0-2
}

/**
 * Packet Structure
 */
export interface Packet {
  id: string;
  type: PacketType;
  header: PacketHeader;
  payload: any;
  size: number; // bytes
  timestamp: number;
  sourceDeviceId: string;
  targetDeviceId?: string;
  path: string[]; // Device IDs in packet path
  hopCount: number;
  
  // Processing metadata
  ingressInterface?: string;
  egressInterface?: string;
  processingDelay: number;
  queuingDelay: number;
  transmissionDelay: number;
  errors: string[];
}

/**
 * Traffic Shaper Configuration
 */
export interface TrafficShaperConfig {
  enabled: boolean;
  algorithm: 'token-bucket' | 'leaky-bucket' | 'priority-queue';
  bandwidth: number; // bps
  burstSize?: number; // bytes
  queues: QueueConfig[];
}

/**
 * Queue Configuration
 */
export interface QueueConfig {
  name: string;
  qosClass: QosClass;
  bandwidth: number; // percentage of total bandwidth
  maxSize: number; // packets
  dropPolicy: 'tail-drop' | 'random-drop' | 'weighted-red';
  priority: number; // 0-7, higher is better
  currentSize: number;
  packetsDropped: number;
  packetsTransmitted: number;
}

/**
 * Access Control List Entry
 */
export interface AclEntry {
  id: string;
  sequenceNumber: number;
  action: 'permit' | 'deny';
  protocol?: string | number;
  srcNetwork?: string; // CIDR notation
  dstNetwork?: string; // CIDR notation
  srcPort?: number | { min: number, max: number };
  dstPort?: number | { min: number, max: number };
  dscp?: number;
  established?: boolean; // TCP established connections only
  logMatches?: boolean;
}

/**
 * Access Control List
 */
export interface AccessControlList {
  name: string;
  type: 'standard' | 'extended';
  entries: AclEntry[];
  hitCounts: Map<string, number>; // entryId -> hit count
}

/**
 * Interface Statistics
 */
export interface InterfaceStats {
  interfaceName: string;
  packetsIn: number;
  packetsOut: number;
  bytesIn: number;
  bytesOut: number;
  errorsIn: number;
  errorsOut: number;
  dropsIn: number;
  dropsOut: number;
  utilization: number; // percentage
  lastUpdated: number;
}

/**
 * Device Processing Capabilities
 */
export interface ProcessingCapabilities {
  packetsPerSecond: number;
  backplaneSpeed: number; // Gbps
  bufferSize: number; // MB
  maxMacEntries: number;
  maxArpEntries: number;
  maxRoutingEntries: number;
  supportsQos: boolean;
  supportsAcl: boolean;
  supportsStp: boolean;
  supportsVtp: boolean;
  switchingLatency: number; // microseconds
  routingLatency: number; // microseconds
}

/**
 * Enhanced Packet Processing Engine
 */
export class PacketProcessingEngine {
  private deviceCapabilities = new Map<string, ProcessingCapabilities>();
  private trafficShapers = new Map<string, Map<string, TrafficShaperConfig>>(); // deviceId -> interface -> config
  private accessLists = new Map<string, Map<string, AccessControlList>>(); // deviceId -> aclName -> acl
  private interfaceStats = new Map<string, Map<string, InterfaceStats>>(); // deviceId -> interface -> stats
  private packetQueues = new Map<string, Map<string, Packet[]>>(); // deviceId -> interface -> packets
  
  // Performance counters
  private packetCounters = {
    totalProcessed: 0,
    totalDropped: 0,
    totalForwarded: 0,
    qosViolations: 0,
    aclDenials: 0,
    bufferOverflows: 0
  };

  /**
   * Initialize device processing capabilities
   */
  initializeDevice(deviceId: string, capabilities: ProcessingCapabilities): void {
    this.deviceCapabilities.set(deviceId, capabilities);
    this.trafficShapers.set(deviceId, new Map());
    this.accessLists.set(deviceId, new Map());
    this.interfaceStats.set(deviceId, new Map());
    this.packetQueues.set(deviceId, new Map());
  }

  /**
   * Configure traffic shaper for interface
   */
  configureTrafficShaper(
    deviceId: string, 
    interfaceName: string, 
    config: TrafficShaperConfig
  ): boolean {
    const deviceShapers = this.trafficShapers.get(deviceId);
    if (!deviceShapers) return false;
    
    // Initialize queues
    config.queues.forEach(queue => {
      queue.currentSize = 0;
      queue.packetsDropped = 0;
      queue.packetsTransmitted = 0;
    });
    
    deviceShapers.set(interfaceName, config);
    return true;
  }

  /**
   * Configure Access Control List
   */
  configureAcl(deviceId: string, acl: AccessControlList): boolean {
    const deviceAcls = this.accessLists.get(deviceId);
    if (!deviceAcls) return false;
    
    // Sort entries by sequence number
    acl.entries.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    
    // Initialize hit counts
    acl.hitCounts = new Map();
    acl.entries.forEach(entry => acl.hitCounts.set(entry.id, 0));
    
    deviceAcls.set(acl.name, acl);
    return true;
  }

  /**
   * Process packet through device
   */
  async processPacket(
    deviceId: string, 
    packet: Packet, 
    ingressInterface: string,
    connections: Connection[]
  ): Promise<{ forwarded: Packet[], dropped: boolean, errors: string[] }> {
    const startTime = performance.now();
    const capabilities = this.deviceCapabilities.get(deviceId);
    
    if (!capabilities) {
      return { forwarded: [], dropped: true, errors: ['Device not initialized'] };
    }
    
    packet.ingressInterface = ingressInterface;
    packet.errors = [];
    
    try {
      // 1. Update interface statistics
      this.updateIngressStats(deviceId, ingressInterface, packet);
      
      // 2. Check device buffer capacity
      if (!this.checkBufferCapacity(deviceId, packet)) {
        this.packetCounters.bufferOverflows++;
        return { forwarded: [], dropped: true, errors: ['Buffer overflow'] };
      }
      
      // 3. Apply input ACL filtering
      const aclResult = this.applyIngressAcl(deviceId, ingressInterface, packet);
      if (!aclResult.permitted) {
        this.packetCounters.aclDenials++;
        return { forwarded: [], dropped: true, errors: ['Denied by ACL'] };
      }
      
      // 4. Classify packet for QoS
      this.classifyPacket(packet);
      
      // 5. Make forwarding decision
      const forwardingDecision = await this.makeForwardingDecision(
        deviceId, packet, connections
      );
      
      if (forwardingDecision.action === 'drop') {
        this.packetCounters.totalDropped++;
        return { forwarded: [], dropped: true, errors: forwardingDecision.errors || [] };
      }
      
      // 6. Process for each egress interface
      const forwardedPackets: Packet[] = [];
      
      for (const egressInterface of forwardingDecision.interfaces) {
        // Create copy for this interface
        const forwardedPacket = { ...packet };
        forwardedPacket.id = `${packet.id}-${egressInterface}`;
        forwardedPacket.egressInterface = egressInterface;
        
        // Apply egress ACL
        const egressAclResult = this.applyEgressAcl(deviceId, egressInterface, forwardedPacket);
        if (!egressAclResult.permitted) {
          continue; // Skip this interface
        }
        
        // Apply traffic shaping and queuing
        const queuingResult = await this.applyTrafficShaping(
          deviceId, egressInterface, forwardedPacket
        );
        
        if (queuingResult.queued) {
          // Calculate processing delays
          const processingTime = performance.now() - startTime;
          forwardedPacket.processingDelay = this.calculateProcessingDelay(
            capabilities, packet.type
          );
          forwardedPacket.queuingDelay = queuingResult.delay;
          forwardedPacket.transmissionDelay = this.calculateTransmissionDelay(
            packet.size, this.getInterfaceBandwidth(deviceId, egressInterface)
          );
          
          // Update packet path
          forwardedPacket.path.push(deviceId);
          forwardedPacket.hopCount++;
          
          forwardedPackets.push(forwardedPacket);
        }
        
        // Update interface statistics
        this.updateEgressStats(deviceId, egressInterface, forwardedPacket);
      }
      
      this.packetCounters.totalProcessed++;
      this.packetCounters.totalForwarded += forwardedPackets.length;
      
      return {
        forwarded: forwardedPackets,
        dropped: forwardedPackets.length === 0,
        errors: packet.errors
      };
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown processing error';
      return { forwarded: [], dropped: true, errors: [errorMsg] };
    }
  }

  /**
   * Classify packet for QoS treatment
   */
  private classifyPacket(packet: Packet): void {
    // Default classification based on packet type and DSCP
    if (packet.header.dscp !== undefined) {
      // Use DSCP marking
      const dscp = packet.header.dscp;
      if (dscp >= 46) packet.header.qosClass = QosClass.VOICE;
      else if (dscp >= 34) packet.header.qosClass = QosClass.VIDEO;
      else if (dscp >= 26) packet.header.qosClass = QosClass.CRITICAL;
      else if (dscp >= 18) packet.header.qosClass = QosClass.GOLD;
      else if (dscp >= 10) packet.header.qosClass = QosClass.SILVER;
      else if (dscp >= 2) packet.header.qosClass = QosClass.BRONZE;
      else packet.header.qosClass = QosClass.BEST_EFFORT;
    } else {
      // Classify based on protocol and ports
      switch (packet.type) {
        case PacketType.STP:
        case PacketType.VTP:
        case PacketType.DTP:
        case PacketType.LLDP:
          packet.header.qosClass = QosClass.NETWORK_CONTROL;
          packet.header.priority = 7;
          break;
          
        case PacketType.DHCP:
          packet.header.qosClass = QosClass.CRITICAL;
          packet.header.priority = 6;
          break;
          
        case PacketType.ARP:
          packet.header.qosClass = QosClass.CRITICAL;
          packet.header.priority = 5;
          break;
          
        default:
          // Check for voice/video based on ports
          if (packet.header.srcPort || packet.header.dstPort) {
            const port = packet.header.srcPort || packet.header.dstPort || 0;
            if (this.isVoicePort(port)) {
              packet.header.qosClass = QosClass.VOICE;
              packet.header.priority = 5;
            } else if (this.isVideoPort(port)) {
              packet.header.qosClass = QosClass.VIDEO;
              packet.header.priority = 4;
            } else {
              packet.header.qosClass = QosClass.BEST_EFFORT;
              packet.header.priority = 0;
            }
          } else {
            packet.header.qosClass = QosClass.BEST_EFFORT;
            packet.header.priority = 0;
          }
      }
    }
  }

  /**
   * Make forwarding decision based on device type and packet
   */
  private async makeForwardingDecision(
    deviceId: string, 
    packet: Packet,
    connections: Connection[]
  ): Promise<{ action: 'forward' | 'drop' | 'flood', interfaces: string[], errors?: string[] }> {
    
    const device = this.getDeviceById(deviceId);
    if (!device) {
      return { action: 'drop', interfaces: [], errors: ['Device not found'] };
    }
    
    // Decrement TTL for IP packets at Layer 3 devices
    if (packet.header.ttl && device.type === 'router') {
      packet.header.ttl--;
      if (packet.header.ttl <= 0) {
        return { action: 'drop', interfaces: [], errors: ['TTL expired'] };
      }
    }
    
    switch (device.type) {
      case 'switch':
        return this.makeSwitchForwardingDecision(deviceId, packet, connections);
        
      case 'router':
        return this.makeRouterForwardingDecision(deviceId, packet, connections);
        
      case 'pc':
      case 'server':
        return this.makeHostForwardingDecision(deviceId, packet, connections);
        
      default:
        return { action: 'drop', interfaces: [], errors: ['Unknown device type'] };
    }
  }

  /**
   * Switch forwarding decision (Layer 2)
   */
  private makeSwitchForwardingDecision(
    switchId: string, 
    packet: Packet,
    connections: Connection[]
  ): { action: 'forward' | 'drop' | 'flood', interfaces: string[] } {
    
    // Check for broadcast/multicast
    if (this.isBroadcastMac(packet.header.dstMac) || this.isMulticastMac(packet.header.dstMac)) {
      const floodInterfaces = this.getVlanInterfaces(
        switchId, packet.header.vlanId || 1, connections, packet.ingressInterface
      );
      return { action: 'flood', interfaces: floodInterfaces };
    }
    
    // Look up destination MAC in forwarding table
    const forwardingInterface = this.lookupMacAddress(
      switchId, packet.header.dstMac, packet.header.vlanId || 1
    );
    
    if (forwardingInterface) {
      // Known unicast
      if (forwardingInterface === packet.ingressInterface) {
        // Destination is on same interface - drop
        return { action: 'drop', interfaces: [] };
      }
      return { action: 'forward', interfaces: [forwardingInterface] };
    } else {
      // Unknown unicast - flood
      const floodInterfaces = this.getVlanInterfaces(
        switchId, packet.header.vlanId || 1, connections, packet.ingressInterface
      );
      return { action: 'flood', interfaces: floodInterfaces };
    }
  }

  /**
   * Router forwarding decision (Layer 3)
   */
  private makeRouterForwardingDecision(
    routerId: string, 
    packet: Packet,
    connections: Connection[]
  ): { action: 'forward' | 'drop' | 'flood', interfaces: string[], errors?: string[] } {
    
    if (!packet.header.dstIp) {
      return { action: 'drop', interfaces: [], errors: ['No destination IP'] };
    }
    
    // Look up destination in routing table
    const nextHop = this.lookupRoute(routerId, packet.header.dstIp);
    
    if (!nextHop) {
      return { action: 'drop', interfaces: [], errors: ['No route to destination'] };
    }
    
    // Check if destination is directly connected
    if (nextHop.interface) {
      return { action: 'forward', interfaces: [nextHop.interface] };
    }
    
    return { action: 'drop', interfaces: [], errors: ['Route lookup failed'] };
  }

  /**
   * Host forwarding decision (send to default gateway)
   */
  private makeHostForwardingDecision(
    hostId: string, 
    packet: Packet,
    connections: Connection[]
  ): { action: 'forward' | 'drop' | 'flood', interfaces: string[] } {
    
    // Hosts typically have only one interface - send to all connected interfaces
    const interfaces = connections
      .filter(conn => conn.from === hostId || conn.to === hostId)
      .map(conn => (conn.from === hostId ? conn.fromInterface : conn.toInterface))
      .filter((iface): iface is string => !!iface);
    
    return { action: 'forward', interfaces };
  }

  /**
   * Apply ingress Access Control List
   */
  private applyIngressAcl(
    deviceId: string, 
    interfaceName: string, 
    packet: Packet
  ): { permitted: boolean, matchedRule?: string } {
    
    // Get interface ACL (simplified - would need interface configuration)
    const deviceAcls = this.accessLists.get(deviceId);
    if (!deviceAcls || deviceAcls.size === 0) {
      return { permitted: true }; // No ACL configured
    }
    
    // Apply first ACL found (in real implementation, would be configured per interface)
    const acl = Array.from(deviceAcls.values())[0];
    
    return this.evaluateAcl(acl, packet);
  }

  /**
   * Apply egress Access Control List
   */
  private applyEgressAcl(
    deviceId: string, 
    interfaceName: string, 
    packet: Packet
  ): { permitted: boolean, matchedRule?: string } {
    
    // Similar to ingress ACL but for egress traffic
    return this.applyIngressAcl(deviceId, interfaceName, packet);
  }

  /**
   * Evaluate packet against ACL
   */
  private evaluateAcl(
    acl: AccessControlList, 
    packet: Packet
  ): { permitted: boolean, matchedRule?: string } {
    
    for (const entry of acl.entries) {
      if (this.matchesAclEntry(entry, packet)) {
        // Update hit count
        const currentCount = acl.hitCounts.get(entry.id) || 0;
        acl.hitCounts.set(entry.id, currentCount + 1);
        
        return {
          permitted: entry.action === 'permit',
          matchedRule: entry.id
        };
      }
    }
    
    // Default deny if no match (implicit deny)
    return { permitted: false, matchedRule: 'implicit-deny' };
  }

  /**
   * Check if packet matches ACL entry
   */
  private matchesAclEntry(entry: AclEntry, packet: Packet): boolean {
    // Protocol match
    if (entry.protocol !== undefined) {
      if (typeof entry.protocol === 'number') {
        if (packet.header.protocol !== entry.protocol) return false;
      } else {
        // Named protocol matching would be implemented here
      }
    }
    
    // Source/destination network match
    if (entry.srcNetwork && packet.header.srcIp) {
      if (!this.ipMatchesNetwork(packet.header.srcIp, entry.srcNetwork)) return false;
    }
    
    if (entry.dstNetwork && packet.header.dstIp) {
      if (!this.ipMatchesNetwork(packet.header.dstIp, entry.dstNetwork)) return false;
    }
    
    // Port matching
    if (entry.srcPort && packet.header.srcPort) {
      if (!this.portMatches(packet.header.srcPort, entry.srcPort)) return false;
    }
    
    if (entry.dstPort && packet.header.dstPort) {
      if (!this.portMatches(packet.header.dstPort, entry.dstPort)) return false;
    }
    
    // DSCP match
    if (entry.dscp !== undefined && packet.header.dscp !== entry.dscp) {
      return false;
    }
    
    // Established connection check (TCP)
    if (entry.established && packet.type === PacketType.TCP) {
      // Check if ACK bit is set (simplified)
      if (!packet.header.tcpFlags || !(packet.header.tcpFlags & 0x10)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Apply traffic shaping and queuing
   */
  private async applyTrafficShaping(
    deviceId: string, 
    interfaceName: string, 
    packet: Packet
  ): Promise<{ queued: boolean, delay: number }> {
    
    const deviceShapers = this.trafficShapers.get(deviceId);
    const shaper = deviceShapers?.get(interfaceName);
    
    if (!shaper || !shaper.enabled) {
      return { queued: true, delay: 0 };
    }
    
    // Find appropriate queue for packet
    const queue = this.findQueue(shaper, packet);
    if (!queue) {
      return { queued: false, delay: 0 };
    }
    
    // Check queue capacity
    if (queue.currentSize >= queue.maxSize) {
      // Apply drop policy
      if (this.shouldDropPacket(queue, packet)) {
        queue.packetsDropped++;
        this.packetCounters.qosViolations++;
        return { queued: false, delay: 0 };
      }
    }
    
    // Add to queue
    let deviceQueues = this.packetQueues.get(deviceId);
    if (!deviceQueues) {
      deviceQueues = new Map();
      this.packetQueues.set(deviceId, deviceQueues);
    }
    
    let interfaceQueue = deviceQueues.get(interfaceName);
    if (!interfaceQueue) {
      interfaceQueue = [];
      deviceQueues.set(interfaceName, interfaceQueue);
    }
    
    interfaceQueue.push(packet);
    queue.currentSize++;
    
    // Calculate queuing delay based on current queue size and bandwidth
    const delay = this.calculateQueuingDelay(queue, shaper.bandwidth);
    
    return { queued: true, delay };
  }

  // Utility methods
  private isBroadcastMac(mac: string): boolean {
    return mac.toLowerCase() === 'ff:ff:ff:ff:ff:ff';
  }

  private isMulticastMac(mac: string): boolean {
    const firstOctet = parseInt(mac.split(':')[0], 16);
    return (firstOctet & 0x01) === 0x01;
  }

  private isVoicePort(port: number): boolean {
    // Common voice ports
    return port >= 5060 && port <= 5061 || // SIP
           port === 2000 || // Cisco SCCP
           port >= 16384 && port <= 32767; // RTP range
  }

  private isVideoPort(port: number): boolean {
    // Common video streaming ports
    return port === 554 || // RTSP
           port === 1935 || // RTMP
           port >= 8000 && port <= 8080; // HTTP streaming
  }

  private calculateProcessingDelay(capabilities: ProcessingCapabilities, type: PacketType): number {
    // Base delay based on packet type
    switch (type) {
      case PacketType.ETHERNET:
        return capabilities.switchingLatency / 1000; // Convert to ms
      case PacketType.IP:
        return capabilities.routingLatency / 1000; // Convert to ms
      default:
        return capabilities.switchingLatency / 1000;
    }
  }

  private calculateTransmissionDelay(packetSize: number, bandwidth: number): number {
    // Transmission delay = packet size / bandwidth
    return (packetSize * 8) / bandwidth * 1000; // Convert to ms
  }

  private calculateQueuingDelay(queue: QueueConfig, bandwidth: number): number {
    // Simplified queuing delay calculation
    return (queue.currentSize * 1500 * 8) / (bandwidth * queue.bandwidth / 100) * 1000; // ms
  }

  // Placeholder methods (would be implemented based on your existing systems)
  private getDeviceById(deviceId: string): Device | null { return null; }
  private lookupMacAddress(switchId: string, mac: string, vlanId: number): string | null { return null; }
  private lookupRoute(routerId: string, destIp: string): { interface?: string } | null { return null; }
  private getVlanInterfaces(switchId: string, vlanId: number, connections: Connection[], exclude?: string): string[] { return []; }
  private getInterfaceBandwidth(deviceId: string, interfaceName: string): number { return 1000000000; } // 1 Gbps default
  private checkBufferCapacity(deviceId: string, packet: Packet): boolean { return true; }
  private ipMatchesNetwork(ip: string, network: string): boolean { return true; }
  private portMatches(port: number, match: number | { min: number, max: number }): boolean { return true; }
  private findQueue(shaper: TrafficShaperConfig, packet: Packet): QueueConfig | null { return shaper.queues[0] || null; }
  private shouldDropPacket(queue: QueueConfig, packet: Packet): boolean { return queue.dropPolicy === 'tail-drop'; }
  
  private updateIngressStats(deviceId: string, interfaceName: string, packet: Packet): void {
    // Update interface statistics
  }
  
  private updateEgressStats(deviceId: string, interfaceName: string, packet: Packet): void {
    // Update interface statistics
  }

  /**
   * Get processing statistics
   */
  getProcessingStats() {
    return { ...this.packetCounters };
  }

  /**
   * Get interface statistics
   */
  getInterfaceStats(deviceId: string, interfaceName?: string): InterfaceStats[] {
    const deviceStats = this.interfaceStats.get(deviceId);
    if (!deviceStats) return [];
    
    if (interfaceName) {
      const stats = deviceStats.get(interfaceName);
      return stats ? [stats] : [];
    }
    
    return Array.from(deviceStats.values());
  }

  /**
   * Reset statistics
   */
  resetStats(deviceId?: string): void {
    if (deviceId) {
      const deviceStats = this.interfaceStats.get(deviceId);
      if (deviceStats) {
        deviceStats.clear();
      }
    } else {
      this.interfaceStats.clear();
      this.packetCounters = {
        totalProcessed: 0,
        totalDropped: 0,
        totalForwarded: 0,
        qosViolations: 0,
        aclDenials: 0,
        bufferOverflows: 0
      };
    }
  }
}

// Export singleton instance
export const packetProcessingEngine = new PacketProcessingEngine();