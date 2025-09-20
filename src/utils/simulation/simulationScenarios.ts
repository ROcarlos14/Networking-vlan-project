import { SimulationScenario, TrafficFlow, NetworkProtocol } from '../../types/simulation';
import { NetworkDevice, DeviceType, Vlan } from '../../types';

/**
 * Predefined simulation scenarios for educational and testing purposes
 */

/**
 * Basic ping connectivity test scenario
 */
export const createPingScenario = (
  sourceDevice: NetworkDevice,
  targetDevice: NetworkDevice,
  vlanId?: number
): SimulationScenario => ({
  id: crypto.randomUUID(),
  name: 'Basic Ping Test',
  description: `Test basic connectivity between ${sourceDevice.name} and ${targetDevice.name}`,
  topology: 'current',
  trafficFlows: [
    {
      id: crypto.randomUUID(),
      sourceDevice: sourceDevice.id,
      targetDevice: targetDevice.id,
      protocol: NetworkProtocol.ICMP,
      packetsPerSecond: 1,
      averagePacketSize: 64,
      duration: 30,
      isActive: true,
      vlanId,
    }
  ],
  duration: 30,
  objectives: [
    'Verify basic connectivity',
    'Test network path discovery',
    'Measure round-trip latency'
  ]
});

/**
 * VLAN isolation test scenario
 */
export const createVlanIsolationScenario = (
  devices: NetworkDevice[],
  vlans: Vlan[]
): SimulationScenario => {
  const trafficFlows: TrafficFlow[] = [];
  
  // Create flows between devices in different VLANs (should fail)
  for (let i = 0; i < Math.min(vlans.length, 2); i++) {
    for (let j = i + 1; j < Math.min(vlans.length, 2); j++) {
      const sourceVlan = vlans[i];
      const targetVlan = vlans[j];
      
      // Find devices that might be in these VLANs (simplified)
      const sourceDevice = devices.find(d => d.type !== DeviceType.SWITCH);
      const targetDevice = devices.find(d => d.type !== DeviceType.SWITCH && d.id !== sourceDevice?.id);
      
      if (sourceDevice && targetDevice) {
        trafficFlows.push({
          id: crypto.randomUUID(),
          sourceDevice: sourceDevice.id,
          targetDevice: targetDevice.id,
          protocol: NetworkProtocol.ICMP,
          packetsPerSecond: 2,
          averagePacketSize: 64,
          duration: 60,
          isActive: true,
          vlanId: sourceVlan.id,
        });
      }
    }
  }

  return {
    id: crypto.randomUUID(),
    name: 'VLAN Isolation Test',
    description: 'Test VLAN segmentation and isolation between different broadcast domains',
    topology: 'current',
    trafficFlows,
    duration: 60,
    objectives: [
      'Verify VLAN isolation is working',
      'Test that inter-VLAN communication is blocked',
      'Validate network segmentation'
    ]
  };
};

/**
 * Broadcast storm simulation scenario
 */
export const createBroadcastStormScenario = (
  devices: NetworkDevice[],
  vlanId?: number
): SimulationScenario => {
  const sourceDevices = devices.filter(d => d.type === DeviceType.PC || d.type === DeviceType.SERVER);
  const trafficFlows: TrafficFlow[] = [];

  // Create high-rate broadcast traffic from multiple sources
  sourceDevices.slice(0, 3).forEach(device => {
    // Simulate broadcast by sending to all other devices
    const targetDevices = sourceDevices.filter(d => d.id !== device.id);
    
    targetDevices.forEach(target => {
      trafficFlows.push({
        id: crypto.randomUUID(),
        sourceDevice: device.id,
        targetDevice: target.id,
        protocol: NetworkProtocol.ARP,
        packetsPerSecond: 50, // High rate to simulate storm
        averagePacketSize: 64,
        duration: 45,
        isActive: true,
        vlanId,
      });
    });
  });

  return {
    id: crypto.randomUUID(),
    name: 'Broadcast Storm Simulation',
    description: 'Simulate a broadcast storm to test network resilience and observe traffic patterns',
    topology: 'current',
    trafficFlows,
    duration: 45,
    objectives: [
      'Observe broadcast traffic behavior',
      'Test network performance under high load',
      'Identify potential bottlenecks'
    ]
  };
};

/**
 * Multi-protocol traffic scenario
 */
export const createMultiProtocolScenario = (devices: NetworkDevice[]): SimulationScenario => {
  const sourceDevices = devices.filter(d => d.type === DeviceType.PC || d.type === DeviceType.SERVER);
  const trafficFlows: TrafficFlow[] = [];

  if (sourceDevices.length >= 2) {
    const protocols = [NetworkProtocol.TCP, NetworkProtocol.UDP, NetworkProtocol.ICMP];
    
    protocols.forEach((protocol, index) => {
      const sourceIndex = index % sourceDevices.length;
      const targetIndex = (index + 1) % sourceDevices.length;
      
      trafficFlows.push({
        id: crypto.randomUUID(),
        sourceDevice: sourceDevices[sourceIndex].id,
        targetDevice: sourceDevices[targetIndex].id,
        protocol,
        packetsPerSecond: protocol === NetworkProtocol.TCP ? 20 : protocol === NetworkProtocol.UDP ? 15 : 5,
        averagePacketSize: protocol === NetworkProtocol.TCP ? 1400 : protocol === NetworkProtocol.UDP ? 512 : 64,
        duration: 120,
        isActive: true,
      });
    });
  }

  return {
    id: crypto.randomUUID(),
    name: 'Multi-Protocol Traffic Test',
    description: 'Generate mixed TCP, UDP, and ICMP traffic to test protocol handling',
    topology: 'current',
    trafficFlows,
    duration: 120,
    objectives: [
      'Test mixed protocol handling',
      'Observe different traffic patterns',
      'Measure protocol-specific performance'
    ]
  };
};

