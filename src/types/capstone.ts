/**
 * Capstone-specific types for the Guided Capstone Demo and supporting panels.
 * These types are for presentation/assessment orchestration only and do not
 * duplicate or alter any core algorithm logic.
 */

import { Scenario, ScenarioPreset, Vehicle, Customer, Edge, Node } from './domain';
import { QpsoPreset, PsoPreset, AlgorithmName, RoutePlan, QpsoRunResult, PsoRunResult, ReroutingResult, VehicleDynamicState, DynamicIncident } from './routing';
import { ExperimentRecord, ExperimentHistory } from './experiments';

export type { Scenario, ScenarioPreset, Vehicle, Customer, Edge, Node };
export type { QpsoPreset, PsoPreset, AlgorithmName, RoutePlan, QpsoRunResult, PsoRunResult, ReroutingResult, VehicleDynamicState, DynamicIncident };
export type { ExperimentRecord, ExperimentHistory };

/** Status for each step of the Guided Capstone Demo. */
export type DemoStepStatus = 'not_started' | 'ready' | 'running' | 'completed' | 'blocked' | 'failed';

/** Result data captured when a demo step completes. */
export type DemoStepResult = {
  [key: string]: unknown;
};

/** State of a single demo step. */
export type DemoStepState = {
  id: string;
  title: string;
  description: string;
  status: DemoStepStatus;
  error: string | null;
  result: DemoStepResult | null;
};

/** Guided Demo configuration matching the spec defaults. */
export type GuidedDemoConfig = {
  scenarioPreset: ScenarioPreset;
  scenarioSeed: number;
  initialAlgorithm: AlgorithmName;
  initialPreset: QpsoPreset;
  initialOptimizerSeed: number;
  stopsCompletedPerVehicle: number;
  incidentType: 'road_closure' | 'congestion_surge';
  incidentSeverity: 1 | 2 | 3;
  reroutingAlgorithm: AlgorithmName;
  reroutingPreset: QpsoPreset;
  reroutingOptimizerSeed: number;
};

/** Result returned by each step execution. */
export type DemoStepOutput = {
  success: boolean;
  error: string | null;
  result: DemoStepResult;
};

/** A manually checkable checklist item with optional note and timestamp. */
export type ChecklistItem = {
  id: string;
  label: string;
  completed: boolean;
  note: string;
  timestamp: string | null;
};

/** A category of checklist items for the readiness panel. */
export type ChecklistCategory = {
  id: string;
  label: string;
  items: ChecklistItem[];
  critical: boolean;
};

/** A single capstone presentation test result. */
export type CapstoneUnitTestResult = {
  id: string;
  name: string;
  passed: boolean;
  runtimeMs: number;
  summary: string;
  details: string;
};

/** The default guided demo configuration per the capstone spec. */
export const DEFAULT_GUIDED_DEMO_CONFIG: GuidedDemoConfig = {
  scenarioPreset: 'normal',
  scenarioSeed: 26137,
  initialAlgorithm: 'qpso',
  initialPreset: 'Balanced',
  initialOptimizerSeed: 26137,
  stopsCompletedPerVehicle: 1,
  incidentType: 'road_closure',
  incidentSeverity: 3,
  reroutingAlgorithm: 'qpso',
  reroutingPreset: 'Fast Re-route',
  reroutingOptimizerSeed: 26137,
};

/** The six steps of the Guided Capstone Demo. */
export const DEMO_STEPS: ReadonlyArray<{
  id: string;
  title: string;
  description: string;
}> = [
  {
    id: 'step-1',
    title: 'Load Deterministic Scenario',
    description: 'Load Normal Traffic scenario with seed 26137. Clear overlays, Dijkstra test state, incident, and reroute results. Do not clear experiment history.',
  },
  {
    id: 'step-2',
    title: 'Generate Initial Fleet Plan',
    description: 'Execute QPSO Balanced initial optimization on the scenario. Capture actual score, travel time, distance, congestion, feasibility, runtime, and convergence.',
  },
  {
    id: 'step-3',
    title: 'Compare Algorithms',
    description: 'Run Greedy, Classical PSO Balanced, and QPSO Balanced on cloned scenario copies. Show compact comparison table.',
  },
  {
    id: 'step-4',
    title: 'Simulate Route Progress',
    description: 'Simulate 1 completed stop per active vehicle. Show locked/served count, pending count, current node, remaining capacity.',
  },
  {
    id: 'step-5',
    title: 'Inject Traffic Incident',
    description: 'Inject guided demo road closure using selectGuidedDemoEdge. Show incident type, edge ID, affected vehicles.',
  },
  {
    id: 'step-6',
    title: 'Re-optimize Pending Deliveries',
    description: 'Execute QPSO Fast Re-route on pending customers. Show runtime, population, iterations, evaluations, feasibility, delay avoided, warnings.',
  },
];

/** The objective formula displayed in methodology and documentation. */
export const OBJECTIVE_FORMULA = 'F = 0.55T + 0.25D + 0.20C + 10000P';
