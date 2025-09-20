import {
  NetworkDevice,
  SwitchDevice,
  NetworkInterface,
  InterfaceType,
  InterfaceStatus,
  VlanInterfaceConfig,
  Vlan,
  VlanStatus,
  Connection,
} from '../../types';

/**
 * VLAN configuration validation result
 */
export interface VlanValidationResult {
  isValid: boolean;
  warnings: VlanWarning[];
  errors: VlanError[];
}

/**
 * VLAN warning types
 */
export interface VlanWarning {
  type: VlanWarningType;
  message: string;
  deviceId?: string;
  interfaceId?: string;
  vlanId?: number;
}

export enum VlanWarningType {
  UNUSED_VLAN = 'unused_vlan',
  SINGLE_PORT_VLAN = 'single_port_vlan',
  TRUNK_NATIVE_VLAN = 'trunk_native_vlan',
  VLAN_MISMATCH = 'vlan_mismatch',
}

/**
 * VLAN error types
 */
export interface VlanError {
  type: VlanErrorType;
  message: string;
  deviceId?: string;
  interfaceId?: string;
  vlanId?: number;
  severity: 'low' | 'medium' | 'high';
}

export enum VlanErrorType {
  INVALID_VLAN_ID = 'invalid_vlan_id',
  VLAN_NOT_EXISTS = 'vlan_not_exists',
  TRUNK_NO_ALLOWED_VLANS = 'trunk_no_allowed_vlans',
  ACCESS_MULTIPLE_VLANS = 'access_multiple_vlans',
  NATIVE_VLAN_NOT_ALLOWED = 'native_vlan_not_allowed',
  INTERFACE_DOWN = 'interface_down',
}

/**
 * VLAN assignment operations
 */
export interface VlanAssignmentOperation {
  deviceId: string;
  interfaceId: string;
  operation: 'assign' | 'remove';
  vlanId: number;
  interfaceType: InterfaceType;
}

/**
 * Check if VLAN ID is valid (1-4094)
 */
export const isValidVlanId = (vlanId: number): boolean => {
  return vlanId >= 1 && vlanId <= 4094 && Number.isInteger(vlanId);
};

/**
 * Check if VLAN exists in the VLAN database
 */
export const vlanExists = (vlanId: number, vlans: Vlan[]): boolean => {
  return vlans.some(vlan => vlan.id === vlanId && vlan.status === VlanStatus.ACTIVE);
};

/**
 * Configure interface as access port
 */
export const configureAccessPort = (
  device: SwitchDevice,
  interfaceId: string,
  vlanId: number,
  vlans: Vlan[]
): { success: boolean; error?: string; updatedDevice?: SwitchDevice } => {
  // Validate VLAN ID
  if (!isValidVlanId(vlanId)) {
    return { success: false, error: `Invalid VLAN ID: ${vlanId}. Must be between 1-4094.` };
  }

  // Check if VLAN exists
  if (!vlanExists(vlanId, vlans)) {
    return { success: false, error: `VLAN ${vlanId} does not exist or is not active.` };
  }

  // Find interface
  const interfaceIndex = device.interfaces.findIndex(iface => iface.id === interfaceId);
  if (interfaceIndex === -1) {
    return { success: false, error: `Interface ${interfaceId} not found on device ${device.name}.` };
  }

  // Create updated device
  const updatedDevice: SwitchDevice = {
    ...device,
    interfaces: device.interfaces.map((iface, index) => {
      if (index === interfaceIndex) {
        return {
          ...iface,
          type: InterfaceType.ACCESS,
          vlanConfig: {
            accessVlan: vlanId,
          },
        };
      }
      return iface;
    }),
  };

  return { success: true, updatedDevice };
};

/**
 * Configure interface as trunk port
 */
