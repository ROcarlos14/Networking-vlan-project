import {
  NetworkDevice,
  DeviceType,
  DeviceStatus,
  SwitchDevice,
  RouterDevice,
  PcDevice,
  ServerDevice,
  InterfaceType,
  InterfaceStatus,
  Vlan,
  VlanStatus,
  VlanType,
  Connection,
  ConnectionType,
  ConnectionStatus,
  DeviceTemplate,
} from '../types';

/**
 * Generate a unique ID
 */
export const generateId = (): string => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

/**
 * Generate a random MAC address
 */
export const generateMacAddress = (): string => {
  const mac = [];
  for (let i = 0; i < 6; i++) {
    mac.push(Math.floor(Math.random() * 256).toString(16).padStart(2, '0'));
  }
  return mac.join(':').toUpperCase();
};

/**
 * Sample VLAN configurations
 */
export const defaultVlans: Vlan[] = [
  {
    id: 1,
    name: 'Default',
    description: 'Default VLAN',
    color: '#E3E3E3',
    status: VlanStatus.ACTIVE,
    type: VlanType.NORMAL,
    createdAt: new Date(),
    modifiedAt: new Date(),
  },
  {
    id: 10,
    name: 'Management',
    description: 'Management VLAN',
    color: '#FF6B6B',
    status: VlanStatus.ACTIVE,
    type: VlanType.MANAGEMENT,
    createdAt: new Date(),
    modifiedAt: new Date(),
  },
  {
    id: 20,
    name: 'Data',
    description: 'Data VLAN',
    color: '#4ECDC4',
    status: VlanStatus.ACTIVE,
    type: VlanType.DATA,
    createdAt: new Date(),
    modifiedAt: new Date(),
  },
  {
    id: 30,
    name: 'Voice',
    description: 'Voice VLAN',
    color: '#45B7D1',
    status: VlanStatus.ACTIVE,
    type: VlanType.VOICE,
    createdAt: new Date(),
    modifiedAt: new Date(),
  },
];

/**
 * Device templates for UI creation
 */
export const deviceTemplates: DeviceTemplate[] = [
  {
    type: DeviceType.SWITCH,
    name: 'Layer 2 Switch',
    icon: 'switch-icon',
    defaultConfig: {
      type: DeviceType.SWITCH,
      status: DeviceStatus.ACTIVE,
      interfaces: Array.from({ length: 24 }, (_, i) => ({
        id: generateId(),
        name: `Fa0/${i + 1}`,
        type: InterfaceType.ACCESS,
        status: InterfaceStatus.DOWN,
        macAddress: generateMacAddress(),
        speed: 100,
        duplex: 'full' as const,
        vlanConfig: {
          accessVlan: 1,
        },
      })),
      macAddressTable: [],
      vlanDatabase: defaultVlans.map(vlan => ({
        id: vlan.id,
        name: vlan.name,
        status: vlan.status === VlanStatus.ACTIVE ? 'active' as const : 'suspended' as const,
      })),
      spanningTreeEnabled: true,
    },
  },
  {
    type: DeviceType.ROUTER,
    name: 'Layer 3 Router',
    icon: 'router-icon',
    defaultConfig: {
      type: DeviceType.ROUTER,
      status: DeviceStatus.ACTIVE,
      interfaces: Array.from({ length: 4 }, (_, i) => ({
        id: generateId(),
        name: `Gi0/${i}`,
        type: InterfaceType.ETHERNET,
        status: InterfaceStatus.DOWN,
        macAddress: generateMacAddress(),
        speed: 1000,
        duplex: 'full' as const,
      })),
      routingTable: [],
      ospfEnabled: false,
      bgpEnabled: false,
    },
  },
  {
    type: DeviceType.PC,
    name: 'Workstation',
    icon: 'pc-icon',
    defaultConfig: {
      type: DeviceType.PC,
      status: DeviceStatus.ACTIVE,
      interface: {
        id: generateId(),
        name: 'Eth0',
        type: InterfaceType.ETHERNET,
        status: InterfaceStatus.DOWN,
        macAddress: generateMacAddress(),
        speed: 1000,
        duplex: 'full' as const,
      },
    },
  },
  {
    type: DeviceType.SERVER,
    name: 'Server',
    icon: 'server-icon',
    defaultConfig: {
      type: DeviceType.SERVER,
      status: DeviceStatus.ACTIVE,
      interfaces: Array.from({ length: 2 }, (_, i) => ({
        id: generateId(),
        name: `Eth${i}`,
        type: InterfaceType.ETHERNET,
        status: InterfaceStatus.DOWN,
        macAddress: generateMacAddress(),
        speed: 1000,
        duplex: 'full' as const,
      })),
      services: ['HTTP', 'HTTPS', 'SSH'],
    },
  },
];

