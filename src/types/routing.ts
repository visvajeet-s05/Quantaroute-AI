/**
 * Routing domain models for QuantaRoute AI
 * Shared between Greedy, Classical PSO, and QPSO.
 */

export type AlgorithmName = 'greedy' | 'pso' | 'qpso';

export type VehicleRoute = {
  vehicleId: string;
  vehicleLabel: string;
  customerIds: string[];
  stopNodeIds: string[];
  fullPathNodeIds: string[];
  fullPathEdgeIds: string[];
  travelMinutes: number;
  distanceKm: number;
  congestionPenalty: number;
  usedCapacity: number;
  remainingCapacity: number;
  startsAtDepot: boolean;
  endsAtDepot: boolean;
  reachable: boolean;
  feasible: boolean;
  warnings: string[];
  /** Non-depot start node for dynamic re-routes (undefined = depot start). */
  startNodeId?: string;
  /** Explicit end node for dynamic re-routes (undefined = depot end). */
  endNodeId?: string;
  /** Customers already served and locked before this route segment. */
  completedCustomerIds?: string[];
  /** Pending (not-yet-served) customers remaining in this route. */
  pendingCustomerIds?: string[];
  /** True when this route was produced by a dynamic re-routing pass. */
  isDynamicReroute?: boolean;
  /** Vehicle's current node at the start of re-routing (captured for validation). */
  initialVehicleCurrentNodeId?: string;
};

export type RoutePlan = {
  algorithm: AlgorithmName;
  scenarioId: string;
  seed: number;
  depotNodeId: string;
  vehicleRoutes: VehicleRoute[];
  totalTravelMinutes: number;
  totalDistanceKm: number;
  congestionPenalty: number;
  routingScore: number;
  customersServed: number;
  customerCount: number;
  unservedCustomerIds: string[];
  duplicateCustomerIds: string[];
  capacityViolationVehicleIds: string[];
  blockedEdgeViolationIds: string[];
  unreachableVehicleIds: string[];
  isFeasible: boolean;
  warnings: string[];
  runtimeMs: number;
};

export type RoutePlanValidationResult = {
  valid: boolean;
  capacityCompliant: boolean;
  customerCoverageComplete: boolean;
  noDuplicateCustomerService: boolean;
  allRoutesStartAtDepot: boolean;
  allRoutesEndAtDepot: boolean;
  noBlockedEdgesUsed: boolean;
  allRoutePathsReachable: boolean;
  errors: string[];
  warnings: string[];
};

export type GreedyRoutingOptions = {
  returnToDepot: boolean;
  useTravelTimeForNearestCustomer: boolean;
};

export interface GreedyUnitTestResult {
  id: string;
  name: string;
  passed: boolean;
  runtimeMs: number;
  summary: string;
  details: string[];
}

export type PsoParticle = {
  assignmentKeys: number[];
  priorityKeys: number[];

  assignmentVelocity: number[];
  priorityVelocity: number[];

  currentPlan: RoutePlan;
  currentFitness: number;

  personalBestAssignmentKeys: number[];
  personalBestPriorityKeys: number[];
  personalBestPlan: RoutePlan;
  personalBestFitness: number;
};

export type PsoPreset = 'Fast Re-route' | 'Balanced' | 'High Quality';

export type PsoRunConfig = {
  populationSize: number;
  iterations: number;
  inertiaStart: number;
  inertiaEnd: number;
  cognitiveCoefficient: number;
  socialCoefficient: number;
  seed: number;
  presetName?: PsoPreset;
};

export type PsoRunResult = {
  bestPlan: RoutePlan;
  bestFitness: number;
  convergenceHistory: number[];
  populationSize: number;
  iterationsCompleted: number;
  candidateEvaluations: number;
  runtimeMs: number;
  seed: number;
  validatorResult: RoutePlanValidationResult;
  config: PsoRunConfig;
};

export interface PsoUnitTestResult {
  id: string;
  name: string;
  passed: boolean;
  runtimeMs: number;
  summary: string;
  details: string[];
}

export type QpsoParticle = {
  assignmentKeys: number[];
  priorityKeys: number[];

  currentPlan: RoutePlan;
  currentFitness: number;

  personalBestAssignmentKeys: number[];
  personalBestPriorityKeys: number[];
  personalBestPlan: RoutePlan;
  personalBestFitness: number;
};