export const configureTrunkPort = (
  device: SwitchDevice,
  interfaceId: string,
  allowedVlans: number[],
  nativeVlan: number,
  vlans: Vlan[]
): { success: boolean; error?: string; updatedDevice?: SwitchDevice } => {
  // Validate allowed VLANs
  for (const vlanId of allowedVlans) {
    if (!isValidVlanId(vlanId)) {
      return { success: false, error: `Invalid VLAN ID in allowed list: ${vlanId}` };
    }
    if (!vlanExists(vlanId, vlans)) {
      return { success: false, error: `VLAN ${vlanId} does not exist or is not active.` };
    }
  }

  // Validate native VLAN
  if (!isValidVlanId(nativeVlan)) {
    return { success: false, error: `Invalid native VLAN ID: ${nativeVlan}` };
  }
  if (!vlanExists(nativeVlan, vlans)) {
    return { success: false, error: `Native VLAN ${nativeVlan} does not exist or is not active.` };
  }

  // Native VLAN should be in allowed VLANs list
  if (!allowedVlans.includes(nativeVlan)) {
    return { 
      success: false, 
      error: `Native VLAN ${nativeVlan} must be included in allowed VLANs list.` 
    };
  }

  // Find interface
  const interfaceIndex = device.interfaces.findIndex(iface => iface.id === interfaceId);
  if (interfaceIndex === -1) {
    return { success: false, error: `Interface ${interfaceId} not found on device ${device.name}.` };
  }

  // Create updated device
  const updatedDevice: SwitchDevice = {
    ...device,
    interfaces: device.interfaces.map((iface, index) => {
      if (index === interfaceIndex) {
        return {
          ...iface,
          type: InterfaceType.TRUNK,
          vlanConfig: {
            allowedVlans: [...allowedVlans],
            nativeVlan,
          },
        };
      }
      return iface;
    }),
  };

  return { success: true, updatedDevice };
};

/**
 * Get VLANs assigned to a specific interface
 */
export const getInterfaceVlans = (networkInterface: NetworkInterface): number[] => {
  if (!networkInterface.vlanConfig) return [];

  switch (networkInterface.type) {
    case InterfaceType.ACCESS:
      return networkInterface.vlanConfig.accessVlan ? [networkInterface.vlanConfig.accessVlan] : [];
    case InterfaceType.TRUNK:
      return networkInterface.vlanConfig.allowedVlans || [];
    default:
      return [];
  }
};

/**
 * Get all VLANs used by a switch
 */
export const getSwitchVlans = (device: SwitchDevice): number[] => {
  const vlanSet = new Set<number>();
  
  device.interfaces.forEach(iface => {
    const interfaceVlans = getInterfaceVlans(iface);
    interfaceVlans.forEach(vlanId => vlanSet.add(vlanId));
  });

  return Array.from(vlanSet).sort((a, b) => a - b);
};

/**
 * Check if two switches can communicate via a specific VLAN
 */
export const canSwitchesCommunicate = (
  switch1: SwitchDevice,
  switch2: SwitchDevice,
  vlanId: number,
  connections: Connection[]
): boolean => {
  // Find connection between switches
  const connection = connections.find(conn =>
    (conn.sourceDevice === switch1.id && conn.targetDevice === switch2.id) ||
    (conn.sourceDevice === switch2.id && conn.targetDevice === switch1.id)
  );

  if (!connection) return false;

  // Get interfaces involved in the connection
  const switch1Interface = switch1.interfaces.find(iface => 
    iface.id === connection.sourceInterface || iface.id === connection.targetInterface
  );
  const switch2Interface = switch2.interfaces.find(iface => 
    iface.id === connection.sourceInterface || iface.id === connection.targetInterface
  );

  if (!switch1Interface || !switch2Interface) return false;

  // Check if both interfaces support the VLAN
  const switch1Vlans = getInterfaceVlans(switch1Interface);
  const switch2Vlans = getInterfaceVlans(switch2Interface);

  return switch1Vlans.includes(vlanId) && switch2Vlans.includes(vlanId);
};

