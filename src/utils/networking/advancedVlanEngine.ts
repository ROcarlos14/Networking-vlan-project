import { Device, Connection, VlanConfig } from '../../types';

/**
 * VTP (VLAN Trunking Protocol) Modes
 */
export enum VtpMode {
  SERVER = 'server',
  CLIENT = 'client',
  TRANSPARENT = 'transparent',
  OFF = 'off'
}

/**
 * VTP Configuration
 */
export interface VtpConfig {
  mode: VtpMode;
  domain: string;
  password?: string;
  version: 1 | 2 | 3;
  revision: number;
  lastModified: number;
}

/**
 * VTP Advertisement Message
 */
export interface VtpAdvertisement {
  type: 'summary' | 'subset' | 'request';
  domain: string;
  revision: number;
  timestamp: number;
  vlans?: ExtendedVlanConfig[];
  senderId: string;
}

/**
 * Extended VLAN Configuration with VTP support
 */
export interface ExtendedVlanConfig {
  id: number;
  name: string;
  state: 'active' | 'suspend';
  type: 'ethernet' | 'fddi' | 'tokenRing' | 'fddiNet' | 'trNet';
  mtu: number;
  said: number; // Security Association ID
  parent?: number;
  ringNumber?: number;
  bridgeNumber?: number;
  stp: 'ieee' | 'ibm' | 'auto';
  backupCrf?: boolean;
  remoteSpan?: boolean;
}

/**
 * Trunk Port Configuration
 */
export interface TrunkPortConfig {
  interfaceName: string;
  mode: 'trunk' | 'access' | 'dynamic-auto' | 'dynamic-desirable';
  nativeVlan: number;
  allowedVlans: number[];
  encapsulation: 'dot1q' | 'isl';
  pruningEligible: boolean;
  dtp: boolean; // Dynamic Trunking Protocol
}

/**
 * VLAN Pruning Configuration
 */
export interface VlanPruningConfig {
  enabled: boolean;
  eligibleVlans: Set<number>;
  prunedVlans: Map<string, Set<number>>; // interface -> pruned VLANs
}

/**
 * DTP (Dynamic Trunking Protocol) Frame
 */
export interface DtpFrame {
  type: 'negotiate' | 'response';
  mode: 'access' | 'trunk' | 'dynamic-auto' | 'dynamic-desirable';
  encapsulation: 'dot1q' | 'isl';
  senderId: string;
  interfaceName: string;
  timestamp: number;
}

/**
 * Advanced VLAN Engine with VTP, Pruning, and Enhanced Trunk Support
 */
export class AdvancedVlanEngine {
  private vtpConfigs = new Map<string, VtpConfig>(); // deviceId -> VTP config
  private extendedVlans = new Map<string, Map<number, ExtendedVlanConfig>>(); // deviceId -> (vlanId -> config)
  private trunkPorts = new Map<string, Map<string, TrunkPortConfig>>(); // deviceId -> (interface -> config)
  private pruningConfigs = new Map<string, VlanPruningConfig>(); // deviceId -> pruning config
  
  // VTP constants
  private readonly VTP_MULTICAST_MAC = '01:00:0C:CC:CC:CC';
  private readonly VTP_UPDATE_INTERVAL = 300000; // 5 minutes
  private readonly DTP_UPDATE_INTERVAL = 30000; // 30 seconds

  /**
   * Initialize VTP configuration for a switch
   */
  initializeVtp(deviceId: string, config: Partial<VtpConfig> = {}): void {
    const defaultConfig: VtpConfig = {
      mode: VtpMode.SERVER,
      domain: 'default',
      version: 2,
      revision: 0,
      lastModified: Date.now(),
      ...config
    };
    
    this.vtpConfigs.set(deviceId, defaultConfig);
    this.extendedVlans.set(deviceId, new Map());
  }

  /**
   * Configure VTP settings
   */
  configureVtp(deviceId: string, config: Partial<VtpConfig>): boolean {
    const currentConfig = this.vtpConfigs.get(deviceId);
    if (!currentConfig) return false;
    
    const newConfig: VtpConfig = { ...currentConfig, ...config };
    
    // Validate configuration changes
    if (config.mode === VtpMode.CLIENT && config.revision !== undefined) {
      // Clients cannot modify revision number - keep current revision
      newConfig.revision = currentConfig.revision;
    }
    
    if (config.domain && config.domain !== currentConfig.domain) {
      // Domain change resets revision to 0
      newConfig.revision = 0;
    }
    
    newConfig.lastModified = Date.now();
    this.vtpConfigs.set(deviceId, newConfig);
    
    // If mode changed to CLIENT, clear local VLAN database
    if (config.mode === VtpMode.CLIENT && currentConfig.mode !== VtpMode.CLIENT) {
      this.clearVlanDatabase(deviceId);
    }
    
    return true;
  }

