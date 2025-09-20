import {
  NetworkDevice,
  RouterDevice,
  SwitchDevice,
  PcDevice,
  ServerDevice,
  DeviceType,
  Connection,
  Vlan,
  SimulationScenario,
  TrafficFlow,
} from '../../types';

import { RoutingEngine } from '../routing/routingEngine';
import { NetworkIPManager, DHCPPool } from './ipAddressManager';
import { SpanningTreeProtocol } from './spanningTreeProtocol';
import { NetworkConfigurationManager, ConfigResult } from './networkConfiguration';
import { NetworkTroubleshootingTools, CommandResult, PingResult, TracerouteResult } from './troubleshootingTools';
import { SimulationEngine, createSimulationEngine } from '../simulation/simulationEngine';

/**
 * Network initialization options
 */
export interface NetworkInitializationOptions {
  autoConfigureIPs: boolean;
  enableSTP: boolean;
  enableOSPF: boolean;
  createDefaultVLANs: boolean;
  setupDHCP: boolean;
  baseNetwork: string;
}

/**
 * Network status information
 */
export interface NetworkStatus {
  totalDevices: number;
  devicesByType: Record<DeviceType, number>;
  totalConnections: number;
  totalVLANs: number;
  activeSimulations: number;
  dhcpLeases: number;
  stpConverged: boolean;
  ospfNeighbors: number;
  issues: string[];
  warnings: string[];
}

/**
 * Network statistics
 */
export interface NetworkStatistics {
  ipManager: {
    totalSubnets: number;
    staticAssignments: number;
    dhcpStats: any;
  };
  routing: {
    totalRoutes: number;
    routesByProtocol: Record<string, number>;
  };
  stp: {
    totalBridges: number;
    rootBridge: string | null;
    blockedPorts: number;
    forwardingPorts: number;
  };
  simulation: {
    totalPackets: number;
    deliveredPackets: number;
    droppedPackets: number;
    averageLatency: number;
    throughput: number;
  };
}

/**
 * Comprehensive Network Integration Manager
 * Provides a unified interface for all networking components and features
 */
export class NetworkIntegrationManager {
  private routingEngine: RoutingEngine;
  private ipManager: NetworkIPManager;
  private stpManager: SpanningTreeProtocol;
  private configManager: NetworkConfigurationManager;
  private troubleshootingTools: NetworkTroubleshootingTools;
  private simulationEngine?: SimulationEngine;

  private devices: Map<string, NetworkDevice> = new Map();
  private connections: Connection[] = [];
  private vlans: Map<number, Vlan> = new Map();
  private isInitialized: boolean = false;

  constructor() {
    this.routingEngine = new RoutingEngine();
    this.ipManager = new NetworkIPManager();
    this.stpManager = new SpanningTreeProtocol();
    this.configManager = new NetworkConfigurationManager();
    this.troubleshootingTools = new NetworkTroubleshootingTools();
  }

