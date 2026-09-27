/**
 * Record builder utilities for the Guided Capstone Demo.
 * Builds ExperimentRecord objects from real algorithm results for persistence.
 * Does NOT duplicate routing logic — only maps fields from existing Result types.
 */

import { Scenario } from '../types/domain';
import { RoutePlan, ReroutingResult, VehicleDynamicState } from '../types/routing';
import {
  InitialRoutingExperimentRecord,
  DynamicReroutingExperimentRecord,
} from '../types/experiments';

function generateRecordId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getAlgorithmLabel(algo: string): string {
  if (algo === 'greedy') return 'Greedy Routing';
  if (algo === 'pso') return 'Classical PSO';
  if (algo === 'qpso') return 'Quantum-Inspired PSO';
  return algo;
}

export function buildCapstoneInitialRecord(
  scenario: Scenario,
  plan: RoutePlan,
  optimizerSeed: number | null,
  presetName: string,
  populationSize: number | null,
  iterations: number | null,
  candidateEvaluations: number | null,
  convergenceHistory: number[] | null,
  groupId: string,
  trafficProfile: string,
  runtimeMs: number
): InitialRoutingExperimentRecord {
  const vehicleCapacityTotal = scenario.vehicles.reduce((sum, v) => sum + v.capacity, 0);

  return {
    id: generateRecordId('rec'),
    timestamp: new Date().toISOString(),
    experimentGroupId: groupId,
    runType: 'initial_routing',
    scenarioId: scenario.id || 'scenario-default',
    scenarioName: scenario.name || 'Default Scenario',
    scenarioSeed: scenario.seed,
    trafficProfile: trafficProfile as 'normal' | 'peak' | 'road_closure_demo',
    algorithm: 'qpso',
    algorithmLabel: 'Quantum-Inspired PSO',
    optimizerPreset: presetName === 'Balanced' ? 'balanced' : presetName === 'Fast Re-route' ? 'fast' : 'balanced',
    optimizerSeed,
    populationSize,
    iterations,
    candidateEvaluations,
    runtimeMs,
    totalTravelMinutes: plan.totalTravelMinutes,
    totalDistanceKm: plan.totalDistanceKm,
    congestionPenalty: plan.congestionPenalty,
    routingScore: plan.routingScore,
    customersAssigned: plan.customersServed,
    customersUnserved: plan.customerCount - plan.customersServed,
    customerCount: plan.customerCount,
    vehiclesUsed: plan.vehicleRoutes.filter(
      (r) => r.customerIds.length > 0 || r.fullPathNodeIds.length > 1
    ).length,
    vehicleCapacityTotal,
    capacityViolationCount: plan.capacityViolationVehicleIds.length,
    duplicateCustomerCount: plan.duplicateCustomerIds.length,
    blockedEdgeViolationCount: plan.blockedEdgeViolationIds.length,
    unreachableVehicleCount: plan.unreachableVehicleIds.length,
    feasible: plan.isFeasible,
    warnings: [...plan.warnings],
    convergenceHistory: convergenceHistory ? [...convergenceHistory] : null,
  };
}

export function buildCapstoneDynamicRecord(
  scenario: Scenario,
  reroutingResult: ReroutingResult,
  initialAlgorithm: string,
  initialAlgorithmLabel: string,
  initialPreset: string,
  groupId: string
): DynamicReroutingExperimentRecord {
  const revisedPlan = reroutingResult.revisedSnapshot?.routePlan;
  const incident = reroutingResult.incident;
  const vehicleDynamicStates = reroutingResult.revisedSnapshot?.vehicleDynamicStates || [];

  const completedSet = new Set<string>();
  const pendingSet = new Set<string>();
  vehicleDynamicStates.forEach((vs: VehicleDynamicState) => {
    vs.deliveredCustomerIds?.forEach((c: string) => completedSet.add(c));
    vs.pendingCustomerIds?.forEach((c: string) => pendingSet.add(c));
  });

  return {
    id: generateRecordId('rec'),
    timestamp: new Date().toISOString(),
    experimentGroupId: groupId,
    runType: 'dynamic_rerouting',
    scenarioId: scenario.id || 'scenario-default',
    scenarioName: scenario.name || 'Default Scenario',
    scenarioSeed: scenario.seed,
    initialAlgorithm: initialAlgorithm as 'greedy' | 'pso' | 'qpso',
    initialAlgorithmLabel,
    initialPreset,
    reroutingAlgorithm: reroutingResult.reroutingAlgorithm,
    reroutingAlgorithmLabel: getAlgorithmLabel(reroutingResult.reroutingAlgorithm),
    reroutingPreset: reroutingResult.reroutingPreset === 'Fast Re-route' ? 'fast' : 'balanced',
    optimizerSeed: scenario.seed,
    incidentType: incident.type,
    incidentId: incident.id,
    incidentEdgeIds: [...incident.affectedEdgeIds],
    incidentSeverity: incident.severity,
    affectedVehicleIds: [...incident.affectedVehicleIds],
    completedCustomerCount: completedSet.size,
    lockedCustomerCount: reroutingResult.lockedCustomerCount || 0,
    pendingCustomerCount: reroutingResult.eligibleCustomerIds?.length || 0,
    eligibleCustomerIds: [...(reroutingResult.eligibleCustomerIds || [])],
    reroutingRuntimeMs: reroutingResult.reroutingRuntimeMs,
    populationSize: reroutingResult.populationSize,
    iterations: reroutingResult.iterations,
    candidateEvaluations: reroutingResult.candidateEvaluations,
    originalRemainingTravelMinutes: reroutingResult.originalRemainingTravelMinutes,
    incidentAdjustedRemainingTravelMinutes: reroutingResult.incidentAdjustedRemainingTravelMinutes,
    revisedRemainingTravelMinutes: reroutingResult.revisedRemainingTravelMinutes,
    delayAvoidedMinutes: reroutingResult.delayAvoidedMinutes,
    routeStabilityChanges: reroutingResult.routeStabilityChanges,
    revisedRoutingScore: revisedPlan ? revisedPlan.routingScore : null,
    revisedCustomersAssigned: revisedPlan ? revisedPlan.customersServed : 0,
    revisedCustomersUnserved: revisedPlan ? revisedPlan.customerCount - revisedPlan.customersServed : 0,
    revisedFeasible: reroutingResult.revisedFeasible,
    warnings: [...reroutingResult.warnings],
  };
}
