import { useCallback, useState } from 'react';
import { useAppStore } from '../store';
import { Connection, NetworkDevice, ConnectionType, ConnectionStatus, InterfaceStatus, DeviceType } from '../types';
import { generateId } from '../data/sampleData';

/**
 * Connection creation state
 */
interface ConnectionCreationState {
  isCreating: boolean;
  sourceDevice?: NetworkDevice;
  sourceInterfaceId?: string;
  targetDevice?: NetworkDevice;
  targetInterfaceId?: string;
}

/**
 * Custom hook for managing connections between devices
 */
export const useConnectionManager = () => {
  const { devices, connections, addConnection, updateDevice } = useAppStore();
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
      sourceInterfaceId: undefined,
      targetDevice: undefined,
      targetInterfaceId: undefined,
    });
  }, []);

  /**
   * Complete connection creation to a target device
   */
  const completeConnection = useCallback((targetDevice: NetworkDevice) => {
    if (!connectionState.sourceDevice || connectionState.sourceDevice.id === targetDevice.id) {
      // Cancel if no source or connecting to self
      setConnectionState({ isCreating: false });
      return;
    }

    setConnectionState((prev) => ({
      ...prev,
      targetDevice,
    }));
  }, [connectionState.sourceDevice]);

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
      case DeviceType.SWITCH:
      case DeviceType.ROUTER: {
        const deviceWithInterfaces = device as any;
        // Find first interface that's not already used on THIS device
        return deviceWithInterfaces.interfaces?.find((iface: any) => {
          return !connections.some(conn =>
            (conn.sourceDevice === device.id && conn.sourceInterface === iface.id) ||
            (conn.targetDevice === device.id && conn.targetInterface === iface.id)
          );
        }) || null;
      }
      case DeviceType.PC:
      case DeviceType.SERVER: {
        const deviceWithInterface = device as any;
        const ifaceId = deviceWithInterface.interface?.id;
        if (!ifaceId) return null;
        // Check if the single interface is already used on THIS device
        const isUsed = connections.some(conn =>
          (conn.sourceDevice === device.id && conn.sourceInterface === ifaceId) ||
          (conn.targetDevice === device.id && conn.targetInterface === ifaceId)
        );
        return isUsed ? null : deviceWithInterface.interface;
      }
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

  const setSourceInterfaceId = useCallback((ifaceId: string) => {
    setConnectionState((prev) => ({ ...prev, sourceInterfaceId: ifaceId }));
  }, []);

  const setTargetInterfaceId = useCallback((ifaceId: string) => {
    setConnectionState((prev) => ({ ...prev, targetInterfaceId: ifaceId }));
  }, []);

  // Helper to set interface status UP after connecting
  const setInterfaceUp = useCallback((device: NetworkDevice, interfaceId: string) => {
    if (device.type === DeviceType.SWITCH || device.type === DeviceType.ROUTER || device.type === DeviceType.SERVER) {
      const devAny = device as any;
      if (Array.isArray(devAny.interfaces)) {
        const newIfaces = devAny.interfaces.map((i: any) => i.id === interfaceId ? { ...i, status: InterfaceStatus.UP } : i);
        updateDevice(device.id, { interfaces: newIfaces } as any);
      }
    } else if (device.type === DeviceType.PC) {
      const devPc = device as any;
      if (devPc.interface && devPc.interface.id === interfaceId) {
        updateDevice(device.id, { interface: { ...devPc.interface, status: InterfaceStatus.UP } } as any);
      }
    }
  }, [updateDevice]);

  const commitConnection = useCallback(() => {
    const { sourceDevice, sourceInterfaceId, targetDevice, targetInterfaceId } = connectionState;
    if (!sourceDevice || !sourceInterfaceId || !targetDevice || !targetInterfaceId) return;

    // Prevent duplicates
    const duplicate = connections.find(conn => (
      (conn.sourceDevice === sourceDevice.id && conn.sourceInterface === sourceInterfaceId && conn.targetDevice === targetDevice.id && conn.targetInterface === targetInterfaceId) ||
      (conn.sourceDevice === targetDevice.id && conn.sourceInterface === targetInterfaceId && conn.targetDevice === sourceDevice.id && conn.targetInterface === sourceInterfaceId)
    ));
    if (duplicate) {
      setConnectionState({ isCreating: false });
      return;
    }

    const newConnection: Connection = {
      id: generateId(),
      name: `${sourceDevice.name}-${targetDevice.name}`,
      sourceDevice: sourceDevice.id,
      sourceInterface: sourceInterfaceId,
      targetDevice: targetDevice.id,
      targetInterface: targetInterfaceId,
      connectionType: ConnectionType.ETHERNET,
      status: ConnectionStatus.UP,
      bandwidth: 1000,
    };
    addConnection(newConnection);

    // Turn up interfaces on both ends
    const srcDev = devices.find(d => d.id === sourceDevice.id);
    const dstDev = devices.find(d => d.id === targetDevice.id);
    if (srcDev) setInterfaceUp(srcDev, sourceInterfaceId);
    if (dstDev) setInterfaceUp(dstDev, targetInterfaceId);

    setConnectionState({ isCreating: false });
  }, [connectionState, connections, addConnection]);

  /**
   * Quickly connect current source device to a target device using first available interfaces
   */
  const quickConnectToTarget = useCallback((targetDevice: NetworkDevice): boolean => {
    const { sourceDevice } = connectionState;
    if (!sourceDevice) return false;

    const srcIface = getAvailableInterface(sourceDevice);
    const dstIface = getAvailableInterface(targetDevice);

    if (!srcIface || !dstIface) {
      setConnectionState({ isCreating: false });
      return false;
    }

    // Prevent duplicates
    const duplicate = connections.find(conn => (
      (conn.sourceDevice === sourceDevice.id && conn.sourceInterface === srcIface.id && conn.targetDevice === targetDevice.id && conn.targetInterface === dstIface.id) ||
      (conn.sourceDevice === targetDevice.id && conn.sourceInterface === dstIface.id && conn.targetDevice === sourceDevice.id && conn.targetInterface === srcIface.id)
    ));
    if (duplicate) {
      setConnectionState({ isCreating: false });
      return false;
    }

    const newConnection: Connection = {
      id: generateId(),
      name: `${sourceDevice.name}-${targetDevice.name}`,
      sourceDevice: sourceDevice.id,
      sourceInterface: srcIface.id,
      targetDevice: targetDevice.id,
      targetInterface: dstIface.id,
      connectionType: ConnectionType.ETHERNET,
      status: ConnectionStatus.UP,
      bandwidth: 1000,
    };

    addConnection(newConnection);

    // Turn up interfaces on both ends
    const srcDev = devices.find(d => d.id === sourceDevice.id);
    const dstDev = devices.find(d => d.id === targetDevice.id);
    if (srcDev) setInterfaceUp(srcDev, srcIface.id);
    if (dstDev) setInterfaceUp(dstDev, dstIface.id);

    setConnectionState({ isCreating: false });
    return true;
  }, [connectionState, connections, addConnection]);

  return {
    connectionState,
    startConnection,
    completeConnection,
    cancelConnection,
    canConnect,
    getConnectionCursor,
    isCreatingConnection: connectionState.isCreating,
    sourceDevice: connectionState.sourceDevice,
    setSourceInterfaceId,
    setTargetInterfaceId,
    commitConnection,
    getAvailableInterface,
    quickConnectToTarget,
  };
};