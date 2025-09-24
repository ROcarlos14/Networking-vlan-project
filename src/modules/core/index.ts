/**
 * Core Module - Main application components
 * 
 * Handles the main UI structure including Canvas, Toolbar, and Sidebar
 */

// Core components
export { default as Canvas } from '../../components/Canvas/Canvas';
export { default as Toolbar } from '../../components/Toolbar/Toolbar';
export { default as Sidebar } from '../../components/Sidebar/Sidebar';

// Core utilities
export * from '../../utils/d3-helpers';

// Core hooks
export * from '../../hooks/useConnectionManager';

// Re-export commonly used types
export type { 
  NetworkDevice, 
  Connection, 
  Position, 
  DeviceType, 
  DeviceStatus 
} from '../../types';