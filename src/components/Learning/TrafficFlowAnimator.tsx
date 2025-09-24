import React, { useState, useEffect, useRef } from 'react';
import { Device, Connection } from '../../types';
import { getVlanColor } from '../../types/colors';

/**
 * Traffic Flow Animation Types
 */
export interface AnimatedPacket {
  id: string;
  srcDeviceId: string;
  dstDeviceId: string;
  vlanId: number;
  packetType: 'unicast' | 'broadcast' | 'multicast' | 'arp' | 'dhcp';
  currentPosition: { x: number; y: number };
  path: string[];
  pathIndex: number;
  isTagged: boolean;
  size: 'small' | 'medium' | 'large';
  speed: number;
  timestamp: number;
}

/**
 * Flow Configuration
 */
export interface FlowConfig {
  showVlanTags: boolean;
  showPacketTypes: boolean;
  animationSpeed: number;
  maxPackets: number;
  colorByVlan: boolean;
}

/**
 * Props for TrafficFlowAnimator
 */
interface TrafficFlowAnimatorProps {
  devices: Device[];
  connections: Connection[];
  selectedVlan?: number;
  isAnimating: boolean;
  config: FlowConfig;
  onPacketClick?: (packet: AnimatedPacket) => void;
}

/**
 * Traffic Flow Animator Component
 * 
 * This component visualizes network traffic with VLAN-aware animations
 */
