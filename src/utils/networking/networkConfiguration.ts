import {
  NetworkDevice,
  RouterDevice,
  SwitchDevice,
  PcDevice,
  ServerDevice,
  DeviceType,
  InterfaceType,
  InterfaceStatus,
  Vlan,
  VlanType,
  VlanStatus,
  Connection,
} from '../../types';
import { NetworkIPManager, DHCPPool } from './ipAddressManager';
import { RoutingEngine } from '../routing/routingEngine';
import { SpanningTreeProtocol } from './spanningTreeProtocol';

/**
 * Configuration command result
 */
export interface ConfigResult {
  success: boolean;
  message: string;
  warnings?: string[];
  data?: any;
}

/**
 * Configuration template for common network setups
 */
export interface NetworkTemplate {
  id: string;
  name: string;
  description: string;
  deviceTypes: DeviceType[];
  vlans: number[];
  subnets: string[];
  connections: Array<{
    sourceType: DeviceType;
    targetType: DeviceType;
    interfaceType: InterfaceType;
  }>;
}

/**
 * Interface configuration parameters
 */
export interface InterfaceConfig {
  ip?: string;
  mask?: string;
  vlanId?: number;
  interfaceType?: InterfaceType;
  description?: string;
  shutdown?: boolean;
  speed?: number;
  duplex?: 'full' | 'half';
}

/**
 * VLAN configuration parameters
 */
export interface VlanConfig {
  id: number;
  name?: string;
  description?: string;
  type?: VlanType;
  status?: VlanStatus;
}

/**
 * Network Configuration Manager
 * Provides Cisco IOS-style configuration commands
 */
export class NetworkConfigurationManager {
  private ipManager: NetworkIPManager;
  private routingEngine: RoutingEngine;
  private stpManager: SpanningTreeProtocol;
  private devices: Map<string, NetworkDevice> = new Map();
  private vlans: Map<number, Vlan> = new Map();
  private connections: Connection[] = [];

  constructor() {
    this.ipManager = new NetworkIPManager();
    this.routingEngine = new RoutingEngine();
    this.stpManager = new SpanningTreeProtocol();
  }

  /**
   * Initialize with existing network data
   */
  initialize(devices: NetworkDevice[], vlans: Vlan[], connections: Connection[]): void {
    // Store devices
    this.devices.clear();
    devices.forEach(device => {
      this.devices.set(device.id, device);
    });

    // Store VLANs
    this.vlans.clear();
    vlans.forEach(vlan => {
      this.vlans.set(vlan.id, vlan);
    });

    this.connections = connections;

    // Initialize networking systems
    const vlanIds = vlans.map(v => v.id);
    this.ipManager.autoConfigureNetwork(devices, vlanIds);
    this.routingEngine.initializeRouting(devices, connections);
    
    const switches = devices.filter(d => d.type === DeviceType.SWITCH) as SwitchDevice[];
    this.stpManager.initializeSTP(switches, connections);
  }

  /**
   * Configure device hostname
   * Command: hostname <name>
   */
  configureHostname(deviceId: string, hostname: string): ConfigResult {
    const device = this.devices.get(deviceId);
    if (!device) {
      return { success: false, message: `Device ${deviceId} not found` };
    }

    device.name = hostname;
    return { 
      success: true, 
      message: `Hostname set to ${hostname}`,
      data: { hostname }
    };
  }

