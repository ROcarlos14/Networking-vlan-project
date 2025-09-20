import React, { createContext, useContext, useEffect, useState } from 'react';
import { Theme, ThemeName, availableThemes, defaultTheme } from './themes';

interface ThemeContextType {
  theme: Theme;
  themeName: ThemeName;
  setTheme: (themeName: ThemeName) => void;
  availableThemes: Record<ThemeName, Theme>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [themeName, setThemeName] = useState<ThemeName>(() => {
    // Load theme preference from localStorage
    const saved = localStorage.getItem('vlan-simulator-theme');
    return (saved as ThemeName) || defaultTheme;
  });

  const theme = availableThemes[themeName];

  const setTheme = (newThemeName: ThemeName) => {
    setThemeName(newThemeName);
    localStorage.setItem('vlan-simulator-theme', newThemeName);
  };

  // Apply theme to document root for CSS custom properties
  useEffect(() => {
    const root = document.documentElement;
    
    // Background colors
    root.style.setProperty('--color-bg-primary', theme.colors.background.primary);
    root.style.setProperty('--color-bg-secondary', theme.colors.background.secondary);
    root.style.setProperty('--color-bg-tertiary', theme.colors.background.tertiary);
    root.style.setProperty('--color-bg-elevated', theme.colors.background.elevated);
    root.style.setProperty('--color-bg-overlay', theme.colors.background.overlay);

    // Text colors
    root.style.setProperty('--color-text-primary', theme.colors.text.primary);
    root.style.setProperty('--color-text-secondary', theme.colors.text.secondary);
    root.style.setProperty('--color-text-tertiary', theme.colors.text.tertiary);
    root.style.setProperty('--color-text-disabled', theme.colors.text.disabled);
    root.style.setProperty('--color-text-inverse', theme.colors.text.inverse);

    // Border colors
    root.style.setProperty('--color-border-primary', theme.colors.border.primary);
    root.style.setProperty('--color-border-secondary', theme.colors.border.secondary);
    root.style.setProperty('--color-border-focus', theme.colors.border.focus);
    root.style.setProperty('--color-border-error', theme.colors.border.error);
    root.style.setProperty('--color-border-success', theme.colors.border.success);
    root.style.setProperty('--color-border-warning', theme.colors.border.warning);

    // Interactive colors
    root.style.setProperty('--color-interactive-primary', theme.colors.interactive.primary);
    root.style.setProperty('--color-interactive-primary-hover', theme.colors.interactive.primaryHover);
    root.style.setProperty('--color-interactive-primary-active', theme.colors.interactive.primaryActive);
    root.style.setProperty('--color-interactive-secondary', theme.colors.interactive.secondary);
    root.style.setProperty('--color-interactive-secondary-hover', theme.colors.interactive.secondaryHover);
    root.style.setProperty('--color-interactive-secondary-active', theme.colors.interactive.secondaryActive);
    root.style.setProperty('--color-interactive-destructive', theme.colors.interactive.destructive);
    root.style.setProperty('--color-interactive-destructive-hover', theme.colors.interactive.destructiveHover);

    // Status colors
    root.style.setProperty('--color-status-success', theme.colors.status.success);
    root.style.setProperty('--color-status-warning', theme.colors.status.warning);
    root.style.setProperty('--color-status-error', theme.colors.status.error);
    root.style.setProperty('--color-status-info', theme.colors.status.info);
    root.style.setProperty('--color-status-neutral', theme.colors.status.neutral);

    // Network colors
    root.style.setProperty('--color-device-switch', theme.colors.network.device.switch);
    root.style.setProperty('--color-device-router', theme.colors.network.device.router);
    root.style.setProperty('--color-device-pc', theme.colors.network.device.pc);
    root.style.setProperty('--color-device-server', theme.colors.network.device.server);

    root.style.setProperty('--color-connection-active', theme.colors.network.connection.active);
    root.style.setProperty('--color-connection-inactive', theme.colors.network.connection.inactive);
    root.style.setProperty('--color-connection-trunk', theme.colors.network.connection.trunk);
    root.style.setProperty('--color-connection-access', theme.colors.network.connection.access);

    root.style.setProperty('--color-vlan-default', theme.colors.network.vlan.default);
    root.style.setProperty('--color-vlan-management', theme.colors.network.vlan.management);
    root.style.setProperty('--color-vlan-voice', theme.colors.network.vlan.voice);
    root.style.setProperty('--color-vlan-data', theme.colors.network.vlan.data);

    root.style.setProperty('--color-packet-icmp', theme.colors.network.packet.icmp);
    root.style.setProperty('--color-packet-tcp', theme.colors.network.packet.tcp);
    root.style.setProperty('--color-packet-udp', theme.colors.network.packet.udp);
    root.style.setProperty('--color-packet-arp', theme.colors.network.packet.arp);
    root.style.setProperty('--color-packet-broadcast', theme.colors.network.packet.broadcast);

    // Shadows
    root.style.setProperty('--shadow-small', theme.shadows.small);
    root.style.setProperty('--shadow-medium', theme.shadows.medium);
    root.style.setProperty('--shadow-large', theme.shadows.large);
    root.style.setProperty('--shadow-overlay', theme.shadows.overlay);

    // Border radius
    root.style.setProperty('--radius-small', theme.borderRadius.small);
    root.style.setProperty('--radius-medium', theme.borderRadius.medium);
    root.style.setProperty('--radius-large', theme.borderRadius.large);
    root.style.setProperty('--radius-full', theme.borderRadius.full);

    // Spacing
    root.style.setProperty('--spacing-xs', theme.spacing.xs);
    root.style.setProperty('--spacing-sm', theme.spacing.sm);
    root.style.setProperty('--spacing-md', theme.spacing.md);
    root.style.setProperty('--spacing-lg', theme.spacing.lg);
    root.style.setProperty('--spacing-xl', theme.spacing.xl);
    root.style.setProperty('--spacing-xxl', theme.spacing.xxl);

    // Typography
    root.style.setProperty('--font-size-xs', theme.typography.fontSize.xs);
    root.style.setProperty('--font-size-sm', theme.typography.fontSize.sm);
    root.style.setProperty('--font-size-base', theme.typography.fontSize.base);
    root.style.setProperty('--font-size-lg', theme.typography.fontSize.lg);
    root.style.setProperty('--font-size-xl', theme.typography.fontSize.xl);
    root.style.setProperty('--font-size-2xl', theme.typography.fontSize['2xl']);
    root.style.setProperty('--font-size-3xl', theme.typography.fontSize['3xl']);

    root.style.setProperty('--font-weight-normal', theme.typography.fontWeight.normal.toString());
    root.style.setProperty('--font-weight-medium', theme.typography.fontWeight.medium.toString());
    root.style.setProperty('--font-weight-semibold', theme.typography.fontWeight.semibold.toString());
    root.style.setProperty('--font-weight-bold', theme.typography.fontWeight.bold.toString());

    root.style.setProperty('--line-height-tight', theme.typography.lineHeight.tight.toString());
    root.style.setProperty('--line-height-normal', theme.typography.lineHeight.normal.toString());
    root.style.setProperty('--line-height-relaxed', theme.typography.lineHeight.relaxed.toString());

    // Add theme class to body for conditional styling
    document.body.className = document.body.className.replace(/theme-\w+/g, '');
    document.body.classList.add(`theme-${themeName}`);
  }, [theme, themeName]);

  const contextValue: ThemeContextType = {
    theme,
    themeName,
    setTheme,
    availableThemes,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

// Utility hook for accessing theme colors in JavaScript
export const useThemeColors = () => {
  const { theme } = useTheme();
  return theme.colors;
};

// Utility hook for accessing theme values
export const useThemeValues = () => {
  const { theme } = useTheme();
  return {
    colors: theme.colors,
    shadows: theme.shadows,
    borderRadius: theme.borderRadius,
    spacing: theme.spacing,
    typography: theme.typography,
  };
};