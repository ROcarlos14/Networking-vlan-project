import { Device, Connection } from '../../types';

/**
 * ARP Table Entry
 */
export interface ArpEntry {
  ipAddress: string;
  macAddress: string;
  interface: string;
  ageTime: number;
  isStatic: boolean;
  expiresAt: number;
}

/**
 * MAC Address Table Entry (for switches)
 */
export interface MacEntry {
  macAddress: string;
  vlanId: number;
  interface: string;
  ageTime: number;
  learnedTime: number;
  expiresAt: number;
  isStatic: boolean;
}

/**
 * ARP Request/Reply Packet
 */
export interface ArpPacket {
  type: 'request' | 'reply';
  senderIp: string;
  senderMac: string;
  targetIp: string;
  targetMac: string;
  vlanId: number;
  sourceInterface?: string;
  timestamp: number;
}

/**
 * ARP and MAC Learning Engine
 */
export class ArpEngine {
  private arpTables = new Map<string, Map<string, ArpEntry>>(); // deviceId -> (ip -> entry)
  private macTables = new Map<string, Map<string, MacEntry>>(); // switchId -> (mac -> entry)
  
  // Configuration constants
  private readonly ARP_TIMEOUT = 300000; // 5 minutes
  private readonly MAC_AGING_TIME = 300000; // 5 minutes
  private readonly MAX_ARP_ENTRIES = 1000;
  private readonly MAX_MAC_ENTRIES = 8192;

  /**
   * Initialize ARP table for a device
   */
  initializeArpTable(deviceId: string): void {
    if (!this.arpTables.has(deviceId)) {
      this.arpTables.set(deviceId, new Map());
    }
  }

  /**
   * Initialize MAC address table for a switch
   */
  initializeMacTable(switchId: string): void {
    if (!this.macTables.has(switchId)) {
      this.macTables.set(switchId, new Map());
    }
  }

  /**
   * Add static ARP entry
   */
  addStaticArpEntry(deviceId: string, ipAddress: string, macAddress: string, interfaceName: string): void {
    this.initializeArpTable(deviceId);
    const table = this.arpTables.get(deviceId)!;
    
    table.set(ipAddress, {
      ipAddress,
      macAddress,
      interface: interfaceName,
      ageTime: 0,
      isStatic: true,
      expiresAt: 0 // Static entries don't expire
    });
  }

  /**
   * Add dynamic ARP entry (learned from ARP reply)
   */
  addDynamicArpEntry(deviceId: string, ipAddress: string, macAddress: string, interfaceName: string): void {
    this.initializeArpTable(deviceId);
    const table = this.arpTables.get(deviceId)!;
    
    // Check table size limit
    if (table.size >= this.MAX_ARP_ENTRIES && !table.has(ipAddress)) {
      this.cleanupArpTable(deviceId);
    }
    
    const now = Date.now();
    table.set(ipAddress, {
      ipAddress,
      macAddress,
      interface: interfaceName,
      ageTime: now,
      isStatic: false,
      expiresAt: now + this.ARP_TIMEOUT
    });
  }

  /**
   * Look up MAC address for IP in ARP table
   */
  lookupArpEntry(deviceId: string, ipAddress: string): ArpEntry | null {
    const table = this.arpTables.get(deviceId);
    if (!table) return null;
    
    const entry = table.get(ipAddress);
    if (!entry) return null;
    
    // Check if entry has expired
    if (!entry.isStatic && Date.now() > entry.expiresAt) {
      table.delete(ipAddress);
      return null;
    }
    
    return entry;
  }

  /**
   * Learn MAC address on switch port
   */
  learnMacAddress(
    switchId: string, 
    macAddress: string, 
    vlanId: number, 
    interfaceName: string, 
    isStatic = false
  ): void {
    this.initializeMacTable(switchId);
    const table = this.macTables.get(switchId)!;
    
    // Check if MAC is already learned on different interface
    const existingEntry = table.get(macAddress);
    if (existingEntry && existingEntry.interface !== interfaceName) {
      // MAC has moved to different port - update entry
      table.delete(macAddress);
    }
    
    // Check table size limit
    if (table.size >= this.MAX_MAC_ENTRIES && !table.has(macAddress)) {
      this.cleanupMacTable(switchId);
    }
    
    const now = Date.now();
    table.set(macAddress, {
      macAddress,
      vlanId,
      interface: interfaceName,
      ageTime: now,
      learnedTime: now,
      expiresAt: isStatic ? 0 : now + this.MAC_AGING_TIME,
      isStatic
    });
  }