  /**
   * Add or modify VLAN in VTP domain
   */
  addVlan(deviceId: string, vlanConfig: Partial<ExtendedVlanConfig>): boolean {
    const vtpConfig = this.vtpConfigs.get(deviceId);
    if (!vtpConfig) return false;
    
    // Only servers can create/modify VLANs
    if (vtpConfig.mode !== VtpMode.SERVER && vtpConfig.mode !== VtpMode.TRANSPARENT) {
      return false;
    }
    
    const vlans = this.extendedVlans.get(deviceId)!;
    const vlanId = vlanConfig.id || this.getNextAvailableVlanId(deviceId);
    
    const extendedConfig: ExtendedVlanConfig = {
      id: vlanId,
      name: `VLAN${vlanId.toString().padStart(4, '0')}`,
      state: 'active',
      type: 'ethernet',
      mtu: 1500,
      said: 100000 + vlanId,
      stp: 'ieee',
      backupCrf: false,
      remoteSpan: false,
      ...vlanConfig
    };
    
    vlans.set(vlanId, extendedConfig);
    
    // Increment revision if in server mode
    if (vtpConfig.mode === VtpMode.SERVER) {
      vtpConfig.revision++;
      vtpConfig.lastModified = Date.now();
    }
    
    return true;
  }

  /**
   * Delete VLAN from VTP domain
   */
  deleteVlan(deviceId: string, vlanId: number): boolean {
    const vtpConfig = this.vtpConfigs.get(deviceId);
    if (!vtpConfig || vtpConfig.mode !== VtpMode.SERVER) return false;
    
    // Cannot delete default VLANs (1, 1002-1005)
    if (vlanId === 1 || (vlanId >= 1002 && vlanId <= 1005)) {
      return false;
    }
    
    const vlans = this.extendedVlans.get(deviceId);
    if (!vlans || !vlans.has(vlanId)) return false;
    
    vlans.delete(vlanId);
    vtpConfig.revision++;
    vtpConfig.lastModified = Date.now();
    
    return true;
  }

  /**
   * Configure trunk port
   */
  configureTrunkPort(
    deviceId: string, 
    interfaceName: string, 
    config: Partial<TrunkPortConfig>
  ): boolean {
    let deviceTrunks = this.trunkPorts.get(deviceId);
    if (!deviceTrunks) {
      deviceTrunks = new Map();
      this.trunkPorts.set(deviceId, deviceTrunks);
    }
    
    const currentConfig = deviceTrunks.get(interfaceName) || {
      interfaceName,
      mode: 'access',
      nativeVlan: 1,
      allowedVlans: [1],
      encapsulation: 'dot1q',
      pruningEligible: true,
      dtp: true
    };
    
    const newConfig = { ...currentConfig, ...config };
    
    // Validate configuration
    if (newConfig.nativeVlan && !newConfig.allowedVlans.includes(newConfig.nativeVlan)) {
      newConfig.allowedVlans.push(newConfig.nativeVlan);
    }
    
    deviceTrunks.set(interfaceName, newConfig);
    return true;
  }

  /**
   * Configure VLAN pruning
   */
  configurePruning(deviceId: string, enabled: boolean, eligibleVlans?: number[]): boolean {
    let pruningConfig = this.pruningConfigs.get(deviceId);
    if (!pruningConfig) {
      pruningConfig = {
        enabled: false,
        eligibleVlans: new Set(),
        prunedVlans: new Map()
      };
      this.pruningConfigs.set(deviceId, pruningConfig);
    }
    
    pruningConfig.enabled = enabled;
    
    if (eligibleVlans) {
      pruningConfig.eligibleVlans = new Set(eligibleVlans);
    }
    
    return true;
  }

