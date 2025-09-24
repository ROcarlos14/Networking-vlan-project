import * as d3 from 'd3';
import { Connection, NetworkDevice, ConnectionType, ConnectionStatus, InterfaceType } from '../../types';

/**
 * Connection visual configuration
 */
export interface ConnectionVisualConfig {
  strokeWidth: number;
  trunkStrokeWidth: number;
  accessStrokeWidth: number;
  selectedStrokeWidth: number;
  dashArray: {
    trunk: string;
    access: string;
  };
  colors: {
    up: string;
    down: string;
    degraded: string;
    selected: string;
  };
  labelOffset: number;
  labelFontSize: number;
}

/**
 * Default connection visual configuration
 */
export const defaultConnectionConfig: ConnectionVisualConfig = {
  strokeWidth: 2,
  trunkStrokeWidth: 4,
  accessStrokeWidth: 2,
  selectedStrokeWidth: 4,
  dashArray: {
    trunk: '10,5',
    access: 'none',
  },
  colors: {
    up: '#60A5FA',       // blue-400
    down: '#6B7280',     // gray-500
    degraded: '#F59E0B', // amber-500
    selected: '#10B981', // emerald-500
  },
  labelOffset: 10,
  labelFontSize: 10,
};

/**
 * Get connection color based on status
 */
export const getConnectionColor = (
  connection: Connection,
  config: ConnectionVisualConfig = defaultConnectionConfig
): string => {
  switch (connection.status) {
    case ConnectionStatus.UP:
      return config.colors.up;
    case ConnectionStatus.DOWN:
      return config.colors.down;
    case ConnectionStatus.DEGRADED:
      return config.colors.degraded;
    default:
      return config.colors.down;
  }
};

/**
 * Get connection stroke properties
 */
export const getConnectionStrokeProperties = (
  connection: Connection,
  isSelected: boolean = false,
  config: ConnectionVisualConfig = defaultConnectionConfig
): {
  strokeWidth: number;
  strokeDasharray: string;
  stroke: string;
} => {
  let strokeWidth = config.strokeWidth;
  let strokeDasharray = config.dashArray.access;

  // Determine stroke width based on connection type
  if (connection.connectionType === ConnectionType.ETHERNET) {
    // Check if this is a trunk connection by looking at connection name or bandwidth
    const isTrunk = connection.name?.toLowerCase().includes('trunk') || 
                   connection.bandwidth >= 1000;
    
    if (isTrunk) {
      strokeWidth = config.trunkStrokeWidth;
      strokeDasharray = config.dashArray.trunk;
    } else {
      strokeWidth = config.accessStrokeWidth;
      strokeDasharray = config.dashArray.access;
    }
  }

  if (isSelected) {
    strokeWidth = config.selectedStrokeWidth;
  }

  const stroke = isSelected ? config.colors.selected : getConnectionColor(connection, config);

  return {
    strokeWidth,
    strokeDasharray,
    stroke,
  };
};

/**
 * Calculate connection path between devices
 */