/**
 * Network stress test scenario
 */
export const createStressTestScenario = (devices: NetworkDevice[]): SimulationScenario => {
  const allDevices = devices.filter(d => d.type !== DeviceType.SWITCH);
  const trafficFlows: TrafficFlow[] = [];

  // Create many-to-many traffic flows
  allDevices.forEach(source => {
    allDevices.filter(d => d.id !== source.id).forEach(target => {
      trafficFlows.push({
        id: crypto.randomUUID(),
        sourceDevice: source.id,
        targetDevice: target.id,
        protocol: Math.random() > 0.5 ? NetworkProtocol.TCP : NetworkProtocol.UDP,
        packetsPerSecond: Math.floor(Math.random() * 30) + 10, // 10-40 pps
        averagePacketSize: Math.floor(Math.random() * 1000) + 500, // 500-1500 bytes
        duration: 90,
        isActive: true,
      });
    });
  });

  return {
    id: crypto.randomUUID(),
    name: 'Network Stress Test',
    description: 'High-intensity traffic between all devices to test network capacity',
    topology: 'current',
    trafficFlows,
    duration: 90,
    objectives: [
      'Test maximum network throughput',
      'Identify performance bottlenecks',
      'Stress test switching capacity'
    ]
  };
};

/**
 * Latency measurement scenario
 */
export const createLatencyTestScenario = (
  sourceDevice: NetworkDevice,
  targetDevice: NetworkDevice
): SimulationScenario => ({
  id: crypto.randomUUID(),
  name: 'Latency Measurement Test',
  description: `Measure network latency between ${sourceDevice.name} and ${targetDevice.name}`,
  topology: 'current',
  trafficFlows: [
    {
      id: crypto.randomUUID(),
      sourceDevice: sourceDevice.id,
      targetDevice: targetDevice.id,
      protocol: NetworkProtocol.ICMP,
      packetsPerSecond: 10, // Higher frequency for better measurement
      averagePacketSize: 64,
      duration: 60,
      isActive: true,
    }
  ],
  duration: 60,
  objectives: [
    'Measure precise network latency',
    'Test consistent packet delivery',
    'Identify latency variations'
  ]
});

/**
 * Trunk link test scenario
 */
export const createTrunkLinkTestScenario = (
  devices: NetworkDevice[],
  vlans: Vlan[]
): SimulationScenario => {
  const endDevices = devices.filter(d => d.type === DeviceType.PC || d.type === DeviceType.SERVER);
  const trafficFlows: TrafficFlow[] = [];

  // Create traffic for each VLAN across trunk links
  vlans.forEach(vlan => {
    if (endDevices.length >= 2) {
      trafficFlows.push({
        id: crypto.randomUUID(),
        sourceDevice: endDevices[0].id,
        targetDevice: endDevices[1].id,
        protocol: NetworkProtocol.TCP,
        packetsPerSecond: 5,
        averagePacketSize: 1000,
        duration: 90,
        isActive: true,
        vlanId: vlan.id,
      });
    }
  });

  return {
    id: crypto.randomUUID(),
    name: 'Trunk Link VLAN Test',
    description: 'Test VLAN traffic across trunk links between switches',
    topology: 'current',
    trafficFlows,
    duration: 90,
    objectives: [
      'Verify trunk link configuration',
      'Test VLAN tagging',
      'Validate inter-switch VLAN communication'
    ]
  };
};

/**
 * Get all available scenario generators
 */
export const scenarioGenerators = {
  ping: createPingScenario,
  vlanIsolation: createVlanIsolationScenario,
  broadcastStorm: createBroadcastStormScenario,
  multiProtocol: createMultiProtocolScenario,
  stressTest: createStressTestScenario,
  latencyTest: createLatencyTestScenario,
  trunkTest: createTrunkLinkTestScenario,
};

/**
 * Get scenario recommendations based on network topology
 */
export const getRecommendedScenarios = (
  devices: NetworkDevice[],
  vlans: Vlan[]
): { scenario: string; description: string; applicable: boolean }[] => {
  const endDevices = devices.filter(d => d.type === DeviceType.PC || d.type === DeviceType.SERVER);
  const switches = devices.filter(d => d.type === DeviceType.SWITCH);
  
  return [
    {
      scenario: 'ping',
      description: 'Basic connectivity test between any two devices',
      applicable: endDevices.length >= 2,
    },
    {
      scenario: 'vlanIsolation',
      description: 'Test VLAN segmentation and isolation',
      applicable: vlans.length >= 2 && switches.length >= 1,
    },
    {
      scenario: 'broadcastStorm',
      description: 'Simulate broadcast storm conditions',
      applicable: endDevices.length >= 3,
    },
    {
      scenario: 'multiProtocol',
      description: 'Mixed protocol traffic test',
      applicable: endDevices.length >= 2,
    },
    {
      scenario: 'stressTest',
      description: 'High-intensity network stress test',
      applicable: devices.length >= 4,
    },
    {
      scenario: 'latencyTest',
      description: 'Precise latency measurement',
      applicable: endDevices.length >= 2,
    },
    {
      scenario: 'trunkTest',
      description: 'Trunk link and VLAN tagging test',
      applicable: switches.length >= 2 && vlans.length >= 1,
    },
  ];
};

/**
 * Create a custom scenario from parameters
 */
export const createCustomScenario = (
  name: string,
  description: string,
  trafficFlows: TrafficFlow[],
  duration: number = 60
): SimulationScenario => ({
  id: crypto.randomUUID(),
  name,
  description,
  topology: 'current',
  trafficFlows,
  duration,
  objectives: ['Custom simulation scenario']
});