  /**
   * Initialize the network with all components
   */
  initialize(
    devices: NetworkDevice[],
    connections: Connection[],
    vlans: Vlan[],
    options: Partial<NetworkInitializationOptions> = {}
  ): ConfigResult {
    try {
      const defaultOptions: NetworkInitializationOptions = {
        autoConfigureIPs: true,
        enableSTP: true,
        enableOSPF: false,
        createDefaultVLANs: true,
        setupDHCP: true,
        baseNetwork: '192.168.0.0',
      };

      const opts = { ...defaultOptions, ...options };
      const warnings: string[] = [];

      // Store network data
      this.devices.clear();
      devices.forEach(device => {
        this.devices.set(device.id, device);
      });
      this.connections = connections;
      this.vlans.clear();
      vlans.forEach(vlan => {
        this.vlans.set(vlan.id, vlan);
      });

      // Create default VLANs if needed
      if (opts.createDefaultVLANs && vlans.length === 0) {
        this.createDefaultVLANs();
        warnings.push('Created default VLANs (1, 10, 20, 30)');
      }

      // Initialize all network components
      const vlanIds = Array.from(this.vlans.keys());
      
      // Initialize configuration manager
      this.configManager.initialize(devices, Array.from(this.vlans.values()), connections);

      // Initialize IP management
      if (opts.autoConfigureIPs) {
        this.ipManager.autoConfigureNetwork(devices, vlanIds);
        warnings.push('Auto-configured IP addresses for all devices');
      }

      // Initialize routing engine
      this.routingEngine.initializeRouting(devices, connections);

      // Enable OSPF on routers if requested
      if (opts.enableOSPF) {
        devices
          .filter(d => d.type === DeviceType.ROUTER)
          .forEach(router => {
            (router as RouterDevice).ospfEnabled = true;
            this.routingEngine.enableOSPF(router.id);
          });
        warnings.push('Enabled OSPF on all routers');
      }

      // Initialize STP on switches
      if (opts.enableSTP) {
        const switches = devices.filter(d => d.type === DeviceType.SWITCH) as SwitchDevice[];
        switches.forEach(sw => {
          sw.spanningTreeEnabled = true;
        });
        this.stpManager.initializeSTP(switches, connections);
        warnings.push('Enabled STP on all switches');
      }

      // Create simulation engine
      this.simulationEngine = createSimulationEngine(devices, connections, Array.from(this.vlans.values()));

      // Initialize troubleshooting tools
      this.troubleshootingTools.initialize(
        devices,
        connections,
        Array.from(this.vlans.values()),
        this.ipManager,
        this.routingEngine,
        this.stpManager,
        this.simulationEngine
      );

      // Setup DHCP pools if requested
      if (opts.setupDHCP) {
        this.setupDefaultDHCPPools(opts.baseNetwork, vlanIds);
        warnings.push('Created DHCP pools for all VLANs');
      }

      this.isInitialized = true;

      return {
        success: true,
        message: 'Network initialized successfully',
        warnings: warnings.length > 0 ? warnings : undefined,
        data: {
          devices: devices.length,
          connections: connections.length,
          vlans: vlanIds.length,
        }
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to initialize network: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get comprehensive network status
   */
  getNetworkStatus(): NetworkStatus {
    if (!this.isInitialized) {
      return {
        totalDevices: 0,
        devicesByType: { [DeviceType.PC]: 0, [DeviceType.SERVER]: 0, [DeviceType.ROUTER]: 0, [DeviceType.SWITCH]: 0 },
        totalConnections: 0,
        totalVLANs: 0,
        activeSimulations: 0,
        dhcpLeases: 0,
        stpConverged: false,
        ospfNeighbors: 0,
        issues: ['Network not initialized'],
        warnings: [],
      };
    }

    const devices = Array.from(this.devices.values());
    const devicesByType: Record<DeviceType, number> = {
      [DeviceType.PC]: 0,
      [DeviceType.SERVER]: 0,
      [DeviceType.ROUTER]: 0,
      [DeviceType.SWITCH]: 0,
    };

    devices.forEach(device => {
      devicesByType[device.type]++;
    });

    const dhcpStats = this.ipManager.getDHCPServer().getStatistics();
    const stpStats = this.stpManager.getStatistics();
    const simulationStats = this.simulationEngine?.getSimulationStatistics();

    const issues: string[] = [];
    const warnings: string[] = [];

    // Check for common issues
    if (devicesByType[DeviceType.ROUTER] === 0 && this.vlans.size > 1) {
      issues.push('Multiple VLANs configured but no router present for inter-VLAN routing');
    }

    if (stpStats.blockedPorts > 0) {
      warnings.push(`${stpStats.blockedPorts} ports are blocked by Spanning Tree Protocol`);
    }

    if (dhcpStats.activeLeases === 0 && devicesByType[DeviceType.PC] > 0) {
      warnings.push('No active DHCP leases but PCs are present');
    }

    return {
      totalDevices: devices.length,
      devicesByType,
      totalConnections: this.connections.length,
      totalVLANs: this.vlans.size,
      activeSimulations: simulationStats ? 1 : 0,
      dhcpLeases: dhcpStats.activeLeases,
      stpConverged: stpStats.rootBridge !== null,
      ospfNeighbors: 0, // Would need to implement neighbor tracking
      issues,
      warnings,
    };
  }

  /**
   * Get network statistics
   */
  getNetworkStatistics(): NetworkStatistics {
    const ipStats = this.ipManager.getNetworkStatistics();
    const stpStats = this.stpManager.getStatistics();
    const simulationStats = this.simulationEngine?.getSimulationStatistics() || {
      totalPackets: 0,
      deliveredPackets: 0,
      droppedPackets: 0,
      averageLatency: 0,
      throughput: 0,
    };

    // Calculate routing statistics
    const devices = Array.from(this.devices.values());
    const routers = devices.filter(d => d.type === DeviceType.ROUTER);
    const routesByProtocol: Record<string, number> = {};
    let totalRoutes = 0;

    routers.forEach(router => {
      const routes = this.routingEngine.getRoutingTable(router.id);
      totalRoutes += routes.length;
      routes.forEach(route => {
        routesByProtocol[route.protocol] = (routesByProtocol[route.protocol] || 0) + 1;
      });
    });

    return {
      ipManager: ipStats,
      routing: {
        totalRoutes,
        routesByProtocol,
      },
      stp: stpStats,
      simulation: simulationStats,
    };
  }

  /**
   * Execute Cisco IOS-style configuration command
   */
  executeConfigCommand(command: string, deviceId: string, ...args: any[]): ConfigResult {
    const parts = command.toLowerCase().split(' ').filter(Boolean);
    
    try {
      switch (parts[0]) {
        case 'hostname':
          return this.configManager.configureHostname(deviceId, parts[1]);
          
        case 'interface':
          if (parts.length < 2) {
            return { success: false, message: 'Interface name required' };
          }
          const interfaceConfig = args[0] || {};
          return this.configManager.configureInterface(deviceId, parts[1], interfaceConfig);
          
        case 'vlan':
          const vlanId = parseInt(parts[1]);
          if (isNaN(vlanId)) {
            return { success: false, message: 'Invalid VLAN ID' };
          }
          const vlanConfig = args[0] || { id: vlanId };
          return this.configManager.configureVlan(vlanConfig);
          
        case 'switchport':
          if (parts[1] === 'mode' && parts.length >= 3) {
            const interfaceName = args[0];
            const mode = parts[2] as 'access' | 'trunk';
            const vlanId = args[1];
            return this.configManager.configureSwitchport(deviceId, interfaceName, mode, vlanId);
          }
          break;
          
        case 'ip':
          if (parts[1] === 'route' && parts.length >= 5) {
            return this.configManager.configureStaticRoute(deviceId, parts[2], parts[3], parts[4]);
          } else if (parts[1] === 'dhcp' && parts[2] === 'pool') {
            const poolName = parts[3];
            const poolConfig = args[0];
            return this.configManager.configureDHCPPool(poolName, poolConfig);
          }
          break;
          
        case 'router':
          if (parts[1] === 'ospf') {
            const processId = parseInt(parts[2]) || 1;
            return this.configManager.enableOSPF(deviceId, processId);
          }
          break;
          
        default:
          return { success: false, message: `Unknown command: ${command}` };
      }
    } catch (error) {
      return {
        success: false,
        message: `Command execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }

    return { success: false, message: 'Invalid command syntax' };
  }

  /**
   * Execute Cisco IOS-style show command
   */
  executeShowCommand(deviceId: string, command: string): CommandResult {
    return this.troubleshootingTools.executeShowCommand(deviceId, command);
  }

  /**
   * Execute ping command
   */
  async ping(sourceDeviceId: string, target: string, count: number = 4): Promise<PingResult> {
    return this.troubleshootingTools.ping(sourceDeviceId, target, count);
  }

  /**
   * Execute traceroute command
   */
  async traceroute(sourceDeviceId: string, target: string, maxHops: number = 30): Promise<TracerouteResult> {
    return this.troubleshootingTools.traceroute(sourceDeviceId, target, maxHops);
  }

  /**
   * Start network simulation with traffic flows
   */
  startSimulation(trafficFlows?: TrafficFlow[]): ConfigResult {
    if (!this.simulationEngine) {
      return { success: false, message: 'Simulation engine not initialized' };
    }

    try {
      this.simulationEngine.startSimulation(trafficFlows || []);
      return {
        success: true,
        message: 'Network simulation started successfully',
        data: { trafficFlows: trafficFlows?.length || 0 }
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to start simulation: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Stop network simulation
   */
  stopSimulation(): ConfigResult {
    if (!this.simulationEngine) {
      return { success: false, message: 'Simulation engine not initialized' };
    }

    try {
      this.simulationEngine.stopSimulation();
      return { success: true, message: 'Network simulation stopped successfully' };
    } catch (error) {
      return {
        success: false,
        message: `Failed to stop simulation: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Send test packet between devices
   */
  sendTestPacket(sourceDeviceId: string, targetDeviceId: string, vlanTag?: number): ConfigResult {
    if (!this.simulationEngine) {
      return { success: false, message: 'Simulation engine not initialized' };
    }

    try {
      const packet = this.simulationEngine.createTestPacket(
        sourceDeviceId,
        targetDeviceId,
        'ip' as any,
        'icmp' as any,
        vlanTag
      );

      if (packet) {
        this.simulationEngine.sendPacket(packet);
        return {
          success: true,
          message: `Test packet sent from ${sourceDeviceId} to ${targetDeviceId}`,
          data: { packetId: packet.id, vlanTag }
        };
      } else {
        return { success: false, message: 'Failed to create test packet' };
      }
    } catch (error) {
      return {
        success: false,
        message: `Failed to send test packet: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
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
    return this.configManager.validateConfiguration();
  }

  /**
   * Apply network template
   */
  applyTemplate(templateId: string): ConfigResult {
    const devices = Array.from(this.devices.values());
    return this.configManager.applyNetworkTemplate(templateId, devices);
  }

  /**
   * Export complete network configuration
   */
  exportConfiguration(): any {
    return {
      ...this.configManager.exportConfiguration(),
      networkStatus: this.getNetworkStatus(),
      statistics: this.getNetworkStatistics(),
      exportedAt: new Date().toISOString(),
    };
  }

  /**
   * Import network configuration
   */
  importConfiguration(config: any): ConfigResult {
    return this.configManager.importConfiguration(config);
  }

  /**
   * Get available network templates
   */
  getAvailableTemplates() {
    return this.configManager.getAvailableTemplates();
  }

  /**
   * Check connectivity between devices
   */
  checkConnectivity(sourceDeviceId: string, targetDeviceId: string) {
    return this.troubleshootingTools.checkConnectivity(sourceDeviceId, targetDeviceId);
  }

  /**
   * Get routing table for a device
   */
  getRoutingTable(deviceId: string) {
    return this.routingEngine.getRoutingTable(deviceId);
  }

  /**
   * Get MAC address table for a switch
   */
  getMacAddressTable(deviceId: string) {
    return this.simulationEngine?.getMacTable(deviceId) || [];
  }

  /**
   * Get ARP table for a device
   */
  getArpTable(deviceId: string) {
    return this.simulationEngine?.getArpTable(deviceId) || [];
  }

  /**
   * Get STP information for a switch
   */
  getSTPInfo(deviceId: string) {
    return this.stpManager.getBridgeInfo(deviceId);
  }

  /**
   * Get DHCP leases
   */
  getDHCPLeases() {
    return this.ipManager.getDHCPServer().getActiveLeases();
  }

  /**
   * Trigger STP topology change
   */
  triggerSTPTopologyChange(deviceId: string): ConfigResult {
    try {
      this.stpManager.triggerTopologyChange(deviceId);
      return {
        success: true,
        message: `STP topology change triggered on device ${deviceId}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to trigger topology change: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get simulation engine instance (for advanced operations)
   */
  getSimulationEngine(): SimulationEngine | undefined {
    return this.simulationEngine;
  }

  /**
   * Private helper methods
   */
  private createDefaultVLANs(): void {
    const defaultVLANs = [
      { id: 1, name: 'Default', description: 'Default VLAN', type: 'normal', status: 'active' },
      { id: 10, name: 'Management', description: 'Management VLAN', type: 'management', status: 'active' },
      { id: 20, name: 'Data', description: 'Data VLAN', type: 'data', status: 'active' },
      { id: 30, name: 'Voice', description: 'Voice VLAN', type: 'voice', status: 'active' },
    ];

    defaultVLANs.forEach(vlanConfig => {
      const result = this.configManager.configureVlan(vlanConfig as any);
      if (result.success && result.data?.vlan) {
        this.vlans.set(vlanConfig.id, result.data.vlan);
      }
    });
  }

  private setupDefaultDHCPPools(baseNetwork: string, vlanIds: number[]): void {
    const baseOctets = baseNetwork.split('.').slice(0, 2);
    
    vlanIds.forEach(vlanId => {
      const network = `${baseOctets[0]}.${baseOctets[1]}.${vlanId}.0`;
      const poolConfig = {
        network,
        mask: '255.255.255.0',
        rangeStart: `${baseOctets[0]}.${baseOctets[1]}.${vlanId}.100`,
        rangeEnd: `${baseOctets[0]}.${baseOctets[1]}.${vlanId}.200`,
        defaultGateway: `${baseOctets[0]}.${baseOctets[1]}.${vlanId}.1`,
        dnsServers: ['8.8.8.8', '8.8.4.4'],
        leaseTime: 86400, // 24 hours
        isEnabled: true,
        excludedAddresses: [],
      };

      this.configManager.configureDHCPPool(`VLAN${vlanId}_Pool`, poolConfig);
    });
  }
}