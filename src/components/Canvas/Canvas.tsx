import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { useAppStore } from '../../store';
import { createDeviceFromTemplate } from '../../data/sampleData';
import { useConnectionManager } from '../../hooks/useConnectionManager';
import {
  createSvgContainer,
  createZoomBehavior,
  createGridPattern,
  getResponsiveCanvasDimensions,
  screenToCanvas,
  resetZoom,
  fitToCanvas,
  defaultCanvasConfig,
  defaultZoomConfig,
} from '../../utils/d3-helpers/canvasHelpers';
import {
  renderDeviceNodes,
  highlightDevice,
  getDeviceBounds,
  defaultDeviceConfig,
} from '../../utils/d3-helpers/deviceHelpers';
import {
  renderConnectionLines,
  renderConnectionLabels,
  defaultConnectionConfig,
} from '../../utils/d3-helpers/connectionHelpers';
import { PacketAnimationManager } from '../../utils/simulation/packetAnimation';
import { PacketStatus } from '../../types/simulation';
import DeviceConfigModal from '../Modals/DeviceConfigModal';
import { getInterfaceVlans, validateNetworkVlanConfig } from '../../utils/vlan-logic/vlanConfiguration';

/**
 * D3.js enhanced Canvas component for network topology visualization
 * Features: zoom, pan, responsive sizing, SVG container with grid background
 */
