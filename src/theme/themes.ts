export interface Theme {
  name: string;
  displayName: string;
  colors: {
    // Background colors
    background: {
      primary: string;
      secondary: string;
      tertiary: string;
      elevated: string;
      overlay: string;
    };
    // Text colors
    text: {
      primary: string;
      secondary: string;
      tertiary: string;
      disabled: string;
      inverse: string;
    };
    // Border colors
    border: {
      primary: string;
      secondary: string;
      focus: string;
      error: string;
      success: string;
      warning: string;
    };
    // Interactive elements
    interactive: {
      primary: string;
      primaryHover: string;
      primaryActive: string;
      secondary: string;
      secondaryHover: string;
      secondaryActive: string;
      destructive: string;
      destructiveHover: string;
    };
    // Status colors
    status: {
      success: string;
      warning: string;
      error: string;
      info: string;
      neutral: string;
    };
    // Network-specific colors
    network: {
      device: {
        switch: string;
        router: string;
        pc: string;
        server: string;
      };
      connection: {
        active: string;
        inactive: string;
        trunk: string;
        access: string;
      };
      vlan: {
        default: string;
        management: string;
        voice: string;
        data: string;
      };
      packet: {
        icmp: string;
        tcp: string;
        udp: string;
        arp: string;
        broadcast: string;
      };
    };
  };
  shadows: {
    small: string;
    medium: string;
    large: string;
    overlay: string;
  };
  borderRadius: {
    small: string;
    medium: string;
    large: string;
    full: string;
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    xxl: string;
  };
  typography: {
    fontSize: {
      xs: string;
      sm: string;
      base: string;
      lg: string;
      xl: string;
      '2xl': string;
      '3xl': string;
    };
    fontWeight: {
      normal: number;
      medium: number;
      semibold: number;
      bold: number;
    };
    lineHeight: {
      tight: number;
      normal: number;
      relaxed: number;
    };
  };
}

