import * as d3 from 'd3';
import { NetworkDevice, Connection } from '../../types';
import { SimulatedPacket, PacketStatus, NetworkProtocol } from '../../types/simulation';

/**
 * Animation state for a packet
 */
interface PacketAnimationState {
  packet: SimulatedPacket;
  currentProgress: number; // 0-1 along current link
  currentLinkIndex: number;
  animationStartTime: number;
  element?: d3.Selection<SVGCircleElement, unknown, null, undefined>;
  trailElements?: d3.Selection<SVGCircleElement, unknown, null, undefined>[];
}

/**
 * Visual style configuration for packets
 */
interface PacketVisualStyle {
  color: string;
  size: number;
  opacity: number;
  strokeColor: string;
  strokeWidth: number;
  pulseAnimation: boolean;
}

/**
 * Advanced packet animation manager
 */
export class PacketAnimationManager {
  private svg: d3.Selection<SVGGElement, unknown, null, undefined>;
  private animationLayer!: d3.Selection<SVGGElement, unknown, null, undefined>;
  private devices: NetworkDevice[] = [];
  private connections: Connection[] = [];
  private devicePositions: Map<string, { x: number; y: number }> = new Map();
  private animatedPackets: Map<string, PacketAnimationState> = new Map();
  private isAnimating: boolean = false;
  private animationSpeed: number = 1.0;
  private showPacketTrails: boolean = true;
  private maxTrailLength: number = 5;

  constructor(svgElement: d3.Selection<SVGGElement, unknown, null, undefined>) {
    this.svg = svgElement;
    this.setupAnimationLayer();
  }

  /**
   * Initialize animation layer
   */
  private setupAnimationLayer(): void {
    // Remove existing animation layer
    this.svg.selectAll('.packet-animation-layer').remove();

    // Create new animation layer
    this.animationLayer = this.svg
      .append('g')
      .attr('class', 'packet-animation-layer')
      .style('pointer-events', 'none'); // Don't interfere with canvas interactions

    // Add trail layer (behind packets)
    this.animationLayer.append('g').attr('class', 'packet-trails');
    
    // Add packet layer (in front of trails)
    this.animationLayer.append('g').attr('class', 'packets');
  }

  /**
   * Update network topology for animation
   */
  updateTopology(devices: NetworkDevice[], connections: Connection[]): void {
    this.devices = devices;
    this.connections = connections;
    this.updateDevicePositions();
  }

