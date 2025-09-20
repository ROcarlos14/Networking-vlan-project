import {
  NetworkDevice,
  RouterDevice,
  SwitchDevice,
  PcDevice,
  ServerDevice,
  DeviceType,
  RouteEntry,
  NetworkInterface,
  Connection,
  Vlan,
  SubnetInfo,
} from '../../types';

/**
 * Enhanced route entry with additional metadata
 */
export interface EnhancedRouteEntry extends RouteEntry {
  id: string;
  administrativeDistance: number;
  age: number;
  isActive: boolean;
  learned: Date;
  nextHopReachable: boolean;
}

/**
 * Subnet calculation utilities
 */
export class SubnetCalculator {
  static parseSubnet(network: string): { network: string; prefixLength: number; mask: string } {
    if (network.includes('/')) {
      const [net, prefix] = network.split('/');
      const prefixLength = parseInt(prefix);
      const mask = this.prefixToMask(prefixLength);
      return { network: net, prefixLength, mask };
    } else {
      // Assume /24 if no prefix specified
      return { network, prefixLength: 24, mask: '255.255.255.0' };
    }
  }

  static prefixToMask(prefixLength: number): string {
    const mask = (0xffffffff << (32 - prefixLength)) >>> 0;
    return [
      (mask >>> 24) & 0xff,
      (mask >>> 16) & 0xff,
      (mask >>> 8) & 0xff,
      mask & 0xff,
    ].join('.');
  }

