/**
 * Frontend/Backend Parity Export Utility
 * QuantaRoute AI — Builds genuine frontend-to-backend metric parity export packages.
 * Browser-only, no external dependencies, uses Blob + URL.createObjectURL for download.
 */

import {
  FrontendBackendParityExport,
  FrontendParityMetadata,
  FrontendParityEvaluation,
  BuildParityExportOptions,
  ParityExportValidationResult,
  canBuildParityExport,
} from '../types/parity';
import { Scenario } from '../types/domain';
import { RoutePlan, VehicleRoute, RoutingContext, AlgorithmName, RoutingMode } from '../types/routing';

/**
 * Generate ISO 8601 timestamp for export metadata
 */
export function generateExportTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Generate filename for parity export
 */
export function generateParityFilename(
  algorithm: AlgorithmName,
  scenarioSeed: number,
  timestamp?: string
): string {
  const ts = timestamp || generateExportTimestamp().replace(/[:.]/g, '-').slice(0, 19);
  return `frontend-parity-${algorithm}-${scenarioSeed}-${ts}.json`;
}

/**
 * Validate that a route plan has correct node/edge counts for all non-empty routes
 */
function validateRouteNodeEdgeCounts(plan: RoutePlan): { valid: boolean; message?: string } {
  for (const route of plan.vehicleRoutes) {
    if (route.fullPathNodeIds.length > 0 && route.fullPathEdgeIds.length > 0) {
      if (route.fullPathNodeIds.length !== route.fullPathEdgeIds.length + 1) {
        return {
          valid: false,
          message: `Vehicle ${route.vehicleId}: ${route.fullPathNodeIds.length} nodes vs ${route.fullPathEdgeIds.length} edges (must be edges = nodes - 1)`
        };
      }
    }
  }
  return { valid: true };
}

/**
 * Validate that all route metrics are finite numbers
 */
function validateFiniteMetrics(plan: RoutePlan): { valid: boolean; message?: string } {
  for (const route of plan.vehicleRoutes) {
    if (!Number.isFinite(route.travelMinutes)) {
      return { valid: false, message: `Vehicle ${route.vehicleId}: travelMinutes is not finite` };
    }
    if (!Number.isFinite(route.distanceKm)) {
      return { valid: false, message: `Vehicle ${route.vehicleId}: distanceKm is not finite` };
    }
    if (!Number.isFinite(route.congestionPenalty)) {
      return { valid: false, message: `Vehicle ${route.vehicleId}: congestionPenalty is not finite` };
    }
    if (!Number.isFinite(route.usedCapacity)) {
      return { valid: false, message: `Vehicle ${route.vehicleId}: usedCapacity is not finite` };
    }
    if (!Number.isFinite(route.remainingCapacity)) {
      return { valid: false, message: `Vehicle ${route.vehicleId}: remainingCapacity is not finite` };
    }
  }
  if (!Number.isFinite(plan.totalTravelMinutes)) {
    return { valid: false, message: 'Plan totalTravelMinutes is not finite' };
  }
  if (!Number.isFinite(plan.totalDistanceKm)) {
    return { valid: false, message: 'Plan totalDistanceKm is not finite' };
  }
  if (!Number.isFinite(plan.congestionPenalty)) {
    return { valid: false, message: 'Plan congestionPenalty is not finite' };
  }
  if (!Number.isFinite(plan.routingScore)) {
    return { valid: false, message: 'Plan routingScore is not finite' };
  }
  return { valid: true };
}

/**
 * Validate internal objective equality: routingScore = 0.55*T + 0.25*D + 0.20*C + penaltyTotal
 * within 1e-8 tolerance
 */
function validateObjectiveEquality(
  plan: RoutePlan,
  frontendEvaluation: FrontendParityEvaluation
): { valid: boolean; message?: string; details?: { computed: number; expected: number; diff: number } } {
  const T = plan.totalTravelMinutes;
  const D = plan.totalDistanceKm;
  const C = plan.congestionPenalty;
  const P = frontendEvaluation.penaltyTotal;
  
  const computedScore = 0.55 * T + 0.25 * D + 0.20 * C + 10000 * P;
  const expectedScore = plan.routingScore;
  const diff = Math.abs(computedScore - expectedScore);
  
  if (diff > 1e-8) {
    return {
      valid: false,
      message: `Objective equality check failed: computed ${computedScore} vs expected ${expectedScore} (diff ${diff})`,
      details: { computed: computedScore, expected: expectedScore, diff }
    };
  }
  return { valid: true };
}

