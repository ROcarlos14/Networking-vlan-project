import React, { useRef, useEffect, useState } from 'react';
import { useAppStore } from '../../store';
import { createDeviceFromTemplate } from '../../data/sampleData';

/**
 * Canvas component for network topology visualization
 * This is a basic implementation that will be enhanced with D3.js in the next phase
 */
const Canvas: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const { devices, connections, addDevice } = useAppStore();
  const [dragOver, setDragOver] = useState(false);

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
      
      if (data.type === 'device-template') {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          
          const deviceName = `${data.template.name}-${devices.length + 1}`;
          const newDevice = createDeviceFromTemplate(data.template, deviceName, { x, y });
          addDevice(newDevice);
        }
      }
    } catch (error) {
      console.error('Error parsing dropped data:', error);
    }
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'switch': return '🔀';
      case 'router': return '📶';
      case 'pc': return '💻';
      case 'server': return '🖥️';
      default: return '❓';
    }
  };

  return (
    <div className="relative w-full h-full bg-gray-900 overflow-hidden">
      {/* Canvas area */}
      <div
        ref={canvasRef}
        className={`w-full h-full network-canvas ${dragOver ? 'bg-gray-800' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Grid background */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          <defs>
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#374151" strokeWidth="1" opacity="0.3"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Render connections */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none">
          {connections.map((connection) => {
            const sourceDevice = devices.find(d => d.id === connection.sourceDevice);
            const targetDevice = devices.find(d => d.id === connection.targetDevice);
            
            if (!sourceDevice || !targetDevice) return null;

            return (
              <line
                key={connection.id}
                x1={sourceDevice.position.x}
                y1={sourceDevice.position.y}
                x2={targetDevice.position.x}
                y2={targetDevice.position.y}
                stroke="#60A5FA"
                strokeWidth="2"
                className="connection-line"
              />
            );
          })}
        </svg>

        {/* Render devices */}
        {devices.map((device) => (
          <div
            key={device.id}
            className="absolute device-node select-none"
            style={{
              left: device.position.x - 30,
              top: device.position.y - 30,
              transform: 'translate(-50%, -50%)',
            }}
          >
            {/* Device icon */}
            <div className="w-16 h-16 bg-gray-700 border-2 border-gray-500 rounded-lg flex items-center justify-center text-2xl hover:bg-gray-600 transition-colors">
              {getDeviceIcon(device.type)}
            </div>
            
            {/* Device label */}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 px-2 py-1 bg-gray-800 border border-gray-600 rounded text-xs text-white whitespace-nowrap">
              {device.name}
            </div>

            {/* Status indicator */}
            <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-gray-900 ${
              device.status === 'active' ? 'bg-green-400' : 
              device.status === 'error' ? 'bg-red-400' : 'bg-gray-400'
            }`} />
          </div>
        ))}

        {/* Drop zone hint */}
        {dragOver && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800 bg-opacity-50 pointer-events-none">
            <div className="bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg">
              Drop device here to add to topology
            </div>
          </div>
        )}

        {/* Empty state */}
        {devices.length === 0 && !dragOver && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400">
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
      </div>

      {/* Canvas info */}
      <div className="absolute bottom-4 left-4 bg-gray-800 bg-opacity-80 px-3 py-2 rounded-lg text-sm text-gray-300">
        <div>Canvas: Ready for D3.js integration</div>
        <div>Devices: {devices.length} | Connections: {connections.length}</div>
      </div>
    </div>
  );
};

export default Canvas;