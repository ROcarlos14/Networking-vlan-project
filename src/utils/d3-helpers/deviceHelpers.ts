import * as d3 from 'd3';
import { NetworkDevice, DeviceType, DeviceStatus } from '../../types';

/**
 * Device visual configuration
 */
export interface DeviceVisualConfig {
  width: number;
  height: number;
  iconSize: number;
  cornerRadius: number;
  strokeWidth: number;
  labelOffset: number;
  statusIndicatorSize: number;
}

/**
 * Default device visual configuration
 */
export const defaultDeviceConfig: DeviceVisualConfig = {
  width: 60,
  height: 60,
  iconSize: 32,
  cornerRadius: 8,
  strokeWidth: 2,
  labelOffset: 75,
  statusIndicatorSize: 12,
};

/**
 * Get device color based on type and status
 */
export const getDeviceColor = (device: NetworkDevice): {
  fill: string;
  stroke: string;
  statusColor: string;
} => {
  let fill: string;
  let stroke: string;
  
  // Base colors by device type
  switch (device.type) {
    case DeviceType.SWITCH:
      fill = '#4B5563'; // gray-600
      stroke = '#374151'; // gray-700
      break;
    case DeviceType.ROUTER:
      fill = '#DC2626'; // red-600
      stroke = '#B91C1C'; // red-700
      break;
    case DeviceType.PC:
      fill = '#2563EB'; // blue-600
      stroke = '#1D4ED8'; // blue-700
      break;
    case DeviceType.SERVER:
      fill = '#059669'; // emerald-600
      stroke = '#047857'; // emerald-700
      break;
    default:
      fill = '#6B7280'; // gray-500
      stroke = '#4B5563'; // gray-600
  }

  // Status indicator color
  let statusColor: string;
  switch (device.status) {
    case DeviceStatus.ACTIVE:
      statusColor = '#10B981'; // emerald-500
      break;
    case DeviceStatus.ERROR:
      statusColor = '#EF4444'; // red-500
      break;
    case DeviceStatus.INACTIVE:
    default:
      statusColor = '#6B7280'; // gray-500
  }

  return { fill, stroke, statusColor };
};

/**
 * Get device icon (Unicode emoji for now, can be replaced with SVG icons later)
 */
export const getDeviceIcon = (deviceType: DeviceType): string => {
  switch (deviceType) {
    case DeviceType.SWITCH:
      return '🔀';
    case DeviceType.ROUTER:
      return '📶';
    case DeviceType.PC:
      return '💻';
    case DeviceType.SERVER:
      return '🖥️';
    default:
      return '❓';
  }
};

/**
 * Create or update device nodes
 */
