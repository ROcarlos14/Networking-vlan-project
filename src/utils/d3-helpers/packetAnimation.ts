import * as d3 from 'd3';
import { SimulatedPacket, PacketStatus, NetworkProtocol } from '../../types/simulation';
import { NetworkDevice, Connection } from '../../types';

interface PacketVisualization {
  id: string;
  packet: SimulatedPacket;
  element: d3.Selection<SVGCircleElement, unknown, null, undefined>;
  currentPath?: { x: number; y: number }[];
  currentSegment: number;
  progress: number;
}

/**
 * Packet animation system for visualizing packet flow in network topology
 */
export class PacketAnimationSystem {
  private svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private animationGroup: d3.Selection<SVGGElement, unknown, null, undefined>;
  private activeAnimations: Map<string, PacketVisualization> = new Map();
  private devices: NetworkDevice[] = [];
  private connections: Connection[] = [];
  private devicePositions: Map<string, { x: number; y: number }> = new Map();
  private animationSpeed: number = 1.0;
  private isRunning: boolean = false;

  constructor(svg: d3.Selection<SVGSVGElement, unknown, null, undefined>) {
    this.svg = svg;
    this.animationGroup = this.svg.select('.packet-animation-group');
    
    // Create animation group if it doesn't exist
    if (this.animationGroup.empty()) {
      this.animationGroup = this.svg.append('g').attr('class', 'packet-animation-group');
    }
  }

  /**
   * Update network topology data
   */
  updateTopology(devices: NetworkDevice[], connections: Connection[]): void {
    this.devices = devices;
    this.connections = connections;
    
    // Update device positions
    this.devicePositions.clear();
    devices.forEach(device => {
      this.devicePositions.set(device.id, { x: device.position.x, y: device.position.y });
    });
  }

  /**
   * Start packet animations
   */
  startAnimations(): void {
    this.isRunning = true;
    this.animatePackets();
  }

  /**
   * Stop packet animations
   */
  stopAnimations(): void {
    this.isRunning = false;
  }

  /**
   * Set animation speed multiplier
   */
  setSpeed(speed: number): void {
    this.animationSpeed = Math.max(0.1, Math.min(5.0, speed));
  }

  /**
   * Add packets to animation
   */
  animatePackets(packets: SimulatedPacket[] = []): void {
    // Add new packets
    packets.forEach(packet => {
      if (!this.activeAnimations.has(packet.id) && packet.status === PacketStatus.IN_TRANSIT) {
        this.createPacketAnimation(packet);
      }
    });

    // Update existing animations
    this.activeAnimations.forEach((animation, packetId) => {
      this.updatePacketAnimation(animation);
      
      // Remove completed animations
      if (animation.packet.status === PacketStatus.DELIVERED || 
          animation.packet.status === PacketStatus.DROPPED) {
        this.removePacketAnimation(packetId);
      }
    });

    // Continue animation loop
    if (this.isRunning) {
      requestAnimationFrame(() => this.animatePackets());
    }
  }

  /**
   * Create visual representation for a packet
   */
  private createPacketAnimation(packet: SimulatedPacket): void {
    const path = this.calculateAnimationPath(packet);
    if (!path || path.length < 2) {
      return;
    }

    // Create packet circle element
    const packetElement = this.animationGroup
      .append('circle')
      .attr('class', 'animated-packet')
      .attr('r', this.getPacketRadius(packet))
      .attr('fill', this.getPacketColor(packet))
      .attr('stroke', this.getPacketStrokeColor(packet))
      .attr('stroke-width', 2)
      .attr('cx', path[0].x)
      .attr('cy', path[0].y)
      .style('opacity', 0.8);

    // Add packet trail effect
    const trailGroup = this.animationGroup
      .append('g')
      .attr('class', 'packet-trail');

    // Create animation visualization object
    const visualization: PacketVisualization = {
      id: packet.id,
      packet,
      element: packetElement,
      currentPath: path,
      currentSegment: 0,
      progress: 0,
    };

    this.activeAnimations.set(packet.id, visualization);

    // Add packet info tooltip
    this.addPacketTooltip(packetElement, packet);
  }

