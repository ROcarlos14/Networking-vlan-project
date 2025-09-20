import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store';
import { Device, Connection, VlanConfig } from '../../types';

/**
 * Learning Mode Types
 */
export enum LearningMode {
  TUTORIAL = 'tutorial',
  GUIDED = 'guided',
  SANDBOX = 'sandbox',
  ASSESSMENT = 'assessment'
}

/**
 * Tutorial Step
 */
export interface TutorialStep {
  id: string;
  title: string;
  description: string;
  objective: string;
  instructions: string[];
  expectedConfig: any;
  hints: string[];
  validation: (devices: Device[], connections: Connection[]) => {
    success: boolean;
    message: string;
    suggestions?: string[];
  };
}

/**
 * Learning Scenario
 */
export interface LearningScenario {
  id: string;
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedTime: number; // minutes
  learningObjectives: string[];
  prerequisites: string[];
  steps: TutorialStep[];
  initialTopology: {
    devices: Device[];
    connections: Connection[];
  };
}

/**
 * VLAN Color Scheme for Visual Learning
 */
export const VLAN_COLORS = {
  1: '#6B7280',    // Default VLAN - Gray
  10: '#EF4444',   // Sales - Red
  20: '#3B82F6',   // IT - Blue
  30: '#10B981',   // HR - Green
  40: '#F59E0B',   // Marketing - Orange
  50: '#8B5CF6',   // Finance - Purple
  100: '#EC4899',  // Guest - Pink
  200: '#14B8A6',  // Management - Teal
  999: '#F97316'   // Native/Management - Orange-Red
};

/**
 * Interactive VLAN Learning Interface
 */
