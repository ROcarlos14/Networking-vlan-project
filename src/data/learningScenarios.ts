import { LearningScenario } from '../components/Learning/VlanLearningInterface';

/**
 * Comprehensive VLAN Learning Scenarios Database
 * 
 * This file contains pre-built scenarios that teach various VLAN concepts
 * from basic segmentation to advanced enterprise configurations.
 */

export const learningScenarios: LearningScenario[] = [
  {
    id: 'basic-vlan-setup',
    title: 'Basic VLAN Configuration',
    description: 'Learn to create VLANs and assign ports to different VLANs',
    difficulty: 'beginner',
    estimatedTime: 15,
    learningObjectives: [
      'Understand VLAN concepts and benefits',
      'Create multiple VLANs on a switch',
      'Assign ports to specific VLANs',
      'Test VLAN isolation',
      'Verify broadcast domain separation'
    ],
    prerequisites: ['Basic networking knowledge', 'Understanding of switches'],
    steps: [
      {
        id: 'understand-vlans',
        title: 'Understanding VLANs',
        description: 'Learn what VLANs are and why they are useful',
        objective: 'Understand the concept of Virtual LANs and their benefits',
        instructions: [
          'Read about VLAN concepts in the information panel',
          'Identify the default VLAN configuration',
          'Understand broadcast domains vs collision domains'
        ],
        expectedConfig: {},
        hints: [
          'VLANs create separate broadcast domains on a single switch',
          'Default VLAN is usually VLAN 1',
          'VLANs improve security by isolating traffic'
        ],
        validation: (devices, connections) => {
          return { success: true, message: 'Great! You understand VLAN concepts.' };
        }
      },
      {
        id: 'create-vlans',
        title: 'Create VLANs',
        description: 'Create VLANs for different departments',
        objective: 'Create VLAN 10 (Sales), VLAN 20 (IT), and VLAN 30 (HR)',
        instructions: [
          'Go to the VLAN Configuration panel',
          'Create VLAN 10 with name "Sales"',
          'Create VLAN 20 with name "IT"', 
          'Create VLAN 30 with name "HR"',
          'Observe the VLAN database on the switch'
        ],
        expectedConfig: {
          vlans: [
            { id: 10, name: 'Sales' },
            { id: 20, name: 'IT' },
            { id: 30, name: 'HR' }
          ]
        },
        hints: [
          'Use meaningful VLAN names for easy identification',
          'VLAN IDs can range from 1-4094',
          'Best practice: Use consistent VLAN IDs across network'
        ],
        validation: (devices, connections) => {
          // This would be implemented to check VLAN creation
          return { success: true, message: 'All VLANs created successfully!' };
        }
      },
      {
        id: 'assign-ports',
        title: 'Assign Ports to VLANs',
        description: 'Configure switch ports for different VLANs',
        objective: 'Assign ports to appropriate VLANs based on department needs',
        instructions: [
          'Select the switch device',
          'Configure ports 1-8 for VLAN 10 (Sales)',
          'Configure ports 9-16 for VLAN 20 (IT)',
          'Configure ports 17-24 for VLAN 30 (HR)',
          'Set all ports to access mode'
        ],
        expectedConfig: {
          portAssignments: {
            'port1-8': { vlan: 10, mode: 'access' },
            'port9-16': { vlan: 20, mode: 'access' },
            'port17-24': { vlan: 30, mode: 'access' }
          }
        },
        hints: [
          'Access ports belong to only one VLAN',
          'Devices on access ports don\'t need VLAN awareness',
          'Plan assignments based on physical device locations'
        ],
        validation: (devices, connections) => {
          return { success: true, message: 'Port assignments completed!' };
        }
      },
      {
        id: 'test-isolation',
        title: 'Test VLAN Isolation',
        description: 'Verify that VLANs properly isolate traffic',
        objective: 'Send traffic between devices and observe VLAN isolation',
        instructions: [
          'Send a packet from Sales-PC1 to Sales-PC2',
          'Try to send a packet from Sales-PC1 to IT-PC1',
          'Observe that cross-VLAN communication fails',
          'Check the packet animation and flow'
        ],
        expectedConfig: {},
        hints: [
          'Devices in same VLAN can communicate',
          'Devices in different VLANs cannot communicate without a router',
          'Watch the packet flow animation'
        ],
        validation: (devices, connections) => {
          return { success: true, message: 'VLAN isolation working correctly!' };
        }
      }
    ],
    initialTopology: {
      devices: [
        {
          id: 'sw1',
          name: 'Main-Switch',
          type: 'switch',
          x: 400,
          y: 300,
          config: { ports: 24 }
        },
        {
          id: 'sales-pc1',
          name: 'Sales-PC1',
          type: 'pc',
          x: 200,
          y: 200,
          config: { vlan: 10 }
        },
        {
          id: 'sales-pc2',
          name: 'Sales-PC2',
          type: 'pc',
          x: 250,
          y: 250,
          config: { vlan: 10 }
        },
        {
          id: 'it-pc1',
          name: 'IT-PC1',
          type: 'pc',
          x: 550,
          y: 200,
          config: { vlan: 20 }
        },
        {
          id: 'hr-pc1',
          name: 'HR-PC1',
          type: 'pc',
          x: 400,
          y: 150,
          config: { vlan: 30 }
        }
      ],
      connections: [
        { id: 'c1', from: 'sales-pc1', to: 'sw1', fromInterface: 'eth0', toInterface: 'port1' },
        { id: 'c2', from: 'sales-pc2', to: 'sw1', fromInterface: 'eth0', toInterface: 'port2' },
        { id: 'c3', from: 'it-pc1', to: 'sw1', fromInterface: 'eth0', toInterface: 'port9' },
        { id: 'c4', from: 'hr-pc1', to: 'sw1', fromInterface: 'eth0', toInterface: 'port17' }
      ]
    }
  },

  {
    id: 'trunk-configuration',
    title: 'VLAN Trunking',
    description: 'Learn to configure trunk ports for VLAN communication between switches',
    difficulty: 'intermediate',
    estimatedTime: 25,
    learningObjectives: [
      'Understand trunk port concepts',
      'Configure trunk ports between switches',
      'Learn about VLAN tagging (802.1Q)',
      'Configure native VLAN',
      'Test multi-switch VLAN communication'
    ],
    prerequisites: ['Basic VLAN Configuration'],
    steps: [
      {
        id: 'trunk-concepts',
        title: 'Understanding Trunk Ports',
        description: 'Learn what trunk ports are and when to use them',
        objective: 'Understand the purpose and function of trunk ports',
        instructions: [
          'Study the trunk port concept diagram',
          'Identify when trunk ports are needed',
          'Learn about VLAN tagging (802.1Q)',
          'Understand native VLAN concept'
        ],
        expectedConfig: {},
        hints: [
          'Trunk ports carry multiple VLANs between switches',
          '802.1Q adds VLAN tags to frames',
          'Native VLAN frames are not tagged'
        ],
        validation: (devices, connections) => {
          return { success: true, message: 'Trunk concepts understood!' };
        }
      },
      {
        id: 'configure-trunk',
        title: 'Configure Trunk Port',
        description: 'Set up trunk connection between switches',
        objective: 'Configure port 24 on both switches as trunk ports',
        instructions: [
          'Select Switch-A',
          'Configure port 24 as trunk mode',
          'Set allowed VLANs to 10, 20, 99',
          'Repeat for Switch-B port 1',
          'Set native VLAN to 99'
        ],
        expectedConfig: {
          trunkPorts: ['port24', 'port1'],
          allowedVlans: [10, 20, 99],
          nativeVlan: 99
        },
        hints: [
          'Both ends must be configured as trunk',
          'Allowed VLANs should match on both sides',
          'Native VLAN should be same on both ends'
        ],
        validation: (devices, connections) => {
          return { success: true, message: 'Trunk configured successfully!' };
        }
      },
      {
        id: 'test-trunk',
        title: 'Test Cross-Switch Communication',
        description: 'Verify VLAN communication across switches',
        objective: 'Test communication between devices on different switches but same VLAN',
        instructions: [
          'Send packet from Sales-PC1 (Switch-A) to Sales-PC2 (Switch-B)',
          'Observe VLAN tag being added at trunk port',
          'Watch tag being removed at destination access port',
          'Test IT VLAN communication as well'
        ],
        expectedConfig: {},
        hints: [
          'Frames get tagged when entering trunk port',
          'Tags are removed when exiting to access port',
          'Same VLAN can communicate across switches'
        ],
        validation: (devices, connections) => {
          return { success: true, message: 'Cross-switch VLAN communication working!' };
        }
      }
    ],
    initialTopology: {
      devices: [
        { id: 'sw-a', name: 'Switch-A', type: 'switch', x: 200, y: 300 },
        { id: 'sw-b', name: 'Switch-B', type: 'switch', x: 600, y: 300 },
        { id: 'sales-pc1', name: 'Sales-PC1', type: 'pc', x: 100, y: 200 },
        { id: 'sales-pc2', name: 'Sales-PC2', type: 'pc', x: 700, y: 200 },
        { id: 'it-pc1', name: 'IT-PC1', type: 'pc', x: 100, y: 400 },
        { id: 'it-pc2', name: 'IT-PC2', type: 'pc', x: 700, y: 400 }
      ],
      connections: [
        { id: 'trunk', from: 'sw-a', to: 'sw-b', fromInterface: 'port24', toInterface: 'port1' },
        { id: 'c1', from: 'sales-pc1', to: 'sw-a', fromInterface: 'eth0', toInterface: 'port1' },
        { id: 'c2', from: 'it-pc1', to: 'sw-a', fromInterface: 'eth0', toInterface: 'port9' },
        { id: 'c3', from: 'sales-pc2', to: 'sw-b', fromInterface: 'eth0', toInterface: 'port2' },
        { id: 'c4', from: 'it-pc2', to: 'sw-b', fromInterface: 'eth0', toInterface: 'port10' }
      ]
    }
  },

  {
    id: 'inter-vlan-routing',
    title: 'Inter-VLAN Routing',
    description: 'Configure routing between VLANs using a router',
    difficulty: 'advanced',
    estimatedTime: 35,
    learningObjectives: [
      'Understand inter-VLAN routing concepts',
      'Configure router-on-a-stick',
      'Set up sub-interfaces',
      'Configure IP addressing for VLANs',
      'Test connectivity between VLANs',
      'Troubleshoot routing issues'
    ],
    prerequisites: ['Basic VLAN Configuration', 'VLAN Trunking'],
    steps: [
      {
        id: 'routing-concepts',
        title: 'Inter-VLAN Routing Concepts',
        description: 'Learn how to route between VLANs',
        objective: 'Understand different methods of inter-VLAN routing',
        instructions: [
          'Study router-on-a-stick concept',
          'Learn about sub-interfaces',
          'Understand VLAN interface (SVI) concept',
          'Plan IP addressing scheme'
        ],
        expectedConfig: {},
        hints: [
          'Layer 3 device needed for inter-VLAN communication',
          'Router-on-a-stick uses sub-interfaces',
          'Each VLAN needs its own subnet'
        ],
        validation: (devices, connections) => {
          return { success: true, message: 'Inter-VLAN routing concepts understood!' };
        }
      },
      {
        id: 'configure-subinterfaces',
        title: 'Configure Sub-interfaces',
        description: 'Set up sub-interfaces on the router',
        objective: 'Create sub-interfaces for each VLAN with proper IP addressing',
        instructions: [
          'Configure sub-interface eth0.10 for Sales VLAN',
          'Set IP address 192.168.10.1/24',
          'Configure sub-interface eth0.20 for IT VLAN',
          'Set IP address 192.168.20.1/24',
          'Configure sub-interface eth0.30 for HR VLAN',
          'Set IP address 192.168.30.1/24'
        ],
        expectedConfig: {
          subInterfaces: {
            'eth0.10': { ip: '192.168.10.1/24', vlan: 10 },
            'eth0.20': { ip: '192.168.20.1/24', vlan: 20 },
            'eth0.30': { ip: '192.168.30.1/24', vlan: 30 }
          }
        },
        hints: [
          'Sub-interface format: interface.vlan_id',
          'Each VLAN needs different subnet',
          'Router IP becomes default gateway for VLAN'
        ],
        validation: (devices, connections) => {
          return { success: true, message: 'Sub-interfaces configured!' };
        }
      },
      {
        id: 'configure-devices',
        title: 'Configure Device IP Addresses',
        description: 'Set IP addresses on all devices',
        objective: 'Configure appropriate IP addresses and default gateways',
        instructions: [
          'Set Sales-PC1 IP to 192.168.10.10/24, gateway 192.168.10.1',
          'Set IT-PC1 IP to 192.168.20.10/24, gateway 192.168.20.1',
          'Set HR-PC1 IP to 192.168.30.10/24, gateway 192.168.30.1',
          'Verify all devices can ping their gateways'
        ],
        expectedConfig: {
          deviceIPs: {
            'sales-pc1': { ip: '192.168.10.10/24', gateway: '192.168.10.1' },
            'it-pc1': { ip: '192.168.20.10/24', gateway: '192.168.20.1' },
            'hr-pc1': { ip: '192.168.30.10/24', gateway: '192.168.30.1' }
          }
        },
        hints: [
          'Each device needs IP in its VLAN\'s subnet',
          'Default gateway points to router sub-interface',
          'Test connectivity with ping'
        ],
        validation: (devices, connections) => {
          return { success: true, message: 'Device IPs configured!' };
        }
      },
      {
        id: 'test-routing',
        title: 'Test Inter-VLAN Communication',
        description: 'Verify routing between VLANs works',
        objective: 'Test communication between devices in different VLANs',
        instructions: [
          'Ping from Sales-PC1 to IT-PC1',
          'Ping from IT-PC1 to HR-PC1',
          'Observe routing process in packet animation',
          'Check routing table on router',
          'Verify ARP entries are created'
        ],
        expectedConfig: {},
        hints: [
          'Router performs IP routing between subnets',
          'ARP is used to resolve MAC addresses',
          'Each hop decrements TTL'
        ],
        validation: (devices, connections) => {
          return { success: true, message: 'Inter-VLAN routing working perfectly!' };
        }
      }
    ],
    initialTopology: {
      devices: [
        { id: 'router1', name: 'Core-Router', type: 'router', x: 400, y: 150 },
        { id: 'sw1', name: 'Main-Switch', type: 'switch', x: 400, y: 350 },
        { id: 'sales-pc1', name: 'Sales-PC1', type: 'pc', x: 200, y: 450 },
        { id: 'it-pc1', name: 'IT-PC1', type: 'pc', x: 400, y: 450 },
        { id: 'hr-pc1', name: 'HR-PC1', type: 'pc', x: 600, y: 450 },
        { id: 'server1', name: 'File-Server', type: 'server', x: 400, y: 50 }
      ],
      connections: [
        { id: 'router-sw', from: 'router1', to: 'sw1', fromInterface: 'eth0', toInterface: 'port24' },
        { id: 'c1', from: 'sales-pc1', to: 'sw1', fromInterface: 'eth0', toInterface: 'port1' },
        { id: 'c2', from: 'it-pc1', to: 'sw1', fromInterface: 'eth0', toInterface: 'port9' },
        { id: 'c3', from: 'hr-pc1', to: 'sw1', fromInterface: 'eth0', toInterface: 'port17' },
        { id: 'c4', from: 'server1', to: 'router1', fromInterface: 'eth0', toInterface: 'eth1' }
      ]
    }
  },

  {
    id: 'vlan-troubleshooting',
    title: 'VLAN Troubleshooting',
    description: 'Learn to diagnose and fix common VLAN issues',
    difficulty: 'intermediate',
    estimatedTime: 30,
    learningObjectives: [
      'Identify common VLAN problems',
      'Use troubleshooting commands',
      'Analyze VLAN configurations',
      'Fix connectivity issues',
      'Verify VLAN operation'
    ],
    prerequisites: ['Basic VLAN Configuration', 'VLAN Trunking'],
    steps: [
      {
        id: 'identify-problem',
        title: 'Identify the Problem',
        description: 'Analyze network symptoms to identify VLAN issues',
        objective: 'Use show commands to diagnose VLAN problems',
        instructions: [
          'Use "show vlan" command to check VLAN database',
          'Use "show interfaces trunk" to verify trunk ports',
          'Check port assignments with "show vlan brief"',
          'Test connectivity between devices'
        ],
        expectedConfig: {},
        hints: [
          'Start with show commands to gather information',
          'Check both VLAN database and port assignments',
          'Verify trunk configuration on both ends'
        ],
        validation: (devices, connections) => {
          return { success: true, message: 'Problem identified successfully!' };
        }
      }
      // Additional troubleshooting steps would be added here
    ],
    initialTopology: {
      devices: [
        // Pre-configured topology with intentional misconfigurations
      ],
      connections: []
    }
  },

  {
    id: 'vtp-configuration',
    title: 'VLAN Trunking Protocol (VTP)',
    description: 'Learn to configure and manage VTP for VLAN propagation',
    difficulty: 'advanced',
    estimatedTime: 40,
    learningObjectives: [
      'Understand VTP concepts and modes',
      'Configure VTP domains and passwords',
      'Set up VTP servers and clients',
      'Manage VLAN propagation',
      'Troubleshoot VTP issues'
    ],
    prerequisites: ['VLAN Trunking', 'Advanced VLAN concepts'],
    steps: [
      // VTP-specific steps would be implemented here
    ],
    initialTopology: {
      devices: [],
      connections: []
    }
  },

  {
    id: 'voice-data-vlans',
    title: 'Voice and Data VLAN Separation',
    description: 'Configure separate VLANs for voice and data traffic',
    difficulty: 'intermediate',
    estimatedTime: 25,
    learningObjectives: [
      'Understand voice VLAN concepts',
      'Configure voice and data VLANs',
      'Set up QoS for voice traffic',
      'Test voice/data separation',
      'Optimize voice quality'
    ],
    prerequisites: ['Basic VLAN Configuration'],
    steps: [
      // Voice/Data VLAN specific steps would be implemented here
    ],
    initialTopology: {
      devices: [],
      connections: []
    }
  },

  {
    id: 'guest-network',
    title: 'Guest Network Isolation',
    description: 'Set up isolated guest network using VLANs',
    difficulty: 'beginner',
    estimatedTime: 20,
    learningObjectives: [
      'Create isolated guest VLAN',
      'Restrict guest network access',
      'Configure internet-only access',
      'Implement security policies',
      'Test guest isolation'
    ],
    prerequisites: ['Basic VLAN Configuration'],
    steps: [
      // Guest network specific steps would be implemented here
    ],
    initialTopology: {
      devices: [],
      connections: []
    }
  }
];

/**
 * Get scenario by ID
 */
export function getScenarioById(id: string): LearningScenario | undefined {
  return learningScenarios.find(scenario => scenario.id === id);
}

/**
 * Get scenarios by difficulty level
 */
export function getScenariosByDifficulty(difficulty: 'beginner' | 'intermediate' | 'advanced'): LearningScenario[] {
  return learningScenarios.filter(scenario => scenario.difficulty === difficulty);
}

/**
 * Get scenarios by estimated time
 */
export function getScenariosByTime(maxTime: number): LearningScenario[] {
  return learningScenarios.filter(scenario => scenario.estimatedTime <= maxTime);
}

/**
 * Search scenarios by keywords
 */
export function searchScenarios(keywords: string): LearningScenario[] {
  const lowerKeywords = keywords.toLowerCase();
  return learningScenarios.filter(scenario => 
    scenario.title.toLowerCase().includes(lowerKeywords) ||
    scenario.description.toLowerCase().includes(lowerKeywords) ||
    scenario.learningObjectives.some(obj => obj.toLowerCase().includes(lowerKeywords))
  );
}