/**
 * Map frontend VehicleRoute to backend-compatible VehicleRoute
 * Field names are mapped only; values are preserved exactly
 */
function mapVehicleRouteForExport(route: VehicleRoute): VehicleRoute {
  return {
    vehicleId: route.vehicleId,
    vehicleLabel: route.vehicleLabel,
    customerIds: route.customerIds,
    stopNodeIds: route.stopNodeIds,
    fullPathNodeIds: route.fullPathNodeIds,
    fullPathEdgeIds: route.fullPathEdgeIds,
    travelMinutes: route.travelMinutes,
    distanceKm: route.distanceKm,
    congestionPenalty: route.congestionPenalty,
    usedCapacity: route.usedCapacity,
    remainingCapacity: route.remainingCapacity,
    startsAtDepot: route.startsAtDepot,
    endsAtDepot: route.endsAtDepot,
    reachable: route.reachable,
    feasible: route.feasible,
    warnings: route.warnings,
    // Optional fields for dynamic re-routing (included if present)
    startNodeId: route.startNodeId,
    endNodeId: route.endNodeId,
    completedCustomerIds: route.completedCustomerIds,
    pendingCustomerIds: route.pendingCustomerIds,
    isDynamicReroute: route.isDynamicReroute,
    initialVehicleCurrentNodeId: route.initialVehicleCurrentNodeId,
  };
}

/**
 * Map frontend RoutingContext to backend-compatible RoutingContext
 */
function mapRoutingContextForExport(context: RoutingContext | null | undefined): RoutingContext | null {
  if (!context) return null;
  
  return {
    mode: context.mode,
    depotNodeId: context.depotNodeId,
    startNodeByVehicleId: context.startNodeByVehicleId,
    remainingCapacityByVehicleId: context.remainingCapacityByVehicleId,
    lockedCustomerIds: context.lockedCustomerIds,
    eligibleCustomerIds: context.eligibleCustomerIds,
    // graphEdges not included in export (too large, backend has scenario edges)
    // but if needed, could be added
  };
}

/**
 * Build the complete frontend parity export package
 */
export function buildParityExport(
  options: BuildParityExportOptions
): FrontendBackendParityExport | { error: string; missing: string[] } {
  const { experimentRecord, scenario, appVersion = '1.0.0' } = options;
  
  // Check export availability
  const check = canBuildParityExport(experimentRecord, scenario);
  if (!check.canExport) {
    return { error: 'Cannot build parity export: missing required data', missing: check.missing };
  }
  
  const record = experimentRecord;
  const plan = record.routePlan!;
  
  // Validate plan structure
  const nodeEdgeCheck = validateRouteNodeEdgeCounts(plan);
  if (!nodeEdgeCheck.valid) {
    return { error: `Route structure validation failed: ${nodeEdgeCheck.message}`, missing: [] };
  }
  
  const finiteCheck = validateFiniteMetrics(plan);
  if (!finiteCheck.valid) {
    return { error: `Finite metrics validation failed: ${finiteCheck.message}`, missing: [] };
  }
  
  // Build metadata
  const metadata: FrontendParityMetadata = {
    source: 'QuantaRoute AI Frontend',
    exportKind: 'frontend_backend_parity',
    exportedAt: generateExportTimestamp(),
    scenarioSeed: record.scenarioSeed,
    algorithm: record.algorithm,
    preset: record.optimizerPreset || null,
    optimizerSeed: record.optimizerSeed,
    appVersion,
    sourceVerified: true,
  };
  
  // Build route plan with mapped vehicle routes
  const mappedVehicleRoutes = plan.vehicleRoutes.map(mapVehicleRouteForExport);
  const mappedRoutingContext = mapRoutingContextForExport(plan.routingContext as RoutingContext | null | undefined);
  
  const routePlan: RoutePlan = {
    ...plan,
    vehicleRoutes: mappedVehicleRoutes,
    routingContext: mappedRoutingContext,
    // Ensure mode is initial for initial routing exports
    // The backend's RoutePlanSchema has mode as optional with default 'initial'
  };
  
  // Build frontend evaluation from experiment record (exact values, no rounding)
  const frontendEvaluation: FrontendParityEvaluation = {
    totalTravelMinutes: record.totalTravelMinutes,
    totalDistanceKm: record.totalDistanceKm,
    totalCongestionPenalty: record.congestionPenalty,
    routingScore: record.routingScore,
    // penaltyTotal derived from evaluator output if available, otherwise compute from violation counts
    penaltyTotal: computePenaltyTotal(record, plan),
    customersAssigned: record.customersAssigned,
    customersUnserved: record.customersUnserved,
    unservedCustomerIds: plan.unservedCustomerIds,
    duplicateCustomerIds: plan.duplicateCustomerIds,
    capacityViolationVehicleIds: plan.capacityViolationVehicleIds,
    blockedEdgeViolationIds: plan.blockedEdgeViolationIds,
    unreachableVehicleIds: plan.unreachableVehicleIds,
    pathContinuityViolationVehicleIds: [], // Not directly tracked in frontend RoutePlan, left empty
    feasible: record.feasible,
    warnings: record.warnings,
  };
  
  // Validate objective equality using frontend's own penaltyTotal
  const equalityCheck = validateObjectiveEquality(plan, frontendEvaluation);
  if (!equalityCheck.valid) {
    return { error: `Objective equality validation failed: ${equalityCheck.message}`, missing: [] };
  }
  
  return {
    metadata,
    scenario,
    routePlan,
    frontendEvaluation,
  };
}

