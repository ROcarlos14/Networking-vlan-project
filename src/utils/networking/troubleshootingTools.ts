import {
  NetworkDevice,
  RouterDevice,
  SwitchDevice,
  PcDevice,
  ServerDevice,
  DeviceType,
  Connection,
  Vlan,
  NetworkInterface,
  InterfaceStatus,
  SpanningTreePortState,
} from '../../types';
import { NetworkIPManager } from './ipAddressManager';
import { RoutingEngine, EnhancedRouteEntry } from '../routing/routingEngine';
import { SpanningTreeProtocol, STPPortInfo, STPBridgeInfo } from './spanningTreeProtocol';
import { SimulationEngine } from '../simulation/simulationEngine';

/**
 * Command execution result
 */
export interface CommandResult {
  success: boolean;
  output: string;
  data?: any;
  executionTime: number;
}

/**
 * Ping result statistics
 */
export interface PingResult {
  target: string;
  packetsTransmitted: number;
  packetsReceived: number;
  packetLoss: number;
  minTime: number;
  maxTime: number;
  avgTime: number;
  responses: Array<{
    sequenceNumber: number;
    time: number;
    ttl: number;
    size: number;
  }>;
}

/**
 * Traceroute hop information
 */
export interface TracerouteHop {
  hopNumber: number;
  deviceId: string;
  deviceName: string;
  ipAddress: string;
  responseTime: number;
  timeout: boolean;
}

/**
 * Traceroute result
 */
export interface TracerouteResult {
  target: string;
  hops: TracerouteHop[];
  completed: boolean;
  maxHopsReached: boolean;
}

/**
 * Interface status information
 */
export interface InterfaceStatusInfo {
  name: string;
  status: InterfaceStatus;
  protocol: 'up' | 'down';
  ipAddress?: string;
  mtu: number;
  bandwidth: number;
  delay: number;
  reliability: number;
  load: number;
  encapsulation: string;
  duplex: string;
  speed: number;
  mediaType: string;
  inputPackets: number;
  outputPackets: number;
  inputBytes: number;
  outputBytes: number;
  inputErrors: number;
  outputErrors: number;
  collisions: number;
}

/**
 * Network troubleshooting and diagnostic tools
 * Provides Cisco IOS-style show commands and network utilities
 */
export class NetworkTroubleshootingTools {
  private devices: Map<string, NetworkDevice> = new Map();
  private connections: Connection[] = [];
  private vlans: Map<number, Vlan> = new Map();
  private ipManager?: NetworkIPManager;
  private routingEngine?: RoutingEngine;
  private stpManager?: SpanningTreeProtocol;
  private simulationEngine?: SimulationEngine;

  constructor() {}

  /**
   * Initialize with network components
   */
  initialize(
    devices: NetworkDevice[],
    connections: Connection[],
    vlans: Vlan[],
    ipManager?: NetworkIPManager,
    routingEngine?: RoutingEngine,
    stpManager?: SpanningTreeProtocol,
    simulationEngine?: SimulationEngine
  ): void {
    this.devices.clear();
    devices.forEach(device => {
      this.devices.set(device.id, device);
    });

    this.connections = connections;
    
    this.vlans.clear();
    vlans.forEach(vlan => {
      this.vlans.set(vlan.id, vlan);
    });

    this.ipManager = ipManager;
    this.routingEngine = routingEngine;
    this.stpManager = stpManager;
    this.simulationEngine = simulationEngine;
  }