  /**
   * Process VTP advertisement
   */
  processVtpAdvertisement(deviceId: string, advertisement: VtpAdvertisement): boolean {
    const vtpConfig = this.vtpConfigs.get(deviceId);
    if (!vtpConfig || vtpConfig.domain !== advertisement.domain) {
      return false;
    }
    
    // Transparent mode doesn't process advertisements but forwards them
    if (vtpConfig.mode === VtpMode.TRANSPARENT) {
      return true; // Forward but don't process
    }
    
    // Client mode processes advertisements from servers
    if (vtpConfig.mode === VtpMode.CLIENT && advertisement.revision > vtpConfig.revision) {
      this.synchronizeVlanDatabase(deviceId, advertisement);
      vtpConfig.revision = advertisement.revision;
      vtpConfig.lastModified = Date.now();
      return true;
    }
    
    // Server mode processes advertisements from other servers
    if (vtpConfig.mode === VtpMode.SERVER) {
      if (advertisement.revision > vtpConfig.revision) {
        // Become client temporarily to sync
        this.synchronizeVlanDatabase(deviceId, advertisement);
        vtpConfig.revision = advertisement.revision;
        vtpConfig.lastModified = Date.now();
        return true;
      } else if (advertisement.revision < vtpConfig.revision) {
        // Send our advertisement
        return false; // Indicates we should send our advertisement
      }
    }
    
    return true;
  }

  /**
   * Generate VTP advertisement
   */
  createVtpAdvertisement(deviceId: string, type: 'summary' | 'subset' | 'request'): VtpAdvertisement | null {
    const vtpConfig = this.vtpConfigs.get(deviceId);
    if (!vtpConfig) return null;
    
    const advertisement: VtpAdvertisement = {
      type,
      domain: vtpConfig.domain,
      revision: vtpConfig.revision,
      timestamp: Date.now(),
      senderId: deviceId
    };
    
    if (type === 'subset') {
      const vlans = this.extendedVlans.get(deviceId);
      if (vlans) {
        advertisement.vlans = Array.from(vlans.values());
      }
    }
    
    return advertisement;
  }

  /**
   * Process DTP frame for dynamic trunking
   */
  processDtpFrame(deviceId: string, interfaceName: string, frame: DtpFrame): TrunkPortConfig | null {
    const deviceTrunks = this.trunkPorts.get(deviceId);
    if (!deviceTrunks) return null;
    
    const portConfig = deviceTrunks.get(interfaceName);
    if (!portConfig || !portConfig.dtp) return null;
    
    // Determine negotiated trunk mode
    const negotiatedMode = this.negotiateTrunkMode(portConfig.mode, frame.mode);
    
    if (negotiatedMode !== portConfig.mode) {
      const updatedConfig = { ...portConfig, mode: negotiatedMode };
      deviceTrunks.set(interfaceName, updatedConfig);
      return updatedConfig;
    }
    
    return null;
  }

  /**
   * Check if VLAN is pruned on interface
   */
  isVlanPruned(deviceId: string, interfaceName: string, vlanId: number): boolean {
    const pruningConfig = this.pruningConfigs.get(deviceId);
    if (!pruningConfig || !pruningConfig.enabled) return false;
    
    const prunedVlans = pruningConfig.prunedVlans.get(interfaceName);
    return prunedVlans ? prunedVlans.has(vlanId) : false;
  }

  /**
   * Update VLAN pruning based on traffic patterns
   */
  updateVlanPruning(
    deviceId: string, 
    interfaceName: string, 
    activeVlans: number[]
  ): void {
    const pruningConfig = this.pruningConfigs.get(deviceId);
    if (!pruningConfig || !pruningConfig.enabled) return;
    
    const trunkConfig = this.getTrunkPortConfig(deviceId, interfaceName);
    if (!trunkConfig || !trunkConfig.pruningEligible) return;
    
    // Determine which eligible VLANs can be pruned
    const eligibleForPruning = Array.from(pruningConfig.eligibleVlans).filter(vlanId => 
      trunkConfig.allowedVlans.includes(vlanId) && !activeVlans.includes(vlanId)
    );
    
    // Update pruned VLANs
    if (!pruningConfig.prunedVlans.has(interfaceName)) {
      pruningConfig.prunedVlans.set(interfaceName, new Set());
    }
    
    const prunedVlans = pruningConfig.prunedVlans.get(interfaceName)!;
    prunedVlans.clear();
    eligibleForPruning.forEach(vlanId => prunedVlans.add(vlanId));
  }

  /**
   * Get VLAN database for device
   */
  getVlanDatabase(deviceId: string): ExtendedVlanConfig[] {
    const vlans = this.extendedVlans.get(deviceId);
    return vlans ? Array.from(vlans.values()) : [];
  }

  /**
   * Get VTP configuration
   */
  getVtpConfig(deviceId: string): VtpConfig | null {
    return this.vtpConfigs.get(deviceId) || null;
  }