  static maskToPrefix(mask: string): number {
    const parts = mask.split('.').map(Number);
    const binaryMask = (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
    return 32 - Math.log2((~binaryMask >>> 0) + 1);
  }

  static isInSameSubnet(ip1: string, ip2: string, mask: string): boolean {
    const parseIp = (ip: string) => {
      const parts = ip.split('.').map(Number);
      return (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
    };

    const parseMask = (mask: string) => {
      const parts = mask.split('.').map(Number);
      return (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
    };

    const addr1 = parseIp(ip1);
    const addr2 = parseIp(ip2);
    const netmask = parseMask(mask);

    return (addr1 & netmask) === (addr2 & netmask);
  }

  static getNetworkAddress(ip: string, mask: string): string {
    const parseIp = (ip: string) => {
      const parts = ip.split('.').map(Number);
      return (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
    };

    const parseMask = (mask: string) => {
      const parts = mask.split('.').map(Number);
      return (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
    };

    const formatIp = (addr: number) => {
      return [
        (addr >>> 24) & 0xff,
        (addr >>> 16) & 0xff,
        (addr >>> 8) & 0xff,
        addr & 0xff,
      ].join('.');
    };

    const addr = parseIp(ip);
    const netmask = parseMask(mask);
    return formatIp(addr & netmask);
  }

  static getUsableIpRange(network: string, mask: string): { start: string; end: string; broadcast: string } {
    const parseIp = (ip: string) => {
      const parts = ip.split('.').map(Number);
      return (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
    };

    const parseMask = (mask: string) => {
      const parts = mask.split('.').map(Number);
      return (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
    };

    const formatIp = (addr: number) => {
      return [
        (addr >>> 24) & 0xff,
        (addr >>> 16) & 0xff,
        (addr >>> 8) & 0xff,
        addr & 0xff,
      ].join('.');
    };

    const networkAddr = parseIp(network);
    const netmask = parseMask(mask);
    const broadcast = networkAddr | (~netmask >>> 0);
    const start = networkAddr + 1;
    const end = broadcast - 1;

    return {
      start: formatIp(start),
      end: formatIp(end),
      broadcast: formatIp(broadcast),
    };
  }
}

/**
 * Routing table manager for routers
 */
export class RoutingTableManager {
  private routes: Map<string, EnhancedRouteEntry[]> = new Map();

  /**
   * Add a route to a device's routing table
   */
  addRoute(deviceId: string, route: Omit<EnhancedRouteEntry, 'id' | 'learned'>): void {
    if (!this.routes.has(deviceId)) {
      this.routes.set(deviceId, []);
    }

    const routes = this.routes.get(deviceId)!;
    const enhancedRoute: EnhancedRouteEntry = {
      ...route,
      id: crypto.randomUUID(),
      learned: new Date(),
    };

    // Remove any existing route to the same network
    const existingIndex = routes.findIndex(r => 
      r.network === route.network && r.mask === route.mask
    );

    if (existingIndex >= 0) {
      routes[existingIndex] = enhancedRoute;
    } else {
      routes.push(enhancedRoute);
    }

    // Sort by administrative distance and metric
    routes.sort((a, b) => {
      if (a.administrativeDistance !== b.administrativeDistance) {
        return a.administrativeDistance - b.administrativeDistance;
      }
      return a.metric - b.metric;
    });
  }

  /**
   * Remove a route from a device's routing table
   */
  removeRoute(deviceId: string, network: string, mask: string): void {
    const routes = this.routes.get(deviceId);
    if (!routes) return;

    const index = routes.findIndex(r => r.network === network && r.mask === mask);
    if (index >= 0) {
      routes.splice(index, 1);
    }
  }

  /**
   * Get all routes for a device
   */
  getRoutes(deviceId: string): EnhancedRouteEntry[] {
    return this.routes.get(deviceId) || [];
  }

  /**
   * Find best route for destination IP
   */
  findBestRoute(deviceId: string, destinationIp: string): EnhancedRouteEntry | null {
    const routes = this.routes.get(deviceId) || [];
    
    // Find all matching routes (longest prefix match)
    const matchingRoutes = routes
      .filter(route => route.isActive && SubnetCalculator.isInSameSubnet(destinationIp, route.network, route.mask))
      .sort((a, b) => {
        // Sort by prefix length (longest first), then by administrative distance, then by metric
        const aPrefixLength = SubnetCalculator.maskToPrefix(a.mask);
        const bPrefixLength = SubnetCalculator.maskToPrefix(b.mask);
        
        if (aPrefixLength !== bPrefixLength) {
          return bPrefixLength - aPrefixLength;
        }
        
        if (a.administrativeDistance !== b.administrativeDistance) {
          return a.administrativeDistance - b.administrativeDistance;
        }
        
        return a.metric - b.metric;
      });

    return matchingRoutes[0] || null;
  }

  /**
   * Add connected routes for router interfaces
   */
  addConnectedRoutes(device: RouterDevice): void {
    device.interfaces.forEach(iface => {
      if (iface.ipAddress && iface.status === 'up') {
        const subnet = SubnetCalculator.parseSubnet(iface.ipAddress);
        const networkAddr = SubnetCalculator.getNetworkAddress(subnet.network, subnet.mask);

        this.addRoute(device.id, {
          network: networkAddr,
          mask: subnet.mask,
          nextHop: '0.0.0.0', // Directly connected
          interface: iface.name,
          metric: 0,
          protocol: 'connected',
          administrativeDistance: 0,
          age: 0,
          isActive: true,
          nextHopReachable: true,
        });
      }
    });
  }

  /**
   * Add default route
   */
  addDefaultRoute(deviceId: string, gateway: string, interface?: string): void {
    this.addRoute(deviceId, {
      network: '0.0.0.0',
      mask: '0.0.0.0',
      nextHop: gateway,
      interface: interface || 'auto',
      metric: 1,
      protocol: 'static',
      administrativeDistance: 1,
      age: 0,
      isActive: true,
      nextHopReachable: true,
    });
  }

  /**
   * Clear all routes for a device
   */
  clearRoutes(deviceId: string): void {
    this.routes.delete(deviceId);
  }
}

/**
 * Inter-VLAN routing manager
 */
export class InterVlanRoutingManager {
  private routingTable: RoutingTableManager;
  private vlanInterfaces: Map<string, Map<number, string>> = new Map(); // deviceId -> vlanId -> interface IP

  constructor(routingTable: RoutingTableManager) {
    this.routingTable = routingTable;
  }

  /**
   * Configure VLAN interface on router/Layer 3 switch
   */
  configureVlanInterface(
    deviceId: string, 
    vlanId: number, 
    ipAddress: string, 
    mask: string
  ): void {
    if (!this.vlanInterfaces.has(deviceId)) {
      this.vlanInterfaces.set(deviceId, new Map());
    }

    const deviceVlans = this.vlanInterfaces.get(deviceId)!;
    deviceVlans.set(vlanId, ipAddress);

    // Add connected route for this VLAN
    const networkAddr = SubnetCalculator.getNetworkAddress(ipAddress, mask);
    this.routingTable.addRoute(deviceId, {
      network: networkAddr,
      mask,
      nextHop: '0.0.0.0',
      interface: `vlan${vlanId}`,
      metric: 0,
      protocol: 'connected',
      administrativeDistance: 0,
      age: 0,
      isActive: true,
      nextHopReachable: true,
    });
  }

  /**
   * Remove VLAN interface
   */
  removeVlanInterface(deviceId: string, vlanId: number): void {
    const deviceVlans = this.vlanInterfaces.get(deviceId);
    if (deviceVlans) {
      deviceVlans.delete(vlanId);
      
      // Remove connected route for this VLAN
      // Note: This is simplified - should find and remove the specific route
      const routes = this.routingTable.getRoutes(deviceId);
      const vlanRoute = routes.find(r => r.interface === `vlan${vlanId}`);
      if (vlanRoute) {
        this.routingTable.removeRoute(deviceId, vlanRoute.network, vlanRoute.mask);
      }
    }
  }

  /**
   * Get VLAN gateway for a specific VLAN
   */
  getVlanGateway(deviceId: string, vlanId: number): string | null {
    const deviceVlans = this.vlanInterfaces.get(deviceId);
    return deviceVlans?.get(vlanId) || null;
  }

  /**
   * Check if device can route between VLANs
   */
  canRouteVlans(deviceId: string, sourceVlan: number, targetVlan: number): boolean {
    const deviceVlans = this.vlanInterfaces.get(deviceId);
    return deviceVlans?.has(sourceVlan) && deviceVlans?.has(targetVlan) || false;
  }
}

/**
 * OSPF simulation (simplified)
 */
export class OSPFManager {
  private areas: Map<string, Set<string>> = new Map(); // areaId -> deviceIds
  private lsdb: Map<string, any[]> = new Map(); // Link State Database per area

  /**
   * Add device to OSPF area
   */
  addToArea(deviceId: string, areaId: string = '0.0.0.0'): void {
    if (!this.areas.has(areaId)) {
      this.areas.set(areaId, new Set());
    }
    this.areas.get(areaId)!.add(deviceId);
  }

  /**
   * Remove device from OSPF area
   */
  removeFromArea(deviceId: string, areaId: string = '0.0.0.0'): void {
    const area = this.areas.get(areaId);
    if (area) {
      area.delete(deviceId);
      if (area.size === 0) {
        this.areas.delete(areaId);
      }
    }
  }

  /**
   * Calculate OSPF routes (simplified SPF algorithm)
   */
  calculateOSPFRoutes(
    routingTable: RoutingTableManager,
    devices: NetworkDevice[],
    connections: Connection[]
  ): void {
    // Simplified OSPF calculation
    // In a real implementation, this would run Dijkstra's algorithm on the link-state database

    this.areas.forEach((deviceIds, areaId) => {
      const areaDevices = devices.filter(d => deviceIds.has(d.id));
      
      // For each device in the area, calculate routes to all other networks
      areaDevices.forEach(sourceDevice => {
        if (sourceDevice.type === DeviceType.ROUTER) {
          areaDevices.forEach(targetDevice => {
            if (sourceDevice.id !== targetDevice.id && targetDevice.type === DeviceType.ROUTER) {
              // Add OSPF route to target device's networks
              const targetRouter = targetDevice as RouterDevice;
              targetRouter.interfaces.forEach(iface => {
                if (iface.ipAddress) {
                  const subnet = SubnetCalculator.parseSubnet(iface.ipAddress);
                  const networkAddr = SubnetCalculator.getNetworkAddress(subnet.network, subnet.mask);
                  
                  routingTable.addRoute(sourceDevice.id, {
                    network: networkAddr,
                    mask: subnet.mask,
                    nextHop: this.getNextHop(sourceDevice.id, targetDevice.id, connections),
                    interface: 'auto',
                    metric: this.calculateOSPFMetric(sourceDevice.id, targetDevice.id, connections),
                    protocol: 'ospf',
                    administrativeDistance: 110,
                    age: 0,
                    isActive: true,
                    nextHopReachable: true,
                  });
                }
              });
            }
          });
        }
      });
    });
  }

  private getNextHop(sourceId: string, targetId: string, connections: Connection[]): string {
    // Simplified - return the first hop neighbor
    // In reality, this would be calculated via SPF
    const connection = connections.find(c => 
      (c.sourceDevice === sourceId && c.targetDevice === targetId) ||
      (c.targetDevice === sourceId && c.sourceDevice === targetId)
    );
    return connection ? '0.0.0.1' : '0.0.0.0'; // Placeholder
  }

  private calculateOSPFMetric(sourceId: string, targetId: string, connections: Connection[]): number {
    // Simplified metric calculation based on bandwidth
    // OSPF cost = 100,000,000 / bandwidth in bps
    const connection = connections.find(c => 
      (c.sourceDevice === sourceId && c.targetDevice === targetId) ||
      (c.targetDevice === sourceId && c.sourceDevice === targetId)
    );
    
    if (connection) {
      const bandwidthBps = connection.bandwidth * 1000000; // Convert Mbps to bps
      return Math.ceil(100000000 / bandwidthBps);
    }
    
    return 10; // Default metric
  }
}

/**
 * Main routing engine
 */
export class RoutingEngine {
  private routingTable: RoutingTableManager;
  private interVlanRouting: InterVlanRoutingManager;
  private ospf: OSPFManager;

  constructor() {
    this.routingTable = new RoutingTableManager();
    this.interVlanRouting = new InterVlanRoutingManager(this.routingTable);
    this.ospf = new OSPFManager();
  }

  /**
   * Initialize routing for all devices
   */
  initializeRouting(devices: NetworkDevice[], connections: Connection[]): void {
    devices.forEach(device => {
      if (device.type === DeviceType.ROUTER) {
        const router = device as RouterDevice;
        
        // Add connected routes
        this.routingTable.addConnectedRoutes(router);
        
        // Enable OSPF if configured
        if (router.ospfEnabled) {
          this.ospf.addToArea(router.id);
        }
      }
    });

    // Calculate OSPF routes
    this.ospf.calculateOSPFRoutes(this.routingTable, devices, connections);
  }

  /**
   * Route a packet from source to destination
   */
  routePacket(
    sourceDeviceId: string, 
    destinationIp: string, 
    devices: NetworkDevice[]
  ): { nextHop: string; outInterface: string; route?: EnhancedRouteEntry } | null {
    const route = this.routingTable.findBestRoute(sourceDeviceId, destinationIp);
    
    if (!route) {
      return null; // No route to destination
    }

    return {
      nextHop: route.nextHop,
      outInterface: route.interface,
      route
    };
  }

  /**
   * Configure inter-VLAN routing
   */
  configureInterVlanRouting(
    deviceId: string,
    vlanId: number,
    ipAddress: string,
    mask: string
  ): void {
    this.interVlanRouting.configureVlanInterface(deviceId, vlanId, ipAddress, mask);
  }

  /**
   * Get routing table for device
   */
  getRoutingTable(deviceId: string): EnhancedRouteEntry[] {
    return this.routingTable.getRoutes(deviceId);
  }

  /**
   * Add static route
   */
  addStaticRoute(
    deviceId: string,
    network: string,
    mask: string,
    nextHop: string,
    interface?: string
  ): void {
    this.routingTable.addRoute(deviceId, {
      network,
      mask,
      nextHop,
      interface: interface || 'auto',
      metric: 1,
      protocol: 'static',
      administrativeDistance: 1,
      age: 0,
      isActive: true,
      nextHopReachable: true,
    });
  }

  /**
   * Enable OSPF on device
   */
  enableOSPF(deviceId: string, areaId: string = '0.0.0.0'): void {
    this.ospf.addToArea(deviceId, areaId);
  }

  /**
   * Get VLAN gateway
   */
  getVlanGateway(deviceId: string, vlanId: number): string | null {
    return this.interVlanRouting.getVlanGateway(deviceId, vlanId);
  }
}