  /**
   * Configure interface
   * Command: interface <interface-name>
   */
  configureInterface(deviceId: string, interfaceName: string, config: InterfaceConfig): ConfigResult {
    const device = this.devices.get(deviceId);
    if (!device) {
      return { success: false, message: `Device ${deviceId} not found` };
    }

    let targetInterface;

    // Find interface based on device type
    switch (device.type) {
      case DeviceType.PC:
        const pc = device as PcDevice;
        if (pc.interface.name === interfaceName) {
          targetInterface = pc.interface;
        }
        break;
        
      case DeviceType.SERVER:
        const server = device as ServerDevice;
        targetInterface = server.interfaces.find(i => i.name === interfaceName);
        break;
        
      case DeviceType.ROUTER:
        const router = device as RouterDevice;
        targetInterface = router.interfaces.find(i => i.name === interfaceName);
        break;
        
      case DeviceType.SWITCH:
        const sw = device as SwitchDevice;
        targetInterface = sw.interfaces.find(i => i.name === interfaceName);
        break;
    }

    if (!targetInterface) {
      return { success: false, message: `Interface ${interfaceName} not found on device ${device.name}` };
    }

    const warnings: string[] = [];

    // Apply configuration
    if (config.ip && config.mask) {
      const ipConfig = `${config.ip}/${this.maskToPrefix(config.mask)}`;
      targetInterface.ipAddress = ipConfig;
      
      // Add static route if this is a router
      if (device.type === DeviceType.ROUTER) {
        this.routingEngine.addStaticRoute(deviceId, config.ip, config.mask, '0.0.0.0', interfaceName);
      }
    }

    if (config.vlanId !== undefined) {
      if (!this.vlans.has(config.vlanId)) {
        warnings.push(`VLAN ${config.vlanId} does not exist`);
      }
      
      targetInterface.vlanConfig = targetInterface.vlanConfig || {};
      
      if (config.interfaceType === InterfaceType.ACCESS) {
        targetInterface.vlanConfig.accessVlan = config.vlanId;
        targetInterface.type = InterfaceType.ACCESS;
      } else if (config.interfaceType === InterfaceType.TRUNK) {
        targetInterface.vlanConfig.allowedVlans = targetInterface.vlanConfig.allowedVlans || [];
        if (!targetInterface.vlanConfig.allowedVlans.includes(config.vlanId)) {
          targetInterface.vlanConfig.allowedVlans.push(config.vlanId);
        }
        targetInterface.type = InterfaceType.TRUNK;
      }
    }

    if (config.description) {
      // Note: description field doesn't exist in current interface type, but we'd add it
      console.log(`Interface ${interfaceName} description: ${config.description}`);
    }

    if (config.shutdown !== undefined) {
      targetInterface.status = config.shutdown ? InterfaceStatus.ADMIN_DOWN : InterfaceStatus.UP;
    }

    if (config.speed) {
      targetInterface.speed = config.speed;
    }

    if (config.duplex) {
      targetInterface.duplex = config.duplex;
    }

    return {
      success: true,
      message: `Interface ${interfaceName} configured successfully`,
      warnings: warnings.length > 0 ? warnings : undefined,
      data: { interface: targetInterface }
    };
  }

  /**
   * Configure VLAN
   * Command: vlan <vlan-id>
   */
  configureVlan(config: VlanConfig): ConfigResult {
    const existingVlan = this.vlans.get(config.id);
    
    const vlan: Vlan = {
      id: config.id,
      name: config.name || (existingVlan?.name ?? `VLAN${config.id.toString().padStart(4, '0')}`),
      description: config.description || existingVlan?.description,
      color: this.generateVlanColor(config.id),
      status: config.status || VlanStatus.ACTIVE,
      type: config.type || VlanType.NORMAL,
      createdAt: existingVlan?.createdAt || new Date(),
      modifiedAt: new Date(),
    };

    this.vlans.set(config.id, vlan);

    // Update IP manager with new VLAN
    const vlanIds = Array.from(this.vlans.keys());
    const devices = Array.from(this.devices.values());
    this.ipManager.initializeNetwork(devices, vlanIds);

    return {
      success: true,
      message: `VLAN ${config.id} configured successfully`,
      data: { vlan }
    };
  }