  /**
   * Update packet animation position
   */
  private updatePacketAnimation(animation: PacketVisualization): void {
    if (!animation.currentPath || animation.currentPath.length < 2) {
      return;
    }

    const { currentSegment, progress, currentPath } = animation;
    const speed = this.animationSpeed * this.getPacketSpeed(animation.packet);

    // Calculate new progress
    let newProgress = progress + speed;
    let newSegment = currentSegment;

    // Move to next segment if needed
    while (newProgress >= 1.0 && newSegment < currentPath.length - 2) {
      newProgress -= 1.0;
      newSegment++;
    }

    // Ensure we don't exceed the path
    if (newSegment >= currentPath.length - 1) {
      newSegment = currentPath.length - 2;
      newProgress = 1.0;
    }

    // Update animation state
    animation.currentSegment = newSegment;
    animation.progress = newProgress;

    // Calculate interpolated position
    const start = currentPath[newSegment];
    const end = currentPath[newSegment + 1];
    const x = start.x + (end.x - start.x) * newProgress;
    const y = start.y + (end.y - start.y) * newProgress;

    // Update packet position
    animation.element
      .attr('cx', x)
      .attr('cy', y);

    // Add pulse effect for active packets
    if (animation.packet.status === PacketStatus.IN_TRANSIT) {
      animation.element
        .transition()
        .duration(500)
        .attr('r', this.getPacketRadius(animation.packet) * 1.2)
        .transition()
        .duration(500)
        .attr('r', this.getPacketRadius(animation.packet));
    }

    // Check if packet reached destination
    if (newSegment >= currentPath.length - 2 && newProgress >= 1.0) {
      this.handlePacketArrival(animation);
    }
  }

  /**
   * Remove packet animation
   */
  private removePacketAnimation(packetId: string): void {
    const animation = this.activeAnimations.get(packetId);
    if (!animation) return;

    // Create completion effect
    if (animation.packet.status === PacketStatus.DELIVERED) {
      this.createDeliveryEffect(animation);
    } else if (animation.packet.status === PacketStatus.DROPPED) {
      this.createDropEffect(animation);
    }

    // Remove packet element after effect
    setTimeout(() => {
      animation.element.remove();
    }, 500);

    // Remove trail elements
    this.animationGroup.selectAll(`.packet-trail-${packetId}`).remove();

    this.activeAnimations.delete(packetId);
  }

  /**
   * Calculate animation path for packet
   */
  private calculateAnimationPath(packet: SimulatedPacket): { x: number; y: number }[] | null {
    if (!packet.path || packet.path.length < 2) {
      return null;
    }

    const path: { x: number; y: number }[] = [];

    for (let i = 0; i < packet.path.length; i++) {
      const deviceId = packet.path[i];
      const position = this.devicePositions.get(deviceId);
      
      if (position) {
        path.push({ x: position.x, y: position.y });
      }
    }

    // Smooth the path for better animation
    return this.smoothPath(path);
  }

  /**
   * Smooth animation path using curves
   */
  private smoothPath(path: { x: number; y: number }[]): { x: number; y: number }[] {
    if (path.length <= 2) {
      return path;
    }

    const smoothedPath: { x: number; y: number }[] = [path[0]];

    for (let i = 1; i < path.length - 1; i++) {
      const prev = path[i - 1];
      const curr = path[i];
      const next = path[i + 1];

      // Add intermediate points for smoother animation
      const midPoint1 = {
        x: prev.x + (curr.x - prev.x) * 0.8,
        y: prev.y + (curr.y - prev.y) * 0.8,
      };
      
      const midPoint2 = {
        x: curr.x + (next.x - curr.x) * 0.2,
        y: curr.y + (next.y - curr.y) * 0.2,
      };

      smoothedPath.push(midPoint1, curr, midPoint2);
    }

    smoothedPath.push(path[path.length - 1]);
    return smoothedPath;
  }

  /**
   * Get packet visualization properties
   */
  private getPacketRadius(packet: SimulatedPacket): number {
    // Base radius with size variation
    const baseRadius = 4;
    const sizeMultiplier = Math.log(packet.size + 1) / 10;
    return baseRadius + sizeMultiplier;
  }

  private getPacketColor(packet: SimulatedPacket): string {
    // Color by protocol
    switch (packet.protocol) {
      case NetworkProtocol.ICMP: return '#10b981'; // Green
      case NetworkProtocol.TCP: return '#3b82f6';  // Blue
      case NetworkProtocol.UDP: return '#8b5cf6';  // Purple
      case NetworkProtocol.ARP: return '#f59e0b';  // Amber
      case NetworkProtocol.DHCP: return '#ef4444'; // Red
      default: return '#6b7280'; // Gray
    }
  }

  private getPacketStrokeColor(packet: SimulatedPacket): string {
    // Highlight VLAN packets
    if (packet.vlanTag) {
      return '#fbbf24'; // Yellow stroke for VLAN packets
    }
    return this.getPacketColor(packet);
  }

  private getPacketSpeed(packet: SimulatedPacket): number {
    // Speed variation by protocol
    const baseSpeed = 0.02;
    switch (packet.protocol) {
      case NetworkProtocol.ICMP: return baseSpeed * 1.5; // Faster for ping
      case NetworkProtocol.ARP: return baseSpeed * 2.0;  // Fastest for ARP
      case NetworkProtocol.TCP: return baseSpeed;        // Normal speed
      case NetworkProtocol.UDP: return baseSpeed * 1.2;  // Slightly faster
      default: return baseSpeed;
    }
  }

