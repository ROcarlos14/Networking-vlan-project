import { DeviceType, NetworkDevice, Connection, Vlan, VlanStatus, VlanType, ConnectionType, ConnectionStatus } from '../types';

/**
 * Template device interface for wizards
 */
export interface TemplateDevice {
  id?: string;
  name: string;
  type: string;
  x: number;
  y: number;
}

/**
 * Template connection interface
 */
export interface TemplateConnection {
  id: string;
  from: string;
  to: string;
  fromInterface: string;
  toInterface: string;
}

/**
 * Template VLAN interface
 */
export interface TemplateVlan {
  id: number;
  name: string;
}

/**
 * Convert string device type to enum
 */
export function stringToDeviceType(type: string): DeviceType {
  switch (type) {
    case 'switch': return DeviceType.SWITCH;
    case 'router': return DeviceType.ROUTER;
    case 'pc': return DeviceType.PC;
    case 'server': return DeviceType.SERVER;
    default: return DeviceType.PC;
  }
}

/**
 * Convert template device to NetworkDevice
 */
export function templateDeviceToNetworkDevice(template: TemplateDevice): Partial<NetworkDevice> {
  return {
    name: template.name,
    type: stringToDeviceType(template.type),
    position: { x: template.x, y: template.y }
  };
}

/**
 * Convert template connection to Connection
 */
export function templateConnectionToConnection(template: TemplateConnection): Partial<Connection> {
  return {
    id: template.id,
    sourceDevice: template.from,
    targetDevice: template.to,
    sourceInterface: template.fromInterface,
    targetInterface: template.toInterface,
    connectionType: ConnectionType.ETHERNET,
    status: ConnectionStatus.UP,
    bandwidth: 1000,
    // Legacy properties for backward compatibility
    from: template.from,
    to: template.to,
    fromInterface: template.fromInterface,
    toInterface: template.toInterface
  };
}

/**
 * Convert template VLAN to proper Vlan
 */
export function templateVlanToVlan(template: TemplateVlan): Vlan {
  return {
    id: template.id,
    name: template.name,
    description: `VLAN ${template.id} - ${template.name}`,
    color: getVlanColorById(template.id),
    status: VlanStatus.ACTIVE,
    type: VlanType.DATA,
    createdAt: new Date(),
    modifiedAt: new Date()
  };
}

/**
 * Get VLAN color by ID
 */
function getVlanColorById(vlanId: number): string {
  const colors: { [key: number]: string } = {
    1: '#F59E0B',    // Default VLAN - Amber
    10: '#EF4444',   // Sales - Red
    20: '#3B82F6',   // IT - Blue
    30: '#10B981',   // HR - Green
    40: '#8B5CF6',   // Finance - Purple
    50: '#F97316',   // Marketing - Orange
    100: '#06B6D4',  // Servers - Cyan
    200: '#EC4899',  // Guest - Pink
    999: '#6B7280'   // Management - Gray
  };
  return colors[vlanId] || '#6B7280';
}