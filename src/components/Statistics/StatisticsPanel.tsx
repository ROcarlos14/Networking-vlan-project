import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useAppStore } from '../../store';
import { SimulationStats } from '../../types/simulation';

interface ChartData {
  timestamp: number;
  value: number;
  label: string;
}

interface DeviceUtilizationData {
  deviceId: string;
  deviceName: string;
  utilization: number;
}

interface VlanUtilizationData {
  vlanId: number;
  vlanName: string;
  utilization: number;
}

/**
 * Statistics panel with comprehensive network metrics and visualizations
 */
const StatisticsPanel: React.FC = () => {
  const {
    devices,
    vlans,
    simulationStats,
    simulationRunning,
    currentSimulation,
  } = useAppStore();

  const [timeSeriesData, setTimeSeriesData] = useState<ChartData[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<'throughput' | 'latency' | 'packets'>('throughput');
  const [timeRange, setTimeRange] = useState<'1m' | '5m' | '15m' | '1h'>('5m');
  
  const throughputChartRef = useRef<SVGSVGElement>(null);
  const deviceUtilizationRef = useRef<SVGSVGElement>(null);
  const vlanUtilizationRef = useRef<SVGSVGElement>(null);
  const packetStatusRef = useRef<SVGSVGElement>(null);

  // Collect historical data
  useEffect(() => {
    if (simulationRunning) {
      const interval = setInterval(() => {
        const now = Date.now();
        let value = 0;
        
        switch (selectedMetric) {
          case 'throughput':
            value = simulationStats.throughput;
            break;
          case 'latency':
            value = simulationStats.averageLatency;
            break;
          case 'packets':
            value = simulationStats.totalPackets;
            break;
        }

        setTimeSeriesData(prev => {
          const newData = [...prev, { timestamp: now, value, label: selectedMetric }];
          
          // Keep only data within time range
          const timeRangeMs = {
            '1m': 60 * 1000,
            '5m': 5 * 60 * 1000,
            '15m': 15 * 60 * 1000,
            '1h': 60 * 60 * 1000,
          }[timeRange];
          
          return newData.filter(d => now - d.timestamp <= timeRangeMs);
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [simulationRunning, selectedMetric, timeRange, simulationStats]);

  // Create throughput time series chart
  useEffect(() => {
    if (!throughputChartRef.current || timeSeriesData.length < 2) return;

    const svg = d3.select(throughputChartRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 20, right: 30, bottom: 30, left: 50 };
    const width = 400 - margin.left - margin.right;
    const height = 200 - margin.bottom - margin.top;

    const g = svg
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Scales
    const xScale = d3.scaleTime()
      .domain(d3.extent(timeSeriesData, d => new Date(d.timestamp)) as [Date, Date])
      .range([0, width]);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(timeSeriesData, d => d.value) || 0])
      .nice()
      .range([height, 0]);

    // Line generator
    const line = d3.line<ChartData>()
      .x(d => xScale(new Date(d.timestamp)))
      .y(d => yScale(d.value))
      .curve(d3.curveMonotoneX);

    // Add axes
    const xAxis: any = d3.axisBottom(xScale).tickFormat(d3.timeFormat('%H:%M:%S') as any) as any;
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(xAxis);

    g.append('g')
      .call(d3.axisLeft(yScale) as any);

    // Add line
    g.append('path')
      .datum(timeSeriesData)
      .attr('fill', 'none')
      .attr('stroke', '#60a5fa')
      .attr('stroke-width', 2)
      .attr('d', line);

    // Add dots
    g.selectAll('.dot')
      .data(timeSeriesData)
      .enter().append('circle')
      .attr('class', 'dot')
      .attr('cx', d => xScale(new Date(d.timestamp)))
      .attr('cy', d => yScale(d.value))
      .attr('r', 3)
      .attr('fill', '#60a5fa');

  }, [timeSeriesData]);

  // Create device utilization bar chart
  useEffect(() => {
    if (!deviceUtilizationRef.current) return;

    const deviceData: DeviceUtilizationData[] = Object.entries(simulationStats.utilizationByDevice).map(([deviceId, utilization]) => ({
      deviceId,
      deviceName: devices.find(d => d.id === deviceId)?.name || deviceId,
      utilization,
    })).sort((a, b) => b.utilization - a.utilization);

    if (deviceData.length === 0) return;

    const svg = d3.select(deviceUtilizationRef.current);
    svg.selectAll('*').remove();

    const margin = { top: 20, right: 30, bottom: 60, left: 50 };
    const width = 400 - margin.left - margin.right;
    const height = 250 - margin.top - margin.bottom;

    const g = svg
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const xScale = d3.scaleBand()
      .domain(deviceData.map(d => d.deviceName))
      .range([0, width])
      .padding(0.1);

    const yScale = d3.scaleLinear()
      .domain([0, d3.max(deviceData, d => d.utilization) || 0])
      .nice()
      .range([height, 0]);

    // Add axes
    g.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(xScale))
      .selectAll('text')
      .style('text-anchor', 'end')
      .attr('dx', '-.8em')
      .attr('dy', '.15em')
      .attr('transform', 'rotate(-45)');

    g.append('g')
      .call(d3.axisLeft(yScale));

    // Add bars
    g.selectAll('.bar')
      .data(deviceData)
      .enter().append('rect')
      .attr('class', 'bar')
      .attr('x', d => xScale(d.deviceName)!)
      .attr('width', xScale.bandwidth())
      .attr('y', d => yScale(d.utilization))
      .attr('height', d => height - yScale(d.utilization))
      .attr('fill', '#8b5cf6');

    // Add value labels
    g.selectAll('.label')
      .data(deviceData)
      .enter().append('text')
      .attr('class', 'label')
      .attr('x', d => xScale(d.deviceName)! + xScale.bandwidth() / 2)
      .attr('y', d => yScale(d.utilization) - 5)
      .attr('text-anchor', 'middle')
      .style('fill', '#e5e7eb')
      .style('font-size', '12px')
      .text(d => d.utilization.toLocaleString());

  }, [simulationStats.utilizationByDevice, devices]);

  // Create VLAN utilization pie chart
  useEffect(() => {
    if (!vlanUtilizationRef.current) return;

    const vlanData: VlanUtilizationData[] = Object.entries(simulationStats.utilizationByVlan).map(([vlanId, utilization]) => ({
      vlanId: parseInt(vlanId),
      vlanName: vlans.find(v => v.id === parseInt(vlanId))?.name || `VLAN ${vlanId}`,
      utilization,
    }));

    if (vlanData.length === 0) return;

    const svg = d3.select(vlanUtilizationRef.current);
    svg.selectAll('*').remove();

    const width = 300;
    const height = 300;
    const radius = Math.min(width, height) / 2 - 40;

    const g = svg
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`);

    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

    const pie = d3.pie<VlanUtilizationData>()
      .value(d => d.utilization)
      .sort(null);

    const arc = d3.arc<d3.PieArcDatum<VlanUtilizationData>>()
      .innerRadius(0)
      .outerRadius(radius);

    const labelArc = d3.arc<d3.PieArcDatum<VlanUtilizationData>>()
      .outerRadius(radius * 0.8)
      .innerRadius(radius * 0.8);

    const arcs = g.selectAll('.arc')
      .data(pie(vlanData))
      .enter().append('g')
      .attr('class', 'arc');

    arcs.append('path')
      .attr('d', arc)
      .style('fill', (d, i) => colorScale(i.toString()));

    arcs.append('text')
      .attr('transform', d => `translate(${labelArc.centroid(d)})`)
      .attr('text-anchor', 'middle')
      .style('fill', '#e5e7eb')
      .style('font-size', '12px')
      .text(d => d.data.vlanName);

  }, [simulationStats.utilizationByVlan, vlans]);

  // Create packet status donut chart
  useEffect(() => {
    if (!packetStatusRef.current) return;

    const statusData = [
      { status: 'Delivered', count: simulationStats.deliveredPackets, color: '#10b981' },
      { status: 'Dropped', count: simulationStats.droppedPackets, color: '#ef4444' },
      { status: 'In Transit', count: (currentSimulation?.packets || []).filter(p => p.status === 'in_transit').length, color: '#3b82f6' },
    ].filter(d => d.count > 0);

    if (statusData.length === 0) return;

    const svg = d3.select(packetStatusRef.current);
    svg.selectAll('*').remove();

    const width = 250;
    const height = 250;
    const radius = Math.min(width, height) / 2 - 20;

    const g = svg
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${width / 2},${height / 2})`);

    const pie = d3.pie<typeof statusData[0]>()
      .value(d => d.count)
      .sort(null);

    const arc = d3.arc<d3.PieArcDatum<typeof statusData[0]>>()
      .innerRadius(radius * 0.4)
      .outerRadius(radius);

    const arcs = g.selectAll('.arc')
      .data(pie(statusData))
      .enter().append('g')
      .attr('class', 'arc');

    arcs.append('path')
      .attr('d', arc)
      .style('fill', d => d.data.color);

    // Add center text
    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.5em')
      .style('fill', '#e5e7eb')
      .style('font-size', '18px')
      .style('font-weight', 'bold')
      .text(simulationStats.totalPackets.toString());

    g.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '1em')
      .style('fill', '#9ca3af')
      .style('font-size', '12px')
      .text('Total Packets');

  }, [simulationStats, currentSimulation]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const formatRate = (rate: number): string => {
    if (rate === 0) return '0 bps';
    const k = 1000;
    const sizes = ['bps', 'Kbps', 'Mbps', 'Gbps'];
    const i = Math.floor(Math.log(rate) / Math.log(k));
    return `${parseFloat((rate / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const getSuccessRate = (): number => {
    if (simulationStats.totalPackets === 0) return 0;
    return (simulationStats.deliveredPackets / simulationStats.totalPackets) * 100;
  };

  if (!simulationRunning && simulationStats.totalPackets === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-400">
          <div className="text-6xl mb-4">📊</div>
          <h3 className="text-xl font-semibold mb-2">No Statistics Available</h3>
          <p>Start a packet simulation to see network statistics and metrics</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Network Statistics</h2>
          
          <div className="flex items-center space-x-4">
            {/* Metric selector */}
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-300">Metric:</span>
              <select
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value as any)}
                className="bg-gray-700 border border-gray-600 rounded-md px-2 py-1 text-sm"
              >
                <option value="throughput">Throughput</option>
                <option value="latency">Latency</option>
                <option value="packets">Packets</option>
              </select>
            </div>
            
            {/* Time range selector */}
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-300">Range:</span>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as any)}
                className="bg-gray-700 border border-gray-600 rounded-md px-2 py-1 text-sm"
              >
                <option value="1m">1 min</option>
                <option value="5m">5 min</option>
                <option value="15m">15 min</option>
                <option value="1h">1 hour</option>
              </select>
            </div>
          </div>
        </div>

        {/* Status indicator */}
        <div className="flex items-center space-x-4 text-sm">
          <div className={`flex items-center space-x-2 ${simulationRunning ? 'text-green-400' : 'text-gray-400'}`}>
            <div className={`w-2 h-2 rounded-full ${simulationRunning ? 'bg-green-400 animate-pulse' : 'bg-gray-400'}`}></div>
            <span>{simulationRunning ? 'Recording' : 'Stopped'}</span>
          </div>
          {simulationStats.totalPackets > 0 && (
            <div className="text-gray-300">
              Success Rate: <span className={`font-medium ${getSuccessRate() >= 90 ? 'text-green-400' : getSuccessRate() >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
                {getSuccessRate().toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 p-6 overflow-auto">
        {/* Key metrics cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="text-2xl font-bold text-blue-400">{simulationStats.totalPackets}</div>
            <div className="text-sm text-gray-300">Total Packets</div>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="text-2xl font-bold text-green-400">{simulationStats.deliveredPackets}</div>
            <div className="text-sm text-gray-300">Delivered</div>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="text-2xl font-bold text-red-400">{simulationStats.droppedPackets}</div>
            <div className="text-sm text-gray-300">Dropped</div>
          </div>
          <div className="bg-gray-800 p-4 rounded-lg">
            <div className="text-2xl font-bold text-yellow-400">{simulationStats.averageLatency.toFixed(2)}ms</div>
            <div className="text-sm text-gray-300">Avg Latency</div>
          </div>
        </div>

        {/* Charts grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Time series chart */}
          <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-3">
              {selectedMetric.charAt(0).toUpperCase() + selectedMetric.slice(1)} Over Time
            </h3>
            <svg ref={throughputChartRef}></svg>
          </div>

          {/* Packet status chart */}
          <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-3">Packet Status Distribution</h3>
            <div className="flex justify-center">
              <svg ref={packetStatusRef}></svg>
            </div>
          </div>

          {/* Device utilization */}
          <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-3">Device Utilization</h3>
            <svg ref={deviceUtilizationRef}></svg>
          </div>

          {/* VLAN utilization */}
          <div className="bg-gray-800 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-3">VLAN Traffic Distribution</h3>
            <div className="flex justify-center">
              <svg ref={vlanUtilizationRef}></svg>
            </div>
          </div>
        </div>

        {/* Detailed metrics table */}
        <div className="mt-8 bg-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-4">Detailed Metrics</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Performance metrics */}
            <div>
              <h4 className="font-medium mb-3 text-gray-300">Performance</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Throughput:</span>
                  <span className="text-blue-400">{formatRate(simulationStats.throughput)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Average Latency:</span>
                  <span className="text-yellow-400">{simulationStats.averageLatency.toFixed(2)} ms</span>
                </div>
                <div className="flex justify-between">
                  <span>Packet Loss Rate:</span>
                  <span className="text-red-400">
                    {simulationStats.totalPackets > 0 
                      ? ((simulationStats.droppedPackets / simulationStats.totalPackets) * 100).toFixed(2)
                      : '0.00'
                    }%
                  </span>
                </div>
              </div>
            </div>

            {/* Traffic summary */}
            <div>
              <h4 className="font-medium mb-3 text-gray-300">Traffic Summary</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Total Devices:</span>
                  <span className="text-gray-300">{devices.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Active VLANs:</span>
                  <span className="text-gray-300">{Object.keys(simulationStats.utilizationByVlan).length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Success Rate:</span>
                  <span className={`${getSuccessRate() >= 90 ? 'text-green-400' : getSuccessRate() >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {getSuccessRate().toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatisticsPanel;