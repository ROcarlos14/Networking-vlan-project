import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store';
import { Device, Connection, Vlan, DeviceType } from '../../types';
import { getVlanColor } from '../../types/colors';
import { 
  TemplateDevice, 
  TemplateConnection, 
  TemplateVlan,
  templateDeviceToNetworkDevice,
  templateConnectionToConnection,
  templateVlanToVlan 
} from '../../utils/templateHelpers';

/**
 * Wizard Step Interface
 */
interface WizardStep {
  id: string;
  title: string;
  description: string;
  component: React.ComponentType<any>;
  validation: () => { isValid: boolean; message?: string };
  onComplete?: () => void;
}

/**
 * Network Template
 */
export interface NetworkTemplate {
  id: string;
  name: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  topology: {
    devices: TemplateDevice[];
    connections: TemplateConnection[];
    vlans: TemplateVlan[];
  };
  configuration: {
    [deviceId: string]: {
      vlans?: number[];
      trunkPorts?: string[];
      accessPorts?: { [port: string]: number };
      ipAddresses?: { [interfaceName: string]: string };
    };
  };
}

/**
 * VLAN Configuration Wizard Props
 */
interface VlanConfigWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (config: any) => void;
}

/**
 * Step 1: Network Purpose Selection
 */
const NetworkPurposeStep: React.FC<{ onSelect: (template: NetworkTemplate) => void }> = ({ onSelect }) => {
  const templates: NetworkTemplate[] = [
    {
      id: 'small-office',
      name: 'Small Office Network',
      description: 'Basic VLAN setup for a small office with 3 departments',
      difficulty: 'beginner',
      topology: {
        devices: [
          { name: 'Main-Switch', type: 'switch', x: 400, y: 300 },
          { name: 'Sales-PC1', type: 'pc', x: 200, y: 200 },
          { name: 'Sales-PC2', type: 'pc', x: 250, y: 200 },
          { name: 'IT-PC1', type: 'pc', x: 550, y: 200 },
          { name: 'HR-PC1', type: 'pc', x: 400, y: 150 }
        ],
        connections: [],
        vlans: [
          { id: 10, name: 'Sales' },
          { id: 20, name: 'IT' },
          { id: 30, name: 'HR' }
        ]
      },
      configuration: {
        'Main-Switch': {
          vlans: [10, 20, 30],
          accessPorts: {
            'port1': 10, 'port2': 10,  // Sales
            'port9': 20,               // IT
            'port17': 30               // HR
          }
        }
      }
    },
    {
      id: 'multi-switch',
      name: 'Multi-Switch Network',
      description: 'Two switches connected via trunk with multiple VLANs',
      difficulty: 'intermediate',
      topology: {
        devices: [
          { name: 'Switch-A', type: 'switch', x: 200, y: 300 },
          { name: 'Switch-B', type: 'switch', x: 600, y: 300 },
          { name: 'Sales-PC1', type: 'pc', x: 100, y: 200 },
          { name: 'Sales-PC2', type: 'pc', x: 700, y: 200 },
          { name: 'IT-PC1', type: 'pc', x: 100, y: 400 },
          { name: 'IT-PC2', type: 'pc', x: 700, y: 400 }
        ],
        connections: [],
        vlans: [
          { id: 10, name: 'Sales' },
          { id: 20, name: 'IT' },
          { id: 99, name: 'Management' }
        ]
      },
      configuration: {
        'Switch-A': {
          vlans: [10, 20, 99],
          trunkPorts: ['port24'],
          accessPorts: { 'port1': 10, 'port9': 20 }
        },
        'Switch-B': {
          vlans: [10, 20, 99],
          trunkPorts: ['port1'],
          accessPorts: { 'port2': 10, 'port10': 20 }
        }
      }
    },
    {
      id: 'enterprise-routing',
      name: 'Enterprise with Inter-VLAN Routing',
      description: 'Complete setup with router for inter-VLAN communication',
      difficulty: 'advanced',
      topology: {
        devices: [
          { name: 'Core-Router', type: 'router', x: 400, y: 150 },
          { name: 'Main-Switch', type: 'switch', x: 400, y: 350 },
          { name: 'Sales-PC1', type: 'pc', x: 200, y: 450 },
          { name: 'IT-PC1', type: 'pc', x: 400, y: 450 },
          { name: 'HR-PC1', type: 'pc', x: 600, y: 450 },
          { name: 'Server', type: 'server', x: 400, y: 50 }
        ],
        connections: [],
        vlans: [
          { id: 10, name: 'Sales' },
          { id: 20, name: 'IT' },
          { id: 30, name: 'HR' },
          { id: 100, name: 'Servers' }
        ]
      },
      configuration: {
        'Core-Router': {
          ipAddresses: {
            'eth0.10': '192.168.10.1/24',
            'eth0.20': '192.168.20.1/24',
            'eth0.30': '192.168.30.1/24',
            'eth0.100': '192.168.100.1/24'
          }
        },
        'Main-Switch': {
          vlans: [10, 20, 30, 100],
          trunkPorts: ['port24'],
          accessPorts: {
            'port1': 10,   // Sales
            'port9': 20,   // IT
            'port17': 30,  // HR
            'port23': 100  // Servers
          }
        }
      }
    }
  ];

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-2">Choose Your Network Type</h3>
        <p className="text-gray-600">Select a template that matches your learning goals</p>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {templates.map(template => (
          <div
            key={template.id}
            className="border-2 border-gray-200 rounded-lg p-4 hover:border-blue-400 hover:shadow-md transition-all cursor-pointer"
            onClick={() => onSelect(template)}
          >
            <div className="flex justify-between items-start mb-3">
              <h4 className="font-semibold text-gray-800">{template.name}</h4>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                template.difficulty === 'beginner' ? 'bg-green-100 text-green-800' :
                template.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {template.difficulty}
              </span>
            </div>
            
            <p className="text-gray-600 text-sm mb-3">{template.description}</p>
            
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-gray-500">Devices:</span>
                <span className="text-gray-700">{template.topology.devices.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">VLANs:</span>
                <span className="text-gray-700">{template.topology.vlans.length}</span>
              </div>
            </div>
            
            <div className="mt-3 pt-3 border-t">
              <div className="flex flex-wrap gap-1">
                {template.topology.vlans.map(vlan => (
                  <div
                    key={vlan.id}
                    className="flex items-center space-x-1 text-xs"
                  >
                    <div
                      className="w-2 h-2 rounded"
                      style={{ backgroundColor: getVlanColor(vlan.id) }}
                    />
                    <span className="text-gray-600">VLAN {vlan.id}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Step 2: VLAN Configuration
 */
const VlanConfigStep: React.FC<{
  template: NetworkTemplate;
  onUpdate: (vlans: TemplateVlan[]) => void;
}> = ({ template, onUpdate }) => {
  const [vlans, setVlans] = useState<TemplateVlan[]>(template.topology.vlans);
  const [newVlan, setNewVlan] = useState({ id: '', name: '' });

  useEffect(() => {
    onUpdate(vlans);
  }, [vlans, onUpdate]);

  const addVlan = () => {
    if (newVlan.id && newVlan.name) {
      const vlanId = parseInt(newVlan.id);
      if (vlanId >= 1 && vlanId <= 4094 && !vlans.find(v => v.id === vlanId)) {
        setVlans([...vlans, { id: vlanId, name: newVlan.name }]);
        setNewVlan({ id: '', name: '' });
      }
    }
  };

  const removeVlan = (vlanId: number) => {
    setVlans(vlans.filter(v => v.id !== vlanId));
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-2">Configure VLANs</h3>
        <p className="text-gray-600">Define the VLANs for your network segmentation</p>
      </div>
      
      {/* Current VLANs */}
      <div>
        <h4 className="font-medium text-gray-700 mb-3">Current VLANs</h4>
        <div className="space-y-2">
          {vlans.map(vlan => (
            <div
              key={vlan.id}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center space-x-3">
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: getVlanColor(vlan.id) }}
                />
                <span className="font-medium">VLAN {vlan.id}</span>
                <span className="text-gray-600">{vlan.name}</span>
              </div>
              
              <button
                onClick={() => removeVlan(vlan.id)}
                className="text-red-600 hover:text-red-800 text-sm"
                disabled={template.topology.vlans.some(tv => tv.id === vlan.id)}
              >
                {template.topology.vlans.some(tv => tv.id === vlan.id) ? '🔒' : '🗑️'}
              </button>
            </div>
          ))}
        </div>
      </div>
      
      {/* Add New VLAN */}
      <div>
        <h4 className="font-medium text-gray-700 mb-3">Add New VLAN</h4>
        <div className="flex gap-3">
          <input
            type="number"
            placeholder="VLAN ID (1-4094)"
            value={newVlan.id}
            onChange={(e) => setNewVlan({ ...newVlan, id: e.target.value })}
            className="border rounded px-3 py-2 w-32"
            min={1}
            max={4094}
          />
          <input
            type="text"
            placeholder="VLAN Name"
            value={newVlan.name}
            onChange={(e) => setNewVlan({ ...newVlan, name: e.target.value })}
            className="border rounded px-3 py-2 flex-1"
          />
          <button
            onClick={addVlan}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Add VLAN
          </button>
        </div>
      </div>
      
      {/* VLAN Best Practices */}
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
        <h4 className="font-medium text-blue-800 mb-2">💡 VLAN Best Practices</h4>
        <ul className="text-blue-700 text-sm space-y-1">
          <li>• Use VLAN IDs consistently across all switches</li>
          <li>• Choose descriptive names that reflect the purpose</li>
          <li>• Reserve VLAN 1 for management (don't use for users)</li>
          <li>• Consider VLAN ranges: 10-99 for users, 100+ for services</li>
          <li>• Document your VLAN assignments</li>
        </ul>
      </div>
    </div>
  );
};

/**
 * Step 3: Port Assignment
 */
const PortAssignmentStep: React.FC<{
  template: NetworkTemplate;
  vlans: TemplateVlan[];
  onUpdate: (assignments: any) => void;
}> = ({ template, vlans, onUpdate }) => {
  const [assignments, setAssignments] = useState<any>(template.configuration);
  const [selectedSwitch, setSelectedSwitch] = useState<string>('');

  useEffect(() => {
    const switches = template.topology.devices.filter(d => d.type === 'switch');
    if (switches.length > 0 && !selectedSwitch) {
      setSelectedSwitch(switches[0].name || switches[0].id || '');
    }
  }, [template]);

  useEffect(() => {
    onUpdate(assignments);
  }, [assignments, onUpdate]);

  const switches = template.topology.devices.filter(d => d.type === 'switch');
  const currentSwitchConfig = assignments[selectedSwitch] || {};

  const updatePortAssignment = (port: string, vlanId: number, mode: 'access' | 'trunk') => {
    setAssignments((prev: any) => ({
      ...prev,
      [selectedSwitch]: {
        ...prev[selectedSwitch],
        accessPorts: mode === 'access' ? {
          ...prev[selectedSwitch]?.accessPorts,
          [port]: vlanId
        } : prev[selectedSwitch]?.accessPorts,
        trunkPorts: mode === 'trunk' ? [
          ...(prev[selectedSwitch]?.trunkPorts || []),
          port
        ] : (prev[selectedSwitch]?.trunkPorts || []).filter((p: any) => p !== port)
      }
    }));
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-2">Port Assignment</h3>
        <p className="text-gray-600">Configure which VLANs are assigned to each switch port</p>
      </div>
      
      {/* Switch Selection */}
      {switches.length > 1 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Switch to Configure
          </label>
          <select
            value={selectedSwitch}
            onChange={(e) => setSelectedSwitch(e.target.value)}
            className="border rounded px-3 py-2 w-full"
          >
            {switches.map(sw => (
              <option key={sw.name || sw.id} value={sw.name || sw.id}>
                {sw.name || sw.id}
              </option>
            ))}
          </select>
        </div>
      )}
      
      {/* Port Configuration Grid */}
      <div>
        <h4 className="font-medium text-gray-700 mb-3">Port Configuration - {selectedSwitch}</h4>
        <div className="grid grid-cols-4 gap-2 mb-4">
          {Array.from({ length: 24 }, (_, i) => {
            const port = `port${i + 1}`;
            const assignedVlan = currentSwitchConfig.accessPorts?.[port];
            const isTrunk = currentSwitchConfig.trunkPorts?.includes(port);
            
            return (
              <div
                key={port}
                className={`p-3 rounded border-2 text-center text-sm ${
                  isTrunk ? 'border-purple-400 bg-purple-50' :
                  assignedVlan ? 'border-green-400 bg-green-50' :
                  'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="font-medium">Port {i + 1}</div>
                {isTrunk && <div className="text-purple-600 text-xs">Trunk</div>}
                {assignedVlan && (
                  <div className="flex items-center justify-center mt-1">
                    <div
                      className="w-3 h-3 rounded mr-1"
                      style={{ backgroundColor: getVlanColor(assignedVlan) }}
                    />
                    <span className="text-xs">VLAN {assignedVlan}</span>
                  </div>
                )}
                
                <select
                  value={isTrunk ? 'trunk' : assignedVlan || 'unassigned'}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === 'trunk') {
                      updatePortAssignment(port, 0, 'trunk');
                    } else if (value === 'unassigned') {
                      // Remove assignment
                      setAssignments((prev: any) => {
                        const newPrev = {
                          ...prev,
                          [selectedSwitch]: {
                            ...prev[selectedSwitch],
                            accessPorts: {
                              ...prev[selectedSwitch]?.accessPorts
                            },
                            trunkPorts: (prev[selectedSwitch]?.trunkPorts || []).filter((p: any) => p !== port)
                          }
                        };
                        if (newPrev[selectedSwitch]?.accessPorts?.[port]) {
                          delete newPrev[selectedSwitch].accessPorts[port];
                        }
                        return newPrev;
                      });
                    } else {
                      updatePortAssignment(port, parseInt(value), 'access');
                    }
                  }}
                  className="mt-1 text-xs border rounded px-1 py-0.5 w-full"
                >
                  <option value="unassigned">Unassigned</option>
                  <option value="trunk">Trunk</option>
                  {vlans.map(vlan => (
                    <option key={vlan.id} value={vlan.id}>VLAN {vlan.id}</option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Legend */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <h4 className="font-medium text-gray-700 mb-3">Port Types</h4>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 border-2 border-green-400 bg-green-50 rounded"></div>
            <span>Access Port - Assigned to specific VLAN</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 border-2 border-purple-400 bg-purple-50 rounded"></div>
            <span>Trunk Port - Carries multiple VLANs</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 border-2 border-gray-200 bg-gray-50 rounded"></div>
            <span>Unassigned Port</span>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Step 4: Review and Deploy
 */
const ReviewStep: React.FC<{
  template: NetworkTemplate;
  vlans: TemplateVlan[];
  assignments: any;
  onDeploy: () => void;
}> = ({ template, vlans, assignments, onDeploy }) => {
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h3 className="text-xl font-semibold text-gray-800 mb-2">Review Configuration</h3>
        <p className="text-gray-600">Review your network configuration before deployment</p>
      </div>
      
      {/* Configuration Summary */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Network Overview */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="font-semibold text-gray-800 mb-3">📊 Network Overview</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Template:</span>
              <span className="font-medium">{template.name}</span>
            </div>
            <div className="flex justify-between">
              <span>Devices:</span>
              <span>{template.topology.devices.length}</span>
            </div>
            <div className="flex justify-between">
              <span>VLANs:</span>
              <span>{vlans.length}</span>
            </div>
            <div className="flex justify-between">
              <span>Difficulty:</span>
              <span className={`px-2 py-1 rounded text-xs ${
                template.difficulty === 'beginner' ? 'bg-green-100 text-green-800' :
                template.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {template.difficulty}
              </span>
            </div>
          </div>
        </div>
        
        {/* VLAN Summary */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="font-semibold text-gray-800 mb-3">🎨 VLAN Configuration</h4>
          <div className="space-y-2">
            {vlans.map(vlan => (
              <div key={vlan.id} className="flex items-center space-x-3 text-sm">
                <div
                  className="w-3 h-3 rounded"
                  style={{ backgroundColor: getVlanColor(vlan.id) }}
                />
                <span className="font-medium">VLAN {vlan.id}</span>
                <span className="text-gray-600">{vlan.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Port Assignments per Switch */}
      {Object.entries(assignments).map(([switchName, config]: [string, any]) => (
        <div key={switchName} className="bg-white border border-gray-200 rounded-lg p-4">
          <h4 className="font-semibold text-gray-800 mb-3">🔌 {switchName} Port Assignments</h4>
          
          <div className="grid md:grid-cols-2 gap-4">
            {/* Access Ports */}
            <div>
              <h5 className="font-medium text-gray-700 mb-2">Access Ports</h5>
              <div className="space-y-1 text-sm">
                {Object.entries(config.accessPorts || {}).map(([port, vlanId]: [string, any]) => (
                  <div key={port} className="flex items-center space-x-2">
                    <span className="w-16">{port}:</span>
                    <div
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: getVlanColor(vlanId) }}
                    />
                    <span>VLAN {vlanId} ({vlans.find(v => v.id === vlanId)?.name})</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Trunk Ports */}
            <div>
              <h5 className="font-medium text-gray-700 mb-2">Trunk Ports</h5>
              <div className="space-y-1 text-sm">
                {(config.trunkPorts || []).map((port: string) => (
                  <div key={port} className="flex items-center space-x-2">
                    <span className="w-16">{port}:</span>
                    <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs">
                      Trunk (All VLANs)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}
      
      {/* Deployment Button */}
      <div className="text-center">
        <button
          onClick={onDeploy}
          className="bg-green-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors"
        >
          🚀 Deploy Network Configuration
        </button>
        <p className="text-gray-600 text-sm mt-2">
          This will create the network topology and apply all configurations
        </p>
      </div>
    </div>
  );
};

/**
 * Main VLAN Configuration Wizard
 */
const VlanConfigWizard: React.FC<VlanConfigWizardProps> = ({ isOpen, onClose, onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState<NetworkTemplate | null>(null);
  const [configuredVlans, setConfiguredVlans] = useState<TemplateVlan[]>([]);
  const [portAssignments, setPortAssignments] = useState<any>({});

  const steps = [
    {
      title: 'Network Type',
      component: NetworkPurposeStep
    },
    {
      title: 'VLAN Setup',
      component: VlanConfigStep
    },
    {
      title: 'Port Assignment',
      component: PortAssignmentStep
    },
    {
      title: 'Review & Deploy',
      component: ReviewStep
    }
  ];

  const nextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleDeploy = () => {
    const finalConfig = {
      template: selectedTemplate,
      vlans: configuredVlans,
      assignments: portAssignments
    };
    
    onComplete(finalConfig);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full m-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-800">🧙‍♂️ VLAN Configuration Wizard</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          
          {/* Progress Bar */}
          <div className="mt-4">
            <div className="flex items-center space-x-4">
              {steps.map((step, index) => (
                <div key={index} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    index <= currentStep 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-200 text-gray-500'
                  }`}>
                    {index < currentStep ? '✓' : index + 1}
                  </div>
                  <span className={`ml-2 text-sm ${
                    index <= currentStep ? 'text-blue-600' : 'text-gray-500'
                  }`}>
                    {step.title}
                  </span>
                  {index < steps.length - 1 && (
                    <div className={`w-12 h-0.5 mx-4 ${
                      index < currentStep ? 'bg-blue-600' : 'bg-gray-200'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Content */}
        <div className="px-6 py-6">
          {currentStep === 0 && (
            <NetworkPurposeStep onSelect={(template) => {
              setSelectedTemplate(template);
              setConfiguredVlans(template.topology.vlans);
              setPortAssignments(template.configuration);
              nextStep();
            }} />
          )}
          
          {currentStep === 1 && selectedTemplate && (
            <VlanConfigStep
              template={selectedTemplate}
              onUpdate={setConfiguredVlans}
            />
          )}
          
          {currentStep === 2 && selectedTemplate && (
            <PortAssignmentStep
              template={selectedTemplate}
              vlans={configuredVlans}
              onUpdate={setPortAssignments}
            />
          )}
          
          {currentStep === 3 && selectedTemplate && (
            <ReviewStep
              template={selectedTemplate}
              vlans={configuredVlans}
              assignments={portAssignments}
              onDeploy={handleDeploy}
            />
          )}
        </div>
        
        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4">
          <div className="flex justify-between">
            <button
              onClick={prevStep}
              disabled={currentStep === 0}
              className="px-4 py-2 border border-gray-300 rounded text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
            >
              ← Previous
            </button>
            
            {currentStep < steps.length - 1 && (
              <button
                onClick={nextStep}
                disabled={currentStep === 0 && !selectedTemplate}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VlanConfigWizard;