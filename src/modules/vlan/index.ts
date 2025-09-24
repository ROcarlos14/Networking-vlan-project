/**
 * VLAN Module - VLAN configuration and management
 * 
 * Handles VLAN creation, configuration, and visualization
 */

// VLAN components
export { default as VlanPanel } from '../../components/Vlan/VlanPanel';

// VLAN utilities
export * from '../../utils/vlan-logic/vlanConfiguration';
export * from '../../utils/networking/advancedVlanEngine';

// VLAN types and colors
export type { 
  Vlan, 
  VlanStatus, 
  VlanType, 
  VlanConfiguration, 
  VlanAssignment 
} from '../../types';
export { VLAN_COLORS, getVlanColor } from '../../types/colors';