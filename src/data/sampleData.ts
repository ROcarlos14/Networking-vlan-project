import {
  NetworkDevice,
  DeviceType,
  DeviceStatus,
  SwitchDevice,
  RouterDevice,
  PcDevice,
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
  
  return {
    id,
    name,
    position,
    description: `${template.name} - ${name}`,
    ...template.defaultConfig,
  } as NetworkDevice;
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
    // Connect router to core switch
    connections.push({
      id: generateId(),
      name: 'Router-CoreSwitch',
      sourceDevice: devices[3].id, // Router
      sourceInterface: (devices[3] as RouterDevice).interfaces[0].id,
      targetDevice: devices[0].id, // Core Switch
      targetInterface: (devices[0] as SwitchDevice).interfaces[0].id,
      connectionType: ConnectionType.ETHERNET,
      status: ConnectionStatus.UP,
      bandwidth: 1000,
    });

    // Connect core switch to access switches
    connections.push({
      id: generateId(),
      name: 'CoreSwitch-AccessSwitch1',
      sourceDevice: devices[0].id, // Core Switch
      sourceInterface: (devices[0] as SwitchDevice).interfaces[1].id,
      targetDevice: devices[1].id, // Access Switch 1
      targetInterface: (devices[1] as SwitchDevice).interfaces[23].id,
      connectionType: ConnectionType.ETHERNET,
      status: ConnectionStatus.UP,
      bandwidth: 1000,
    });

    connections.push({
      id: generateId(),
      name: 'CoreSwitch-AccessSwitch2',
      sourceDevice: devices[0].id, // Core Switch
      sourceInterface: (devices[0] as SwitchDevice).interfaces[2].id,
      targetDevice: devices[2].id, // Access Switch 2
      targetInterface: (devices[2] as SwitchDevice).interfaces[23].id,
      connectionType: ConnectionType.ETHERNET,
      status: ConnectionStatus.UP,
      bandwidth: 1000,
    });
  }

  // Connect PCs and servers to access switches
  if (devices.length >= 8) {
    // PC-001 to Access-Switch-01
    connections.push({
      id: generateId(),
      name: 'PC001-AccessSwitch1',
      sourceDevice: devices[4].id, // PC-001
      sourceInterface: (devices[4] as PcDevice).interface.id,
      targetDevice: devices[1].id, // Access Switch 1
      targetInterface: (devices[1] as SwitchDevice).interfaces[0].id,
      connectionType: ConnectionType.ETHERNET,
      status: ConnectionStatus.UP,
      bandwidth: 100,
    });

    // PC-002 to Access-Switch-01
    connections.push({
      id: generateId(),
      name: 'PC002-AccessSwitch1',
      sourceDevice: devices[5].id, // PC-002
      sourceInterface: (devices[5] as PcDevice).interface.id,
      targetDevice: devices[1].id, // Access Switch 1
      targetInterface: (devices[1] as SwitchDevice).interfaces[1].id,
      connectionType: ConnectionType.ETHERNET,
      status: ConnectionStatus.UP,
      bandwidth: 100,
    });

    // Web-Server to Access-Switch-02
    connections.push({
      id: generateId(),
      name: 'WebServer-AccessSwitch2',
      sourceDevice: devices[6].id, // Web Server
      sourceInterface: (devices[6] as RouterDevice).interfaces[0].id,
      targetDevice: devices[2].id, // Access Switch 2
      targetInterface: (devices[2] as SwitchDevice).interfaces[0].id,
      connectionType: ConnectionType.ETHERNET,
      status: ConnectionStatus.UP,
      bandwidth: 1000,
    });

    // PC-003 to Access-Switch-02
    connections.push({
      id: generateId(),
      name: 'PC003-AccessSwitch2',
      sourceDevice: devices[7].id, // PC-003
      sourceInterface: (devices[7] as PcDevice).interface.id,
      targetDevice: devices[2].id, // Access Switch 2
      targetInterface: (devices[2] as SwitchDevice).interfaces[1].id,
      connectionType: ConnectionType.ETHERNET,
      status: ConnectionStatus.UP,
      bandwidth: 100,
    });
  }

  return connections;
};

// Update sample topology with connections
sampleTopology.connections = createSampleConnections(sampleTopology.devices);