  /**
   * Configure switchport
   * Command: switchport mode <access|trunk>
   */
  configureSwitchport(deviceId: string, interfaceName: string, mode: 'access' | 'trunk', vlanId?: number): ConfigResult {
    const device = this.devices.get(deviceId);
    if (!device || device.type !== DeviceType.SWITCH) {
      return { success: false, message: `Device ${deviceId} is not a switch` };
    }

    const sw = device as SwitchDevice;
    const targetInterface = sw.interfaces.find(i => i.name === interfaceName);

    if (!targetInterface) {
      return { success: false, message: `Interface ${interfaceName} not found` };
    }

    targetInterface.vlanConfig = targetInterface.vlanConfig || {};

    if (mode === 'access') {
      targetInterface.type = InterfaceType.ACCESS;
      targetInterface.vlanConfig.accessVlan = vlanId || 1;
      
      return {
        success: true,
        message: `Interface ${interfaceName} set to access mode, VLAN ${vlanId || 1}`,
        data: { mode, vlanId: vlanId || 1 }
      };
    } else if (mode === 'trunk') {
      targetInterface.type = InterfaceType.TRUNK;
      targetInterface.vlanConfig.nativeVlan = 1;
      targetInterface.vlanConfig.allowedVlans = vlanId ? [vlanId] : [1];
      
      return {
        success: true,
        message: `Interface ${interfaceName} set to trunk mode`,
        data: { mode, allowedVlans: targetInterface.vlanConfig.allowedVlans }
      };
    }

    return { success: false, message: `Invalid switchport mode: ${mode}` };
  }

  /**
   * Configure trunk allowed VLANs
   * Command: switchport trunk allowed vlan <vlan-list>
   */
  configureTrunkAllowedVlans(deviceId: string, interfaceName: string, vlans: number[]): ConfigResult {
    const device = this.devices.get(deviceId);
    if (!device || device.type !== DeviceType.SWITCH) {
      return { success: false, message: `Device ${deviceId} is not a switch` };
    }

    const sw = device as SwitchDevice;
    const targetInterface = sw.interfaces.find(i => i.name === interfaceName);

    if (!targetInterface) {
      return { success: false, message: `Interface ${interfaceName} not found` };
    }

    if (targetInterface.type !== InterfaceType.TRUNK) {
      return { success: false, message: `Interface ${interfaceName} is not configured as trunk` };
    }

    // Validate VLANs exist
    const invalidVlans = vlans.filter(v => !this.vlans.has(v));
    const warnings = invalidVlans.length > 0 ? [`VLANs not configured: ${invalidVlans.join(', ')}`] : undefined;

    targetInterface.vlanConfig = targetInterface.vlanConfig || {};
    targetInterface.vlanConfig.allowedVlans = vlans;

    return {
      success: true,
      message: `Trunk allowed VLANs configured: ${vlans.join(', ')}`,
      warnings,
      data: { allowedVlans: vlans }
    };
  }

  /**
   * Configure native VLAN
   * Command: switchport trunk native vlan <vlan-id>
   */
  configureNativeVlan(deviceId: string, interfaceName: string, vlanId: number): ConfigResult {
    const device = this.devices.get(deviceId);
    if (!device || device.type !== DeviceType.SWITCH) {
      return { success: false, message: `Device ${deviceId} is not a switch` };
    }

    const sw = device as SwitchDevice;
    const targetInterface = sw.interfaces.find(i => i.name === interfaceName);

    if (!targetInterface) {
      return { success: false, message: `Interface ${interfaceName} not found` };
    }

    if (targetInterface.type !== InterfaceType.TRUNK) {
      return { success: false, message: `Interface ${interfaceName} is not configured as trunk` };
    }

    const warnings = [];
    if (!this.vlans.has(vlanId)) {
      warnings.push(`VLAN ${vlanId} does not exist`);
    }

    targetInterface.vlanConfig = targetInterface.vlanConfig || {};
    targetInterface.vlanConfig.nativeVlan = vlanId;

    // Ensure native VLAN is in allowed list
    if (targetInterface.vlanConfig.allowedVlans && !targetInterface.vlanConfig.allowedVlans.includes(vlanId)) {
      targetInterface.vlanConfig.allowedVlans.push(vlanId);
      warnings.push(`Added native VLAN ${vlanId} to allowed VLANs list`);
    }

    return {
      success: true,
      message: `Native VLAN set to ${vlanId}`,
      warnings: warnings.length > 0 ? warnings : undefined,
      data: { nativeVlan: vlanId }
    };
  }