/**
 * Validate VLAN configuration for a single switch
 */
export const validateSwitchVlanConfig = (
  device: SwitchDevice,
  vlans: Vlan[]
): VlanValidationResult => {
  const warnings: VlanWarning[] = [];
  const errors: VlanError[] = [];

  device.interfaces.forEach(iface => {
    // Skip interfaces that are down
    if (iface.status === InterfaceStatus.DOWN || iface.status === InterfaceStatus.ADMIN_DOWN) {
      if (iface.vlanConfig) {
        warnings.push({
          type: VlanWarningType.VLAN_MISMATCH,
          message: `Interface ${iface.name} is down but has VLAN configuration`,
          deviceId: device.id,
          interfaceId: iface.id,
        });
      }
      return;
    }

    if (!iface.vlanConfig) return;

    // Validate access port configuration
    if (iface.type === InterfaceType.ACCESS) {
      const { accessVlan } = iface.vlanConfig;
      if (accessVlan) {
        if (!isValidVlanId(accessVlan)) {
          errors.push({
            type: VlanErrorType.INVALID_VLAN_ID,
            message: `Invalid access VLAN ID ${accessVlan} on interface ${iface.name}`,
            deviceId: device.id,
            interfaceId: iface.id,
            vlanId: accessVlan,
            severity: 'high',
          });
        } else if (!vlanExists(accessVlan, vlans)) {
          errors.push({
            type: VlanErrorType.VLAN_NOT_EXISTS,
            message: `Access VLAN ${accessVlan} does not exist on interface ${iface.name}`,
            deviceId: device.id,
            interfaceId: iface.id,
            vlanId: accessVlan,
            severity: 'high',
          });
        }
      }
    }

    // Validate trunk port configuration
    if (iface.type === InterfaceType.TRUNK) {
      const { allowedVlans, nativeVlan } = iface.vlanConfig;
      
      if (!allowedVlans || allowedVlans.length === 0) {
        errors.push({
          type: VlanErrorType.TRUNK_NO_ALLOWED_VLANS,
          message: `Trunk interface ${iface.name} has no allowed VLANs`,
          deviceId: device.id,
          interfaceId: iface.id,
          severity: 'high',
        });
      } else {
        // Validate each allowed VLAN
        allowedVlans.forEach(vlanId => {
          if (!isValidVlanId(vlanId)) {
            errors.push({
              type: VlanErrorType.INVALID_VLAN_ID,
              message: `Invalid VLAN ID ${vlanId} in allowed list on interface ${iface.name}`,
              deviceId: device.id,
              interfaceId: iface.id,
              vlanId,
              severity: 'medium',
            });
          } else if (!vlanExists(vlanId, vlans)) {
            errors.push({
              type: VlanErrorType.VLAN_NOT_EXISTS,
              message: `VLAN ${vlanId} in allowed list does not exist on interface ${iface.name}`,
              deviceId: device.id,
              interfaceId: iface.id,
              vlanId,
              severity: 'medium',
            });
          }
        });

        // Validate native VLAN
        if (nativeVlan) {
          if (!isValidVlanId(nativeVlan)) {
            errors.push({
              type: VlanErrorType.INVALID_VLAN_ID,
              message: `Invalid native VLAN ID ${nativeVlan} on interface ${iface.name}`,
              deviceId: device.id,
              interfaceId: iface.id,
              vlanId: nativeVlan,
              severity: 'high',
            });
          } else if (!vlanExists(nativeVlan, vlans)) {
            errors.push({
              type: VlanErrorType.VLAN_NOT_EXISTS,
              message: `Native VLAN ${nativeVlan} does not exist on interface ${iface.name}`,
              deviceId: device.id,
              interfaceId: iface.id,
              vlanId: nativeVlan,
              severity: 'high',
            });
          } else if (!allowedVlans.includes(nativeVlan)) {
            errors.push({
              type: VlanErrorType.NATIVE_VLAN_NOT_ALLOWED,
              message: `Native VLAN ${nativeVlan} is not in allowed VLANs list on interface ${iface.name}`,
              deviceId: device.id,
              interfaceId: iface.id,
              vlanId: nativeVlan,
              severity: 'high',
            });
          }
        }
      }
    }
  });

  return {
    isValid: errors.length === 0,
    warnings,
    errors,
  };
};

