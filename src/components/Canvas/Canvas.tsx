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

/**
 * D3.js enhanced Canvas component for network topology visualization
 * Features: zoom, pan, responsive sizing, SVG container with grid background
 */
const Canvas: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<d3.Selection<SVGSVGElement, unknown, null, undefined> | null>(null);
  const containerRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  
  const { 
    devices, 
    connections, 
    addDevice, 
    updateDevice, 
    selectedDevice, 
    selectDevice,
    showVlanHighlight 
  } = useAppStore();
  
  const [dragOver, setDragOver] = useState(false);
  const [showConnectionLabels, setShowConnectionLabels] = useState(false);
  
  // Connection management
  const {
    startConnection,
    completeConnection,
    cancelConnection,
    isCreatingConnection,
    sourceDevice: connectionSourceDevice,
    canConnect
  } = useConnectionManager();

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
    renderConnectionLines(
      connectionsContainer,
      connections,
      devices,
      [], // selectedConnections - will be implemented later
      defaultConnectionConfig
    );

    // Render connection labels if enabled
    renderConnectionLabels(
      connectionsContainer,
      connections,
      devices,
      showConnectionLabels,
      defaultConnectionConfig
    );

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

    // Highlight selected device
    if (selectedDevice) {
      highlightDevice(deviceGroups, selectedDevice, true);
    }
  }, [devices, connections, selectedDevice, showConnectionLabels]);

  // Device interaction handlers
  const handleDeviceClick = useCallback((device: any, event: MouseEvent) => {
    if (isCreatingConnection) {
      // Complete connection if we're in connection mode
      completeConnection(device);
    } else if (event.altKey || event.shiftKey) {
      // Start connection creation with Alt/Shift + click
      if (canConnect(device)) {
        startConnection(device);
      }
    } else {
      // Normal device selection
      selectDevice(device.id === selectedDevice ? undefined : device.id);
    }
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

  return (
    <div className="relative w-full h-full bg-gray-900 overflow-hidden">
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

      {/* Canvas Controls */}
      <div className="absolute top-4 right-4 flex flex-col space-y-2 z-20">
        <button
          onClick={handleResetZoom}
          className="bg-gray-800 bg-opacity-80 hover:bg-opacity-100 text-white p-2 rounded-lg transition-colors"
          title="Reset Zoom"
        >
          🔍
        </button>
        
        {devices.length > 0 && (
          <button
            onClick={handleFitToCanvas}
            className="bg-gray-800 bg-opacity-80 hover:bg-opacity-100 text-white p-2 rounded-lg transition-colors"
            title="Fit to Canvas"
          >
            📐
          </button>
        )}
        
        {connections.length > 0 && (
          <button
            onClick={toggleConnectionLabels}
            className={`bg-gray-800 bg-opacity-80 hover:bg-opacity-100 text-white p-2 rounded-lg transition-colors ${
              showConnectionLabels ? 'ring-2 ring-blue-400' : ''
            }`}
            title="Toggle Connection Labels"
          >
            🏷️
          </button>
        )}
        
        <button
          onClick={isCreatingConnection ? cancelConnection : () => {}}
          className={`bg-gray-800 bg-opacity-80 hover:bg-opacity-100 text-white p-2 rounded-lg transition-colors ${
            isCreatingConnection ? 'ring-2 ring-red-400' : ''
          }`}
          title="Connection Mode: Shift+Click device to start connection"
        >
          🔗
        </button>
      </div>

      {/* Canvas Info */}
      <div className="absolute bottom-4 left-4 bg-gray-800 bg-opacity-80 px-3 py-2 rounded-lg text-sm text-gray-300 max-w-sm">
        <div>D3.js Canvas: Pan, Zoom, Drag</div>
        <div>Devices: {devices.length} | Connections: {connections.length}</div>
        {selectedDevice && (
          <div>Selected: {devices.find(d => d.id === selectedDevice)?.name}</div>
        )}
        {!isCreatingConnection && devices.length > 1 && (
          <div className="text-xs mt-1 opacity-75">
            Shift+Click devices to create connections
          </div>
        )}
      </div>
    </div>
  );
};

export default Canvas;