export const lightTheme: Theme = {
  name: 'light',
  displayName: 'Light Professional',
  colors: {
    background: {
      primary: '#ffffff',
      secondary: '#f8fafc',
      tertiary: '#f1f5f9',
      elevated: '#ffffff',
      overlay: 'rgba(0, 0, 0, 0.5)',
    },
    text: {
      primary: '#0f172a',
      secondary: '#475569',
      tertiary: '#64748b',
      disabled: '#94a3b8',
      inverse: '#ffffff',
    },
    border: {
      primary: '#e2e8f0',
      secondary: '#cbd5e1',
      focus: '#3b82f6',
      error: '#ef4444',
      success: '#10b981',
      warning: '#f59e0b',
    },
    interactive: {
      primary: '#3b82f6',
      primaryHover: '#2563eb',
      primaryActive: '#1d4ed8',
      secondary: '#64748b',
      secondaryHover: '#475569',
      secondaryActive: '#334155',
      destructive: '#ef4444',
      destructiveHover: '#dc2626',
    },
    status: {
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#3b82f6',
      neutral: '#64748b',
    },
    network: {
      device: {
        switch: '#059669',
        router: '#dc2626',
        pc: '#3b82f6',
        server: '#7c3aed',
      },
      connection: {
        active: '#10b981',
        inactive: '#94a3b8',
        trunk: '#f59e0b',
        access: '#3b82f6',
      },
      vlan: {
        default: '#64748b',
        management: '#ef4444',
        voice: '#8b5cf6',
        data: '#06b6d4',
      },
      packet: {
        icmp: '#10b981',
        tcp: '#3b82f6',
        udp: '#8b5cf6',
        arp: '#f59e0b',
        broadcast: '#ef4444',
      },
    },
  },
  shadows: {
    small: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    medium: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    large: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    overlay: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  },
  borderRadius: {
    small: '0.25rem',
    medium: '0.375rem',
    large: '0.5rem',
    full: '9999px',
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    xxl: '3rem',
  },
  typography: {
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
};

export const darkTheme: Theme = {
  name: 'dark',
  displayName: 'Dark Professional',
  colors: {
    background: {
      primary: '#0f172a',
      secondary: '#1e293b',
      tertiary: '#334155',
      elevated: '#1e293b',
      overlay: 'rgba(0, 0, 0, 0.7)',
    },
    text: {
      primary: '#f8fafc',
      secondary: '#cbd5e1',
      tertiary: '#94a3b8',
      disabled: '#64748b',
      inverse: '#0f172a',
    },
    border: {
      primary: '#334155',
      secondary: '#475569',
      focus: '#60a5fa',
      error: '#f87171',
      success: '#34d399',
      warning: '#fbbf24',
    },
    interactive: {
      primary: '#3b82f6',
      primaryHover: '#60a5fa',
      primaryActive: '#93c5fd',
      secondary: '#64748b',
      secondaryHover: '#94a3b8',
      secondaryActive: '#cbd5e1',
      destructive: '#ef4444',
      destructiveHover: '#f87171',
    },
    status: {
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#60a5fa',
      neutral: '#94a3b8',
    },
    network: {
      device: {
        switch: '#10b981',
        router: '#f87171',
        pc: '#60a5fa',
        server: '#a78bfa',
      },
      connection: {
        active: '#22c55e',
        inactive: '#64748b',
        trunk: '#fbbf24',
        access: '#60a5fa',
      },
      vlan: {
        default: '#94a3b8',
        management: '#f87171',
        voice: '#a78bfa',
        data: '#22d3ee',
      },
      packet: {
        icmp: '#22c55e',
        tcp: '#60a5fa',
        udp: '#a78bfa',
        arp: '#fbbf24',
        broadcast: '#f87171',
      },
    },
  },
  shadows: {
    small: '0 1px 2px 0 rgba(0, 0, 0, 0.3)',
    medium: '0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -1px rgba(0, 0, 0, 0.3)',
    large: '0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.3)',
    overlay: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
  },
  borderRadius: {
    small: '0.25rem',
    medium: '0.375rem',
    large: '0.5rem',
    full: '9999px',
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    xxl: '3rem',
  },
  typography: {
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '1.875rem',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
};

export const ciscoTheme: Theme = {
  name: 'cisco',
  displayName: 'Cisco Professional',
  colors: {
    background: {
      primary: '#ffffff',
      secondary: '#f7f7f7',
      tertiary: '#eeeeee',
      elevated: '#ffffff',
      overlay: 'rgba(0, 0, 0, 0.5)',
    },
    text: {
      primary: '#1c1c1c',
      secondary: '#4a4a4a',
      tertiary: '#767676',
      disabled: '#b3b3b3',
      inverse: '#ffffff',
    },
    border: {
      primary: '#d6d6d6',
      secondary: '#b3b3b3',
      focus: '#0070c7',
      error: '#d32f2f',
      success: '#388e3c',
      warning: '#f57c00',
    },
    interactive: {
      primary: '#0070c7',
      primaryHover: '#005a9e',
      primaryActive: '#004480',
      secondary: '#4a4a4a',
      secondaryHover: '#1c1c1c',
      secondaryActive: '#000000',
      destructive: '#d32f2f',
      destructiveHover: '#b71c1c',
    },
    status: {
      success: '#388e3c',
      warning: '#f57c00',
      error: '#d32f2f',
      info: '#0070c7',
      neutral: '#4a4a4a',
    },
    network: {
      device: {
        switch: '#0070c7',
        router: '#d32f2f',
        pc: '#388e3c',
        server: '#7b1fa2',
      },
      connection: {
        active: '#388e3c',
        inactive: '#b3b3b3',
        trunk: '#f57c00',
        access: '#0070c7',
      },
      vlan: {
        default: '#4a4a4a',
        management: '#d32f2f',
        voice: '#7b1fa2',
        data: '#0097a7',
      },
      packet: {
        icmp: '#388e3c',
        tcp: '#0070c7',
        udp: '#7b1fa2',
        arp: '#f57c00',
        broadcast: '#d32f2f',
      },
    },
  },
  shadows: {
    small: '0 1px 3px rgba(0, 0, 0, 0.1)',
    medium: '0 2px 8px rgba(0, 0, 0, 0.15)',
    large: '0 8px 24px rgba(0, 0, 0, 0.15)',
    overlay: '0 16px 48px rgba(0, 0, 0, 0.2)',
  },
  borderRadius: {
    small: '2px',
    medium: '4px',
    large: '6px',
    full: '50px',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
    xxl: '48px',
  },
  typography: {
    fontSize: {
      xs: '11px',
      sm: '13px',
      base: '14px',
      lg: '16px',
      xl: '18px',
      '2xl': '21px',
      '3xl': '28px',
    },
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    lineHeight: {
      tight: 1.2,
      normal: 1.4,
      relaxed: 1.6,
    },
  },
};

export const availableThemes = {
  light: lightTheme,
  dark: darkTheme,
  cisco: ciscoTheme,
};

export type ThemeName = keyof typeof availableThemes;

export const defaultTheme: ThemeName = 'dark';