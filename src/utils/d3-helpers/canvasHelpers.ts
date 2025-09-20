import * as d3 from 'd3';

/**
 * Canvas dimensions and configuration
 */
export interface CanvasConfig {
  width: number;
  height: number;
  margin: { top: number; right: number; bottom: number; left: number };
}

/**
 * Zoom behavior configuration
 */
export interface ZoomConfig {
  minScale: number;
  maxScale: number;
  translateExtent: [[number, number], [number, number]];
}

/**
 * Default canvas configuration
 */
export const defaultCanvasConfig: CanvasConfig = {
  width: 1200,
  height: 800,
  margin: { top: 20, right: 20, bottom: 20, left: 20 },
};

/**
 * Default zoom configuration
 */
export const defaultZoomConfig: ZoomConfig = {
  minScale: 0.1,
  maxScale: 3,
  translateExtent: [[-1000, -1000], [2000, 2000]],
};

/**
 * Create SVG container with responsive sizing
 */
export const createSvgContainer = (
  containerRef: HTMLDivElement,
  config: CanvasConfig = defaultCanvasConfig
): d3.Selection<SVGSVGElement, unknown, null, undefined> => {
  // Clear any existing SVG
  d3.select(containerRef).selectAll('svg').remove();

  const svg = d3
    .select(containerRef)
    .append('svg')
    .attr('class', 'network-canvas-svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('viewBox', `0 0 ${config.width} ${config.height}`)
    .style('background-color', 'transparent')
    .style('cursor', 'grab');

  return svg;
};

/**
 * Create zoom behavior
 */
export const createZoomBehavior = (
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  container: d3.Selection<SVGGElement, unknown, null, undefined>,
  config: ZoomConfig = defaultZoomConfig
): d3.ZoomBehavior<SVGSVGElement, unknown> => {
  const zoom = d3
    .zoom<SVGSVGElement, unknown>()
    .scaleExtent([config.minScale, config.maxScale])
    .translateExtent(config.translateExtent)
    .on('start', function(event) {
      if (!event.sourceEvent) return;
      svg.style('cursor', 'grabbing');
    })
    .on('zoom', function(event) {
      container.attr('transform', event.transform.toString());
    })
    .on('end', function(event) {
      if (!event.sourceEvent) return;
      svg.style('cursor', 'grab');
    });

  svg.call(zoom);

  return zoom;
};

/**
 * Create grid pattern
 */
export const createGridPattern = (
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  gridSize: number = 20,
  gridColor: string = '#374151',
  gridOpacity: number = 0.3
): void => {
  const defs = (svg.select('defs').empty() 
    ? svg.append('defs') 
    : svg.select('defs')) as d3.Selection<SVGDefsElement, unknown, null, undefined>;

  // Remove existing grid pattern
  defs.selectAll('#grid').remove();

  const pattern = defs
    .append('pattern')
    .attr('id', 'grid')
    .attr('width', gridSize)
    .attr('height', gridSize)
    .attr('patternUnits', 'userSpaceOnUse');

  pattern
    .append('path')
    .attr('d', `M ${gridSize} 0 L 0 0 0 ${gridSize}`)
    .attr('fill', 'none')
    .attr('stroke', gridColor)
    .attr('stroke-width', 1)
    .attr('opacity', gridOpacity);

  // Apply grid as background
  const gridBackground = (svg.select('.grid-background').empty()
    ? svg.insert('rect', ':first-child').attr('class', 'grid-background')
    : svg.select('.grid-background')) as d3.Selection<SVGRectElement, unknown, null, undefined>;
    
  gridBackground
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('fill', 'url(#grid)');
};

/**
 * Get responsive canvas dimensions
 */
export const getResponsiveCanvasDimensions = (
  containerRef: HTMLDivElement
): { width: number; height: number } => {
  const rect = containerRef.getBoundingClientRect();
  return {
    width: Math.max(rect.width, 800),
    height: Math.max(rect.height, 600),
  };
};

/**
 * Convert screen coordinates to canvas coordinates
 */
export const screenToCanvas = (
  screenX: number,
  screenY: number,
  transform: d3.ZoomTransform,
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>
): { x: number; y: number } => {
  const svgRect = (svg.node() as SVGSVGElement).getBoundingClientRect();
  const canvasX = (screenX - svgRect.left - transform.x) / transform.k;
  const canvasY = (screenY - svgRect.top - transform.y) / transform.k;
  
  return { x: canvasX, y: canvasY };
};

/**
 * Convert canvas coordinates to screen coordinates
 */
export const canvasToScreen = (
  canvasX: number,
  canvasY: number,
  transform: d3.ZoomTransform
): { x: number; y: number } => {
  const screenX = canvasX * transform.k + transform.x;
  const screenY = canvasY * transform.k + transform.y;
  
  return { x: screenX, y: screenY };
};

/**
 * Reset zoom to fit content
 */
export const resetZoom = (
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  zoom: d3.ZoomBehavior<SVGSVGElement, unknown>,
  duration: number = 500
): void => {
  svg
    .transition()
    .duration(duration)
    .call(zoom.transform, d3.zoomIdentity);
};

/**
 * Fit content to canvas
 */
export const fitToCanvas = (
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  zoom: d3.ZoomBehavior<SVGSVGElement, unknown>,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  padding: number = 50,
  duration: number = 500
): void => {
  const svgRect = (svg.node() as SVGSVGElement).getBoundingClientRect();
  
  const contentWidth = bounds.maxX - bounds.minX;
  const contentHeight = bounds.maxY - bounds.minY;
  
  const scale = Math.min(
    (svgRect.width - padding * 2) / contentWidth,
    (svgRect.height - padding * 2) / contentHeight
  );
  
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  
  const translateX = svgRect.width / 2 - centerX * scale;
  const translateY = svgRect.height / 2 - centerY * scale;
  
  const transform = d3.zoomIdentity
    .translate(translateX, translateY)
    .scale(scale);
  
  svg
    .transition()
    .duration(duration)
    .call(zoom.transform, transform);
};