const VlanLearningInterface: React.FC = () => {
  const { devices, connections, vlans, currentView, setCurrentView } = useAppStore();
  const [learningMode, setLearningMode] = useState<LearningMode>(LearningMode.TUTORIAL);
  const [currentScenario, setCurrentScenario] = useState<LearningScenario | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [showHints, setShowHints] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [selectedVlan, setSelectedVlan] = useState<number>(1);

  // Available learning scenarios
  const scenarios: LearningScenario[] = [
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
        'Test VLAN isolation'
      ],
      prerequisites: ['Basic networking knowledge'],
      steps: [
        {
          id: 'create-vlans',
          title: 'Create VLANs',
          description: 'Create VLANs for different departments',
          objective: 'Create VLAN 10 (Sales), VLAN 20 (IT), and VLAN 30 (HR)',
          instructions: [
            'Go to the VLAN Configuration panel',
            'Create VLAN 10 with name "Sales"',
            'Create VLAN 20 with name "IT"',
            'Create VLAN 30 with name "HR"'
          ],
          expectedConfig: {
            vlans: [
              { id: 10, name: 'Sales' },
              { id: 20, name: 'IT' },
              { id: 30, name: 'HR' }
            ]
          },
          hints: [
            'VLANs are virtual LANs that segment broadcast domains',
            'Each VLAN needs a unique ID between 1-4094',
            'Use descriptive names to identify VLAN purposes'
          ],
          validation: (devices, connections) => {
            const switch1 = devices.find(d => d.type === 'switch');
            if (!switch1) return { success: false, message: 'No switch found' };
            
            const hasVlan10 = vlans.some(v => v.id === 10 && v.name === 'Sales');
            const hasVlan20 = vlans.some(v => v.id === 20 && v.name === 'IT');
            const hasVlan30 = vlans.some(v => v.id === 30 && v.name === 'HR');
            
            if (hasVlan10 && hasVlan20 && hasVlan30) {
              return { success: true, message: 'Excellent! All VLANs created successfully.' };
            }
            
            return { 
              success: false, 
              message: 'Missing VLANs. Please create all required VLANs.',
              suggestions: [
                !hasVlan10 ? 'Create VLAN 10 (Sales)' : '',
                !hasVlan20 ? 'Create VLAN 20 (IT)' : '',
                !hasVlan30 ? 'Create VLAN 30 (HR)' : ''
              ].filter(Boolean)
            };
          }
        },
        {
          id: 'assign-ports',
          title: 'Assign Ports to VLANs',
          description: 'Configure switch ports for different VLANs',
          objective: 'Assign ports to appropriate VLANs based on department needs',
          instructions: [
            'Select the switch device',
            'Configure port 1-8 for VLAN 10 (Sales)',
            'Configure port 9-16 for VLAN 20 (IT)',
            'Configure port 17-24 for VLAN 30 (HR)',
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
            'Devices connected to access ports don\'t need to be VLAN-aware',
            'Plan port assignments based on physical location'
          ],
          validation: (devices, connections) => {
            // This would check port VLAN assignments
            return { success: true, message: 'Port assignments completed!' };
          }
        }
      ],
      initialTopology: {
        devices: [
          {
            id: 'sw1',
            name: 'Switch1',
            type: 'switch',
            x: 400,
            y: 300,
            config: { ports: 24 }
          },
          {
            id: 'pc1',
            name: 'Sales-PC1',
            type: 'pc',
            x: 200,
            y: 200,
            config: { vlan: 10 }
          },
          {
            id: 'pc2',
            name: 'IT-PC1',
            type: 'pc',
            x: 600,
            y: 200,
            config: { vlan: 20 }
          },
          {
            id: 'pc3',
            name: 'HR-PC1',
            type: 'pc',
            x: 400,
            y: 100,
            config: { vlan: 30 }
          }
        ],
        connections: [
          {
            id: 'conn1',
            from: 'pc1',
            to: 'sw1',
            fromInterface: 'eth0',
            toInterface: 'port1'
          },
          {
            id: 'conn2',
            from: 'pc2',
            to: 'sw1',
            fromInterface: 'eth0',
            toInterface: 'port9'
          },
          {
            id: 'conn3',
            from: 'pc3',
            to: 'sw1',
            fromInterface: 'eth0',
            toInterface: 'port17'
          }
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
        'Understand VLAN tagging (802.1Q)',
        'Configure native VLAN'
      ],
      prerequisites: ['Basic VLAN Configuration'],
      steps: [], // Would be populated with trunk-specific steps
      initialTopology: {
        devices: [],
        connections: []
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
        'Configure sub-interfaces',
        'Test connectivity between VLANs'
      ],
      prerequisites: ['Basic VLAN Configuration', 'VLAN Trunking'],
      steps: [], // Would be populated with routing-specific steps
      initialTopology: {
        devices: [],
        connections: []
      }
    }
  ];

  /**
   * Start a learning scenario
   */
  const startScenario = (scenario: LearningScenario) => {
    setCurrentScenario(scenario);
    setCurrentStep(0);
    setCompletedSteps([]);
    setValidationResult(null);
    setShowHints(false);
    
    // Load initial topology
    // This would integrate with your store to load the scenario topology
    console.log('Loading scenario:', scenario.title);
  };

  /**
   * Validate current step
   */
  const validateStep = () => {
    if (!currentScenario) return;
    
    const step = currentScenario.steps[currentStep];
    if (!step) return;
    
    const result = step.validation(devices, connections);
    setValidationResult(result);
    
    if (result.success && !completedSteps.includes(step.id)) {
      setCompletedSteps([...completedSteps, step.id]);
    }
  };

  /**
   * Move to next step
   */
  const nextStep = () => {
    if (!currentScenario) return;
    
    if (currentStep < currentScenario.steps.length - 1) {
      setCurrentStep(currentStep + 1);
      setValidationResult(null);
      setShowHints(false);
    }
  };

  /**
   * Get VLAN color for visualization
   */
  const getVlanColor = (vlanId: number): string => {
    return VLAN_COLORS[vlanId] || '#6B7280';
  };

  /**
   * Render scenario selection
   */
  const renderScenarioSelection = () => (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-4 text-gray-800">VLAN Learning Scenarios</h2>
      <p className="text-gray-600 mb-6">
        Choose a scenario to start your VLAN learning journey. Each scenario builds upon previous concepts.
      </p>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {scenarios.map((scenario) => (
          <div
            key={scenario.id}
            className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => startScenario(scenario)}
          >
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-semibold text-lg text-gray-800">{scenario.title}</h3>
              <span
                className={`px-2 py-1 rounded text-xs font-medium ${
                  scenario.difficulty === 'beginner'
                    ? 'bg-green-100 text-green-800'
                    : scenario.difficulty === 'intermediate'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {scenario.difficulty}
              </span>
            </div>
            
            <p className="text-gray-600 text-sm mb-3">{scenario.description}</p>
            
            <div className="flex justify-between items-center text-sm text-gray-500">
              <span>⏱️ {scenario.estimatedTime} minutes</span>
              <span>📚 {scenario.steps.length} steps</span>
            </div>
            
            <div className="mt-3">
              <h4 className="text-sm font-medium text-gray-700 mb-1">Learning Objectives:</h4>
              <ul className="text-xs text-gray-600">
                {scenario.learningObjectives.slice(0, 2).map((objective, index) => (
                  <li key={index}>• {objective}</li>
                ))}
                {scenario.learningObjectives.length > 2 && (
                  <li>• ... and {scenario.learningObjectives.length - 2} more</li>
                )}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  /**
   * Render current step interface
   */
  const renderStepInterface = () => {
    if (!currentScenario) return null;
    
    const step = currentScenario.steps[currentStep];
    if (!step) return null;
    
    return (
      <div className="p-6 bg-white rounded-lg shadow-lg">
        <div className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-xl font-bold text-gray-800">{currentScenario.title}</h2>
            <span className="text-sm text-gray-500">
              Step {currentStep + 1} of {currentScenario.steps.length}
            </span>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentStep + 1) / currentScenario.steps.length) * 100}%` }}
            ></div>
          </div>
        </div>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold mb-2 text-gray-800">{step.title}</h3>
            <p className="text-gray-600 mb-4">{step.description}</p>
            
            <div className="mb-4">
              <h4 className="font-medium text-gray-700 mb-2">📋 Objective:</h4>
              <p className="text-gray-600 text-sm bg-blue-50 p-3 rounded">{step.objective}</p>
            </div>
            
            <div className="mb-4">
              <h4 className="font-medium text-gray-700 mb-2">📝 Instructions:</h4>
              <ol className="text-sm text-gray-600 space-y-1">
                {step.instructions.map((instruction, index) => (
                  <li key={index} className="flex items-start">
                    <span className="font-medium text-blue-600 mr-2">{index + 1}.</span>
                    {instruction}
                  </li>
                ))}
              </ol>
            </div>
            
            {showHints && (
              <div className="mb-4">
                <h4 className="font-medium text-gray-700 mb-2">💡 Hints:</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  {step.hints.map((hint, index) => (
                    <li key={index} className="flex items-start">
                      <span className="text-yellow-500 mr-2">💡</span>
                      {hint}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="flex gap-2 mb-4">
              <button
                onClick={validateStep}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 transition-colors"
              >
                ✅ Check Progress
              </button>
              
              <button
                onClick={() => setShowHints(!showHints)}
                className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700 transition-colors"
              >
                💡 {showHints ? 'Hide' : 'Show'} Hints
              </button>
              
              {validationResult?.success && (
                <button
                  onClick={nextStep}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
                  disabled={currentStep >= currentScenario.steps.length - 1}
                >
                  ➡️ Next Step
                </button>
              )}
            </div>
            
            {validationResult && (
              <div className={`p-3 rounded ${
                validationResult.success 
                  ? 'bg-green-50 border-l-4 border-green-400' 
                  : 'bg-red-50 border-l-4 border-red-400'
              }`}>
                <p className={`font-medium ${
                  validationResult.success ? 'text-green-800' : 'text-red-800'
                }`}>
                  {validationResult.message}
                </p>
                
                {validationResult.suggestions && validationResult.suggestions.length > 0 && (
                  <ul className="mt-2 text-sm text-red-700">
                    {validationResult.suggestions.map((suggestion, index) => (
                      <li key={index}>• {suggestion}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          
          <div>
            <h4 className="font-medium text-gray-700 mb-3">🎨 VLAN Visualization</h4>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="grid grid-cols-2 gap-2 mb-4">
                {Object.entries(VLAN_COLORS).slice(1, 7).map(([vlanId, color]) => (
                  <div key={vlanId} className="flex items-center space-x-2">
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: color }}
                    ></div>
                    <span className="text-sm text-gray-600">
                      VLAN {vlanId}
                      {vlanId === '10' && ' (Sales)'}
                      {vlanId === '20' && ' (IT)'}
                      {vlanId === '30' && ' (HR)'}
                      {vlanId === '40' && ' (Marketing)'}
                      {vlanId === '50' && ' (Finance)'}
                      {vlanId === '100' && ' (Guest)'}
                    </span>
                  </div>
                ))}
              </div>
              
              <div className="text-xs text-gray-500">
                💡 Different colors represent different VLANs in the network topology
              </div>
            </div>
            
            <div className="mt-4">
              <h4 className="font-medium text-gray-700 mb-2">📊 Progress</h4>
              <div className="space-y-2">
                {currentScenario.steps.map((s, index) => (
                  <div
                    key={s.id}
                    className={`flex items-center space-x-2 text-sm ${
                      completedSteps.includes(s.id)
                        ? 'text-green-600'
                        : index === currentStep
                        ? 'text-blue-600 font-medium'
                        : 'text-gray-400'
                    }`}
                  >
                    <span>
                      {completedSteps.includes(s.id) ? '✅' : 
                       index === currentStep ? '🔄' : '⭕'}
                    </span>
                    <span>{s.title}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  /**
   * Main render
   */
  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🎓 VLAN Learning Center
          </h1>
          <p className="text-gray-600">
            Master VLAN concepts through interactive scenarios and hands-on practice
          </p>
        </div>
        
        {!currentScenario && renderScenarioSelection()}
        {currentScenario && (
          <div>
            <div className="mb-4">
              <button
                onClick={() => {
                  setCurrentScenario(null);
                  setCurrentStep(0);
                  setCompletedSteps([]);
                  setValidationResult(null);
                }}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                ← Back to Scenarios
              </button>
            </div>
            {renderStepInterface()}
          </div>
        )}
      </div>
    </div>
  );
};

export default VlanLearningInterface;