/**
 * Create default VLAN configuration for a new switch
 */
export const createDefaultSwitchVlanConfig = (device: SwitchDevice): SwitchDevice => {
  const updatedDevice: SwitchDevice = {
    ...device,
    interfaces: device.interfaces.map(iface => ({
      ...iface,
      vlanConfig: {
        accessVlan: 1, // Default VLAN
      },
    })),
    vlanDatabase: [
      { id: 1, name: 'default', status: 'active' },
      { id: 99, name: 'management', status: 'active' },
    ],
  };

  return updatedDevice;
};

/**
 * Validate VLAN configuration across the entire network (devices + links)
 */
export const validateNetworkVlanConfig = (
  devices: NetworkDevice[],
  vlans: Vlan[],
  connections: Connection[]
): VlanValidationResult & { byDevice: Record<string, { warnings: VlanWarning[]; errors: VlanError[] }> } => {
  const byDevice: Record<string, { warnings: VlanWarning[]; errors: VlanError[] }> = {};
  const allWarnings: VlanWarning[] = [];
  const allErrors: VlanError[] = [];

  // Per-switch validation
  devices.forEach((dev) => {
    if ((dev as any).interfaces && (dev as SwitchDevice).type) {
      const sw = dev as SwitchDevice;
      const res = validateSwitchVlanConfig(sw, vlans);
      if (res.warnings.length || res.errors.length) {
        byDevice[sw.id] = {
          warnings: res.warnings,
          errors: res.errors,
        };
        allWarnings.push(...res.warnings);
        allErrors.push(...res.errors);
      }
    }
  });

  // Link-level validation (VLAN mismatch between connected devices)
  const deviceMap = new Map(devices.map(d => [d.id, d]));
  connections.forEach((conn) => {
    const src = deviceMap.get(conn.sourceDevice);
    const dst = deviceMap.get(conn.targetDevice);
    if (!src || !dst) return;

    const srcIf = (src as any).interfaces?.find((i: any) => i.id === conn.sourceInterface);
    const dstIf = (dst as any).interfaces?.find((i: any) => i.id === conn.targetInterface);
    if (!srcIf || !dstIf) return;

    const srcVlans = getInterfaceVlans(srcIf);
    const dstVlans = getInterfaceVlans(dstIf);

    // If both sides are switches and there is no overlapping VLAN, warn about mismatch
    const srcIsSwitch = (src as any).interfaces && !(src as any).interface;
    const dstIsSwitch = (dst as any).interfaces && !(dst as any).interface;
    if (srcIsSwitch && dstIsSwitch) {
      const overlap = srcVlans.filter((v) => dstVlans.includes(v));
      if (overlap.length === 0) {
        const warn: VlanWarning = {
          type: VlanWarningType.VLAN_MISMATCH,
          message: `VLAN mismatch on link between ${(src as any).name} and ${(dst as any).name}`,
          deviceId: (src as any).id,
        };
        allWarnings.push(warn);
        byDevice[(src as any).id] = byDevice[(src as any).id] || { warnings: [], errors: [] };
        byDevice[(src as any).id].warnings.push(warn);
        byDevice[(dst as any).id] = byDevice[(dst as any).id] || { warnings: [], errors: [] };
        byDevice[(dst as any).id].warnings.push(warn);
      }
    }
  });

  return {
    isValid: allErrors.length === 0,
    warnings: allWarnings,
    errors: allErrors,
    byDevice,
  };
};