  /**
   * Add tooltip to packet
   */
  private addPacketTooltip(element: d3.Selection<SVGCircleElement, unknown, null, undefined>, packet: SimulatedPacket): void {
    const sourceDevice = this.devices.find(d => d.id === packet.sourceDevice);
    const targetDevice = this.devices.find(d => d.id === packet.targetDevice);

    element
      .append('title')
      .text(`
        Protocol: ${packet.protocol}
        From: ${sourceDevice?.name || 'Unknown'}
        To: ${targetDevice?.name || 'Unknown'}
        Size: ${packet.size} bytes
        ${packet.vlanTag ? `VLAN: ${packet.vlanTag}` : ''}
        Status: ${packet.status}
      `.trim());
  }

  /**
   * Handle packet arrival at destination
   */
  private handlePacketArrival(animation: PacketVisualization): void {
    // Update packet status would be handled by simulation engine
    // This is just for visualization completion
  }

  /**
   * Create delivery effect
   */
  private createDeliveryEffect(animation: PacketVisualization): void {
    const currentPos = {
      x: parseFloat(animation.element.attr('cx')),
      y: parseFloat(animation.element.attr('cy')),
    };

    // Create expanding green circle
    this.animationGroup
      .append('circle')
      .attr('cx', currentPos.x)
      .attr('cy', currentPos.y)
      .attr('r', 0)
      .attr('fill', 'none')
      .attr('stroke', '#10b981')
      .attr('stroke-width', 2)
      .style('opacity', 1)
      .transition()
      .duration(500)
      .attr('r', 20)
      .style('opacity', 0)
      .remove();

    // Success checkmark
    this.animationGroup
      .append('text')
      .attr('x', currentPos.x)
      .attr('y', currentPos.y + 5)
      .attr('text-anchor', 'middle')
      .attr('font-size', '14px')
      .attr('fill', '#10b981')
      .text('✓')
      .style('opacity', 1)
      .transition()
      .duration(1000)
      .style('opacity', 0)
      .remove();
  }

  /**
   * Create drop effect
   */
  private createDropEffect(animation: PacketVisualization): void {
    const currentPos = {
      x: parseFloat(animation.element.attr('cx')),
      y: parseFloat(animation.element.attr('cy')),
    };

    // Create red X effect
    this.animationGroup
      .append('circle')
      .attr('cx', currentPos.x)
      .attr('cy', currentPos.y)
      .attr('r', 0)
      .attr('fill', 'none')
      .attr('stroke', '#ef4444')
      .attr('stroke-width', 2)
      .style('opacity', 1)
      .transition()
      .duration(300)
      .attr('r', 15)
      .style('opacity', 0)
      .remove();

    // Drop X mark
    this.animationGroup
      .append('text')
      .attr('x', currentPos.x)
      .attr('y', currentPos.y + 5)
      .attr('text-anchor', 'middle')
      .attr('font-size', '14px')
      .attr('fill', '#ef4444')
      .text('✗')
      .style('opacity', 1)
      .transition()
      .duration(1000)
      .style('opacity', 0)
      .remove();
  }

  /**
   * Clear all animations
   */
  clearAnimations(): void {
    this.activeAnimations.clear();
    this.animationGroup.selectAll('.animated-packet').remove();
    this.animationGroup.selectAll('.packet-trail').remove();
  }

  /**
   * Get current animation count
   */
  getActiveAnimationCount(): number {
    return this.activeAnimations.size;
  }

  /**
   * Check if animations are running
   */
  get animationsRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Update packets for animation
   */
  updatePackets(packets: SimulatedPacket[]): void {
    // Remove animations for packets that no longer exist
    const existingPacketIds = new Set(packets.map(p => p.id));
    const toRemove: string[] = [];
    
    this.activeAnimations.forEach((animation, packetId) => {
      if (!existingPacketIds.has(packetId)) {
        toRemove.push(packetId);
      }
    });
    
    toRemove.forEach(packetId => this.removePacketAnimation(packetId));

    // Add animations for new packets
    packets.forEach(packet => {
      if (packet.status === PacketStatus.IN_TRANSIT && !this.activeAnimations.has(packet.id)) {
        this.createPacketAnimation(packet);
      }
    });
  }
}

/**
 * Create packet animation system for a canvas
 */
export const createPacketAnimationSystem = (svg: d3.Selection<SVGSVGElement, unknown, null, undefined>): PacketAnimationSystem => {
  return new PacketAnimationSystem(svg);
};