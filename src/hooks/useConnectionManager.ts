import { useCallback, useState } from 'react';
import { useAppStore } from '../store';
import { Connection, NetworkDevice, ConnectionType, ConnectionStatus } from '../types';
import { generateId } from '../data/sampleData';

/**
 * Connection creation state
 */
interface ConnectionCreationState {
  isCreating: boolean;
  sourceDevice?: NetworkDevice;
  targetDevice?: NetworkDevice;
}

/**
 * Custom hook for managing connections between devices
 */
export const useConnectionManager = () => {
  const { devices, connections, addConnection } = useAppStore();
  const [connectionState, setConnectionState] = useState<ConnectionCreationState>({
    isCreating: false,
  });

  /**
   * Start creating a connection from a source device
   */
  const startConnection = useCallback((sourceDevice: NetworkDevice) => {
    setConnectionState({
      isCreating: true,
      sourceDevice,
    });
  }, []);

  /**
   * Complete connection creation to a target device
   */
  const completeConnection = useCallback((targetDevice: NetworkDevice) => {
    if (!connectionState.sourceDevice || connectionState.sourceDevice.id === targetDevice.id) {
      // Cancel if no source or connecting to self
      cancelConnection();
      return;
    }

    // Check if connection already exists
    const existingConnection = connections.find(conn => 
      (conn.sourceDevice === connectionState.sourceDevice!.id && conn.targetDevice === targetDevice.id) ||
      (conn.sourceDevice === targetDevice.id && conn.targetDevice === connectionState.sourceDevice!.id)
    );

    if (existingConnection) {
      // Connection already exists
      cancelConnection();
      return;
    }

    // Get available interfaces
    const sourceInterface = getAvailableInterface(connectionState.sourceDevice);
    const targetInterface = getAvailableInterface(targetDevice);

    if (!sourceInterface || !targetInterface) {
      // No available interfaces
      cancelConnection();
      return;
    }

    // Create new connection
    const newConnection: Connection = {
      id: generateId(),
      name: `${connectionState.sourceDevice.name}-${targetDevice.name}`,
      sourceDevice: connectionState.sourceDevice.id,
      sourceInterface: sourceInterface.id,
      targetDevice: targetDevice.id,
      targetInterface: targetInterface.id,
      connectionType: ConnectionType.ETHERNET,
      status: ConnectionStatus.UP,
      bandwidth: 1000, // Default bandwidth
    };

    addConnection(newConnection);
    setConnectionState({ isCreating: false });
  }, [connectionState, connections, addConnection]);

  /**
   * Cancel connection creation
   */
  const cancelConnection = useCallback(() => {
    setConnectionState({ isCreating: false });
  }, []);

  /**
   * Get an available interface from a device
   */
  const getAvailableInterface = (device: NetworkDevice) => {
    switch (device.type) {
      case 'switch':
      case 'router':
        const deviceWithInterfaces = device as any;
        // Find first interface that's not already used in a connection
        return deviceWithInterfaces.interfaces?.find((iface: any) => {
          return !connections.some(conn => 
            conn.sourceInterface === iface.id || conn.targetInterface === iface.id
          );
        });
      case 'pc':
      case 'server':
        const deviceWithInterface = device as any;
        // Check if the single interface is available
        const isUsed = connections.some(conn =>
          conn.sourceInterface === deviceWithInterface.interface?.id || 
          conn.targetInterface === deviceWithInterface.interface?.id
        );
        return isUsed ? null : deviceWithInterface.interface;
      default:
        return null;
    }
  };

  /**
   * Check if a device can accept more connections
   */
  const canConnect = useCallback((device: NetworkDevice) => {
    return getAvailableInterface(device) !== null;
  }, [connections]);

  /**
   * Get connection status for visual feedback
   */
  const getConnectionCursor = useCallback(() => {
    if (connectionState.isCreating) {
      return 'crosshair';
    }
    return 'default';
  }, [connectionState.isCreating]);

  return {
    connectionState,
    startConnection,
    completeConnection,
    cancelConnection,
    canConnect,
    getConnectionCursor,
    isCreatingConnection: connectionState.isCreating,
    sourceDevice: connectionState.sourceDevice,
  };
};