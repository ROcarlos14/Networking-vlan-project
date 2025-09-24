/**
 * UI Module - User interface components and utilities
 * 
 * Handles modals, professional features, and UI utilities
 */

// Modal components
export { default as Modal } from '../../components/Modals/Modal';
export { default as DeviceConfigModal } from '../../components/Modals/DeviceConfigModal';
export { default as PortConfigModal } from '../../components/Modals/PortConfigModal';

// Professional features
export { default as CommandPalette } from '../../components/Professional/CommandPalette';
export { default as StatusBar } from '../../components/Professional/StatusBar';

// Error handling
export { default as ErrorBoundary } from '../../components/ErrorBoundary';

// Theme and styling
export * from '../../theme/ThemeProvider';
export * from '../../theme/themes';
export * from '../../theme/keyboardShortcuts';

// UI types
export type {
  UIState,
  ModalState,
  ModalType,
  AppConfig
} from '../../types';