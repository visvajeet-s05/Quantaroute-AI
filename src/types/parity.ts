/**
 * Frontend/Backend Parity Export Types
 * QuantaRoute AI — TypeScript interfaces for genuine frontend-to-backend metric parity.
 * These types match the backend's ParityComparisonResponse and adapter expectations exactly.
 */

import { Scenario } from './domain';
import { RoutePlan, VehicleRoute, RoutingContext, AlgorithmName, RoutingMode } from './routing';

/**
 * Frontend parity metadata — must match backend FrontendParityMetadataSchema exactly
 */
export type FrontendParityMetadata = {
  /** Must be exactly "QuantaRoute AI Frontend" for sourceVerified=true */
  source: 'QuantaRoute AI Frontend';
  /** Must be exactly "frontend_backend_parity" for sourceVerified=true */
  exportKind: 'frontend_backend_parity';
  /** ISO 8601 datetime of export */
  exportedAt: string;
  /** Scenario seed used for generation (e.g., 26137) */
  scenarioSeed: number;
  /** Algorithm that produced the route plan */
  algorithm: AlgorithmName;
  /** Optimizer preset name (e.g., "standard", "balanced", "highQuality") */
  preset: string | null;
  /** Optimizer seed (e.g., 26137) */
  optimizerSeed: number | null;
  /** Frontend application version (optional) */
  appVersion: string | null;
  /** Set to true only for genuine exports from QuantaRoute AI Frontend */
  sourceVerified: true;
};

/**
 * Frontend evaluation metrics — must match backend FrontendEvaluationSchema exactly
 */
export type FrontendParityEvaluation = {
  /** Total traffic-adjusted travel time across all vehicle routes (minutes) */
  totalTravelMinutes: number;
  /** Total physical route distance (km) */
  totalDistanceKm: number;
  /** Total congestion penalty (minutes) */
  totalCongestionPenalty: number;
  /** Standardized routing score F = 0.55*T + 0.25*D + 0.20*C + 10000*P */
  routingScore: number;
  /** Total penalty from violations P */
  penaltyTotal: number;
  /** Number of customers assigned in the plan */
  customersAssigned: number;
  /** Number of customers not assigned in the plan */
  customersUnserved: number;
  /** IDs of unserved customers */
  unservedCustomerIds: string[];
  /** IDs of duplicate customer assignments */
  duplicateCustomerIds: string[];
  /** Vehicle IDs with capacity violations */
  capacityViolationVehicleIds: string[];
  /** Edge IDs that are blocked and were traversed */
  blockedEdgeViolationIds: string[];
  /** Vehicle IDs with unreachable routes */
  unreachableVehicleIds: string[];
  /** Vehicle IDs with path continuity violations */
  pathContinuityViolationVehicleIds: string[];
  /** Whether the plan is feasible (penaltyTotal === 0) */
  feasible: boolean;
  /** Warning messages from evaluator/validator */
  warnings: string[];
};

/**
 * Complete frontend parity export package — root object for POST /api/v1/parity/compare
 */
export type FrontendBackendParityExport = {
  metadata: FrontendParityMetadata;
  scenario: Scenario;
  routePlan: RoutePlan;
  frontendEvaluation: FrontendParityEvaluation;
};

/**
 * Result of local export validation checks
 */
export type ParityExportValidationResult = {
  /** All checks passed */
  passed: boolean;
  /** Individual check results */
  checks: Array<{
    name: string;
    passed: boolean;
    message?: string;
  }>;
};

/**
 * Options for building a parity export from a completed experiment record
 */
export type BuildParityExportOptions = {
  /** The experiment record containing the route plan and evaluation */
  experimentRecord: {
    id: string;
    timestamp: string;
    experimentGroupId: string;
    runType: 'initial_routing';
    scenarioId: string;
    scenarioName: string;
    scenarioSeed: number;
    trafficProfile: string;
    algorithm: AlgorithmName;
    algorithmLabel: string;
    optimizerPreset: string;
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
    error?: { error: true; message: string; runtimeMs?: number };
  };
  /** The scenario used for this experiment */
  scenario: Scenario;
  /** Frontend application version */
  appVersion?: string;
};

/**
 * Check if a parity export can be built from the given data
 */
export function canBuildParityExport(
  experimentRecord: BuildParityExportOptions['experimentRecord'],
  scenario: Scenario | null
): { canExport: boolean; missing: string[] } {
  const missing: string[] = [];
  
  if (!experimentRecord) missing.push('Experiment record');
  if (!scenario) missing.push('Scenario');
  if (experimentRecord?.runType !== 'initial_routing') missing.push('Initial routing experiment (not dynamic re-routing)');
  if (!experimentRecord?.routePlan) missing.push('RoutePlan in experiment record');
  if (experimentRecord?.feasible === undefined) missing.push('Feasibility result');
  if (experimentRecord?.routingScore === undefined) missing.push('Routing score');
  
  return {
    canExport: missing.length === 0,
    missing
  };
}