import { Connection, NetworkDevice, DeviceType, InterfaceType, Vlan } from '../../types';

export type LinkHealthStatus = 'ok' | 'warn' | 'error';

export interface LinkHealth {
  status: LinkHealthStatus;
  srcOk: boolean;
  dstOk: boolean;
  reasons: string[];
}

const getInterfaceById = (dev: any, ifaceId: string | undefined): any | undefined => {
  if (!ifaceId) return undefined;
  if ('interfaces' in dev && Array.isArray(dev.interfaces)) {
    return dev.interfaces.find((i: any) => i.id === ifaceId);
  }
  if ('interface' in dev && dev.interface) {
    return dev.interface.id === ifaceId ? dev.interface : undefined;
  }
  return undefined;
};

const interfaceAllowsVlan = (iface: any, vlanId: number): boolean => {
  if (!iface || !iface.vlanConfig) return false;
  if (iface.type === InterfaceType.ACCESS) {
    return iface.vlanConfig.accessVlan === vlanId;
  }
  if (iface.type === InterfaceType.TRUNK) {
    const allowed = iface.vlanConfig.allowedVlans || [];
    return allowed.includes(vlanId);
  }
  return false;
};

const anyAllowedVlanOnSwitchLink = (sw1: any, if1: any, sw2: any, if2: any): boolean => {
  const vlans1: number[] = if1?.type === InterfaceType.ACCESS
    ? (if1.vlanConfig?.accessVlan ? [if1.vlanConfig.accessVlan] : [])
    : (if1?.vlanConfig?.allowedVlans || []);
  const vlans2: number[] = if2?.type === InterfaceType.ACCESS
    ? (if2.vlanConfig?.accessVlan ? [if2.vlanConfig.accessVlan] : [])
    : (if2?.vlanConfig?.allowedVlans || []);
  return vlans1.some(v => vlans2.includes(v));
};

const inferHostVlanFromSwitchPort = (swIf: any): number | undefined => {
  if (!swIf) return undefined;
  if (swIf.type === InterfaceType.ACCESS) return swIf.vlanConfig?.accessVlan;
  if (swIf.type === InterfaceType.TRUNK) return swIf.vlanConfig?.nativeVlan;
  return undefined;
};

const getDeviceIpCidr = (dev: any): { ip?: string; maskPrefix?: number } => {
  if ('interface' in dev && dev.interface?.ipAddress) {
    const [ip, prefix] = String(dev.interface.ipAddress).split('/');
    return { ip, maskPrefix: prefix ? parseInt(prefix) : undefined };
  }
  if ('interfaces' in dev && Array.isArray(dev.interfaces)) {
    const withIp = dev.interfaces.find((i: any) => !!i.ipAddress);
    if (withIp) {
      const [ip, prefix] = String(withIp.ipAddress).split('/');
      return { ip, maskPrefix: prefix ? parseInt(prefix) : undefined };
    }
  }
  return {};
};

const sameSubnet = (ip1?: string, prefix1?: number, ip2?: string, prefix2?: number): boolean => {
  if (!ip1 || !ip2 || !prefix1 || !prefix2) return false;
  const prefix = Math.min(prefix1, prefix2);
  const ipToNum = (ip: string) => ip.split('.').map(Number).reduce((a, p) => (a << 8) | p, 0) >>> 0;
  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (ipToNum(ip1) & mask) === (ipToNum(ip2) & mask);
};

/**
 * Evaluate per-connection health based on L1/L2 (status, interfaces, VLAN allowance) and basic L3 plausibility.
 */
export const evaluateConnectionHealth = (
  connection: Connection,
  devices: NetworkDevice[],
): LinkHealth => {
  const reasons: string[] = [];
  const src = devices.find(d => d.id === connection.sourceDevice);
  const dst = devices.find(d => d.id === connection.targetDevice);
  if (!src || !dst) return { status: 'error', srcOk: false, dstOk: false, reasons: ['Device not found'] };

  // Interface status
  const srcIf = getInterfaceById(src as any, connection.sourceInterface);
  const dstIf = getInterfaceById(dst as any, connection.targetInterface);

  let l1ok = true;
  if (srcIf && srcIf.status && srcIf.status !== 'up') { l1ok = false; reasons.push(`Source interface ${srcIf.name} is ${srcIf.status}`); }
  if (dstIf && dstIf.status && dstIf.status !== 'up') { l1ok = false; reasons.push(`Target interface ${dstIf.name} is ${dstIf.status}`); }

  // L2 VLAN allowance
  let l2ok = true;
  if (src.type === DeviceType.SWITCH && dst.type === DeviceType.SWITCH) {
    if (!anyAllowedVlanOnSwitchLink(src, srcIf, dst, dstIf)) {
      l2ok = false;
      reasons.push('No common VLAN allowed on trunk/access between switches');
    }
  } else if (src.type === DeviceType.SWITCH || dst.type === DeviceType.SWITCH) {
    const sw = (src.type === DeviceType.SWITCH ? src : dst) as any;
    const swIf = getInterfaceById(sw, sw.id === connection.sourceDevice ? connection.sourceInterface : connection.targetInterface);
    const inferred = inferHostVlanFromSwitchPort(swIf);
    if (swIf?.type === InterfaceType.TRUNK && inferred === undefined) {
      l2ok = false;
      reasons.push('Trunk port has no native VLAN for untagged host');
    }
    // Access ports are considered OK; trunk with native VLAN is OK
  }

  // Basic L3 plausibility (direct link only): if both endpoints have IP addresses, check same subnet
  let l3plausible = true;
  const sIp = getDeviceIpCidr(src as any);
  const dIp = getDeviceIpCidr(dst as any);
  if (sIp.ip && dIp.ip) {
    if (!sameSubnet(sIp.ip, sIp.maskPrefix, dIp.ip, dIp.maskPrefix)) {
      // Direct L3 between endpoints unlikely without a router; mark as warn but keep L2 green if valid
      l3plausible = false;
      reasons.push('Endpoint IP subnets differ (requires routing)');
    }
  }

  const srcOk = l1ok && l2ok;
  const dstOk = l1ok && l2ok;
  const status: LinkHealthStatus = srcOk && dstOk ? (l3plausible ? 'ok' : 'warn') : 'error';
  return { status, srcOk, dstOk, reasons };
};