  /**
   * Get trunk port configuration
   */
  getTrunkPortConfig(deviceId: string, interfaceName: string): TrunkPortConfig | null {
    const deviceTrunks = this.trunkPorts.get(deviceId);
    return deviceTrunks ? deviceTrunks.get(interfaceName) || null : null;
  }

  /**
   * Get all trunk ports for device
   */
  getTrunkPorts(deviceId: string): TrunkPortConfig[] {
    const deviceTrunks = this.trunkPorts.get(deviceId);
    return deviceTrunks ? Array.from(deviceTrunks.values()) : [];
  }

  /**
   * Check if frame should be allowed on trunk
   */
  isFrameAllowedOnTrunk(
    deviceId: string, 
    interfaceName: string, 
    vlanId: number
  ): boolean {
    const trunkConfig = this.getTrunkPortConfig(deviceId, interfaceName);
    if (!trunkConfig || trunkConfig.mode === 'access') return false;
    
    // Check if VLAN is allowed
    if (!trunkConfig.allowedVlans.includes(vlanId)) return false;
    
    // Check if VLAN is pruned
    if (this.isVlanPruned(deviceId, interfaceName, vlanId)) return false;
    
    return true;
  }

  /**
   * Validate VLAN configuration
   */
  validateVlanConfig(config: Partial<ExtendedVlanConfig>): { valid: boolean, errors: string[] } {
    const errors: string[] = [];
    
    if (config.id !== undefined) {
      if (config.id < 1 || config.id > 4094) {
        errors.push('VLAN ID must be between 1 and 4094');
      }
      if (config.id >= 1002 && config.id <= 1005 && config.type !== 'fddi' && config.type !== 'tokenRing') {
        errors.push('VLANs 1002-1005 are reserved for legacy protocols');
      }
    }
    
    if (config.name && config.name.length > 32) {
      errors.push('VLAN name cannot exceed 32 characters');
    }
    
    if (config.mtu && (config.mtu < 64 || config.mtu > 9000)) {
      errors.push('MTU must be between 64 and 9000 bytes');
    }
    
    return { valid: errors.length === 0, errors };
  }

  // Private helper methods
  private clearVlanDatabase(deviceId: string): void {
    const vlans = this.extendedVlans.get(deviceId);
    if (vlans) {
      // Keep default VLANs
      const defaultVlans = new Map();
      for (const [vlanId, config] of vlans.entries()) {
        if (vlanId === 1 || (vlanId >= 1002 && vlanId <= 1005)) {
          defaultVlans.set(vlanId, config);
        }
      }
      this.extendedVlans.set(deviceId, defaultVlans);
    }
  }

  private synchronizeVlanDatabase(deviceId: string, advertisement: VtpAdvertisement): void {
    if (!advertisement.vlans) return;
    
    const vlans = this.extendedVlans.get(deviceId)!;
    vlans.clear();
    
    // Add VLANs from advertisement
    advertisement.vlans.forEach(vlanConfig => {
      vlans.set(vlanConfig.id, { ...vlanConfig });
    });
  }

  private getNextAvailableVlanId(deviceId: string): number {
    const vlans = this.extendedVlans.get(deviceId)!;
    
    // Start from VLAN 2 (skip default VLAN 1)
    for (let vlanId = 2; vlanId <= 4094; vlanId++) {
      // Skip reserved VLANs
      if (vlanId >= 1002 && vlanId <= 1005) continue;
      
      if (!vlans.has(vlanId)) {
        return vlanId;
      }
    }
    
    return 2; // Fallback
  }

  private negotiateTrunkMode(
    localMode: string, 
    remoteMode: string
  ): 'trunk' | 'access' | 'dynamic-auto' | 'dynamic-desirable' {
    // DTP negotiation logic
    if (localMode === 'trunk' || remoteMode === 'trunk') {
      return 'trunk';
    }
    
    if (localMode === 'access' || remoteMode === 'access') {
      return 'access';
    }
    
    if (localMode === 'dynamic-desirable' && 
        (remoteMode === 'dynamic-desirable' || remoteMode === 'dynamic-auto')) {
      return 'trunk';
    }
    
    if (remoteMode === 'dynamic-desirable' && localMode === 'dynamic-auto') {
      return 'trunk';
    }
    
    // Default to access if negotiation fails
    return 'access';
  }
}

// Export singleton instance
export const advancedVlanEngine = new AdvancedVlanEngine();