  /**
   * Look up interface for MAC address in switch
   */
  lookupMacEntry(switchId: string, macAddress: string, vlanId: number): MacEntry | null {
    const table = this.macTables.get(switchId);
    if (!table) return null;
    
    const entry = table.get(macAddress);
    if (!entry || entry.vlanId !== vlanId) return null;
    
    // Check if entry has expired
    if (!entry.isStatic && Date.now() > entry.expiresAt) {
      table.delete(macAddress);
      return null;
    }
    
    return entry;
  }

  /**
   * Generate ARP request
   */
  createArpRequest(
    senderIp: string, 
    senderMac: string, 
    targetIp: string, 
    vlanId: number,
    sourceInterface?: string
  ): ArpPacket {
    return {
      type: 'request',
      senderIp,
      senderMac,
      targetIp,
      targetMac: '00:00:00:00:00:00', // Unknown in request
      vlanId,
      sourceInterface,
      timestamp: Date.now()
    };
  }

  /**
   * Generate ARP reply
   */
  createArpReply(
    request: ArpPacket, 
    replyIp: string, 
    replyMac: string
  ): ArpPacket {
    return {
      type: 'reply',
      senderIp: replyIp,
      senderMac: replyMac,
      targetIp: request.senderIp,
      targetMac: request.senderMac,
      vlanId: request.vlanId,
      timestamp: Date.now()
    };
  }

  /**
   * Process ARP packet on device
   */
  processArpPacket(deviceId: string, packet: ArpPacket, receivedInterface: string): ArpPacket | null {
    const device = this.getDeviceById(deviceId);
    if (!device) return null;
    
    // Learn sender's MAC-IP mapping
    this.addDynamicArpEntry(deviceId, packet.senderIp, packet.senderMac, receivedInterface);
    
    if (packet.type === 'request') {
      // Check if we are the target
      const deviceIp = this.getDeviceIpAddress(device);
      if (deviceIp === packet.targetIp) {
        // Generate ARP reply
        const deviceMac = this.getDeviceMacAddress(device);
        return this.createArpReply(packet, deviceIp, deviceMac);
      }
    } else if (packet.type === 'reply') {
      // Learn target's MAC-IP mapping
      this.addDynamicArpEntry(deviceId, packet.targetIp, packet.targetMac, receivedInterface);
    }
    
    return null;
  }

  /**
   * Process frame for MAC learning on switch
   */
  processFrameForMacLearning(
    switchId: string, 
    sourceMac: string, 
    vlanId: number, 
    ingressInterface: string
  ): void {
    // Learn source MAC address
    this.learnMacAddress(switchId, sourceMac, vlanId, ingressInterface);
  }

  /**
   * Determine forwarding decision for switch
   */
  getForwardingDecision(
    switchId: string, 
    destinationMac: string, 
    vlanId: number,
    ingressInterface: string,
    connections: Connection[]
  ): { action: 'forward' | 'flood' | 'drop', interfaces: string[] } {
    
    // Check for broadcast/multicast
    if (this.isBroadcastMac(destinationMac) || this.isMulticastMac(destinationMac)) {
      return {
        action: 'flood',
        interfaces: this.getVlanInterfaces(switchId, vlanId, connections, ingressInterface)
      };
    }
    
    // Lookup destination MAC
    const macEntry = this.lookupMacEntry(switchId, destinationMac, vlanId);
    
    if (macEntry) {
      // Check if destination is on same interface as source (no forwarding needed)
      if (macEntry.interface === ingressInterface) {
        return { action: 'drop', interfaces: [] };
      }
      
      return {
        action: 'forward',
        interfaces: [macEntry.interface]
      };
    } else {
      // Unknown unicast - flood in VLAN
      return {
        action: 'flood',
        interfaces: this.getVlanInterfaces(switchId, vlanId, connections, ingressInterface)
      };
    }
  }

  /**
   * Get all ARP entries for a device
   */
  getArpTable(deviceId: string): ArpEntry[] {
    const table = this.arpTables.get(deviceId);
    if (!table) return [];
    
    const now = Date.now();
    const entries: ArpEntry[] = [];
    
    for (const [ip, entry] of table.entries()) {
      if (entry.isStatic || now <= entry.expiresAt) {
        entries.push({
          ...entry,
          ageTime: entry.isStatic ? 0 : Math.floor((now - entry.ageTime) / 1000)
        });
      } else {
        // Remove expired entry
        table.delete(ip);
      }
    }
    
    return entries.sort((a, b) => a.ipAddress.localeCompare(b.ipAddress));
  }

