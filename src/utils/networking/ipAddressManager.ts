import {
  NetworkDevice,
  RouterDevice,
  SwitchDevice,
  PcDevice,
  ServerDevice,
  DeviceType,
  NetworkInterface,
  SubnetInfo,
} from '../../types';

/**
 * DHCP Pool configuration
 */
export interface DHCPPool {
  id: string;
  name: string;
  network: string;
  mask: string;
  rangeStart: string;
  rangeEnd: string;
  defaultGateway: string;
  dnsServers: string[];
  leaseTime: number; // in seconds
  isEnabled: boolean;
  excludedAddresses: string[];
}

/**
 * DHCP Lease information
 */
export interface DHCPLease {
  id: string;
  clientMac: string;
  clientId: string; // device ID
  ipAddress: string;
  assignedTime: Date;
  leaseTime: number;
  renewalTime: Date;
  isActive: boolean;
  hostname?: string;
  poolId: string;
}

/**
 * IP Address validation result
 */
export interface IPValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Subnet allocation result
 */
export interface SubnetAllocation {
  network: string;
  mask: string;
  usableStart: string;
  usableEnd: string;
  broadcast: string;
  gateway: string;
  totalHosts: number;
  usableHosts: number;
}

/**
 * IP Address utilities
 */
export class IPAddressUtils {
  /**
   * Validate IP address format
   */
  static validateIP(ip: string): boolean {
    const ipRegex = /^((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipRegex.test(ip);
  }

  /**
   * Validate subnet mask
   */
  static validateSubnetMask(mask: string): boolean {
    if (!this.validateIP(mask)) return false;
    
    const parts = mask.split('.').map(Number);
    const binaryMask = (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
    
    // Check if mask is contiguous (all 1s followed by all 0s)
    const inverted = (~binaryMask >>> 0);
    return (inverted & (inverted + 1)) === 0;
  }

  /**
   * Convert IP to number for calculations
   */
  static ipToNumber(ip: string): number {
    const parts = ip.split('.').map(Number);
    return (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
  }

  /**
   * Convert number to IP address
   */
  static numberToIp(num: number): string {
    return [
      (num >>> 24) & 0xff,
      (num >>> 16) & 0xff,
      (num >>> 8) & 0xff,
      num & 0xff,
    ].join('.');
  }

  /**
   * Check if IP is in subnet
   */
  static isInSubnet(ip: string, network: string, mask: string): boolean {
    const ipNum = this.ipToNumber(ip);
    const networkNum = this.ipToNumber(network);
    const maskNum = this.ipToNumber(mask);
    
    return (ipNum & maskNum) === (networkNum & maskNum);
  }

  /**
   * Get next available IP in range
   */
  static getNextAvailableIP(startIp: string, endIp: string, usedIps: Set<string>): string | null {
    const start = this.ipToNumber(startIp);
    const end = this.ipToNumber(endIp);
    
    for (let i = start; i <= end; i++) {
      const ip = this.numberToIp(i);
      if (!usedIps.has(ip)) {
        return ip;
      }
    }
    
    return null;
  }

  /**
   * Calculate subnet information
   */
  static calculateSubnet(network: string, mask: string): SubnetAllocation {
    const networkNum = this.ipToNumber(network);
    const maskNum = this.ipToNumber(mask);
    const wildcardNum = ~maskNum >>> 0;
    
    const networkAddress = networkNum & maskNum;
    const broadcastAddress = networkAddress | wildcardNum;
    
    const totalHosts = wildcardNum + 1;
    const usableHosts = Math.max(0, totalHosts - 2); // Subtract network and broadcast
    
    return {
      network: this.numberToIp(networkAddress),
      mask,
      usableStart: this.numberToIp(networkAddress + 1),
      usableEnd: this.numberToIp(broadcastAddress - 1),
      broadcast: this.numberToIp(broadcastAddress),
      gateway: this.numberToIp(networkAddress + 1), // First usable IP as default gateway
      totalHosts,
      usableHosts,
    };
  }

  /**
   * Suggest IP address for device based on device type
   */
  static suggestDeviceIP(deviceType: DeviceType, subnetAllocation: SubnetAllocation, usedIps: Set<string>): string | null {
    const start = this.ipToNumber(subnetAllocation.usableStart);
    const end = this.ipToNumber(subnetAllocation.usableEnd);
    
    // Different IP ranges for different device types
    switch (deviceType) {
      case DeviceType.ROUTER:
        // Routers get the first few IPs
        return this.getNextAvailableIP(subnetAllocation.usableStart, this.numberToIp(start + 9), usedIps);
      
      case DeviceType.SWITCH:
        // Switches get IPs 10-19
        return this.getNextAvailableIP(this.numberToIp(start + 10), this.numberToIp(start + 19), usedIps);
      
      case DeviceType.SERVER:
        // Servers get IPs 20-49
        return this.getNextAvailableIP(this.numberToIp(start + 20), this.numberToIp(start + 49), usedIps);
      
      case DeviceType.PC:
      default:
        // PCs and other devices get remaining IPs
        return this.getNextAvailableIP(this.numberToIp(start + 50), subnetAllocation.usableEnd, usedIps);
    }
  }

  /**
   * Generate IP address ranges for VLANS
   */
  static generateVlanSubnets(baseNetwork: string, vlanIds: number[]): Map<number, SubnetAllocation> {
    const subnets = new Map<number, SubnetAllocation>();
    const baseNetworkParts = baseNetwork.split('.').map(Number);
    
    vlanIds.forEach(vlanId => {
      // Use third octet for VLAN ID (simplified)
      const vlanNetwork = `${baseNetworkParts[0]}.${baseNetworkParts[1]}.${vlanId}.0`;
      const mask = '255.255.255.0';
      
      const allocation = this.calculateSubnet(vlanNetwork, mask);
      subnets.set(vlanId, allocation);
    });
    
    return subnets;
  }
}

/**
 * DHCP Server implementation
 */
export class DHCPServer {
  private pools: Map<string, DHCPPool> = new Map();
  private leases: Map<string, DHCPLease> = new Map(); // IP -> Lease
  private clientLeases: Map<string, string> = new Map(); // ClientID -> IP
  
  /**
   * Create DHCP pool
   */
  createPool(pool: Omit<DHCPPool, 'id'>): DHCPPool {
    const newPool: DHCPPool = {
      ...pool,
      id: crypto.randomUUID(),
    };
    
    this.pools.set(newPool.id, newPool);
    return newPool;
  }

  /**
   * Delete DHCP pool
   */
  deletePool(poolId: string): void {
    // Release all leases from this pool
    for (const [ip, lease] of this.leases.entries()) {
      if (lease.poolId === poolId) {
        this.releaseLease(ip);
      }
    }
    
    this.pools.delete(poolId);
  }

  /**
   * Request IP address from DHCP
   */
  requestIP(clientId: string, clientMac: string, hostname?: string): DHCPLease | null {
    // Check if client already has a lease
    const existingIP = this.clientLeases.get(clientId);
    if (existingIP) {
      const lease = this.leases.get(existingIP);
      if (lease && lease.isActive && !this.isLeaseExpired(lease)) {
        // Renew existing lease
        lease.renewalTime = new Date(Date.now() + lease.leaseTime * 1000);
        return lease;
      }
    }

    // Find an available IP from enabled pools
    for (const pool of this.pools.values()) {
      if (!pool.isEnabled) continue;

      const availableIP = this.findAvailableIP(pool);
      if (availableIP) {
        const lease: DHCPLease = {
          id: crypto.randomUUID(),
          clientId,
          clientMac,
          ipAddress: availableIP,
          assignedTime: new Date(),
          leaseTime: pool.leaseTime,
          renewalTime: new Date(Date.now() + pool.leaseTime * 1000),
          isActive: true,
          hostname,
          poolId: pool.id,
        };

        this.leases.set(availableIP, lease);
        this.clientLeases.set(clientId, availableIP);
        
        return lease;
      }
    }

    return null; // No available IP addresses
  }

  /**
   * Release IP address lease
   */
  releaseLease(ip: string): void {
    const lease = this.leases.get(ip);
    if (lease) {
      lease.isActive = false;
      this.clientLeases.delete(lease.clientId);
      this.leases.delete(ip);
    }
  }

  /**
   * Renew DHCP lease
   */
  renewLease(clientId: string): DHCPLease | null {
    const ip = this.clientLeases.get(clientId);
    if (!ip) return null;

    const lease = this.leases.get(ip);
    if (!lease || !lease.isActive) return null;

    const pool = this.pools.get(lease.poolId);
    if (!pool || !pool.isEnabled) return null;

    lease.renewalTime = new Date(Date.now() + pool.leaseTime * 1000);
    return lease;
  }

  /**
   * Get pool configuration for IP
   */
  getPoolForIP(ip: string): DHCPPool | null {
    const lease = this.leases.get(ip);
    if (!lease) return null;

    return this.pools.get(lease.poolId) || null;
  }

  /**
   * Get all active leases
   */
  getActiveLeases(): DHCPLease[] {
    return Array.from(this.leases.values()).filter(lease => 
      lease.isActive && !this.isLeaseExpired(lease)
    );
  }

  /**
   * Get lease information for client
   */
  getClientLease(clientId: string): DHCPLease | null {
    const ip = this.clientLeases.get(clientId);
    return ip ? this.leases.get(ip) || null : null;
  }

  /**
   * Clean up expired leases
   */
  cleanupExpiredLeases(): void {
    const now = Date.now();
    
    for (const [ip, lease] of this.leases.entries()) {
      if (this.isLeaseExpired(lease)) {
        this.releaseLease(ip);
      }
    }
  }

  /**
   * Get DHCP statistics
   */
  getStatistics(): { totalPools: number; activeLeases: number; expiredLeases: number } {
    const activeLeases = this.getActiveLeases();
    const expiredLeases = Array.from(this.leases.values()).filter(lease => 
      lease.isActive && this.isLeaseExpired(lease)
    );

    return {
      totalPools: this.pools.size,
      activeLeases: activeLeases.length,
      expiredLeases: expiredLeases.length,
    };
  }

  /**
   * Find available IP in pool
   */
  private findAvailableIP(pool: DHCPPool): string | null {
    const start = IPAddressUtils.ipToNumber(pool.rangeStart);
    const end = IPAddressUtils.ipToNumber(pool.rangeEnd);
    const usedIPs = new Set([
      ...pool.excludedAddresses,
      ...Array.from(this.leases.keys()),
    ]);

    for (let i = start; i <= end; i++) {
      const ip = IPAddressUtils.numberToIp(i);
      if (!usedIPs.has(ip)) {
        return ip;
      }
    }

    return null;
  }

  /**
   * Check if lease is expired
   */
  private isLeaseExpired(lease: DHCPLease): boolean {
    return Date.now() > lease.renewalTime.getTime();
  }

  /**
   * Get all pools
   */
  getAllPools(): DHCPPool[] {
    return Array.from(this.pools.values());
  }

  /**
   * Update pool configuration
   */
  updatePool(poolId: string, updates: Partial<DHCPPool>): DHCPPool | null {
    const pool = this.pools.get(poolId);
    if (!pool) return null;

    const updatedPool = { ...pool, ...updates };
    this.pools.set(poolId, updatedPool);
    return updatedPool;
  }
}

/**
 * Network IP Address Manager
 */
export class NetworkIPManager {
  private dhcpServer: DHCPServer;
  private staticAssignments: Map<string, string> = new Map(); // deviceId -> IP
  private subnetAllocations: Map<number, SubnetAllocation> = new Map(); // vlanId -> subnet

  constructor() {
    this.dhcpServer = new DHCPServer();
  }

  /**
   * Initialize network with automatic IP assignments
   */
  initializeNetwork(devices: NetworkDevice[], vlans: number[], baseNetwork: string = '192.168.0.0'): void {
    // Generate subnet allocations for each VLAN
    const vlanSubnets = IPAddressUtils.generateVlanSubnets(baseNetwork, vlans);
    this.subnetAllocations = vlanSubnets;

    // Create DHCP pools for each VLAN
    vlanSubnets.forEach((allocation, vlanId) => {
      this.dhcpServer.createPool({
        name: `VLAN${vlanId}_Pool`,
        network: allocation.network,
        mask: allocation.mask,
        rangeStart: IPAddressUtils.numberToIp(IPAddressUtils.ipToNumber(allocation.usableStart) + 50),
        rangeEnd: allocation.usableEnd,
        defaultGateway: allocation.gateway,
        dnsServers: ['8.8.8.8', '8.8.4.4'],
        leaseTime: 86400, // 24 hours
        isEnabled: true,
        excludedAddresses: [],
      });
    });

    // Assign static IPs to infrastructure devices
    this.assignStaticIPs(devices);
  }

  /**
   * Assign static IP addresses to devices
   */
  assignStaticIPs(devices: NetworkDevice[]): void {
    const usedIPs = new Set<string>();

    // Assign IPs to routers and switches first
    devices.forEach(device => {
      if (device.type === DeviceType.ROUTER || device.type === DeviceType.SWITCH) {
        // Use management VLAN subnet (VLAN 1 or first available)
        const managementVlan = Array.from(this.subnetAllocations.keys())[0];
        const allocation = this.subnetAllocations.get(managementVlan);
        
        if (allocation) {
          const suggestedIP = IPAddressUtils.suggestDeviceIP(device.type, allocation, usedIPs);
          if (suggestedIP) {
            this.setStaticIP(device.id, suggestedIP);
            usedIPs.add(suggestedIP);
            
            // Assign IP to device interfaces
            this.assignIPToDeviceInterface(device, suggestedIP, allocation.mask);
          }
        }
      }
    });
  }

  /**
   * Set static IP for device
   */
  setStaticIP(deviceId: string, ipAddress: string): void {
    if (!IPAddressUtils.validateIP(ipAddress)) {
      throw new Error(`Invalid IP address: ${ipAddress}`);
    }
    
    this.staticAssignments.set(deviceId, ipAddress);
  }

  /**
   * Get IP address for device (static or DHCP)
   */
  getDeviceIP(deviceId: string): string | null {
    // Check static assignment first
    const staticIP = this.staticAssignments.get(deviceId);
    if (staticIP) return staticIP;

    // Check DHCP lease
    const dhcpLease = this.dhcpServer.getClientLease(deviceId);
    return dhcpLease?.ipAddress || null;
  }

  /**
   * Request DHCP IP for device
   */
  requestDHCPIP(device: NetworkDevice): DHCPLease | null {
    const macAddress = this.getDeviceMacAddress(device);
    return this.dhcpServer.requestIP(device.id, macAddress, device.name);
  }

  /**
   * Configure device network settings
   */
  configureDeviceNetwork(device: NetworkDevice, vlanId?: number): void {
    const allocation = vlanId ? this.subnetAllocations.get(vlanId) : null;
    
    if (device.type === DeviceType.PC || device.type === DeviceType.SERVER) {
      // Use DHCP for end devices
      const lease = this.requestDHCPIP(device);
      if (lease) {
        const pool = this.dhcpServer.getPoolForIP(lease.ipAddress);
        if (pool) {
          this.assignIPToDeviceInterface(device, lease.ipAddress, pool.mask, pool.defaultGateway);
        }
      }
    } else if (device.type === DeviceType.ROUTER && allocation) {
      // Routers get static IPs (gateway)
      this.setStaticIP(device.id, allocation.gateway);
      this.assignIPToDeviceInterface(device, allocation.gateway, allocation.mask);
    }
  }

  /**
   * Validate IP configuration
   */
  validateIPConfiguration(ip: string, mask: string, gateway?: string): IPValidationResult {
    const result: IPValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    if (!IPAddressUtils.validateIP(ip)) {
      result.isValid = false;
      result.errors.push(`Invalid IP address format: ${ip}`);
    }

    if (!IPAddressUtils.validateSubnetMask(mask)) {
      result.isValid = false;
      result.errors.push(`Invalid subnet mask format: ${mask}`);
    }

    if (gateway && !IPAddressUtils.validateIP(gateway)) {
      result.isValid = false;
      result.errors.push(`Invalid gateway IP format: ${gateway}`);
    }

    if (result.isValid && gateway) {
      const allocation = IPAddressUtils.calculateSubnet(ip, mask);
      if (!IPAddressUtils.isInSubnet(gateway, allocation.network, mask)) {
        result.warnings.push(`Gateway ${gateway} is not in the same subnet as ${ip}/${mask}`);
      }
    }

    return result;
  }

  /**
   * Get subnet allocation for VLAN
   */
  getVlanSubnet(vlanId: number): SubnetAllocation | null {
    return this.subnetAllocations.get(vlanId) || null;
  }

  /**
   * Get DHCP server instance
   */
  getDHCPServer(): DHCPServer {
    return this.dhcpServer;
  }

  /**
   * Get network statistics
   */
  getNetworkStatistics(): {
    totalSubnets: number;
    staticAssignments: number;
    dhcpStats: ReturnType<DHCPServer['getStatistics']>;
  } {
    return {
      totalSubnets: this.subnetAllocations.size,
      staticAssignments: this.staticAssignments.size,
      dhcpStats: this.dhcpServer.getStatistics(),
    };
  }

  /**
   * Auto-configure network for realistic setup
   */
  autoConfigureNetwork(devices: NetworkDevice[], vlans: number[]): void {
    this.initializeNetwork(devices, vlans);
    
    devices.forEach(device => {
      // Determine VLAN based on device type and connections
      const vlanId = this.determineDeviceVlan(device, vlans);
      this.configureDeviceNetwork(device, vlanId);
    });

    // Start DHCP server maintenance
    setInterval(() => {
      this.dhcpServer.cleanupExpiredLeases();
    }, 60000); // Clean up every minute
  }

  /**
   * Assign IP to device interface
   */
  private assignIPToDeviceInterface(
    device: NetworkDevice, 
    ipAddress: string, 
    mask: string, 
    gateway?: string
  ): void {
    switch (device.type) {
      case DeviceType.PC:
        const pc = device as PcDevice;
        pc.interface.ipAddress = `${ipAddress}/${IPAddressUtils.maskToPrefix(mask)}`;
        if (gateway) pc.defaultGateway = gateway;
        break;
        
      case DeviceType.SERVER:
        const server = device as ServerDevice;
        if (server.interfaces.length > 0) {
          server.interfaces[0].ipAddress = `${ipAddress}/${IPAddressUtils.maskToPrefix(mask)}`;
          if (gateway) server.defaultGateway = gateway;
        }
        break;
        
      case DeviceType.ROUTER:
        const router = device as RouterDevice;
        if (router.interfaces.length > 0) {
          router.interfaces[0].ipAddress = `${ipAddress}/${IPAddressUtils.maskToPrefix(mask)}`;
        }
        break;
    }
  }

  /**
   * Get device MAC address
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

  /**
   * Determine appropriate VLAN for device
   */
  private determineDeviceVlan(device: NetworkDevice, vlans: number[]): number {
    // Simple heuristic - assign devices to VLANs based on type
    switch (device.type) {
      case DeviceType.ROUTER:
      case DeviceType.SWITCH:
        return vlans[0] || 1; // Management VLAN
        
      case DeviceType.SERVER:
        return vlans.find(v => v >= 20) || vlans[1] || 1; // Server VLAN
        
      default:
        return vlans.find(v => v >= 100) || vlans[vlans.length - 1] || 1; // User VLAN
    }
  }

  /**
   * Convert subnet mask to prefix length
   */
  private maskToPrefix(mask: string): number {
    const parts = mask.split('.').map(Number);
    const binaryMask = (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
    return 32 - Math.log2((~binaryMask >>> 0) + 1);
  }
}