  /**
   * Execute show command
   * Command: show <command>
   */
  executeShowCommand(deviceId: string, command: string): CommandResult {
    const startTime = Date.now();
    const device = this.devices.get(deviceId);

    if (!device) {
      return {
        success: false,
        output: `Device ${deviceId} not found`,
        executionTime: Date.now() - startTime,
      };
    }

    const parts = command.toLowerCase().split(' ').filter(Boolean);
    if (parts[0] !== 'show') {
      return {
        success: false,
        output: 'Invalid command. Use "show <command>"',
        executionTime: Date.now() - startTime,
      };
    }

    let output = '';
    let success = true;
    let data = undefined;

    try {
      switch (parts.slice(1).join(' ')) {
        case 'version':
          output = this.showVersion(device);
          break;
        case 'running-config':
        case 'run':
          output = this.showRunningConfig(device);
          break;
        case 'interfaces':
        case 'int':
          output = this.showInterfaces(device);
          break;
        case 'interfaces brief':
        case 'int brief':
        case 'ip int brief':
          output = this.showInterfacesBrief(device);
          break;
        case 'ip route':
          output = this.showIpRoute(device);
          break;
        case 'vlan':
        case 'vlan brief':
          output = this.showVlan(device);
          break;
        case 'vlan-switch':
          output = this.showVlanSwitch(device);
          break;
        case 'mac address-table':
        case 'mac-address-table':
          output = this.showMacAddressTable(device);
          break;
        case 'arp':
          output = this.showArp(device);
          break;
        case 'spanning-tree':
        case 'stp':
          output = this.showSpanningTree(device);
          break;
        case 'cdp neighbors':
          output = this.showCdpNeighbors(device);
          break;
        case 'inventory':
        case 'inv':
          output = this.showInventory(device);
          break;
        case 'processes':
        case 'proc':
          output = this.showProcesses(device);
          break;
        case 'memory':
        case 'mem':
          output = this.showMemory(device);
          break;
        case 'dhcp binding':
          output = this.showDhcpBinding();
          break;
        default:
          if (parts[1] === 'interface' && parts.length >= 3) {
            output = this.showInterface(device, parts.slice(2).join(' '));
          } else if (parts[1] === 'vlan' && parts.length >= 3) {
            const vlanId = parseInt(parts[2]);
            output = this.showVlanDetail(device, vlanId);
          } else {
            success = false;
            output = `Unknown command: ${parts.slice(1).join(' ')}`;
          }
          break;
      }
    } catch (error) {
      success = false;
      output = `Command execution error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }

    return {
      success,
      output,
      data,
      executionTime: Date.now() - startTime,
    };
  }

  /**
   * Execute ping command
   * Command: ping <target>
   */
  ping(sourceDeviceId: string, target: string, count: number = 4, timeout: number = 5000): Promise<PingResult> {
    return new Promise((resolve) => {
      const result: PingResult = {
        target,
        packetsTransmitted: 0,
        packetsReceived: 0,
        packetLoss: 0,
        minTime: Infinity,
        maxTime: 0,
        avgTime: 0,
        responses: [],
      };

      let completedPings = 0;
      const pingTimes: number[] = [];

      const sendPing = (sequenceNumber: number) => {
        const startTime = Date.now();
        result.packetsTransmitted++;

        // Simulate ping using the simulation engine if available
        if (this.simulationEngine) {
          const targetDevice = this.findDeviceByIpOrName(target);
          if (targetDevice) {
            const packet = this.simulationEngine.createTestPacket(
              sourceDeviceId,
              targetDevice.id,
              'ip' as any,
              'icmp' as any
            );

            if (packet) {
              this.simulationEngine.sendPacket(packet);
              
              // Simulate response time based on network topology
              const responseTime = this.calculatePingTime(sourceDeviceId, targetDevice.id);
              
              setTimeout(() => {
                result.packetsReceived++;
                result.responses.push({
                  sequenceNumber,
                  time: responseTime,
                  ttl: 64,
                  size: 32,
                });

                pingTimes.push(responseTime);
                result.minTime = Math.min(result.minTime, responseTime);
                result.maxTime = Math.max(result.maxTime, responseTime);

                completedPings++;
                if (completedPings === count) {
                  result.packetLoss = ((result.packetsTransmitted - result.packetsReceived) / result.packetsTransmitted) * 100;
                  result.avgTime = pingTimes.reduce((sum, time) => sum + time, 0) / pingTimes.length;
                  resolve(result);
                }
              }, responseTime);
            } else {
              completedPings++;
              if (completedPings === count) {
                result.packetLoss = ((result.packetsTransmitted - result.packetsReceived) / result.packetsTransmitted) * 100;
                result.avgTime = pingTimes.length > 0 ? pingTimes.reduce((sum, time) => sum + time, 0) / pingTimes.length : 0;
                resolve(result);
              }
            }
          } else {
            completedPings++;
            if (completedPings === count) {
              result.packetLoss = 100;
              resolve(result);
            }
          }
        } else {
          // Fallback simulation without simulation engine
          const responseTime = 10 + Math.random() * 90; // 10-100ms
          setTimeout(() => {
            result.packetsReceived++;
            result.responses.push({
              sequenceNumber,
              time: responseTime,
              ttl: 64,
              size: 32,
            });

            pingTimes.push(responseTime);
            result.minTime = Math.min(result.minTime, responseTime);
            result.maxTime = Math.max(result.maxTime, responseTime);

            completedPings++;
            if (completedPings === count) {
              result.packetLoss = ((result.packetsTransmitted - result.packetsReceived) / result.packetsTransmitted) * 100;
              result.avgTime = pingTimes.reduce((sum, time) => sum + time, 0) / pingTimes.length;
              resolve(result);
            }
          }, responseTime);
        }
      };

      // Send pings with interval
      for (let i = 1; i <= count; i++) {
        setTimeout(() => sendPing(i), (i - 1) * 1000);
      }
    });
  }

  /**
   * Execute traceroute command
   * Command: traceroute <target>
   */
  traceroute(sourceDeviceId: string, target: string, maxHops: number = 30): Promise<TracerouteResult> {
    return new Promise((resolve) => {
      const result: TracerouteResult = {
        target,
        hops: [],
        completed: false,
        maxHopsReached: false,
      };

      const targetDevice = this.findDeviceByIpOrName(target);
      if (!targetDevice) {
        resolve(result);
        return;
      }

      // Calculate path using routing information or simple topology traversal
      const path = this.calculateNetworkPath(sourceDeviceId, targetDevice.id);
      
      let hopNumber = 1;
      const processHop = (deviceId: string) => {
        const device = this.devices.get(deviceId);
        if (!device) return;

        const responseTime = 10 + Math.random() * 90; // Simulate response time
        const ipAddress = this.getDeviceIpAddress(device) || 'unknown';

        result.hops.push({
          hopNumber,
          deviceId,
          deviceName: device.name,
          ipAddress,
          responseTime,
          timeout: false,
        });

        hopNumber++;

        if (deviceId === targetDevice.id) {
          result.completed = true;
          resolve(result);
        } else if (hopNumber > maxHops) {
          result.maxHopsReached = true;
          resolve(result);
        }
      };

      // Process each hop with delay to simulate real traceroute
      path.forEach((deviceId, index) => {
        setTimeout(() => processHop(deviceId), index * 1000);
      });

      // Fallback timeout
      setTimeout(() => {
        if (!result.completed) {
          result.maxHopsReached = true;
          resolve(result);
        }
      }, maxHops * 1000 + 5000);
    });
  }

  /**
   * Check connectivity between two devices
   */
  checkConnectivity(sourceDeviceId: string, targetDeviceId: string): {
    connected: boolean;
    path: string[];
    issues: string[];
  } {
    const issues: string[] = [];
    
    const sourceDevice = this.devices.get(sourceDeviceId);
    const targetDevice = this.devices.get(targetDeviceId);

    if (!sourceDevice || !targetDevice) {
      issues.push('Source or target device not found');
      return { connected: false, path: [], issues };
    }

    // Check if devices are in same VLAN
    const sourceVlans = this.getDeviceVlans(sourceDevice);
    const targetVlans = this.getDeviceVlans(targetDevice);
    const commonVlans = sourceVlans.filter(vlan => targetVlans.includes(vlan));

    if (commonVlans.length === 0 && sourceDevice.type !== DeviceType.ROUTER && targetDevice.type !== DeviceType.ROUTER) {
      issues.push('Devices are not in the same VLAN and no router is configured for inter-VLAN routing');
    }

    // Calculate network path
    const path = this.calculateNetworkPath(sourceDeviceId, targetDeviceId);
    
    if (path.length === 0) {
      issues.push('No network path found between devices');
      return { connected: false, path: [], issues };
    }

    // Check if all devices in path are active
    const inactivePath = path.filter(deviceId => {
      const device = this.devices.get(deviceId);
      return device?.status !== 'active';
    });

    if (inactivePath.length > 0) {
      issues.push(`Inactive devices in path: ${inactivePath.join(', ')}`);
    }

    return {
      connected: issues.length === 0,
      path,
      issues,
    };
  }

  /**
   * Show device version information
   */
  private showVersion(device: NetworkDevice): string {
    return `
${device.name} uptime is 1 day, 2 hours, 15 minutes
System returned to ROM by power-on
System image file is "flash://${device.type}-simulator.bin"

Cisco ${device.type.toUpperCase()} Simulator (Revision 1.0)
${device.type === DeviceType.ROUTER ? 'with 256 MB DRAM' : 'with 128 MB DRAM'}

Configuration register is 0x2102
    `.trim();
  }

  /**
   * Show running configuration
   */
  private showRunningConfig(device: NetworkDevice): string {
    let config = `Building configuration...\n\nCurrent configuration : 1234 bytes\n!\nversion 15.0\nservice timestamps debug datetime msec\nservice timestamps log datetime msec\nno service password-encryption\n!\nhostname ${device.name}\n!\n`;

    // Add interface configurations
    const interfaces = this.getDeviceInterfaces(device);
    interfaces.forEach(iface => {
      config += `interface ${iface.name}\n`;
      if (iface.ipAddress) {
        config += ` ip address ${iface.ipAddress}\n`;
      }
      if (iface.status === InterfaceStatus.ADMIN_DOWN) {
        config += ` shutdown\n`;
      }
      config += `!\n`;
    });

    // Add routing configuration for routers
    if (device.type === DeviceType.ROUTER && this.routingEngine) {
      const routes = this.routingEngine.getRoutingTable(device.id);
      routes.forEach(route => {
        if (route.protocol === 'static') {
          config += `ip route ${route.network} ${route.mask} ${route.nextHop}\n`;
        }
      });
    }

    config += `!\nend\n`;
    return config;
  }

  /**
   * Show interfaces
   */
  private showInterfaces(device: NetworkDevice): string {
    const interfaces = this.getDeviceInterfaces(device);
    let output = '';

    interfaces.forEach(iface => {
      const statusInfo = this.getInterfaceStatusInfo(iface, device);
      output += `${iface.name} is ${statusInfo.status}, line protocol is ${statusInfo.protocol}
  Hardware is ${statusInfo.mediaType}, address is ${iface.macAddress}
  Internet address is ${statusInfo.ipAddress || 'unassigned'}
  MTU ${statusInfo.mtu} bytes, BW ${statusInfo.bandwidth} Kbit/sec, DLY ${statusInfo.delay} usec,
     reliability ${statusInfo.reliability}/255, txload ${statusInfo.load}/255, rxload ${statusInfo.load}/255
  Encapsulation ${statusInfo.encapsulation}, loopback not set
  Last input 00:00:01, output 00:00:01, output hang never
  Last clearing of "show interface" counters never
  Input queue: 0/75/0/0 (size/max/drops/flushes); Total output drops: 0
  Queueing strategy: fifo
  Output queue: 0/0 (size/max)
  5 minute input rate ${Math.round(Math.random() * 1000)} bits/sec, ${Math.round(Math.random() * 10)} packets/sec
  5 minute output rate ${Math.round(Math.random() * 1000)} bits/sec, ${Math.round(Math.random() * 10)} packets/sec
     ${statusInfo.inputPackets} packets input, ${statusInfo.inputBytes} bytes, 0 no buffer
     Received 0 broadcasts, 0 runts, 0 giants, 0 throttles
     ${statusInfo.inputErrors} input errors, 0 CRC, 0 frame, 0 overrun, 0 ignored
     ${statusInfo.outputPackets} packets output, ${statusInfo.outputBytes} bytes, 0 underruns
     ${statusInfo.outputErrors} output errors, ${statusInfo.collisions} collisions, 1 interface resets
     0 unknown protocol drops
     0 output buffer failures, 0 output buffers swapped out

`;
    });

    return output.trim();
  }

  /**
   * Show interfaces brief
   */
  private showInterfacesBrief(device: NetworkDevice): string {
    const interfaces = this.getDeviceInterfaces(device);
    let output = 'Interface              IP-Address      OK? Method Status                Protocol\n';

    interfaces.forEach(iface => {
      const statusInfo = this.getInterfaceStatusInfo(iface, device);
      const ipAddr = statusInfo.ipAddress || 'unassigned';
      output += `${iface.name.padEnd(22)} ${ipAddr.padEnd(15)} YES NVRAM  ${statusInfo.status.padEnd(20)} ${statusInfo.protocol}\n`;
    });

    return output;
  }

  /**
   * Show IP routing table
   */
  private showIpRoute(device: NetworkDevice): string {
    if (device.type !== DeviceType.ROUTER || !this.routingEngine) {
      return 'This command is only available on routers.';
    }

    const routes = this.routingEngine.getRoutingTable(device.id);
    let output = 'Codes: C - connected, S - static, R - RIP, M - mobile, B - BGP\n';
    output += '       D - EIGRP, EX - EIGRP external, O - OSPF, IA - OSPF inter area\n';
    output += '       N1 - OSPF NSSA external type 1, N2 - OSPF NSSA external type 2\n';
    output += '       E1 - OSPF external type 1, E2 - OSPF external type 2\n';
    output += '       i - IS-IS, su - IS-IS summary, L1 - IS-IS level-1, L2 - IS-IS level-2\n';
    output += '       ia - IS-IS inter area, * - candidate default, U - per-user static route\n';
    output += '       o - ODR, P - periodic downloaded static route\n\n';
    output += 'Gateway of last resort is not set\n\n';

    routes.forEach(route => {
      const code = this.getRouteCode(route.protocol);
      const prefix = this.maskToPrefix(route.mask);
      output += `${code} ${route.network}/${prefix}`;
      
      if (route.protocol === 'connected') {
        output += ` is directly connected, ${route.interface}\n`;
      } else {
        output += ` [${route.administrativeDistance}/${route.metric}] via ${route.nextHop}, ${route.interface}\n`;
      }
    });

    return output;
  }

  /**
   * Show VLAN information
   */
  private showVlan(device: NetworkDevice): string {
    let output = 'VLAN Name                             Status    Ports\n';
    output += '---- -------------------------------- --------- -------------------------------\n';

    this.vlans.forEach(vlan => {
      const ports = this.getVlanPorts(device, vlan.id);
      const portList = ports.length > 0 ? ports.join(', ') : 'none';
      output += `${vlan.id.toString().padStart(4)} ${vlan.name.padEnd(32)} ${vlan.status.padEnd(9)} ${portList}\n`;
    });

    return output;
  }

  /**
   * Show VLAN switch information
   */
  private showVlanSwitch(device: NetworkDevice): string {
    if (device.type !== DeviceType.SWITCH) {
      return 'This command is only available on switches.';
    }

    const sw = device as SwitchDevice;
    let output = 'VLAN Switch Database:\n';
    output += 'VLAN ID  Name               Status\n';
    output += '-------  ------------------ ----------\n';

    sw.vlanDatabase.forEach(vlanEntry => {
      output += `${vlanEntry.id.toString().padStart(7)}  ${vlanEntry.name.padEnd(18)} ${vlanEntry.status}\n`;
    });

    return output;
  }

  /**
   * Show MAC address table
   */
  private showMacAddressTable(device: NetworkDevice): string {
    if (device.type !== DeviceType.SWITCH || !this.simulationEngine) {
      return 'MAC address table is only available on switches with simulation engine.';
    }

    const macEntries = this.simulationEngine.getMacTable(device.id);
    let output = '          Mac Address Table\n';
    output += '-------------------------------------------\n';
    output += 'Vlan    Mac Address       Type        Ports\n';
    output += '----    -----------       --------    -----\n';

    macEntries.forEach(entry => {
      output += `${entry.vlanId.toString().padStart(4)}    ${entry.macAddress.padEnd(17)} ${entry.type.padEnd(11)} ${entry.interface}\n`;
    });

    return output || 'MAC address table is empty.';
  }

  /**
   * Show ARP table
   */
  private showArp(device: NetworkDevice): string {
    if (!this.simulationEngine) {
      return 'ARP table requires simulation engine.';
    }

    const arpEntries = this.simulationEngine.getArpTable(device.id);
    let output = 'Protocol  Address          Age (min)  Hardware Addr   Type   Interface\n';

    arpEntries.forEach(entry => {
      const age = Math.floor((Date.now() - entry.timestamp.getTime()) / 60000);
      output += `Internet  ${entry.ipAddress.padEnd(15)}  ${age.toString().padStart(9)}  ${entry.macAddress}  ARPA   ${entry.deviceId}\n`;
    });

    return output || 'ARP table is empty.';
  }

  /**
   * Show spanning tree information
   */
  private showSpanningTree(device: NetworkDevice): string {
    if (device.type !== DeviceType.SWITCH || !this.stpManager) {
      return 'Spanning tree information is only available on switches.';
    }

    const bridgeInfo = this.stpManager.getBridgeInfo(device.id);
    if (!bridgeInfo) {
      return 'Spanning tree is not enabled on this switch.';
    }

    let output = `\nSpanning tree enabled protocol ieee\nRoot ID    Priority    ${bridgeInfo.priority}\n`;
    output += `           Address     ${bridgeInfo.macAddress}\n`;
    
    if (bridgeInfo.isRoot) {
      output += `           This bridge is the root\n`;
    } else {
      output += `           Cost        ${bridgeInfo.rootPathCost}\n`;
      output += `           Port        ${bridgeInfo.rootPort || 'none'}\n`;
    }

    output += `\nBridge ID  Priority    ${bridgeInfo.priority}\n`;
    output += `           Address     ${bridgeInfo.macAddress}\n`;
    output += `\nInterface           Role Sts Cost      Prio.Nbr Type\n`;
    output += `------------------- ---- --- --------- -------- --------------------------------\n`;

    bridgeInfo.ports.forEach(port => {
      const roleAbbrev = this.getSTPRoleAbbreviation(port.role);
      const stateAbbrev = this.getSTPStateAbbreviation(port.state);
      output += `${port.interfaceId.padEnd(19)} ${roleAbbrev} ${stateAbbrev} ${port.pathCost.toString().padStart(9)} ${port.priority.toString().padStart(8)} P2p\n`;
    });

    return output;
  }

  /**
   * Show CDP neighbors
   */
  private showCdpNeighbors(device: NetworkDevice): string {
    let output = 'Capability Codes: R - Router, T - Trans-Bridge, B - Source-Route-Bridge\n';
    output += '                  S - Switch, H - Host, I - IGMP, r - Repeater\n\n';
    output += 'Device ID        Local Intrfce     Holdtme    Capability  Platform  Port ID\n';

    // Find connected devices
    const connectedDevices = this.getConnectedDevices(device.id);
    
    connectedDevices.forEach(({ connectedDevice, localInterface, remoteInterface }) => {
      const capability = this.getDeviceCapability(connectedDevice);
      output += `${connectedDevice.name.padEnd(16)} ${localInterface.padEnd(17)} 120        ${capability.padEnd(11)} Simulator ${remoteInterface}\n`;
    });

    return output || 'No CDP neighbors found.';
  }

  /**
   * Show inventory
   */
  private showInventory(device: NetworkDevice): string {
    let output = `NAME: "${device.name}", DESCR: "Cisco ${device.type.toUpperCase()} Simulator"\n`;
    output += `PID: ${device.type.toUpperCase()}-SIM   , VID: V01  , SN: SIM${device.id.slice(-8).toUpperCase()}\n\n`;

    const interfaces = this.getDeviceInterfaces(device);
    interfaces.forEach(iface => {
      output += `NAME: "${iface.name}", DESCR: "Simulated Interface"\n`;
      output += `PID: INT-SIM      , VID:     , SN:           \n\n`;
    });

    return output;
  }

  /**
   * Show processes
   */
  private showProcesses(device: NetworkDevice): string {
    const processes = [
      { pid: 1, priority: '5', scheduler: '5ms', cpu: '0.00%', runtime: 0, invoked: 1, usecs: 0, name: 'Kernel' },
      { pid: 2, priority: '5', scheduler: '0ms', cpu: '0.00%', runtime: 0, invoked: 1, usecs: 0, name: 'Init' },
      { pid: 3, priority: '5', scheduler: '0ms', cpu: '0.00%', runtime: 4, invoked: 86, usecs: 46, name: 'BGP Scheduler' },
      { pid: 4, priority: '5', scheduler: '0ms', cpu: '0.00%', runtime: 0, invoked: 1, usecs: 0, name: 'OSPF Hello' },
    ];

    let output = '   PID Priority      Scheduler  CPU Time        Invoked      uSecs   Name\n';
    processes.forEach(proc => {
      output += `${proc.pid.toString().padStart(6)} ${proc.priority.padEnd(8)} ${proc.scheduler.padEnd(10)} ${proc.cpu.padStart(8)} ${proc.runtime.toString().padStart(10)} ${proc.invoked.toString().padStart(10)} ${proc.usecs.toString().padStart(8)}   ${proc.name}\n`;
    });

    return output;
  }

  /**
   * Show memory usage
   */
  private showMemory(device: NetworkDevice): string {
    const total = device.type === DeviceType.ROUTER ? 262144 : 131072; // 256MB or 128MB
    const used = Math.floor(total * (0.3 + Math.random() * 0.4)); // 30-70% usage
    const free = total - used;

    let output = `                Head    Total(b)     Used(b)     Free(b)   Lowest(b)  Largest(b)\n`;
    output += `Processor   60000000  ${total.toString().padStart(10)}  ${used.toString().padStart(10)}  ${free.toString().padStart(10)}  ${free.toString().padStart(10)}  ${(free - 1000).toString().padStart(10)}\n`;
    output += `      I/O    6000000    ${Math.floor(total * 0.1).toString().padStart(10)}  ${Math.floor(total * 0.05).toString().padStart(10)}  ${Math.floor(total * 0.05).toString().padStart(10)}  ${Math.floor(total * 0.05).toString().padStart(10)}  ${Math.floor(total * 0.04).toString().padStart(10)}\n`;

    return output;
  }

  /**
   * Show DHCP bindings
   */
  private showDhcpBinding(): string {
    if (!this.ipManager) {
      return 'DHCP service not available.';
    }

    const leases = this.ipManager.getDHCPServer().getActiveLeases();
    let output = 'Bindings from all pools not associated with VRF:\n';
    output += 'IP address          Client-ID/              Lease expiration        Type\n';
    output += '                    Hardware address/\n';
    output += '                    User name\n';

    leases.forEach(lease => {
      output += `${lease.ipAddress.padEnd(19)} ${lease.clientMac.padEnd(23)} ${lease.renewalTime.toLocaleString().padEnd(23)} Automatic\n`;
    });

    return output || 'No DHCP bindings found.';
  }

  /**
   * Show specific interface
   */
  private showInterface(device: NetworkDevice, interfaceName: string): string {
    const interfaces = this.getDeviceInterfaces(device);
    const targetInterface = interfaces.find(iface => 
      iface.name.toLowerCase() === interfaceName.toLowerCase()
    );

    if (!targetInterface) {
      return `Interface ${interfaceName} not found.`;
    }

    const statusInfo = this.getInterfaceStatusInfo(targetInterface, device);
    
    return `${targetInterface.name} is ${statusInfo.status}, line protocol is ${statusInfo.protocol}
  Hardware is ${statusInfo.mediaType}, address is ${targetInterface.macAddress}
  Internet address is ${statusInfo.ipAddress || 'unassigned'}
  MTU ${statusInfo.mtu} bytes, BW ${statusInfo.bandwidth} Kbit/sec, DLY ${statusInfo.delay} usec,
     reliability ${statusInfo.reliability}/255, txload ${statusInfo.load}/255, rxload ${statusInfo.load}/255
  Encapsulation ${statusInfo.encapsulation}, loopback not set
  Full Duplex, ${targetInterface.speed}Mbps, media type is RJ45
  output flow-control is unsupported, input flow-control is unsupported
  Last input 00:00:01, output 00:00:01, output hang never
  Last clearing of "show interface" counters never
  Input queue: 0/75/0/0 (size/max/drops/flushes); Total output drops: 0
  Queueing strategy: fifo
  Output queue: 0/0 (size/max)
  5 minute input rate ${Math.round(Math.random() * 1000)} bits/sec, ${Math.round(Math.random() * 10)} packets/sec
  5 minute output rate ${Math.round(Math.random() * 1000)} bits/sec, ${Math.round(Math.random() * 10)} packets/sec
     ${statusInfo.inputPackets} packets input, ${statusInfo.inputBytes} bytes, 0 no buffer
     Received 0 broadcasts (0 IP multicasts)
     0 runts, 0 giants, 0 throttles
     ${statusInfo.inputErrors} input errors, 0 CRC, 0 frame, 0 overrun, 0 ignored
     0 watchdog, 0 multicast, 0 pause input
     ${statusInfo.outputPackets} packets output, ${statusInfo.outputBytes} bytes, 0 underruns
     ${statusInfo.outputErrors} output errors, ${statusInfo.collisions} collisions, 2 interface resets
     0 late collision, 0 deferred, 0 lost carrier, 0 no carrier, 0 pause output
     0 output buffer failures, 0 output buffers swapped out`;
  }

  /**
   * Helper methods
   */
  private getDeviceInterfaces(device: NetworkDevice): NetworkInterface[] {
    switch (device.type) {
      case DeviceType.PC:
        return [(device as PcDevice).interface];
      case DeviceType.SERVER:
        return (device as ServerDevice).interfaces;
      case DeviceType.ROUTER:
        return (device as RouterDevice).interfaces;
      case DeviceType.SWITCH:
        return (device as SwitchDevice).interfaces;
      default:
        return [];
    }
  }

  private getInterfaceStatusInfo(iface: NetworkInterface, device: NetworkDevice): InterfaceStatusInfo {
    const isUp = iface.status === InterfaceStatus.UP;
    return {
      name: iface.name,
      status: iface.status,
      protocol: isUp ? 'up' : 'down',
      ipAddress: iface.ipAddress,
      mtu: 1500,
      bandwidth: iface.speed * 1000, // Convert to Kbit/sec
      delay: iface.speed >= 1000 ? 10 : 100, // usec
      reliability: 255,
      load: Math.floor(Math.random() * 5),
      encapsulation: 'ARPA',
      duplex: iface.duplex,
      speed: iface.speed,
      mediaType: 'RJ45',
      inputPackets: Math.floor(Math.random() * 10000),
      outputPackets: Math.floor(Math.random() * 10000),
      inputBytes: Math.floor(Math.random() * 1000000),
      outputBytes: Math.floor(Math.random() * 1000000),
      inputErrors: Math.floor(Math.random() * 5),
      outputErrors: Math.floor(Math.random() * 5),
      collisions: Math.floor(Math.random() * 3),
    };
  }

  private getRouteCode(protocol: string): string {
    switch (protocol) {
      case 'connected': return 'C';
      case 'static': return 'S';
      case 'ospf': return 'O';
      case 'rip': return 'R';
      case 'bgp': return 'B';
      default: return '?';
    }
  }

  private maskToPrefix(mask: string): number {
    const parts = mask.split('.').map(Number);
    const binaryMask = (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
    return 32 - Math.log2((~binaryMask >>> 0) + 1);
  }

  private getVlanPorts(device: NetworkDevice, vlanId: number): string[] {
    const interfaces = this.getDeviceInterfaces(device);
    return interfaces
      .filter(iface => {
        return iface.vlanConfig?.accessVlan === vlanId || 
               iface.vlanConfig?.allowedVlans?.includes(vlanId) ||
               iface.vlanConfig?.nativeVlan === vlanId;
      })
      .map(iface => iface.name);
  }

  private getSTPRoleAbbreviation(role: any): string {
    switch (role) {
      case 'root': return 'Root';
      case 'designated': return 'Desg';
      case 'blocked': return 'Blck';
      case 'disabled': return 'Dsbl';
      default: return 'Unkn';
    }
  }

  private getSTPStateAbbreviation(state: SpanningTreePortState): string {
    switch (state) {
      case SpanningTreePortState.FORWARDING: return 'FWD';
      case SpanningTreePortState.LEARNING: return 'LRN';
      case SpanningTreePortState.LISTENING: return 'LIS';
      case SpanningTreePortState.BLOCKING: return 'BLK';
      case SpanningTreePortState.DISABLED: return 'DIS';
      default: return 'UNK';
    }
  }

  private getConnectedDevices(deviceId: string): Array<{
    connectedDevice: NetworkDevice;
    localInterface: string;
    remoteInterface: string;
  }> {
    const results: Array<{
      connectedDevice: NetworkDevice;
      localInterface: string;
      remoteInterface: string;
    }> = [];

    this.connections.forEach(conn => {
      let connectedDeviceId: string | undefined;
      let localInterface: string;
      let remoteInterface: string;

      if (conn.sourceDevice === deviceId) {
        connectedDeviceId = conn.targetDevice;
        localInterface = this.getInterfaceName(deviceId, conn.sourceInterface);
        remoteInterface = this.getInterfaceName(conn.targetDevice, conn.targetInterface);
      } else if (conn.targetDevice === deviceId) {
        connectedDeviceId = conn.sourceDevice;
        localInterface = this.getInterfaceName(deviceId, conn.targetInterface);
        remoteInterface = this.getInterfaceName(conn.sourceDevice, conn.sourceInterface);
      } else {
        return;
      }

      const connectedDevice = this.devices.get(connectedDeviceId);
      if (connectedDevice) {
        results.push({
          connectedDevice,
          localInterface,
          remoteInterface,
        });
      }
    });

    return results;
  }

  private getInterfaceName(deviceId: string, interfaceId: string): string {
    const device = this.devices.get(deviceId);
    if (!device) return 'unknown';

    const interfaces = this.getDeviceInterfaces(device);
    const iface = interfaces.find(i => i.id === interfaceId);
    return iface?.name || 'unknown';
  }

  private getDeviceCapability(device: NetworkDevice): string {
    switch (device.type) {
      case DeviceType.ROUTER: return 'R';
      case DeviceType.SWITCH: return 'S';
      case DeviceType.PC: return 'H';
      case DeviceType.SERVER: return 'H S';
      default: return '';
    }
  }

  private findDeviceByIpOrName(target: string): NetworkDevice | undefined {
    // First try to find by IP address
    for (const device of this.devices.values()) {
      const ip = this.getDeviceIpAddress(device);
      if (ip === target) return device;
    }

    // Then try to find by name
    for (const device of this.devices.values()) {
      if (device.name.toLowerCase() === target.toLowerCase()) return device;
    }

    return undefined;
  }

  private getDeviceIpAddress(device: NetworkDevice): string | undefined {
    const interfaces = this.getDeviceInterfaces(device);
    for (const iface of interfaces) {
      if (iface.ipAddress) {
        return iface.ipAddress.split('/')[0]; // Remove CIDR notation
      }
    }
    return undefined;
  }

  private getDeviceVlans(device: NetworkDevice): number[] {
    const vlans = new Set<number>();
    const interfaces = this.getDeviceInterfaces(device);

    interfaces.forEach(iface => {
      if (iface.vlanConfig?.accessVlan) {
        vlans.add(iface.vlanConfig.accessVlan);
      }
      if (iface.vlanConfig?.allowedVlans) {
        iface.vlanConfig.allowedVlans.forEach(vlan => vlans.add(vlan));
      }
      if (iface.vlanConfig?.nativeVlan) {
        vlans.add(iface.vlanConfig.nativeVlan);
      }
    });

    return Array.from(vlans);
  }

  private calculateNetworkPath(sourceId: string, targetId: string): string[] {
    if (sourceId === targetId) return [sourceId];

    // Simple BFS to find path
    const queue = [{ deviceId: sourceId, path: [sourceId] }];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { deviceId, path } = queue.shift()!;
      
      if (deviceId === targetId) {
        return path;
      }

      if (visited.has(deviceId)) continue;
      visited.add(deviceId);

      // Find connected devices
      this.connections.forEach(conn => {
        let nextDeviceId: string | undefined;
        
        if (conn.sourceDevice === deviceId) {
          nextDeviceId = conn.targetDevice;
        } else if (conn.targetDevice === deviceId) {
          nextDeviceId = conn.sourceDevice;
        }

        if (nextDeviceId && !visited.has(nextDeviceId)) {
          queue.push({
            deviceId: nextDeviceId,
            path: [...path, nextDeviceId]
          });
        }
      });
    }

    return [];
  }

  private calculatePingTime(sourceId: string, targetId: string): number {
    const path = this.calculateNetworkPath(sourceId, targetId);
    const baseTime = 1; // Base 1ms
    const hopDelay = 5; // 5ms per hop
    const randomJitter = Math.random() * 10; // 0-10ms random jitter
    
    return baseTime + (path.length - 1) * hopDelay + randomJitter;
  }

  private showVlanDetail(device: NetworkDevice, vlanId: number): string {
    const vlan = this.vlans.get(vlanId);
    if (!vlan) {
      return `VLAN ${vlanId} not found.`;
    }

    const ports = this.getVlanPorts(device, vlanId);
    let output = `\nVLAN ${vlan.id} information:\n`;
    output += `  Name: ${vlan.name}\n`;
    output += `  Status: ${vlan.status}\n`;
    output += `  Type: ${vlan.type}\n`;
    if (vlan.description) {
      output += `  Description: ${vlan.description}\n`;
    }
    output += `  Ports: ${ports.length > 0 ? ports.join(', ') : 'none'}\n`;
    output += `  Created: ${vlan.createdAt.toLocaleString()}\n`;
    output += `  Modified: ${vlan.modifiedAt.toLocaleString()}\n`;

    return output;
  }
}

/**
 * Default troubleshooting tools instance
 */
export const troubleshootingTools = new NetworkTroubleshootingTools();
export { NetworkTroubleshootingTools as TroubleshootingTools };