  /**
   * Get all MAC entries for a switch
   */
  getMacTable(switchId: string): MacEntry[] {
    const table = this.macTables.get(switchId);
    if (!table) return [];
    
    const now = Date.now();
    const entries: MacEntry[] = [];
    
    for (const [mac, entry] of table.entries()) {
      if (entry.isStatic || now <= entry.expiresAt) {
        entries.push({
          ...entry,
          ageTime: entry.isStatic ? 0 : Math.floor((now - entry.learnedTime) / 1000)
        });
      } else {
        // Remove expired entry
        table.delete(mac);
      }
    }
    
    return entries.sort((a, b) => a.macAddress.localeCompare(b.macAddress));
  }

  /**
   * Clear ARP table for device
   */
  clearArpTable(deviceId: string, includeStatic = false): void {
    const table = this.arpTables.get(deviceId);
    if (!table) return;
    
    if (includeStatic) {
      table.clear();
    } else {
      for (const [ip, entry] of table.entries()) {
        if (!entry.isStatic) {
          table.delete(ip);
        }
      }
    }
  }

  /**
   * Clear MAC table for switch
   */
  clearMacTable(switchId: string, includeStatic = false): void {
    const table = this.macTables.get(switchId);
    if (!table) return;
    
    if (includeStatic) {
      table.clear();
    } else {
      for (const [mac, entry] of table.entries()) {
        if (!entry.isStatic) {
          table.delete(mac);
        }
      }
    }
  }

  // Private helper methods
  private cleanupArpTable(deviceId: string): void {
    const table = this.arpTables.get(deviceId);
    if (!table) return;
    
    const now = Date.now();
    const toDelete: string[] = [];
    
    for (const [ip, entry] of table.entries()) {
      if (!entry.isStatic && now > entry.expiresAt) {
        toDelete.push(ip);
      }
    }
    
    toDelete.forEach(ip => table.delete(ip));
  }

  private cleanupMacTable(switchId: string): void {
    const table = this.macTables.get(switchId);
    if (!table) return;
    
    const now = Date.now();
    const toDelete: string[] = [];
    
    for (const [mac, entry] of table.entries()) {
      if (!entry.isStatic && now > entry.expiresAt) {
        toDelete.push(mac);
      }
    }
    
    toDelete.forEach(mac => table.delete(mac));
  }

  private isBroadcastMac(mac: string): boolean {
    return mac.toLowerCase() === 'ff:ff:ff:ff:ff:ff';
  }

  private isMulticastMac(mac: string): boolean {
    const firstOctet = parseInt(mac.split(':')[0], 16);
    return (firstOctet & 0x01) === 0x01;
  }

  private getVlanInterfaces(
    switchId: string, 
    vlanId: number, 
    connections: Connection[], 
    excludeInterface?: string
  ): string[] {
    // This would need to be implemented based on your VLAN configuration
    // For now, return all interfaces except the ingress one
    const interfaces = connections
      .filter(conn => conn.from === switchId || conn.to === switchId)
      .map(conn => conn.from === switchId ? conn.fromInterface : conn.toInterface)
      .filter(iface => iface !== excludeInterface);
    
    return interfaces;
  }

  private getDeviceById(deviceId: string): Device | null {
    // This would need to access your device store
    // For now, return null - implement based on your store structure
    return null;
  }

  private getDeviceIpAddress(device: Device): string {
    // Extract IP address from device configuration
    return device.config?.ipAddress || '';
  }

  private getDeviceMacAddress(device: Device): string {
    // Extract MAC address from device configuration
    return device.config?.macAddress || this.generateMacAddress(device.id);
  }

  private generateMacAddress(deviceId: string): string {
    // Generate a MAC address based on device ID
    const hash = this.simpleHash(deviceId);
    const mac = [];
    for (let i = 0; i < 6; i++) {
      mac.push(((hash >> (i * 8)) & 0xFF).toString(16).padStart(2, '0'));
    }
    return mac.join(':');
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
}

// Export singleton instance
export const arpEngine = new ArpEngine();