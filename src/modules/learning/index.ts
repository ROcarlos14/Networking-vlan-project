/**
 * Learning Module - Educational features and tutorials
 * 
 * Handles guided learning, wizards, and interactive tutorials
 */

// Learning components
export { default as VlanLearningInterface } from '../../components/Learning/VlanLearningInterface';
export { default as VlanConfigWizard } from '../../components/Learning/VlanConfigWizard';
export { default as TrafficFlowAnimator } from '../../components/Learning/TrafficFlowAnimator';

// Learning scenarios and data
export * from '../../data/learningScenarios';

// Template helpers
export * from '../../utils/templateHelpers';

// Learning specific types
export type {
  AnimatedPacket,
  FlowConfig
} from '../../components/Learning/TrafficFlowAnimator';

export type {
  NetworkTemplate
} from '../../components/Learning/VlanConfigWizard';