/**
 * Create a new device based on template
 */
export const createDeviceFromTemplate = (
  template: DeviceTemplate,
  name: string,
  position: { x: number; y: number }
): NetworkDevice => {
  const id = generateId();

  // Deep-create device from template with fresh interface IDs and MACs
  switch (template.type) {
    case DeviceType.SWITCH: {
      const t = template.defaultConfig as Partial<SwitchDevice>;
      const sourceIfaces = Array.isArray(t.interfaces) ? t.interfaces : Array.from({ length: 24 }).map((_, i) => ({
        name: `Fa0/${i + 1}`,
        type: InterfaceType.ACCESS,
        status: InterfaceStatus.DOWN,
        speed: 100,
        duplex: 'full' as const,
      }));
      const interfaces = sourceIfaces.map((iface: any, i: number) => ({
        id: generateId(),
        name: iface.name ?? `Fa0/${i + 1}`,
        type: iface.type ?? InterfaceType.ACCESS,
        status: iface.status ?? InterfaceStatus.DOWN,
        macAddress: generateMacAddress(),
        speed: iface.speed ?? 100,
        duplex: iface.duplex ?? ('full' as const),
        vlanConfig: iface.vlanConfig ? { ...iface.vlanConfig } : { accessVlan: 1 },
      }));

      const device: SwitchDevice = {
        id,
        name,
        type: DeviceType.SWITCH,
        position,
        status: t?.status ?? DeviceStatus.ACTIVE,
        interfaces,
        macAddressTable: [],
        vlanDatabase: (t?.vlanDatabase ?? defaultVlans.map(v => ({ id: v.id, name: v.name, status: v.status === VlanStatus.ACTIVE ? 'active' : 'suspended' })))
          .map(v => ({ ...v })),
        spanningTreeEnabled: t?.spanningTreeEnabled ?? true,
        description: `${template.name} - ${name}`,
      };
      return device;
    }
    case DeviceType.ROUTER: {
      const t = template.defaultConfig as Partial<RouterDevice>;
      const sourceIfaces = Array.isArray(t.interfaces) ? t.interfaces : Array.from({ length: 4 }).map((_, i) => ({
        name: `Gi0/${i}`,
        type: InterfaceType.ETHERNET,
        status: InterfaceStatus.DOWN,
        speed: 1000,
        duplex: 'full' as const,
      }));
      const interfaces = sourceIfaces.map((iface: any, i: number) => ({
        id: generateId(),
        name: iface.name ?? `Gi0/${i}`,
        type: iface.type ?? InterfaceType.ETHERNET,
        status: iface.status ?? InterfaceStatus.DOWN,
        macAddress: generateMacAddress(),
        speed: iface.speed ?? 1000,
        duplex: iface.duplex ?? ('full' as const),
      }));

      const device: RouterDevice = {
        id,
        name,
        type: DeviceType.ROUTER,
        position,
        status: t?.status ?? DeviceStatus.ACTIVE,
        interfaces,
        routingTable: Array.isArray(t?.routingTable) ? t!.routingTable.map(r => ({ ...r })) : [],
        ospfEnabled: t?.ospfEnabled ?? false,
        bgpEnabled: t?.bgpEnabled ?? false,
        description: `${template.name} - ${name}`,
      };
      return device;
    }
    case DeviceType.PC: {
      const t = template.defaultConfig as Partial<PcDevice>;
      const iface = t?.interface ?? {
        name: 'Eth0',
        type: InterfaceType.ETHERNET,
        status: InterfaceStatus.DOWN,
        speed: 1000,
        duplex: 'full' as const,
      };
      const device: PcDevice = {
        id,
        name,
        type: DeviceType.PC,
        position,
        status: t?.status ?? DeviceStatus.ACTIVE,
        interface: {
          id: generateId(),
          name: iface.name ?? 'Eth0',
          type: iface.type ?? InterfaceType.ETHERNET,
          status: InterfaceStatus.UP, // End-host NICs default to UP
          macAddress: generateMacAddress(),
          speed: iface.speed ?? 1000,
          duplex: iface.duplex ?? ('full' as const),
        },
        defaultGateway: t?.defaultGateway,
        dnsServers: t?.dnsServers ? [...t.dnsServers] : undefined,
        description: `${template.name} - ${name}`,
      };
      return device;
    }
    case DeviceType.SERVER: {
      const t = template.defaultConfig as Partial<ServerDevice>;
      const sourceIfaces = Array.isArray(t.interfaces) ? t.interfaces : Array.from({ length: 2 }).map((_, i) => ({
        name: `Eth${i}`,
        type: InterfaceType.ETHERNET,
        status: InterfaceStatus.DOWN,
        speed: 1000,
        duplex: 'full' as const,
      }));
      const interfaces = sourceIfaces.map((iface: any, i: number) => ({
        id: generateId(),
        name: iface.name ?? `Eth${i}`,
        type: iface.type ?? InterfaceType.ETHERNET,
        status: InterfaceStatus.UP, // Servers default interfaces UP
        macAddress: generateMacAddress(),
        speed: iface.speed ?? 1000,
        duplex: iface.duplex ?? ('full' as const),
      }));

      const device: ServerDevice = {
        id,
        name,
        type: DeviceType.SERVER,
        position,
        status: t?.status ?? DeviceStatus.ACTIVE,
        interfaces,
        services: t?.services ? [...t.services] : ['HTTP', 'HTTPS', 'SSH'],
        defaultGateway: t?.defaultGateway,
        dnsServers: t?.dnsServers ? [...t.dnsServers] : undefined,
        description: `${template.name} - ${name}`,
      };
      return device;
    }
    default: {
      // Fallback: shallow clone but ensure unique id and description
      return {
        id,
        name,
        position,
        description: `${template.name} - ${name}`,
        ...(template.defaultConfig as any),
      } as NetworkDevice;
    }
  }
};