  /**
   * Update device positions from DOM elements
   */
  private updateDevicePositions(): void {
    this.devicePositions.clear();
    this.devices.forEach(device => {
      // Get device position from D3 rendered elements
      const deviceElement = this.svg.select(`[data-device-id="${device.id}"]`);
      if (!deviceElement.empty()) {
        const transform = deviceElement.attr('transform');
        if (transform) {
          const match = transform.match(/translate\(([^,]+),([^)]+)\)/);
          if (match) {
            const x = parseFloat(match[1]);
            const y = parseFloat(match[2]);
            this.devicePositions.set(device.id, { x, y });
          }
        }
      }
    });
  }

  /**
   * Start animating a packet
   */
  animatePacket(packet: SimulatedPacket): void {
    if (packet.path.length < 2) return; // Need at least source and one hop

    const animationState: PacketAnimationState = {
      packet: packet,
      currentProgress: 0,
      currentLinkIndex: 0,
      animationStartTime: Date.now(),
      trailElements: []
    };

    // Create visual element for packet
    const style = this.getPacketVisualStyle(packet);
    const startPos = this.devicePositions.get(packet.path[0]);
    
    if (startPos) {
      animationState.element = this.animationLayer
        .select('.packets')
        .append('circle')
        .attr('class', 'animated-packet')
        .attr('data-packet-id', packet.id)
        .attr('cx', startPos.x)
        .attr('cy', startPos.y)
        .attr('r', style.size)
        .attr('fill', style.color)
        .attr('stroke', style.strokeColor)
        .attr('stroke-width', style.strokeWidth)
        .attr('opacity', style.opacity);

      // Add pulsing animation for high-priority packets
      if (style.pulseAnimation) {
        animationState.element
          .transition()
          .duration(500)
          .ease(d3.easeSinInOut)
          .attr('r', style.size * 1.5)
          .transition()
          .duration(500)
          .ease(d3.easeSinInOut)
          .attr('r', style.size)
          .on('end', function repeat() {
            d3.select(this)
              .transition()
              .duration(500)
              .ease(d3.easeSinInOut)
              .attr('r', style.size * 1.5)
              .transition()
              .duration(500)
              .ease(d3.easeSinInOut)
              .attr('r', style.size)
              .on('end', repeat);
          });
      }

      // Add packet label
      this.animationLayer
        .select('.packets')
        .append('text')
        .attr('class', 'packet-label')
        .attr('data-packet-id', packet.id)
        .attr('x', startPos.x)
        .attr('y', startPos.y - style.size - 5)
        .attr('text-anchor', 'middle')
        .attr('font-size', '8px')
        .attr('fill', style.color)
        .attr('opacity', 0.8)
        .text(this.getPacketLabel(packet));
    }

    this.animatedPackets.set(packet.id, animationState);

    if (!this.isAnimating) {
      this.startAnimationLoop();
    }
  }

  /**
   * Update packet animation based on simulation state
   */
  updatePacketAnimation(packet: SimulatedPacket): void {
    const animationState = this.animatedPackets.get(packet.id);
    if (!animationState) return;

    switch (packet.status) {
      case PacketStatus.DELIVERED:
        this.completePacketAnimation(packet.id, 'delivered');
        break;
      case PacketStatus.DROPPED:
        this.completePacketAnimation(packet.id, 'dropped');
        break;
      case PacketStatus.IN_TRANSIT:
        this.updatePacketPosition(animationState, packet);
        break;
    }
  }

  /**
   * Update packet position along its path
   */
  private updatePacketPosition(animationState: PacketAnimationState, packet: SimulatedPacket): void {
    const currentDeviceId = packet.currentPosition.deviceId;
    const currentIndex = packet.path.indexOf(currentDeviceId);
    
    if (currentIndex !== animationState.currentLinkIndex) {
      // Packet moved to next device
      animationState.currentLinkIndex = currentIndex;
      animationState.currentProgress = 0;
      
      // Add trail element at previous position
      if (this.showPacketTrails && animationState.element) {
        this.addTrailElement(animationState);
      }
    }

    // Update visual position
    this.interpolatePacketPosition(animationState);
  }

  /**
   * Interpolate packet position between devices
   */
  private interpolatePacketPosition(animationState: PacketAnimationState): void {
    const { packet, currentLinkIndex, element } = animationState;
    
    if (!element || currentLinkIndex >= packet.path.length - 1) return;

    const currentDeviceId = packet.path[currentLinkIndex];
    const nextDeviceId = packet.path[currentLinkIndex + 1];
    
    const currentPos = this.devicePositions.get(currentDeviceId);
    const nextPos = this.devicePositions.get(nextDeviceId);
    
    if (currentPos && nextPos) {
      // Calculate animation progress based on time
      const elapsed = Date.now() - animationState.animationStartTime;
      const linkDuration = this.calculateLinkAnimationDuration(currentDeviceId, nextDeviceId);
      const progress = Math.min(elapsed / linkDuration, 1);
      
      // Smooth interpolation between positions
      const x = currentPos.x + (nextPos.x - currentPos.x) * progress;
      const y = currentPos.y + (nextPos.y - currentPos.y) * progress;
      
      element
        .transition()
        .duration(50)
        .ease(d3.easeLinear)
        .attr('cx', x)
        .attr('cy', y);

      // Update label position
      this.animationLayer
        .select(`[data-packet-id="${packet.id}"].packet-label`)
        .transition()
        .duration(50)
        .ease(d3.easeLinear)
        .attr('x', x)
        .attr('y', y - 10);

      animationState.currentProgress = progress;
    }
  }

  /**
   * Add trail element for packet history
   */
  private addTrailElement(animationState: PacketAnimationState): void {
    if (!animationState.element || !this.showPacketTrails) return;

    const currentX = parseFloat(animationState.element.attr('cx'));
    const currentY = parseFloat(animationState.element.attr('cy'));
    const style = this.getPacketVisualStyle(animationState.packet);

    const trailElement = this.animationLayer
      .select('.packet-trails')
      .append('circle')
      .attr('class', 'packet-trail')
      .attr('cx', currentX)
      .attr('cy', currentY)
      .attr('r', style.size * 0.6)
      .attr('fill', style.color)
      .attr('opacity', 0.4)
      .transition()
      .duration(2000)
      .attr('opacity', 0)
      .attr('r', style.size * 0.2)
      .remove();

    animationState.trailElements = animationState.trailElements || [];
    animationState.trailElements.push(trailElement as any);

    // Limit trail length
    if (animationState.trailElements.length > this.maxTrailLength) {
      const oldTrail = animationState.trailElements.shift();
      if (oldTrail) {
        oldTrail.remove();
      }
    }
  }

  /**
   * Complete packet animation
   */
  private completePacketAnimation(packetId: string, result: 'delivered' | 'dropped'): void {
    const animationState = this.animatedPackets.get(packetId);
    if (!animationState || !animationState.element) return;

    const style = this.getPacketVisualStyle(animationState.packet);
    const finalColor = result === 'delivered' ? '#10B981' : '#EF4444'; // Green or Red

    // Final animation
    animationState.element
      .transition()
      .duration(500)
      .attr('fill', finalColor)
      .attr('r', style.size * (result === 'delivered' ? 1.5 : 0.5))
      .attr('opacity', result === 'delivered' ? 1 : 0.3)
      .transition()
      .duration(1000)
      .attr('opacity', 0)
      .remove();

    // Remove label
    this.animationLayer
      .select(`[data-packet-id="${packetId}"].packet-label`)
      .transition()
      .duration(1000)
      .attr('opacity', 0)
      .remove();

    // Clean up trail elements
    if (animationState.trailElements) {
      animationState.trailElements.forEach(trail => {
        if (trail) trail.transition().duration(500).attr('opacity', 0).remove();
      });
    }

    this.animatedPackets.delete(packetId);
  }

  /**
   * Get visual style for packet based on protocol and VLAN
   */
  private getPacketVisualStyle(packet: SimulatedPacket): PacketVisualStyle {
    let color = '#60A5FA'; // Default blue
    let size = 6;
    let pulseAnimation = false;

    // Color by protocol
    switch (packet.protocol) {
      case NetworkProtocol.ICMP:
        color = '#10B981'; // Green
        break;
      case NetworkProtocol.TCP:
        color = '#3B82F6'; // Blue
        size = 8;
        break;
      case NetworkProtocol.UDP:
        color = '#8B5CF6'; // Purple
        break;
      case NetworkProtocol.ARP:
        color = '#F59E0B'; // Yellow
        pulseAnimation = true;
        break;
    }

    // Modify color based on VLAN
    if (packet.vlanTag) {
      // You could get VLAN color from VLAN configuration
      const vlanHue = (packet.vlanTag * 137.5) % 360; // Golden angle distribution
      color = `hsl(${vlanHue}, 70%, 60%)`;
    }

    return {
      color,
      size,
      opacity: 0.9,
      strokeColor: '#FFFFFF',
      strokeWidth: 1,
      pulseAnimation
    };
  }

  /**
   * Get packet label text
   */
  private getPacketLabel(packet: SimulatedPacket): string {
    const protocol = packet.protocol.toUpperCase();
    const vlan = packet.vlanTag ? ` V${packet.vlanTag}` : '';
    return `${protocol}${vlan}`;
  }

  /**
   * Calculate animation duration for link based on properties
   */
  private calculateLinkAnimationDuration(device1Id: string, device2Id: string): number {
    const connection = this.connections.find(conn =>
      (conn.sourceDevice === device1Id && conn.targetDevice === device2Id) ||
      (conn.sourceDevice === device2Id && conn.targetDevice === device1Id)
    );

    // Base duration adjusted by speed and connection properties
    let baseDuration = 2000; // 2 seconds
    
    if (connection) {
      // Faster animation for higher bandwidth connections
      const speed = (connection as any).bandwidth || 100; // Default 100 Mbps
      baseDuration = Math.max(500, 3000 - (speed / 10)); // Faster links = faster animation
    }

    return baseDuration / this.animationSpeed;
  }

  /**
   * Start animation loop
   */
  private startAnimationLoop(): void {
    if (this.isAnimating) return;
    
    this.isAnimating = true;
    
    const animate = () => {
      if (this.animatedPackets.size > 0) {
        // Update device positions in case they moved
        this.updateDevicePositions();
        
        // Continue animation loop
        requestAnimationFrame(animate);
      } else {
        this.isAnimating = false;
      }
    };
    
    animate();
  }

  /**
   * Set animation speed
   */
  setAnimationSpeed(speed: number): void {
    this.animationSpeed = Math.max(0.1, Math.min(5.0, speed));
  }

  /**
   * Toggle packet trails
   */
  setPacketTrails(enabled: boolean): void {
    this.showPacketTrails = enabled;
  }

  /**
   * Clear all animations
   */
  clearAnimations(): void {
    this.animatedPackets.forEach((state, packetId) => {
      this.completePacketAnimation(packetId, 'dropped');
    });
    this.animatedPackets.clear();
    this.isAnimating = false;
  }

  /**
   * Get animation statistics
   */
  getAnimationStats(): {
    activeAnimations: number;
    totalAnimated: number;
  } {
    return {
      activeAnimations: this.animatedPackets.size,
      totalAnimated: this.animatedPackets.size
    };
  }
}