export type QpsoPreset = 'Fast Re-route' | 'Balanced' | 'High Quality';

export type QpsoRunConfig = {
  populationSize: number;
  iterations: number;
  betaStart: number;
  betaEnd: number;
  seed: number;
  presetName?: QpsoPreset;
};

export type QpsoRunResult = {
  bestPlan: RoutePlan;
  bestFitness: number;
  convergenceHistory: number[];
  populationSize: number;
  iterationsCompleted: number;
  candidateEvaluations: number;
  runtimeMs: number;
  seed: number;
  betaStart: number;
  betaEnd: number;
  validatorResult: RoutePlanValidationResult;
  config: QpsoRunConfig;
};

export interface QpsoUnitTestResult {
  id?: string;
  name: string;
  passed: boolean;
  runtimeMs?: number;
  details: string;
  summary?: string;
}

// ==========================================
// Dynamic Routing Context
// ==========================================

export type RoutingMode = 'initial' | 'reroute';

export type RoutingContext = {
  mode: RoutingMode;
  depotNodeId: string;
  startNodeByVehicleId: Record<string, string>;
  remainingCapacityByVehicleId: Record<string, number>;
  lockedCustomerIds: string[];
  eligibleCustomerIds: string[];
  graphEdges: import('./domain').Edge[];
};

// ==========================================
// Dynamic Incident Simulation & Re-routing
// ==========================================

export type CustomerExecutionState =
  | 'pending'
  | 'assigned'
  | 'served'
  | 'unserved';

export type VehicleExecutionState =
  | 'awaiting_optimization'
  | 'planned'
  | 'en_route'
  | 'rerouting'
  | 'revised'
  | 'inactive'
  | 'infeasible';

export type VehicleDynamicState = {
  vehicleId: string;
  currentNodeId: string;
  deliveredCustomerIds: string[];
  pendingCustomerIds: string[];
  deliveredDemand: number;
  remainingCapacity: number;
  executionState: VehicleExecutionState;
};

export type IncidentType = 'road_closure' | 'congestion_surge';

export type DynamicIncident = {
  id: string;
  type: IncidentType;
  affectedEdgeIds: string[];
  severity: 1 | 2 | 3;
  multiplierBefore: number[];
  multiplierAfter: number[];
  occurredAtStep: number;
  active: boolean;
  affectedVehicleIds: string[];
  description: string;
};

export type RoutePlanSnapshot = {
  id: string;
  timestamp: string;
  label: 'initial_plan' | 'pre_incident' | 'revised_plan';
  scenarioId: string;
  scenarioSeed: number;
  algorithm: AlgorithmName;
  routePlan: RoutePlan;
  trafficState: import('./domain').Edge[];
  vehicleDynamicStates: VehicleDynamicState[];
};

export type ReroutingResult = {
  initialSnapshot: RoutePlanSnapshot;
  preIncidentSnapshot: RoutePlanSnapshot;
  revisedSnapshot: RoutePlanSnapshot | null;
  incident: DynamicIncident;
  reroutingAlgorithm: AlgorithmName;
  reroutingPreset: QpsoPreset;
  reroutingRuntimeMs: number;
  affectedVehicleIds: string[];
  originalRemainingTravelMinutes: number | null;
  incidentAdjustedRemainingTravelMinutes: number | null;
  revisedRemainingTravelMinutes: number | null;
  delayAvoidedMinutes: number | null;
  routeStabilityChanges: number;
  warnings: string[];
  /** Count of served/locked customers that remain excluded from the revised plan. */
  lockedCustomerCount: number;
  /** IDs of all customers considered eligible for the revised plan (pending + unserved). */
  eligibleCustomerIds: string[];
  /** Population size of the re-routing optimizer. */
  populationSize: number;
  /** Iteration count of the re-routing optimizer. */
  iterations: number;
  /** Total candidate plan evaluations performed during re-routing. */
  candidateEvaluations: number;
  /** Whether the revised route plan passes dynamic validation. */
  revisedFeasible: boolean;
};

export interface ReroutingUnitTestResult {
  id?: string;
  name: string;
  passed: boolean;
  runtimeMs?: number;
  details: string;
  summary?: string;
}