const TrafficFlowAnimator: React.FC<TrafficFlowAnimatorProps> = ({
  devices,
  connections,
  selectedVlan,
  isAnimating,
  config,
  onPacketClick
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [animatedPackets, setAnimatedPackets] = useState<AnimatedPacket[]>([]);
  const [hoveredPacket, setHoveredPacket] = useState<string | null>(null);
  const animationFrameRef = useRef<number>();

  /**
   * Generate sample traffic patterns
   */
  const generateTrafficPattern = (): AnimatedPacket[] => {
    const packets: AnimatedPacket[] = [];
    const timestamp = Date.now();
    
    // Generate different types of traffic
    const trafficPatterns = [
      // Unicast traffic between PCs in same VLAN
      {
        type: 'unicast' as const,
        vlan: 10,
        probability: 0.4
      },
      // Broadcast traffic (ARP, DHCP)
      {
        type: 'broadcast' as const,
        vlan: 1,
        probability: 0.2
      },
      // Inter-VLAN traffic through router
      {
        type: 'unicast' as const,
        vlan: 20,
        probability: 0.3
      },
      // Management traffic
      {
        type: 'unicast' as const,
        vlan: 999,
        probability: 0.1
      }
    ];

    devices.forEach((srcDevice, srcIndex) => {
      devices.forEach((dstDevice, dstIndex) => {
        if (srcIndex !== dstIndex && Math.random() < 0.1) {
          const pattern = trafficPatterns[Math.floor(Math.random() * trafficPatterns.length)];
          
          // Skip if filtering by VLAN and this packet doesn't match
          if (selectedVlan && pattern.vlan !== selectedVlan) return;
          
          const packet: AnimatedPacket = {
            id: `packet_${timestamp}_${srcIndex}_${dstIndex}`,
            srcDeviceId: srcDevice.id,
            dstDeviceId: dstDevice.id,
            vlanId: pattern.vlan,
            packetType: pattern.type,
            currentPosition: { x: srcDevice.position.x, y: srcDevice.position.y },
            path: calculatePath(srcDevice, dstDevice, connections),
            pathIndex: 0,
            isTagged: pattern.vlan !== 1,
            size: pattern.type === 'broadcast' ? 'large' : 'medium',
            speed: config.animationSpeed * (0.5 + Math.random() * 0.5),
            timestamp
          };
          
          packets.push(packet);
        }
      });
    });

    return packets.slice(0, config.maxPackets);
  };

  /**
   * Calculate shortest path between two devices
   */
  const calculatePath = (src: Device, dst: Device, connections: Connection[]): string[] => {
    // Simple path calculation - in real implementation, this would use
    // Dijkstra's algorithm or similar for optimal path finding
    
    // Direct connection check
    const directConnection = connections.find(
      conn => (conn.sourceDevice === src.id && conn.targetDevice === dst.id) ||
              (conn.sourceDevice === dst.id && conn.targetDevice === src.id)
    );
    
    if (directConnection) {
      return [src.id, dst.id];
    }
    
    // Find path through switches/routers
    const switches = devices.filter(d => d.type === 'switch' || d.type === 'router');
    
    for (const intermediateDevice of switches) {
      const toIntermediate = connections.find(
        conn => (conn.sourceDevice === src.id && conn.targetDevice === intermediateDevice.id) ||
                (conn.sourceDevice === intermediateDevice.id && conn.targetDevice === src.id)
      );
      
      const fromIntermediate = connections.find(
        conn => (conn.sourceDevice === intermediateDevice.id && conn.targetDevice === dst.id) ||
                (conn.sourceDevice === dst.id && conn.targetDevice === intermediateDevice.id)
      );
      
      if (toIntermediate && fromIntermediate) {
        return [src.id, intermediateDevice.id, dst.id];
      }
    }
    
    return [src.id, dst.id]; // Fallback to direct path
  };

  /**
   * Update packet positions
   */
  const updatePacketPositions = () => {
    setAnimatedPackets(prevPackets => {
      return prevPackets.map(packet => {
        if (packet.pathIndex >= packet.path.length - 1) {
          return packet; // Packet reached destination
        }
        
        const currentDeviceId = packet.path[packet.pathIndex];
        const nextDeviceId = packet.path[packet.pathIndex + 1];
        
        const currentDevice = devices.find(d => d.id === currentDeviceId);
        const nextDevice = devices.find(d => d.id === nextDeviceId);
        
        if (!currentDevice || !nextDevice) return packet;
        
        // Calculate movement vector
        const dx = nextDevice.position.x - currentDevice.position.x;
        const dy = nextDevice.position.y - currentDevice.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance === 0) return packet;
        
        // Normalize and apply speed
        const normalizedDx = (dx / distance) * packet.speed;
        const normalizedDy = (dy / distance) * packet.speed;
        
        const newX = packet.currentPosition.x + normalizedDx;
        const newY = packet.currentPosition.y + normalizedDy;
        
        // Check if reached next device
        const distanceToNext = Math.sqrt(
          Math.pow(newX - nextDevice.position.x, 2) + Math.pow(newY - nextDevice.position.y, 2)
        );
        
        if (distanceToNext < 10) {
          return {
            ...packet,
            currentPosition: { x: nextDevice.position.x, y: nextDevice.position.y },
            pathIndex: packet.pathIndex + 1
          };
        }
        
        return {
          ...packet,
          currentPosition: { x: newX, y: newY }
        };
      }).filter(packet => {
        // Remove packets that have been at destination for too long
        const reachedDestination = packet.pathIndex >= packet.path.length - 1;
        const timeSinceCreation = Date.now() - packet.timestamp;
        return !reachedDestination || timeSinceCreation < 2000;
      });
    });
  };

  /**
   * Animation loop
   */
  const animate = () => {
    if (!isAnimating) return;
    
    updatePacketPositions();
    
    // Generate new packets occasionally
    if (Math.random() < 0.05 && animatedPackets.length < config.maxPackets) {
      const newPackets = generateTrafficPattern();
      setAnimatedPackets(prev => [...prev, ...newPackets]);
    }
    
    animationFrameRef.current = requestAnimationFrame(animate);
  };

  /**
   * Start/stop animation based on isAnimating prop
   */
  useEffect(() => {
    if (isAnimating) {
      animate();
    } else if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isAnimating, devices, connections, config]);

  /**
   * Get packet color based on VLAN
   */
  const getPacketColor = (packet: AnimatedPacket): string => {
    if (config.colorByVlan) {
      return getVlanColor(packet.vlanId);
    }
    
    // Color by packet type
    switch (packet.packetType) {
      case 'broadcast': return '#EF4444'; // Red
      case 'multicast': return '#F59E0B'; // Orange
      case 'arp': return '#10B981'; // Green
      case 'dhcp': return '#8B5CF6'; // Purple
      default: return '#3B82F6'; // Blue
    }
  };

  /**
   * Get packet size
   */
  const getPacketSize = (packet: AnimatedPacket): number => {
    switch (packet.size) {
      case 'small': return 4;
      case 'medium': return 6;
      case 'large': return 8;
      default: return 6;
    }
  };

  /**
   * Get packet opacity based on type
   */
  const getPacketOpacity = (packet: AnimatedPacket): number => {
    if (selectedVlan && packet.vlanId !== selectedVlan) {
      return 0.3; // Dim packets not in selected VLAN
    }
    return hoveredPacket === packet.id ? 1 : 0.8;
  };

  /**
   * Render VLAN tag indicator
   */
  const renderVlanTag = (packet: AnimatedPacket) => {
    if (!config.showVlanTags || !packet.isTagged) return null;
    
    return (
      <g>
        <rect
          x={packet.currentPosition.x - 8}
          y={packet.currentPosition.y - 15}
          width={16}
          height={8}
          fill="white"
          stroke={getPacketColor(packet)}
          strokeWidth={1}
          rx={2}
        />
        <text
          x={packet.currentPosition.x}
          y={packet.currentPosition.y - 9}
          textAnchor="middle"
          fontSize={6}
          fill={getPacketColor(packet)}
          fontWeight="bold"
        >
          {packet.vlanId}
        </text>
      </g>
    );
  };

  /**
   * Render packet type indicator
   */
  const renderPacketTypeIndicator = (packet: AnimatedPacket) => {
    if (!config.showPacketTypes) return null;
    
    const typeSymbols = {
      unicast: '→',
      broadcast: '✦',
      multicast: '⬢',
      arp: 'A',
      dhcp: 'D'
    };
    
    return (
      <text
        x={packet.currentPosition.x}
        y={packet.currentPosition.y + 3}
        textAnchor="middle"
        fontSize={8}
        fill="white"
        fontWeight="bold"
      >
        {typeSymbols[packet.packetType] || '•'}
      </text>
    );
  };

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 10 }}
        viewBox="0 0 800 600"
      >
        {/* Render animated packets */}
        {animatedPackets.map(packet => (
          <g key={packet.id}>
            {/* Packet trail effect */}
            <circle
              cx={packet.currentPosition.x}
              cy={packet.currentPosition.y}
              r={getPacketSize(packet) + 2}
              fill={getPacketColor(packet)}
              opacity={0.2}
            />
            
            {/* Main packet */}
            <circle
              cx={packet.currentPosition.x}
              cy={packet.currentPosition.y}
              r={getPacketSize(packet)}
              fill={getPacketColor(packet)}
              opacity={getPacketOpacity(packet)}
              stroke="white"
              strokeWidth={1}
              className="cursor-pointer"
              onMouseEnter={() => setHoveredPacket(packet.id)}
              onMouseLeave={() => setHoveredPacket(null)}
              onClick={() => onPacketClick?.(packet)}
              style={{ pointerEvents: 'auto' }}
            >
              <title>
                VLAN {packet.vlanId} - {packet.packetType} from {packet.srcDeviceId} to {packet.dstDeviceId}
              </title>
            </circle>
            
            {/* VLAN tag */}
            {renderVlanTag(packet)}
            
            {/* Packet type indicator */}
            {renderPacketTypeIndicator(packet)}
            
            {/* Pulsing effect for broadcast packets */}
            {packet.packetType === 'broadcast' && (
              <circle
                cx={packet.currentPosition.x}
                cy={packet.currentPosition.y}
                r={getPacketSize(packet)}
                fill="none"
                stroke={getPacketColor(packet)}
                strokeWidth={2}
                opacity={0.6}
              >
                <animate
                  attributeName="r"
                  values={`${getPacketSize(packet)};${getPacketSize(packet) + 10};${getPacketSize(packet)}`}
                  dur="2s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.6;0;0.6"
                  dur="2s"
                  repeatCount="indefinite"
                />
              </circle>
            )}
          </g>
        ))}
      </svg>
      
      {/* Traffic Statistics Panel */}
      <div className="absolute top-4 right-4 bg-white bg-opacity-90 rounded-lg p-3 text-sm">
        <h4 className="font-medium text-gray-700 mb-2">📊 Live Traffic</h4>
        <div className="space-y-1 text-xs">
          <div>Active Packets: {animatedPackets.length}</div>
          <div>VLAN Filter: {selectedVlan || 'All'}</div>
          <div>Animation: {isAnimating ? '▶️ Playing' : '⏸️ Paused'}</div>
        </div>
        
        {/* VLAN breakdown */}
        <div className="mt-2 pt-2 border-t">
          <div className="text-xs text-gray-600 mb-1">By VLAN:</div>
          {Object.entries(
            animatedPackets.reduce((acc, packet) => {
              acc[packet.vlanId] = (acc[packet.vlanId] || 0) + 1;
              return acc;
            }, {} as Record<number, number>)
          ).map(([vlanId, count]) => (
            <div key={vlanId} className="flex items-center justify-between text-xs">
              <div className="flex items-center">
                <div
                  className="w-2 h-2 rounded mr-1"
                  style={{ backgroundColor: getVlanColor(parseInt(vlanId)) }}
                />
                VLAN {vlanId}
              </div>
              <span>{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TrafficFlowAnimator;