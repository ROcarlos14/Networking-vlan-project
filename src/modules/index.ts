/**
 * Main Modules Index
 * 
 * Central export point for all application modules
 */

// Core application functionality
export * from './core';

// VLAN management and configuration
export * from './vlan';

// Network protocols and management
export * from './network';

// Simulation and packet analysis
export * from './simulation';

// Educational features and learning tools
export * from './learning';

// UI components and utilities
export * from './ui';

// Global store and data
export { useAppStore } from '../store';
export * from '../data/sampleData';

// Global types - re-export specific types to avoid conflicts
export type {
  NetworkDevice,
  Connection,
  Vlan,
  Position,
  AppState,
  UIState,
  ModalState,
  ModalType,
  AppConfig
} from '../types';

// Export specific enums and value types
export { ViewType, DeviceType, DeviceStatus, VlanStatus, VlanType } from '../types';
