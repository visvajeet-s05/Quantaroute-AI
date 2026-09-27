/**
 * Experiment Management Data Types
 * QuantaRoute AI — Capstone: Controlled Experiment Workflow
 *
 * Every experiment record is built from actual returned algorithm/run data.
 * Never hard-coded or fabricated.
 */

import { AlgorithmName, QpsoPreset, PsoPreset, RoutePlan, VehicleRoute } from './routing';
import { ScenarioPreset } from './domain';

export type TrafficProfile = 'normal' | 'peak' | 'road_closure_demo';

export type OptimizerPresetName = 'standard' | 'fast' | 'balanced' | 'highQuality';

export type ExperimentRecordType = 'initial_routing' | 'dynamic_rerouting';

export type ExperimentError = {
  error: true;
  message: string;
  runtimeMs?: number;
};

export type InitialRoutingExperimentRecord = {
  id: string;
  timestamp: string;
  experimentGroupId: string;

  runType: 'initial_routing';
  scenarioId: string;
  scenarioName: string;
  scenarioSeed: number;
  trafficProfile: TrafficProfile;

  algorithm: AlgorithmName;
  algorithmLabel: string;

  optimizerPreset: OptimizerPresetName;
  optimizerSeed: number | null;
  populationSize: number | null;
  iterations: number | null;
  candidateEvaluations: number | null;

  runtimeMs: number;
  totalTravelMinutes: number;
  totalDistanceKm: number;
  congestionPenalty: number;
  routingScore: number;

  customersAssigned: number;
  customersUnserved: number;
  customerCount: number;

  vehiclesUsed: number;
  vehicleCapacityTotal: number;
  capacityViolationCount: number;
  duplicateCustomerCount: number;
  blockedEdgeViolationCount: number;
  unreachableVehicleCount: number;

  feasible: boolean;
  warnings: string[];

  convergenceHistory: number[] | null;

  routePlan?: RoutePlan;

  error?: ExperimentError;
};

export type DynamicReroutingExperimentRecord = {
  id: string;
  timestamp: string;
  experimentGroupId: string;

  runType: 'dynamic_rerouting';
  scenarioId: string;
  scenarioName: string;
  scenarioSeed: number;

  initialAlgorithm: AlgorithmName;
  initialAlgorithmLabel: string;
  initialPreset: string;

  reroutingAlgorithm: AlgorithmName;
  reroutingAlgorithmLabel: string;
  reroutingPreset: OptimizerPresetName;
  optimizerSeed: number | null;

  incidentType: 'road_closure' | 'congestion_surge';
  incidentId: string;
  incidentEdgeIds: string[];
  incidentSeverity: number;
  affectedVehicleIds: string[];

  completedCustomerCount: number;
  lockedCustomerCount: number;
  pendingCustomerCount: number;
  eligibleCustomerIds: string[];

  reroutingRuntimeMs: number;
  populationSize: number | null;
  iterations: number | null;
  candidateEvaluations: number | null;

  originalRemainingTravelMinutes: number | null;
  incidentAdjustedRemainingTravelMinutes: number | null;
  revisedRemainingTravelMinutes: number | null;
  delayAvoidedMinutes: number | null;
  routeStabilityChanges: number;

  revisedRoutingScore: number | null;
  revisedCustomersAssigned: number;
  revisedCustomersUnserved: number;
  revisedFeasible: boolean;

  warnings: string[];

  error?: ExperimentError;
};

export type ExperimentRecord =
  | InitialRoutingExperimentRecord
  | DynamicReroutingExperimentRecord;

export type BenchmarkPreset = {
  id: string;
  label: string;
  description: string;
  scenarioPreset: ScenarioPreset;
  trafficProfile: TrafficProfile;
  scenarioSeed: number;
  optimizerSeed: number;
  includeGreedy: boolean;
  includePso: boolean;
  includeQpso: boolean;
  psoPreset: PsoPreset;
  qpsoPreset: QpsoPreset;
  isDynamicDemo: boolean;
};

export type ExperimentHistory = ExperimentRecord[];

export type ExperimentGroupResult = {
  groupId: string;
  presetId: string;
  label: string;
  startedAt: string;
  completedAt: string;
  totalRuntimeMs: number;
  totalRecords: number;
  feasibleCount: number;
  infeasibleCount: number;
  errorCount: number;
  records: ExperimentRecord[];
};

export type ExportFormat = 'csv' | 'json';

export type ExperimentRunProgress = {
  step: string;
  stepIndex: number;
  totalSteps: number;
  isRunning: boolean;
  groupId: string | null;
  error: string | null;
};

export interface ExperimentManagerState {
  history: ExperimentHistory;
  isRunning: boolean;
  currentStep: string;
  currentStepIndex: number;
  totalSteps: number;
  groupId: string | null;
  error: string | null;
}

export interface ExperimentUnitTestResult {
  id: string;
  name: string;
  passed: boolean;
  runtimeMs: number;
  summary: string;
  details: string;
}