export const calculateConnectionPath = (
  sourceDevice: NetworkDevice,
  targetDevice: NetworkDevice,
  offset: number = 0
): string => {
  const sourceX = sourceDevice.position.x;
  const sourceY = sourceDevice.position.y;
  const targetX = targetDevice.position.x;
  const targetY = targetDevice.position.y;

  // Simple straight line for now
  if (offset === 0) {
    return `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
  }

  // Add curve for multiple connections between same devices
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;
  
  // Calculate perpendicular offset
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const length = Math.sqrt(dx * dx + dy * dy);
  
  if (length === 0) return `M ${sourceX} ${sourceY} L ${targetX} ${targetY}`;
  
  const perpX = -dy / length * offset;
  const perpY = dx / length * offset;
  
  const controlX = midX + perpX;
  const controlY = midY + perpY;

  return `M ${sourceX} ${sourceY} Q ${controlX} ${controlY} ${targetX} ${targetY}`;
};

/**
 * Calculate label position for connection
 */
export const calculateLabelPosition = (
  sourceDevice: NetworkDevice,
  targetDevice: NetworkDevice,
  offset: number = 0
): { x: number; y: number } => {
  const sourceX = sourceDevice.position.x;
  const sourceY = sourceDevice.position.y;
  const targetX = targetDevice.position.x;
  const targetY = targetDevice.position.y;

  if (offset === 0) {
    return {
      x: (sourceX + targetX) / 2,
      y: (sourceY + targetY) / 2,
    };
  }

  // For curved connections, place label at the curve point
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;
  
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const length = Math.sqrt(dx * dx + dy * dy);
  
  if (length === 0) return { x: midX, y: midY };
  
  const perpX = -dy / length * offset * 0.5;
  const perpY = dx / length * offset * 0.5;

  return {
    x: midX + perpX,
    y: midY + perpY,
  };
};

/**
 * Render connection lines
 */
export const renderConnectionLines = (
  container: d3.Selection<SVGGElement, unknown, null, undefined>,
  connections: Connection[],
  devices: NetworkDevice[],
  selectedConnections: string[] = [],
  config: ConnectionVisualConfig = defaultConnectionConfig,
  onConnectionClick?: (connection: Connection, event: MouseEvent) => void
): d3.Selection<SVGPathElement, Connection, SVGGElement, unknown> => {
  // Create device lookup map
  const deviceMap = new Map(devices.map(d => [d.id, d]));

  // Filter connections to only those with valid devices
  const validConnections = connections.filter(conn => 
    deviceMap.has(conn.sourceDevice) && deviceMap.has(conn.targetDevice)
  );

  // Group connections between same devices for offset calculation
  const connectionGroups = new Map<string, Connection[]>();
  validConnections.forEach(conn => {
    const key = [conn.sourceDevice, conn.targetDevice].sort().join('-');
    if (!connectionGroups.has(key)) {
      connectionGroups.set(key, []);
    }
    connectionGroups.get(key)!.push(conn);
  });

  // Calculate offsets for multiple connections between same devices
  const connectionOffsets = new Map<string, number>();
  connectionGroups.forEach((conns, key) => {
    if (conns.length > 1) {
      conns.forEach((conn, index) => {
        const offset = (index - (conns.length - 1) / 2) * 20;
        connectionOffsets.set(conn.id, offset);
      });
    } else {
      connectionOffsets.set(conns[0].id, 0);
    }
  });

  // Bind data to connection paths
  const connectionPaths = container
    .selectAll<SVGPathElement, Connection>('.connection-line')
    .data(validConnections, (d: Connection) => d.id);

  // Remove old connections
  connectionPaths.exit().remove();

  // Create new connection paths
  const newConnectionPaths = connectionPaths
    .enter()
    .append('path')
    .attr('class', 'connection-line')
    .style('fill', 'none')
    .style('cursor', 'pointer');

  // Merge new and existing paths
  const allConnectionPaths = newConnectionPaths.merge(connectionPaths);

  // Update connection paths
  allConnectionPaths
    .attr('d', (d: Connection) => {
      const sourceDevice = deviceMap.get(d.sourceDevice);
      const targetDevice = deviceMap.get(d.targetDevice);
      if (!sourceDevice || !targetDevice) return '';
      
      const offset = connectionOffsets.get(d.id) || 0;
      return calculateConnectionPath(sourceDevice, targetDevice, offset);
    })
    .attr('stroke', (d: Connection) => {
      const isSelected = selectedConnections.includes(d.id);
      return getConnectionStrokeProperties(d, isSelected, config).stroke;
    })
    .attr('stroke-width', (d: Connection) => {
      const isSelected = selectedConnections.includes(d.id);
      return getConnectionStrokeProperties(d, isSelected, config).strokeWidth;
    })
    .attr('stroke-dasharray', (d: Connection) => {
      const isSelected = selectedConnections.includes(d.id);
      return getConnectionStrokeProperties(d, isSelected, config).strokeDasharray;
    });

  // Add click handlers
  if (onConnectionClick) {
    allConnectionPaths.on('click', function(event: MouseEvent, d: Connection) {
      event.stopPropagation();
      onConnectionClick(d, event);
    });
  }

  return allConnectionPaths;
};

/**
 * Render connection labels
 */
export const renderConnectionLabels = (
  container: d3.Selection<SVGGElement, unknown, null, undefined>,
  connections: Connection[],
  devices: NetworkDevice[],
  showLabels: boolean = false,
  config: ConnectionVisualConfig = defaultConnectionConfig
): d3.Selection<SVGTextElement, Connection, SVGGElement, unknown> => {
  if (!showLabels) {
    container.selectAll('.connection-label').remove();
    return container.selectAll<SVGTextElement, Connection>('.connection-label');
  }

  // Create device lookup map
  const deviceMap = new Map(devices.map(d => [d.id, d]));

  // Filter connections to only those with valid devices
  const validConnections = connections.filter(conn => 
    deviceMap.has(conn.sourceDevice) && deviceMap.has(conn.targetDevice)
  );

  // Calculate offsets (same as connection lines)
  const connectionGroups = new Map<string, Connection[]>();
  validConnections.forEach(conn => {
    const key = [conn.sourceDevice, conn.targetDevice].sort().join('-');
    if (!connectionGroups.has(key)) {
      connectionGroups.set(key, []);
    }
    connectionGroups.get(key)!.push(conn);
  });

  const connectionOffsets = new Map<string, number>();
  connectionGroups.forEach((conns, key) => {
    if (conns.length > 1) {
      conns.forEach((conn, index) => {
        const offset = (index - (conns.length - 1) / 2) * 20;
        connectionOffsets.set(conn.id, offset);
      });
    } else {
      connectionOffsets.set(conns[0].id, 0);
    }
  });

  // Bind data to connection labels
  const connectionLabels = container
    .selectAll<SVGTextElement, Connection>('.connection-label')
    .data(validConnections, (d: Connection) => d.id);

  // Remove old labels
  connectionLabels.exit().remove();

  // Create new labels
  const newConnectionLabels = connectionLabels
    .enter()
    .append('text')
    .attr('class', 'connection-label')
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('font-size', config.labelFontSize)
    .attr('fill', 'white')
    .attr('stroke', '#1F2937')
    .attr('stroke-width', 3)
    .attr('paint-order', 'stroke fill')
    .style('pointer-events', 'none')
    .style('user-select', 'none');

  // Merge new and existing labels
  const allConnectionLabels = newConnectionLabels.merge(connectionLabels);

  // Update label positions and text
  allConnectionLabels
    .attr('x', (d: Connection) => {
      const sourceDevice = deviceMap.get(d.sourceDevice);
      const targetDevice = deviceMap.get(d.targetDevice);
      if (!sourceDevice || !targetDevice) return 0;
      
      const offset = connectionOffsets.get(d.id) || 0;
      return calculateLabelPosition(sourceDevice, targetDevice, offset).x;
    })
    .attr('y', (d: Connection) => {
      const sourceDevice = deviceMap.get(d.sourceDevice);
      const targetDevice = deviceMap.get(d.targetDevice);
      if (!sourceDevice || !targetDevice) return 0;
      
      const offset = connectionOffsets.get(d.id) || 0;
      return calculateLabelPosition(sourceDevice, targetDevice, offset).y;
    })
    .text((d: Connection) => d.name || `${d.bandwidth} Mbps`);

  return allConnectionLabels;
};

/**
 * Render endpoint interface labels (source and target) with directional arrows
 */
export const renderConnectionEndpointLabels = (
  container: d3.Selection<SVGGElement, unknown, null, undefined>,
  connections: Connection[],
  devices: NetworkDevice[],
): void => {
  const deviceMap = new Map(devices.map(d => [d.id, d]));

  type EndpointDatum = {
    id: string; // unique id per connection endpoint
    connId: string;
    x: number;
    y: number;
    text: string;
  };

  const endpointData: EndpointDatum[] = [];

  const getInterfaceName = (dev: any, ifaceId: string): string => {
    if ('interfaces' in dev && Array.isArray(dev.interfaces)) {
      const iface = dev.interfaces.find((i: any) => i.id === ifaceId);
      return iface?.name || ifaceId;
    }
    if ('interface' in dev && dev.interface) {
      if (dev.interface.id === ifaceId) return dev.interface.name || ifaceId;
    }
    return ifaceId;
  };

  connections.forEach((conn) => {
    const src = deviceMap.get(conn.sourceDevice);
    const dst = deviceMap.get(conn.targetDevice);
    if (!src || !dst) return;

    const dx = dst.position.x - src.position.x;
    const dy = dst.position.y - src.position.y;
    const len = Math.sqrt(dx*dx + dy*dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    // Position labels slightly away from device centers, offset perpendicular for readability
    const along = 40; // distance from device center along the line
    const perp = 12;  // perpendicular offset

    // Source endpoint label
    const sx = src.position.x + ux * along - uy * perp;
    const sy = src.position.y + uy * along + ux * perp;
    endpointData.push({
      id: `${conn.id}-src`,
      connId: conn.id,
      x: sx,
      y: sy,
      text: `⟶ ${getInterfaceName(src as any, conn.sourceInterface)}`,
    });

    // Target endpoint label
    const tx = dst.position.x - ux * along + uy * perp;
    const ty = dst.position.y - uy * along - ux * perp;
    endpointData.push({
      id: `${conn.id}-dst`,
      connId: conn.id,
      x: tx,
      y: ty,
      text: `${getInterfaceName(dst as any, conn.targetInterface)} ⟵`,
    });
  });

  // Bind data
  const labels = container
    .selectAll<SVGTextElement, EndpointDatum>('.connection-port-label')
    .data(endpointData, (d: any) => d.id);

  labels.exit().remove();

  const newLabels = labels.enter()
    .append('text')
    .attr('class', 'connection-port-label')
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('font-size', 10)
    .attr('fill', 'white')
    .attr('stroke', '#1F2937')
    .attr('stroke-width', 3)
    .attr('paint-order', 'stroke fill')
    .style('pointer-events', 'none')
    .style('user-select', 'none');

  const all = newLabels.merge(labels as any);
  all
    .attr('x', d => d.x)
    .attr('y', d => d.y)
    .text(d => d.text);
};

/**
 * Render health arrows at each connection endpoint (green/red indicators)
 */
export const renderConnectionHealthArrows = (
  container: d3.Selection<SVGGElement, unknown, null, undefined>,
  connections: Connection[],
  devices: NetworkDevice[],
  health: Map<string, { status: 'ok' | 'warn' | 'error' }>,
): void => {
  const deviceMap = new Map(devices.map(d => [d.id, d]));

  type MarkerDatum = {
    id: string;
    connId: string;
    x: number;
    y: number;
    angle: number; // degrees
    color: string;
  };

  const markers: MarkerDatum[] = [];

  const colorFor = (status: 'ok' | 'warn' | 'error') => {
    if (status === 'ok') return '#22c55e'; // green-500
    if (status === 'warn') return '#f59e0b'; // amber-500
    return '#ef4444'; // red-500
  };

  connections.forEach((conn) => {
    const src = deviceMap.get(conn.sourceDevice);
    const dst = deviceMap.get(conn.targetDevice);
    if (!src || !dst) return;
    const dx = dst.position.x - src.position.x;
    const dy = dst.position.y - src.position.y;
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const len = Math.sqrt(dx*dx + dy*dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    const along = 56; // increased distance from device center so markers sit outside device shape
    const perp = 0;

    const h = health.get(conn.id) || { status: 'error' as const };
    const color = colorFor(h.status);

    // Source marker
    const sx = src.position.x + ux * along - uy * perp;
    const sy = src.position.y + uy * along + ux * perp;
    markers.push({ id: `${conn.id}-src-health`, connId: conn.id, x: sx, y: sy, angle, color });

    // Target marker (reverse angle)
    const tx = dst.position.x - ux * along + uy * perp;
    const ty = dst.position.y - uy * along - ux * perp;
    markers.push({ id: `${conn.id}-dst-health`, connId: conn.id, x: tx, y: ty, angle: angle + 180, color });
  });

  // Bind data
  const sel = container
    .selectAll<SVGPathElement, MarkerDatum>('.connection-health-marker')
    .data(markers, (d: any) => d.id);

  sel.exit().remove();

  const enter = sel.enter()
    .append('path')
    .attr('class', 'connection-health-marker')
    .attr('d', 'M -8 6 L 8 6 L 0 -10 Z') // larger triangle for visibility
    .style('pointer-events', 'none');

  const all = enter.merge(sel as any);

  all
    .attr('transform', d => `translate(${d.x}, ${d.y}) rotate(${d.angle})`)
    .attr('fill', d => d.color)
    .attr('stroke', '#111827')
    .attr('stroke-width', 2)
    .attr('opacity', 0.95);
};

/**
 * Animate packet flow along connection
 */
export const animatePacketFlow = (
  connection: Connection,
  sourceDevice: NetworkDevice,
  targetDevice: NetworkDevice,
  duration: number = 2000,
  color: string = '#10B981'
): void => {
  // This would create a moving circle along the connection path
  // Implementation would depend on having access to the SVG container
  // For now, this is a placeholder for future packet animation
  console.log(`Animating packet flow on connection ${connection.id} from ${sourceDevice.name} to ${targetDevice.name}`);
};

/**
 * Get connections for a specific device
 */
export const getDeviceConnections = (
  deviceId: string,
  connections: Connection[]
): Connection[] => {
  return connections.filter(conn => 
    conn.sourceDevice === deviceId || conn.targetDevice === deviceId
  );
};

/**
 * Check if two devices are directly connected
 */
export const areDevicesConnected = (
  deviceId1: string,
  deviceId2: string,
  connections: Connection[]
): boolean => {
  return connections.some(conn => 
    (conn.sourceDevice === deviceId1 && conn.targetDevice === deviceId2) ||
    (conn.sourceDevice === deviceId2 && conn.targetDevice === deviceId1)
  );
};