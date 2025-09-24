/**
 * VLAN color mappings with proper TypeScript indexing
 */
export interface VlanColorsMap {
  [vlanId: number]: string;
}

/**
 * Default VLAN colors
 */
export const VLAN_COLORS: VlanColorsMap = {
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

/**
 * Get VLAN color by ID with fallback
 */
export function getVlanColor(vlanId: number): string {
  return VLAN_COLORS[vlanId] || '#6B7280';
}