/**
 * Sample network topology
 */
export const sampleTopology = {
  devices: [
    createDeviceFromTemplate(
      deviceTemplates[0], // Switch
      'Core-Switch-01',
      { x: 300, y: 200 }
    ),
    createDeviceFromTemplate(
      deviceTemplates[0], // Switch
      'Access-Switch-01',
      { x: 150, y: 350 }
    ),
    createDeviceFromTemplate(
      deviceTemplates[0], // Switch
      'Access-Switch-02',
      { x: 450, y: 350 }
    ),
    createDeviceFromTemplate(
      deviceTemplates[1], // Router
      'Gateway-Router',
      { x: 300, y: 50 }
    ),
    createDeviceFromTemplate(
      deviceTemplates[2], // PC
      'PC-001',
      { x: 50, y: 500 }
    ),
    createDeviceFromTemplate(
      deviceTemplates[2], // PC
      'PC-002',
      { x: 250, y: 500 }
    ),
    createDeviceFromTemplate(
      deviceTemplates[3], // Server
      'Web-Server',
      { x: 400, y: 500 }
    ),
    createDeviceFromTemplate(
      deviceTemplates[2], // PC
      'PC-003',
      { x: 550, y: 500 }
    ),
  ],
  connections: [] as Connection[], // Will be populated based on devices
  vlans: defaultVlans,
};

/**
 * Create sample connections between devices
 */