const Canvas: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<d3.Selection<SVGSVGElement, unknown, null, undefined> | null>(null);
  const containerRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const animationManagerRef = useRef<PacketAnimationManager | null>(null);
  
  const { 
    devices, 
    connections, 
    addDevice, 
    updateDevice, 
    selectedDevice, 
    selectDevice,
    showVlanHighlight,
    selectedVlan,
    vlans,
    selectedConnections,
    toggleSelectConnection,
    removeSelectedConnections,
    simulationRunning,
    currentSimulation,
    simulationSpeed,
    removeDevice,
    showPortLabels,
  } = useAppStore();
  
  const [dragOver, setDragOver] = useState(false);
  const [showConnectionLabels, setShowConnectionLabels] = useState(false);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ open: boolean; x: number; y: number; device?: any }>({ open: false, x: 0, y: 0 });

  // Device config modal state
  const [configModal, setConfigModal] = useState<{ open: boolean; device?: any }>({ open: false });
  
  // Connection management
  const {
    startConnection,
    completeConnection,
    cancelConnection,
    isCreatingConnection,
    sourceDevice: connectionSourceDevice,
    canConnect,
    setSourceInterfaceId,
    setTargetInterfaceId,
    commitConnection,
  } = useConnectionManager();

  // Connection context menu (for deletion)
  const [connMenu, setConnMenu] = useState<{ open: boolean; x: number; y: number; id?: string }>({ open: false, x: 0, y: 0 });

  // Initialize D3.js canvas
  const initializeCanvas = useCallback(() => {
    if (!canvasRef.current) return;

    const dimensions = getResponsiveCanvasDimensions(canvasRef.current);
    const config = { ...defaultCanvasConfig, ...dimensions };

    // Create SVG container
    const svg = createSvgContainer(canvasRef.current, config);
    svgRef.current = svg;

    // Create main container group
    const container = svg.append('g').attr('class', 'main-container');
    containerRef.current = container;

    // Create grid pattern
    createGridPattern(svg);

    // Create connection container
    container.append('g').attr('class', 'connections-container');

    // Create device container  
    container.append('g').attr('class', 'devices-container');

    // Initialize packet animation manager
    const animationManager = new PacketAnimationManager(container);
    animationManagerRef.current = animationManager;
    
    // Connect animation manager to simulation engine
    const { simulationEngine } = useAppStore.getState();
    if (simulationEngine) {
      simulationEngine.initializeAnimationManager(container);
    }

    // Setup zoom behavior
    const zoom = createZoomBehavior(svg, container, defaultZoomConfig);
    zoomRef.current = zoom;

    // Add canvas click handler for deselection and connection cancellation
    svg.on('click', () => {
      if (isCreatingConnection) {
        cancelConnection();
      } else {
        selectDevice(undefined);
      }
    });
  }, [selectDevice, isCreatingConnection, cancelConnection]);

  // Update canvas content
  const updateCanvas = useCallback(() => {
    if (!containerRef.current) return;

    const devicesContainer = containerRef.current.select('.devices-container') as d3.Selection<SVGGElement, unknown, null, undefined>;
    const connectionsContainer = containerRef.current.select('.connections-container') as d3.Selection<SVGGElement, unknown, null, undefined>;

    // Render connections
    const paths = renderConnectionLines(
      connectionsContainer,
      connections,
      devices,
      selectedConnections,
      defaultConnectionConfig,
      (connection: any, event: MouseEvent) => {
        event.stopPropagation();
        toggleSelectConnection(connection.id);
      }
    );

    // Also allow selecting by clicking on the path directly
    paths.on('click', function(event: MouseEvent, d: any) {
      event.stopPropagation();
      toggleSelectConnection(d.id);
    });

    // Right-click context menu for connections
    paths.on('contextmenu', function(event: any, d: any) {
      event.preventDefault();
      setConnMenu({ open: true, x: event.clientX, y: event.clientY, id: d.id });
    });

    // VLAN highlight styling (if enabled)
    if (showVlanHighlight && selectedVlan) {
      const devicesMap = new Map(devices.map((d) => [d.id, d]));
      const vlanColor = vlans.find(v => v.id === selectedVlan)?.color || '#60A5FA';

      const connectionSupportsVlan = (conn: any, vlanId: number): boolean => {
        const src = devicesMap.get(conn.sourceDevice) as any;
        const dst = devicesMap.get(conn.targetDevice) as any;
        if (!src || !dst) return false;

        const getIfVlans = (dev: any, ifId: string): number[] => {
          if ('interfaces' in dev && Array.isArray(dev.interfaces)) {
            const iface = dev.interfaces.find((i: any) => i.id === ifId);
            if (!iface) return [];
            return getInterfaceVlans(iface);
          }
          if ('interface' in dev && dev.interface && dev.interface.id === ifId) {
            // End hosts (pc/server) typically untagged; treat VLAN membership as determined by the switch side
            return [];
          }
          return [];
        };

        const srcVlans = getIfVlans(src, conn.sourceInterface);
        const dstVlans = getIfVlans(dst, conn.targetInterface);

        const srcIsSwitch = 'interfaces' in src;
        const dstIsSwitch = 'interfaces' in dst;

        if (srcIsSwitch && dstIsSwitch) {
          return srcVlans.includes(vlanId) && dstVlans.includes(vlanId);
        }
        // If only one side is a switch, rely on that side's VLAN membership
        return srcVlans.includes(vlanId) || dstVlans.includes(vlanId);
      };

      paths
        .attr('opacity', (d: any) => (connectionSupportsVlan(d, selectedVlan) ? 1 : 0.15))
        .attr('stroke', (d: any) => (connectionSupportsVlan(d, selectedVlan) ? vlanColor : '#4B5563'));
    }

    // Render connection labels if enabled
    renderConnectionLabels(
      connectionsContainer,
      connections,
      devices,
      showConnectionLabels,
      defaultConnectionConfig
    )
      // Add click handler for selecting connections
      .on('click', function(event: MouseEvent, d: any) {
        event.stopPropagation();
        toggleSelectConnection(d.id);
      });

    // Render endpoint interface labels based on toggle
    if (showPortLabels) {
      import('../../utils/d3-helpers/connectionHelpers').then(({ renderConnectionEndpointLabels }) => {
        renderConnectionEndpointLabels(connectionsContainer as any, connections as any, devices as any);
      });
    } else {
      connectionsContainer.selectAll('.connection-port-label').remove();
    }

    // Render devices with interaction handlers
    const deviceGroups = renderDeviceNodes(
      devicesContainer,
      devices,
      defaultDeviceConfig,
      handleDeviceClick,
      handleDeviceDragStart,
      handleDeviceDrag,
      handleDeviceDragEnd
    );

    // Double-click to open configuration modal
    deviceGroups.on('dblclick', (event: any, d: any) => {
      event.preventDefault();
      setConfigModal({ open: true, device: d });
    });

    // Right-click context menu for devices
    deviceGroups.on('contextmenu', function(event: any, d: any) {
      event.preventDefault();
      const { clientX, clientY } = event;
      setContextMenu({ open: true, x: clientX, y: clientY, device: d });
    });

    // Highlight selected device
    if (selectedDevice) {
      highlightDevice(deviceGroups, selectedDevice, true);
    }

    // VLAN device highlight (broadcast domain visualization)
    if (showVlanHighlight && selectedVlan) {
      const vlanColor = vlans.find(v => v.id === selectedVlan)?.color || '#60A5FA';
      deviceGroups.each(function(d: any) {
        let participates = false;
        if ('interfaces' in d && Array.isArray(d.interfaces)) {
          participates = d.interfaces.some((i: any) => getInterfaceVlans(i).includes(selectedVlan));
        }
        // End-hosts: currently skip, can derive via connected switch later
        d3.select(this).select('.device-body')
          .attr('stroke', participates ? vlanColor : d3.select(this).select('.device-body').attr('stroke'))
          .attr('stroke-width', participates ? 3 : defaultDeviceConfig.strokeWidth);
      });
    }

    // Error highlighting based on VLAN validation
    const validation = validateNetworkVlanConfig(devices as any, vlans as any, connections as any);
    const devicesWithErrors = new Set(Object.entries(validation.byDevice)
      .filter(([_, v]) => v.errors.length > 0)
      .map(([k]) => k));

    deviceGroups.each(function(d: any) {
      const hasError = devicesWithErrors.has(d.id);
      if (hasError) {
        d3.select(this).select('.device-body')
          .attr('stroke', '#EF4444')
          .attr('stroke-width', 4);
      }
    });
  }, [devices, connections, selectedDevice, showConnectionLabels, showVlanHighlight, selectedVlan, vlans, showPortLabels]);

  // Interface selection modal state
  const [ifacePicker, setIfacePicker] = useState<{ open: boolean; device?: any; role?: 'source'|'target' }>(
    { open: false }
  );

  // Device interaction handlers
  const handleDeviceClick = useCallback((device: any, event: MouseEvent) => {
    if (isCreatingConnection) {
      // Stage target device and open interface picker for target
      completeConnection(device);
      setIfacePicker({ open: true, device, role: 'target' });
      return;
    }

    // If Ctrl/Cmd is held, do a simple select without toggling connection mode
    if ((event as any).ctrlKey || (event as any).metaKey) {
      selectDevice(device.id === selectedDevice ? undefined : device.id);
      return;
    }

    // Click-to-connect flow (always allowed), enhanced when toolbar connect tool is active
    const { connectionToolActive } = useAppStore.getState();
    if (connectionToolActive && canConnect(device)) {
      startConnection(device);
      selectDevice(device.id);
      // Prompt to choose source interface immediately
      setIfacePicker({ open: true, device, role: 'source' });
      return;
    }

    // If tool not active, fall back to selection
    selectDevice(device.id === selectedDevice ? undefined : device.id);
  }, [selectDevice, selectedDevice, isCreatingConnection, completeConnection, startConnection, canConnect]);

  const handleDeviceDragStart = useCallback((device: any) => {
    // Device drag start logic
  }, []);

  const handleDeviceDrag = useCallback((device: any, x: number, y: number) => {
    updateDevice(device.id, {
      position: { x, y }
    });
  }, [updateDevice]);

  const handleDeviceDragEnd = useCallback((device: any) => {
    // Device drag end logic  
  }, []);

  // Handle device template drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      
      if (data.type === 'device-template' && svgRef.current && zoomRef.current) {
        const transform = d3.zoomTransform(svgRef.current.node() as Element);
        const canvasCoords = screenToCanvas(e.clientX, e.clientY, transform, svgRef.current);
        
        const deviceName = `${data.template.name}-${devices.length + 1}`;
        const newDevice = createDeviceFromTemplate(data.template, deviceName, canvasCoords);
        addDevice(newDevice);
      }
    } catch (error) {
      console.error('Error parsing dropped data:', error);
    }
  };

  // Canvas control functions
  const handleResetZoom = () => {
    if (svgRef.current && zoomRef.current) {
      resetZoom(svgRef.current, zoomRef.current);
    }
  };

  const handleFitToCanvas = () => {
    if (svgRef.current && zoomRef.current && devices.length > 0) {
      const bounds = getDeviceBounds(devices, defaultDeviceConfig);
      fitToCanvas(svgRef.current, zoomRef.current, bounds);
    }
  };

  const toggleConnectionLabels = () => {
    setShowConnectionLabels(!showConnectionLabels);
  };

  // Effects
  useEffect(() => {
    initializeCanvas();
    
    // Handle window resize
    const handleResize = () => {
      if (canvasRef.current && svgRef.current) {
        const dimensions = getResponsiveCanvasDimensions(canvasRef.current);
        svgRef.current
          .attr('viewBox', `0 0 ${dimensions.width} ${dimensions.height}`);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [initializeCanvas]);

  useEffect(() => {
    updateCanvas();
  }, [updateCanvas]);

  // Keyboard: delete selected connections
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Delete selected device if any
        const sd = useAppStore.getState().selectedDevice;
        if (sd) {
          e.preventDefault();
          useAppStore.getState().removeDevice(sd);
          setConnMenu({ open: false, x: 0, y: 0 });
          return;
        }
        // Otherwise delete selected connections if any
        if (selectedConnections.length > 0) {
          e.preventDefault();
          removeSelectedConnections();
          setConnMenu({ open: false, x: 0, y: 0 });
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedConnections, removeSelectedConnections]);

  // Update packet animation manager when topology changes
  useEffect(() => {
    if (animationManagerRef.current) {
      animationManagerRef.current.updateTopology(devices, connections);
    }
    
    // Also update simulation engine's animation manager
    const { simulationEngine } = useAppStore.getState();
    if (simulationEngine && containerRef.current) {
      simulationEngine.initializeAnimationManager(containerRef.current);
    }
  }, [devices, connections]);

  // Sync animation settings with simulation state
  useEffect(() => {
    if (animationManagerRef.current) {
      animationManagerRef.current.setAnimationSpeed(simulationSpeed);
    }
    
    const { simulationEngine } = useAppStore.getState();
    if (simulationEngine) {
      simulationEngine.setAnimationEnabled(simulationRunning);
    }
  }, [simulationRunning, simulationSpeed]);

  // Clear animations when simulation stops
  useEffect(() => {
    if (!simulationRunning && animationManagerRef.current) {
      animationManagerRef.current.clearAnimations();
    }
  }, [simulationRunning]);

  return (
    <div className="relative w-full h-full bg-gray-900 overflow-hidden" onContextMenu={(e) => {
      // Prevent browser context menu on background
      if ((e.target as HTMLElement).closest('.device-node')) return;
      e.preventDefault();
      setContextMenu({ open: false, x: 0, y: 0 });
    }}>
      {/* D3.js Canvas Container */}
      <div
        ref={canvasRef}
        className={`w-full h-full network-canvas ${dragOver ? 'bg-gray-800' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* SVG will be created by D3.js */}
      </div>


      {/* Drop zone hint */}
      {dragOver && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50 pointer-events-none z-10">
          <div className="bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg">
            Drop device here to add to topology
          </div>
        </div>
      )}

      {/* Empty state */}
      {devices.length === 0 && !dragOver && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-400 z-10">
          <div className="text-center">
            <div className="text-4xl mb-4">🌐</div>
            <div className="text-lg mb-2">No devices in topology</div>
            <div className="text-sm">Drag devices from the sidebar to get started</div>
            <div className="text-sm mt-2">or</div>
            <button
              onClick={() => {
                import('../../data/sampleData').then(({ sampleTopology }) => {
                  useAppStore.getState().loadTopology(sampleTopology);
                });
              }}
              className="mt-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              Load Sample Topology
            </button>
          </div>
        </div>
      )}

      {/* Connection creation indicator */}
      {isCreatingConnection && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-20">
          <div className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg">
            <div className="text-sm font-medium">
              Creating connection from {connectionSourceDevice?.name}
            </div>
            <div className="text-xs opacity-75">
              Click a device to connect, or click canvas to cancel
            </div>
          </div>
        </div>
      )}

      {/* Right overlay controls removed to maximize workspace */}

        {/* Packet animation controls */}
        {simulationRunning && currentSimulation && (
          <div className="bg-gray-800 bg-opacity-80 px-3 py-2 rounded-lg text-xs text-white">
            <div className="flex items-center space-x-2">
              <span>📦</span>
              <span>
                {currentSimulation.packets.filter(p => p.status === PacketStatus.IN_TRANSIT).length} active
              </span>
            </div>
          </div>
        )}

      {/* Context Menu */}
      {contextMenu.open && contextMenu.device && (
        <div
          className="absolute z-30 bg-gray-800 border border-gray-700 rounded-lg shadow-lg text-sm"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            className="block w-full text-left px-4 py-2 hover:bg-gray-700"
            onClick={() => {
              setConfigModal({ open: true, device: contextMenu.device });
              setContextMenu({ open: false, x: 0, y: 0 });
            }}
          >
            ⚙️ Configure Device
          </button>
          <button
            className="block w-full text-left px-4 py-2 hover:bg-gray-700"
            onClick={() => {
              if (canConnect(contextMenu.device)) startConnection(contextMenu.device);
              setContextMenu({ open: false, x: 0, y: 0 });
            }}
          >
            🔗 Start Connection
          </button>
          <button
            className="block w-full text-left px-4 py-2 hover:bg-gray-700 text-red-300"
            onClick={() => {
              useAppStore.getState().removeDevice(contextMenu.device.id);
              setContextMenu({ open: false, x: 0, y: 0 });
            }}
          >
            🗑️ Delete Device
          </button>
        </div>
      )}

      {/* Device Config Modal */}
      {configModal.open && configModal.device && (
        <DeviceConfigModal
          open={configModal.open}
          device={configModal.device}
          onClose={() => setConfigModal({ open: false })}
          onSave={(updates) => updateDevice(configModal.device.id, updates)}
        />
      )}

      {/* Connection context menu */}
      {connMenu.open && connMenu.id && (
        <div
          className="absolute z-30 bg-gray-800 border border-gray-700 rounded-lg shadow-lg text-sm"
          style={{ left: connMenu.x, top: connMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="block w-full text-left px-4 py-2 hover:bg-red-700 text-red-300 rounded"
            onClick={() => {
              useAppStore.getState().removeConnection(connMenu.id!);
              setConnMenu({ open: false, x: 0, y: 0 });
            }}
          >
            🗑️ Delete Connection
          </button>
        </div>
      )}

      {/* Interface Picker Modal */}
      {ifacePicker.open && ifacePicker.device && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black bg-opacity-60" onClick={() => setIfacePicker({ open: false })} />
          <div className="relative w-full max-w-md mx-4 bg-gray-900 border border-gray-700 rounded-lg shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
              <div className="text-white font-medium">
                Select Interface on {ifacePicker.device.name} ({ifacePicker.role})
              </div>
              <button onClick={() => setIfacePicker({ open: false })} className="text-gray-300 hover:text-white">✕</button>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto">
              <div className="space-y-1">
                {(() => {
                  const dev: any = ifacePicker.device;
                  const used = new Set(
                    connections.flatMap(c => [c.sourceInterface, c.targetInterface])
                  );
                  const items = Array.isArray(dev.interfaces)
                    ? dev.interfaces
                    : dev.interface
                      ? [dev.interface]
                      : [];
                  const available = items.filter((i: any) => !used.has(i.id));
                  if (available.length === 0) {
                    return <div className="text-sm text-gray-400">No available interfaces on this device.</div>;
                  }
                  return available.map((i: any) => (
                    <button
                      key={i.id}
                      onClick={() => {
                        if (ifacePicker.role === 'source') {
                          setSourceInterfaceId(i.id);
                          setIfacePicker({ open: false });
                        } else {
                          setTargetInterfaceId(i.id);
                          setIfacePicker({ open: false });
                          // After picking target interface, commit
                          commitConnection();
                        }
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-md bg-gray-800 hover:bg-gray-700 text-left"
                    >
                      <div>
                        <div className="text-sm text-white">{i.name}</div>
                        <div className="text-xs text-gray-400">{i.type} • {i.status}</div>
                      </div>
                      <div className="text-xs text-gray-400">{i.speed}Mb {i.duplex}</div>
                    </button>
                  ));
                })()}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Canvas Info */}
      <div className="absolute bottom-4 right-4 bg-gray-800 bg-opacity-80 px-2 py-1 rounded-md text-xs text-gray-300 max-w-xs">
        <div>By N.Robert.C</div>
        <div>Devices: {devices.length} | Connections: {connections.length}</div>
        {selectedDevice && (
          <div>Selected: {devices.find(d => d.id === selectedDevice)?.name}</div>
        )}
        {!isCreatingConnection && devices.length > 1 && (
          <div className="text-xs mt-1 opacity-75">
            Connection mode: toggle 🔗 Connect in the top bar, then click source and target devices. Click canvas to cancel. Hold Ctrl to select.
          </div>
        )}
      </div>
    </div>
  );
};

export default Canvas;