  /**
   * Configure static route
   * Command: ip route <network> <mask> <gateway>
   */
  configureStaticRoute(deviceId: string, network: string, mask: string, nextHop: string): ConfigResult {
    const device = this.devices.get(deviceId);
    if (!device || device.type !== DeviceType.ROUTER) {
      return { success: false, message: `Device ${deviceId} is not a router` };
    }

    try {
      this.routingEngine.addStaticRoute(deviceId, network, mask, nextHop);
      
      return {
        success: true,
        message: `Static route added: ${network}/${this.maskToPrefix(mask)} via ${nextHop}`,
        data: { network, mask, nextHop }
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to add static route: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Configure default route
   * Command: ip route 0.0.0.0 0.0.0.0 <gateway>
   */
  configureDefaultRoute(deviceId: string, gateway: string): ConfigResult {
    return this.configureStaticRoute(deviceId, '0.0.0.0', '0.0.0.0', gateway);
  }

  /**
   * Enable OSPF
   * Command: router ospf <process-id>
   */
  enableOSPF(deviceId: string, processId: number = 1, areaId: string = '0.0.0.0'): ConfigResult {
    const device = this.devices.get(deviceId);
    if (!device || device.type !== DeviceType.ROUTER) {
      return { success: false, message: `Device ${deviceId} is not a router` };
    }

    const router = device as RouterDevice;
    router.ospfEnabled = true;
    
    this.routingEngine.enableOSPF(deviceId, areaId);

    return {
      success: true,
      message: `OSPF process ${processId} enabled for area ${areaId}`,
      data: { processId, areaId }
    };
  }

  /**
   * Configure DHCP pool
   * Command: ip dhcp pool <name>
   */
  configureDHCPPool(poolName: string, config: Omit<DHCPPool, 'id' | 'name'>): ConfigResult {
    try {
      const pool = this.ipManager.getDHCPServer().createPool({
        name: poolName,
        ...config
      });

      return {
        success: true,
        message: `DHCP pool '${poolName}' created successfully`,
        data: { pool }
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to create DHCP pool: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Configure inter-VLAN routing
   * Command: interface vlan <vlan-id>
   */
  configureVlanInterface(deviceId: string, vlanId: number, ipAddress: string, mask: string): ConfigResult {
    const device = this.devices.get(deviceId);
    if (!device || device.type !== DeviceType.ROUTER) {
      return { success: false, message: `Device ${deviceId} is not a router` };
    }

    if (!this.vlans.has(vlanId)) {
      return { success: false, message: `VLAN ${vlanId} does not exist` };
    }

    try {
      this.routingEngine.configureInterVlanRouting(deviceId, vlanId, ipAddress, mask);
      
      return {
        success: true,
        message: `VLAN interface ${vlanId} configured with IP ${ipAddress}/${this.maskToPrefix(mask)}`,
        data: { vlanId, ipAddress, mask }
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to configure VLAN interface: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Apply network template
   */
  applyNetworkTemplate(templateId: string, devices: NetworkDevice[]): ConfigResult {
    const template = this.getNetworkTemplate(templateId);
    if (!template) {
      return { success: false, message: `Template ${templateId} not found` };
    }

    const results: string[] = [];
    const warnings: string[] = [];

    // Configure VLANs
    template.vlans.forEach(vlanId => {
      const result = this.configureVlan({ id: vlanId });
      if (result.success) {
        results.push(result.message);
      } else {
        warnings.push(result.message);
      }
    });

    // Configure devices based on template
    devices.forEach(device => {
      if (template.deviceTypes.includes(device.type)) {
        // Apply template-specific configuration
        this.applyDeviceTemplateConfiguration(device, template);
        results.push(`Applied template configuration to ${device.name}`);
      }
    });

    return {
      success: true,
      message: `Applied template '${template.name}' successfully`,
      warnings: warnings.length > 0 ? warnings : undefined,
      data: { results }
    };
  }

  /**
   * Generate network configuration report
   */
  generateConfigurationReport(): {
    devices: Array<{ id: string; name: string; type: DeviceType; interfaces: any[] }>;
    vlans: Vlan[];
    routingTables: Array<{ deviceId: string; routes: any[] }>;
    dhcpPools: any[];
    stpStatus: any;
  } {
    const deviceReports = Array.from(this.devices.values()).map(device => ({
      id: device.id,
      name: device.name,
      type: device.type,
      interfaces: this.getDeviceInterfaces(device),
    }));

    const routingTables = Array.from(this.devices.values())
      .filter(d => d.type === DeviceType.ROUTER)
      .map(device => ({
        deviceId: device.id,
        routes: this.routingEngine.getRoutingTable(device.id),
      }));

    return {
      devices: deviceReports,
      vlans: Array.from(this.vlans.values()),
      routingTables,
      dhcpPools: this.ipManager.getDHCPServer().getAllPools(),
      stpStatus: this.stpManager.getStatistics(),
    };
  }

  /**
   * Validate network configuration
   */
  validateConfiguration(): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    suggestions: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Check for unconnected devices
    const connectedDeviceIds = new Set();
    this.connections.forEach(conn => {
      connectedDeviceIds.add(conn.sourceDevice);
      connectedDeviceIds.add(conn.targetDevice);
    });

    this.devices.forEach(device => {
      if (!connectedDeviceIds.has(device.id) && device.type !== DeviceType.PC) {
        warnings.push(`Device ${device.name} is not connected to the network`);
      }
    });

    // Check for VLAN configuration issues
    this.vlans.forEach(vlan => {
      const devicesInVlan = this.getDevicesInVlan(vlan.id);
      if (devicesInVlan.length === 0) {
        warnings.push(`VLAN ${vlan.id} (${vlan.name}) has no devices assigned`);
      } else if (devicesInVlan.length === 1) {
        suggestions.push(`VLAN ${vlan.id} (${vlan.name}) has only one device - consider adding more or removing the VLAN`);
      }
    });

    // Check for routing issues
    const routers = Array.from(this.devices.values()).filter(d => d.type === DeviceType.ROUTER);
    routers.forEach(router => {
      const routes = this.routingEngine.getRoutingTable(router.id);
      if (routes.length === 0) {
        warnings.push(`Router ${router.name} has no routing table entries`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  /**
   * Get available network templates
   */
  getAvailableTemplates(): NetworkTemplate[] {
    return [
      {
        id: 'basic-lan',
        name: 'Basic LAN',
        description: 'Simple LAN setup with switch and PCs',
        deviceTypes: [DeviceType.SWITCH, DeviceType.PC],
        vlans: [1],
        subnets: ['192.168.1.0/24'],
        connections: [
          { sourceType: DeviceType.SWITCH, targetType: DeviceType.PC, interfaceType: InterfaceType.ACCESS }
        ]
      },
      {
        id: 'multi-vlan',
        name: 'Multi-VLAN Network',
        description: 'Network with multiple VLANs and inter-VLAN routing',
        deviceTypes: [DeviceType.ROUTER, DeviceType.SWITCH, DeviceType.PC, DeviceType.SERVER],
        vlans: [1, 10, 20, 30],
        subnets: ['192.168.1.0/24', '192.168.10.0/24', '192.168.20.0/24', '192.168.30.0/24'],
        connections: [
          { sourceType: DeviceType.ROUTER, targetType: DeviceType.SWITCH, interfaceType: InterfaceType.TRUNK },
          { sourceType: DeviceType.SWITCH, targetType: DeviceType.PC, interfaceType: InterfaceType.ACCESS },
          { sourceType: DeviceType.SWITCH, targetType: DeviceType.SERVER, interfaceType: InterfaceType.ACCESS }
        ]
      },
      {
        id: 'redundant-network',
        name: 'Redundant Network',
        description: 'Redundant network topology with STP',
        deviceTypes: [DeviceType.SWITCH],
        vlans: [1, 10, 20],
        subnets: ['192.168.1.0/24', '192.168.10.0/24', '192.168.20.0/24'],
        connections: [
          { sourceType: DeviceType.SWITCH, targetType: DeviceType.SWITCH, interfaceType: InterfaceType.TRUNK }
        ]
      }
    ];
  }

  /**
   * Private helper methods
   */
  private getNetworkTemplate(templateId: string): NetworkTemplate | undefined {
    return this.getAvailableTemplates().find(t => t.id === templateId);
  }

  private applyDeviceTemplateConfiguration(device: NetworkDevice, template: NetworkTemplate): void {
    // Apply template-specific configuration based on device type
    if (device.type === DeviceType.SWITCH) {
      // Configure switch with default VLANs
      const sw = device as SwitchDevice;
      sw.spanningTreeEnabled = template.id === 'redundant-network';
    }
  }

  private getDeviceInterfaces(device: NetworkDevice): any[] {
    switch (device.type) {
      case DeviceType.PC:
        const pc = device as PcDevice;
        return [pc.interface];
      case DeviceType.SERVER:
        const server = device as ServerDevice;
        return server.interfaces;
      case DeviceType.ROUTER:
        const router = device as RouterDevice;
        return router.interfaces;
      case DeviceType.SWITCH:
        const sw = device as SwitchDevice;
        return sw.interfaces;
      default:
        return [];
    }
  }

  private getDevicesInVlan(vlanId: number): NetworkDevice[] {
    const devicesInVlan: NetworkDevice[] = [];
    
    this.devices.forEach(device => {
      const interfaces = this.getDeviceInterfaces(device);
      const hasVlan = interfaces.some(iface => {
        if (iface.vlanConfig?.accessVlan === vlanId) return true;
        if (iface.vlanConfig?.allowedVlans?.includes(vlanId)) return true;
        if (iface.vlanConfig?.nativeVlan === vlanId) return true;
        return false;
      });
      
      if (hasVlan) {
        devicesInVlan.push(device);
      }
    });
    
    return devicesInVlan;
  }

  private generateVlanColor(vlanId: number): string {
    const colors = [
      '#E3E3E3', // VLAN 1 - Default (Gray)
      '#FF6B6B', // Management (Red)
      '#4ECDC4', // Data (Teal)
      '#45B7D1', // Voice (Blue)
      '#96CEB4', // Guest (Green)
      '#FECA57', // DMZ (Orange)
      '#FF9FF3', // Storage (Pink)
      '#A8E6CF', // IoT (Light Green)
    ];
    
    return colors[vlanId % colors.length] || '#E3E3E3';
  }

  private maskToPrefix(mask: string): number {
    const parts = mask.split('.').map(Number);
    const binaryMask = (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
    return 32 - Math.log2((~binaryMask >>> 0) + 1);
  }

  /**
   * Export configuration as JSON
   */
  exportConfiguration(): any {
    return {
      devices: Array.from(this.devices.values()),
      vlans: Array.from(this.vlans.values()),
      connections: this.connections,
      dhcpPools: this.ipManager.getDHCPServer().getAllPools(),
      routingTables: Array.from(this.devices.values())
        .filter(d => d.type === DeviceType.ROUTER)
        .reduce((acc, device) => {
          acc[device.id] = this.routingEngine.getRoutingTable(device.id);
          return acc;
        }, {} as any),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Import configuration from JSON
   */
  importConfiguration(config: any): ConfigResult {
    try {
      if (config.devices) {
        this.devices.clear();
        config.devices.forEach((device: NetworkDevice) => {
          this.devices.set(device.id, device);
        });
      }

      if (config.vlans) {
        this.vlans.clear();
        config.vlans.forEach((vlan: Vlan) => {
          this.vlans.set(vlan.id, vlan);
        });
      }

      if (config.connections) {
        this.connections = config.connections;
      }

      // Reinitialize systems with imported data
      const devices = Array.from(this.devices.values());
      const vlans = Array.from(this.vlans.values());
      this.initialize(devices, vlans, this.connections);

      return {
        success: true,
        message: 'Configuration imported successfully',
        data: { deviceCount: devices.length, vlanCount: vlans.length, connectionCount: this.connections.length }
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to import configuration: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}