export const createSampleConnections = (devices: NetworkDevice[]): Connection[] => {
  const connections: Connection[] = [];
  
  if (devices.length >= 4) {
    // Find devices by name for more reliable connections
    const coreSwitch = devices.find(d => d.name === 'Core-Switch-01') as SwitchDevice;
    const accessSwitch1 = devices.find(d => d.name === 'Access-Switch-01') as SwitchDevice;
    const accessSwitch2 = devices.find(d => d.name === 'Access-Switch-02') as SwitchDevice;
    const router = devices.find(d => d.name === 'Gateway-Router') as RouterDevice;
    
    if (router && coreSwitch) {
      // Connect router to core switch
      connections.push({
        id: generateId(),
        name: 'Router-CoreSwitch-Trunk',
        sourceDevice: router.id,
        sourceInterface: router.interfaces[0].id,
        targetDevice: coreSwitch.id,
        targetInterface: coreSwitch.interfaces[0].id,
        connectionType: ConnectionType.ETHERNET,
        status: ConnectionStatus.UP,
        bandwidth: 1000,
      });
    }

    if (coreSwitch && accessSwitch1) {
      // Connect core switch to access switch 1
      connections.push({
        id: generateId(),
        name: 'CoreSwitch-AccessSwitch1-Trunk',
        sourceDevice: coreSwitch.id,
        sourceInterface: coreSwitch.interfaces[1].id,
        targetDevice: accessSwitch1.id,
        targetInterface: accessSwitch1.interfaces[23].id,
        connectionType: ConnectionType.ETHERNET,
        status: ConnectionStatus.UP,
        bandwidth: 1000,
      });
    }

    if (coreSwitch && accessSwitch2) {
      // Connect core switch to access switch 2
      connections.push({
        id: generateId(),
        name: 'CoreSwitch-AccessSwitch2-Trunk',
        sourceDevice: coreSwitch.id,
        sourceInterface: coreSwitch.interfaces[2].id,
        targetDevice: accessSwitch2.id,
        targetInterface: accessSwitch2.interfaces[23].id,
        connectionType: ConnectionType.ETHERNET,
        status: ConnectionStatus.UP,
        bandwidth: 1000,
      });
    }
  }

  // Find end devices by name for reliable connections
  const pc001 = devices.find(d => d.name === 'PC-001') as PcDevice;
  const pc002 = devices.find(d => d.name === 'PC-002') as PcDevice;
  const pc003 = devices.find(d => d.name === 'PC-003') as PcDevice;
  const webServer = devices.find(d => d.name === 'Web-Server') as ServerDevice;
  
  // Get access switches again for PC connections
  const accessSwitch1 = devices.find(d => d.name === 'Access-Switch-01') as SwitchDevice;
  const accessSwitch2 = devices.find(d => d.name === 'Access-Switch-02') as SwitchDevice;

  // Connect PCs and servers to access switches
    if (pc001 && accessSwitch1) {
      connections.push({
        id: generateId(),
        name: 'PC001-AccessSwitch1',
        sourceDevice: pc001.id,
        sourceInterface: pc001.interface.id,
        targetDevice: accessSwitch1.id,
        targetInterface: accessSwitch1.interfaces[0].id,
        connectionType: ConnectionType.ETHERNET,
        status: ConnectionStatus.UP,
        bandwidth: 100,
      });
    }

    if (pc002 && accessSwitch1) {
      connections.push({
        id: generateId(),
        name: 'PC002-AccessSwitch1',
        sourceDevice: pc002.id,
        sourceInterface: pc002.interface.id,
        targetDevice: accessSwitch1.id,
        targetInterface: accessSwitch1.interfaces[1].id,
        connectionType: ConnectionType.ETHERNET,
        status: ConnectionStatus.UP,
        bandwidth: 100,
      });
    }

    if (webServer && accessSwitch2) {
      connections.push({
        id: generateId(),
        name: 'WebServer-AccessSwitch2',
        sourceDevice: webServer.id,
        sourceInterface: webServer.interfaces[0].id,
        targetDevice: accessSwitch2.id,
        targetInterface: accessSwitch2.interfaces[0].id,
        connectionType: ConnectionType.ETHERNET,
        status: ConnectionStatus.UP,
        bandwidth: 1000,
      });
    }

    if (pc003 && accessSwitch2) {
      connections.push({
        id: generateId(),
        name: 'PC003-AccessSwitch2',
        sourceDevice: pc003.id,
        sourceInterface: pc003.interface.id,
        targetDevice: accessSwitch2.id,
        targetInterface: accessSwitch2.interfaces[1].id,
        connectionType: ConnectionType.ETHERNET,
        status: ConnectionStatus.UP,
        bandwidth: 100,
      });
    }

  return connections;
};

// Update sample topology with connections
sampleTopology.connections = createSampleConnections(sampleTopology.devices);