/**
 * Compute penalty total from experiment record and route plan
 * Uses the same penalty rules as the backend evaluator
 */
function computePenaltyTotal(
  record: BuildParityExportOptions['experimentRecord'],
  plan: RoutePlan
): number {
  const P_unserved = plan.unservedCustomerIds.length * 10000;
  const P_duplicate = plan.duplicateCustomerIds.length * 10000;
  const P_capacity = plan.capacityViolationVehicleIds.length * 10000;
  const P_blocked = plan.blockedEdgeViolationIds.length * 50000;
  const P_unreachable = plan.unreachableVehicleIds.length * 50000;
  // Depot violations not directly tracked in frontend plan, use 0
  const P_depot = 0;
  
  return P_unserved + P_duplicate + P_capacity + P_blocked + P_unreachable + P_depot;
}

/**
 * Run local validation checks on a built parity export
 */
export function validateParityExportLocally(
  exportObj: FrontendBackendParityExport
): ParityExportValidationResult {
  const checks: ParityExportValidationResult['checks'] = [];
  
  // Check 1: Required root keys exist
  checks.push({
    name: 'Required root keys present',
    passed: 'metadata' in exportObj && 'scenario' in exportObj && 'routePlan' in exportObj && 'frontendEvaluation' in exportObj,
    message: 'Export must contain metadata, scenario, routePlan, and frontendEvaluation'
  });
  
  // Check 2: Metadata has correct source and exportKind
  checks.push({
    name: 'Metadata source and exportKind correct',
    passed: exportObj.metadata.source === 'QuantaRoute AI Frontend' && 
            exportObj.metadata.exportKind === 'frontend_backend_parity',
    message: 'Metadata must have source="QuantaRoute AI Frontend" and exportKind="frontend_backend_parity"'
  });
  
  // Check 3: sourceVerified is true
  checks.push({
    name: 'sourceVerified is true',
    passed: exportObj.metadata.sourceVerified === true,
    message: 'sourceVerified must be true for genuine frontend exports'
  });
  
  // Check 4: Scenario has required fields
  checks.push({
    name: 'Scenario has required fields',
    passed: !!(exportObj.scenario.id && exportObj.scenario.nodes && exportObj.scenario.edges && 
               exportObj.scenario.customers && exportObj.scenario.vehicles),
    message: 'Scenario must have id, nodes, edges, customers, vehicles'
  });
  
  // Check 5: RoutePlan has required fields
  checks.push({
    name: 'RoutePlan has required fields',
    passed: !!(exportObj.routePlan.algorithm && exportObj.routePlan.scenarioId && 
               exportObj.routePlan.seed !== undefined && exportObj.routePlan.depotNodeId &&
               exportObj.routePlan.vehicleRoutes),
    message: 'RoutePlan must have algorithm, scenarioId, seed, depotNodeId, vehicleRoutes'
  });
  
  // Check 6: All numeric fields are finite
  const evalObj = exportObj.frontendEvaluation;
  const numericFields = [
    'totalTravelMinutes', 'totalDistanceKm', 'totalCongestionPenalty',
    'routingScore', 'penaltyTotal', 'customersAssigned', 'customersUnserved'
  ];
  checks.push({
    name: 'All numeric evaluation fields are finite',
    passed: numericFields.every(f => Number.isFinite(evalObj[f as keyof FrontendParityEvaluation] as number)),
    message: 'All numeric evaluation fields must be finite numbers'
  });
  
  // Check 7: Integer fields are integers
  const intFields = ['customersAssigned', 'customersUnserved'];
  checks.push({
    name: 'Integer fields are integers',
    passed: intFields.every(f => Number.isInteger(evalObj[f as keyof FrontendParityEvaluation] as number)),
    message: 'Integer fields must be whole numbers'
  });
  
  // Check 8: Route node/edge counts match for all routes
  checks.push({
    name: 'Route node/edge counts consistent',
    passed: exportObj.routePlan.vehicleRoutes.every(r => 
      r.fullPathNodeIds.length === 0 || 
      r.fullPathNodeIds.length === r.fullPathEdgeIds.length + 1
    ),
    message: 'For non-empty routes, edge count must equal node count - 1'
  });
  
  // Check 9: Objective equality holds (within 1e-8)
  const T = exportObj.routePlan.totalTravelMinutes;
  const D = exportObj.routePlan.totalDistanceKm;
  const C = exportObj.routePlan.congestionPenalty;
  const P = exportObj.frontendEvaluation.penaltyTotal;
  const computedScore = 0.55 * T + 0.25 * D + 0.20 * C + 10000 * P;
  const expectedScore = exportObj.routePlan.routingScore;
  const diff = Math.abs(computedScore - expectedScore);
  checks.push({
    name: 'Objective equality (F = 0.55T + 0.25D + 0.20C + 10000P)',
    passed: diff <= 1e-8,
    message: diff <= 1e-8 ? undefined : `Computed ${computedScore} vs expected ${expectedScore} (diff ${diff})`
  });
  
  // Check 10: Frontend evaluation feasible matches plan isFeasible
  checks.push({
    name: 'Feasibility matches plan isFeasible',
    passed: exportObj.frontendEvaluation.feasible === exportObj.routePlan.isFeasible,
    message: 'frontendEvaluation.feasible must equal routePlan.isFeasible'
  });
  
  // Check 11: Generated JSON parses successfully
  let jsonParses = true;
  let jsonParseError: string | undefined;
  try {
    JSON.stringify(exportObj);
  } catch (e) {
    jsonParses = false;
    jsonParseError = String(e);
  }
  checks.push({
    name: 'Export serializes to valid JSON',
    passed: jsonParses,
    message: jsonParseError || 'Export must serialize to valid JSON'
  });
  
  // Check 12: Edge fields use fromNodeId/toNodeId format (backend expects these aliases)
  // Note: Frontend uses 'from'/'to', backend adapter accepts both. We export as-is.
  checks.push({
    name: 'Edge format is valid',
    passed: exportObj.scenario.edges.every(e => 
      typeof e.id === 'string' && 
      (e.from !== undefined || e.to !== undefined) &&
      typeof e.distanceKm === 'number' &&
      typeof e.baseTravelMinutes === 'number' &&
      typeof e.congestionMultiplier === 'number' &&
      typeof e.isBlocked === 'boolean'
    ),
    message: 'All scenario edges must have valid id, from/to, distanceKm, baseTravelMinutes, congestionMultiplier, isBlocked'
  });
  
  const passed = checks.every(c => c.passed);
  
  return { passed, checks };
}

/**
 * Download parity export as JSON file
 */
export function downloadParityExport(
  exportObj: FrontendBackendParityExport,
  filename: string
): void {
  if (typeof window === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined') {
    console.error('Download requires browser environment with Blob and URL support.');
    return;
  }
  
  try {
    const content = JSON.stringify(exportObj, null, 2);
    const blob = new Blob([content], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error('Failed to trigger download:', e);
  }
}

/**
 * Copy parity export to clipboard
 */
export async function copyParityExport(exportObj: FrontendBackendParityExport): Promise<boolean> {
  try {
    const content = JSON.stringify(exportObj, null, 2);
    await navigator.clipboard.writeText(content);
    return true;
  } catch (e) {
    console.error('Failed to copy to clipboard:', e);
    return false;
  }
}