export const renderDeviceNodes = (
  container: d3.Selection<SVGGElement, unknown, null, undefined>,
  devices: NetworkDevice[],
  config: DeviceVisualConfig = defaultDeviceConfig,
  onDeviceClick?: (device: NetworkDevice, event: MouseEvent) => void,
  onDeviceDragStart?: (device: NetworkDevice) => void,
  onDeviceDrag?: (device: NetworkDevice, x: number, y: number) => void,
  onDeviceDragEnd?: (device: NetworkDevice) => void
): d3.Selection<SVGGElement, NetworkDevice, SVGGElement, unknown> => {
  // Bind data to device groups
  const deviceGroups = container
    .selectAll<SVGGElement, NetworkDevice>('.device-node')
    .data(devices, (d: NetworkDevice) => d.id);

  // Remove old devices
  deviceGroups.exit().remove();

  // Create new device groups
  const newDeviceGroups = deviceGroups
    .enter()
    .append('g')
    .attr('class', 'device-node')
    .style('cursor', 'pointer');

  // Add device rectangle/shape
  newDeviceGroups
    .append('rect')
    .attr('class', 'device-body')
    .attr('width', config.width)
    .attr('height', config.height)
    .attr('x', -config.width / 2)
    .attr('y', -config.height / 2)
    .attr('rx', config.cornerRadius)
    .attr('ry', config.cornerRadius)
    .attr('stroke-width', config.strokeWidth);

  // Add device icon (text for now)
  newDeviceGroups
    .append('text')
    .attr('class', 'device-icon')
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'central')
    .attr('font-size', `${config.iconSize}px`)
    .style('pointer-events', 'none')
    .style('user-select', 'none');

  // Add device label
  newDeviceGroups
    .append('text')
    .attr('class', 'device-label')
    .attr('text-anchor', 'middle')
    .attr('y', config.labelOffset)
    .attr('font-size', '12px')
    .attr('font-weight', 'bold')
    .attr('fill', 'white')
    .style('pointer-events', 'none')
    .style('user-select', 'none');

  // Add status indicator
  newDeviceGroups
    .append('circle')
    .attr('class', 'device-status')
    .attr('cx', config.width / 2 - 8)
    .attr('cy', -config.height / 2 + 8)
    .attr('r', config.statusIndicatorSize / 2)
    .attr('stroke', '#1F2937')
    .attr('stroke-width', 2);

  // Merge new and existing groups
  const allDeviceGroups = newDeviceGroups.merge(deviceGroups);

  // Update positions
  allDeviceGroups
    .attr('transform', (d: NetworkDevice) => `translate(${d.position.x}, ${d.position.y})`);

  // Update device body colors
  allDeviceGroups
    .select('.device-body')
    .attr('fill', (d: NetworkDevice) => getDeviceColor(d).fill)
    .attr('stroke', (d: NetworkDevice) => getDeviceColor(d).stroke);

  // Update device icons
  allDeviceGroups
    .select('.device-icon')
    .text((d: NetworkDevice) => getDeviceIcon(d.type));

  // Update device labels
  allDeviceGroups
    .select('.device-label')
    .text((d: NetworkDevice) => d.name);

  // Update status indicators
  allDeviceGroups
    .select('.device-status')
    .attr('fill', (d: NetworkDevice) => getDeviceColor(d).statusColor);

  // Add click handlers
  if (onDeviceClick) {
    allDeviceGroups.on('click', function(event: MouseEvent, d: NetworkDevice) {
      event.stopPropagation();
      onDeviceClick(d, event);
    });
  }

  // Add drag behavior if handlers are provided
  if (onDeviceDragStart || onDeviceDrag || onDeviceDragEnd) {
    const drag = d3.drag<SVGGElement, NetworkDevice>()
      .on('start', function(event, d) {
        if (onDeviceDragStart) {
          onDeviceDragStart(d);
        }
        d3.select(this).raise();
        event.sourceEvent.stopPropagation();
      })
      .on('drag', function(event, d) {
        if (onDeviceDrag) {
          onDeviceDrag(d, event.x, event.y);
        }
        d3.select(this).attr('transform', `translate(${event.x}, ${event.y})`);
      })
      .on('end', function(event, d) {
        if (onDeviceDragEnd) {
          onDeviceDragEnd(d);
        }
      });

    allDeviceGroups.call(drag);
  }

  return allDeviceGroups;
};

/**
 * Highlight device (for selection or hover)
 */
export const highlightDevice = (
  deviceGroup: d3.Selection<SVGGElement, NetworkDevice, SVGGElement, unknown>,
  deviceId: string,
  highlighted: boolean
): void => {
  const device = deviceGroup.filter(d => d.id === deviceId);
  
  device
    .select('.device-body')
    .attr('stroke-width', highlighted ? 4 : 2)
    .attr('stroke', highlighted ? '#60A5FA' : function(d) {
      return getDeviceColor(d as NetworkDevice).stroke;
    });
};

/**
 * Get device bounds for layout calculations
 */
export const getDeviceBounds = (
  devices: NetworkDevice[],
  config: DeviceVisualConfig = defaultDeviceConfig
): { minX: number; minY: number; maxX: number; maxY: number } => {
  if (devices.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  const positions = devices.map(d => d.position);
  const minX = Math.min(...positions.map(p => p.x)) - config.width / 2;
  const maxX = Math.max(...positions.map(p => p.x)) + config.width / 2;
  const minY = Math.min(...positions.map(p => p.y)) - config.height / 2;
  const maxY = Math.max(...positions.map(p => p.y)) + config.height / 2;

  return { minX, minY, maxX, maxY };
};

/**
 * Auto-layout devices using force simulation
 */
export const autoLayoutDevices = (
  devices: NetworkDevice[],
  connections: Array<{ sourceDevice: string; targetDevice: string }>,
  width: number,
  height: number
): Promise<NetworkDevice[]> => {
  return new Promise((resolve) => {
    if (devices.length === 0) {
      resolve(devices);
      return;
    }

    // Create nodes with current positions as starting point
    const nodes = devices.map(device => ({
      id: device.id,
      x: device.position.x,
      y: device.position.y,
      device,
    }));

    // Create links
    const links = connections.map(conn => ({
      source: conn.sourceDevice,
      target: conn.targetDevice,
    }));

    // Create force simulation
    const simulation = d3
      .forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(50));

    // Run simulation
    simulation.on('end', () => {
      const updatedDevices = devices.map(device => {
        const node = nodes.find(n => n.id === device.id);
        return {
          ...device,
          position: {
            x: node?.x || device.position.x,
            y: node?.y || device.position.y,
          },
        };
      });
      resolve(updatedDevices);
    });
  });
};