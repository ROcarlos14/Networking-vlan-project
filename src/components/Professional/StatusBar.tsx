import React from 'react';
import { useTheme } from '../../theme/ThemeProvider';
import { useAppStore } from '../../store';

/**
 * Professional status bar showing system status and quick info
 */
const StatusBar: React.FC = () => {
  const { theme, themeName } = useTheme();
  const { 
    devices, 
    connections, 
    vlans, 
    simulationRunning, 
    simulationStats,
    currentSimulation 
  } = useAppStore();

  const getStatusText = () => {
    if (simulationRunning) {
      return `Simulation Running • ${simulationStats.totalPackets} packets`;
    }
    return 'Ready';
  };

  const getNetworkSummary = () => {
    return `${devices.length} devices • ${connections.length} connections • ${vlans.length} VLANs`;
  };

  return (
    <div 
      className="flex items-center justify-between px-4 py-1 text-xs border-t"
      style={{
        backgroundColor: theme.colors.background.secondary,
        borderColor: theme.colors.border.primary,
        color: theme.colors.text.secondary,
      }}
    >
      {/* Left side - Status and network info */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2">
          <div 
            className={`w-2 h-2 rounded-full ${simulationRunning ? 'animate-pulse' : ''}`}
            style={{ 
              backgroundColor: simulationRunning 
                ? theme.colors.status.success 
                : theme.colors.status.neutral 
            }}
          />
          <span>{getStatusText()}</span>
        </div>
        
        <div className="text-gray-400">|</div>
        
        <div>{getNetworkSummary()}</div>
        
        {simulationRunning && currentSimulation && (
          <>
            <div className="text-gray-400">|</div>
            <div className="flex items-center space-x-3">
              <span style={{ color: theme.colors.status.success }}>
                ✓ {simulationStats.deliveredPackets}
              </span>
              <span style={{ color: theme.colors.status.error }}>
                ✗ {simulationStats.droppedPackets}
              </span>
              <span style={{ color: theme.colors.status.info }}>
                {simulationStats.averageLatency.toFixed(1)}ms
              </span>
            </div>
          </>
        )}
      </div>

      {/* Right side - Theme and shortcuts */}
      <div className="flex items-center space-x-4">
        <div className="capitalize">{themeName} theme</div>
        <div className="text-gray-400">|</div>
        <div className="flex items-center space-x-2">
          <kbd 
            className="px-1 py-0.5 text-xs rounded"
            style={{
              backgroundColor: theme.colors.background.tertiary,
              color: theme.colors.text.tertiary,
            }}
          >
            Ctrl+K
          </kbd>
          <span>Command Palette</span>
        </div>
      </div>
    </div>
  );
};

export default StatusBar;