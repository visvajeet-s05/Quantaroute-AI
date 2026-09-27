/**
 * Experiment Manager Service
 * QuantaRoute AI — Capstone: Controlled Experiment Workflow
 *
 * Orchestrates deterministic scenario comparisons, runs algorithms sequentially
 * on cloned scenario copies, builds real result records, and manages history.
 */

import { generateScenario } from '../data/scenarioGenerator';
import { Scenario, ScenarioPreset } from '../types/domain';
import {
  AlgorithmName,
  PsoPreset,
  QpsoPreset,
  QpsoRunResult,
  PsoRunResult,
  RoutePlan,
} from '../types/routing';
import {
  InitialRoutingExperimentRecord,
  DynamicReroutingExperimentRecord,
  ExperimentRecord,
  ExperimentHistory,
  BenchmarkPreset,
  OptimizerPresetName,
  ExperimentRunProgress,
} from '../types/experiments';
import { runGreedyRouting } from '../algorithms/greedyRouting';
import { runClassicalPso } from '../algorithms/classicalPso';
import { runQuantumPso } from '../algorithms/quantumPso';
import {
  createInitialSnapshot,
  injectDynamicIncident,
  runDynamicRerouting,
  simulatePartialExecution,
  selectGuidedDemoEdge,
  findCandidateIncidentEdges,
} from './dynamicRerouting';
import { BENCHMARK_PRESETS } from './benchmarkPresets';
export type { BenchmarkPreset, ExperimentRecord, ExperimentHistory, ExperimentRunProgress } from '../types/experiments';

const OPTIMIZER_SEED = 26137;

let idCounter = 0;
function generateId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizePresetName(preset: PsoPreset | QpsoPreset): OptimizerPresetName {
  if (preset === 'Fast Re-route') return 'fast';
  if (preset === 'Balanced') return 'balanced';
  if (preset === 'High Quality') return 'highQuality';
  return 'standard';
}

function getAlgorithmLabel(algo: AlgorithmName): string {
  if (algo === 'greedy') return 'Greedy Routing';
  if (algo === 'pso') return 'Classical PSO';
  if (algo === 'qpso') return 'Quantum-Inspired PSO';
  return algo;
}

function cloneScenario(s: Scenario): Scenario {
  return JSON.parse(JSON.stringify(s));
}

/**
 * Builds an InitialRoutingExperimentRecord from a real RoutePlan and run result.
 */
function buildInitialRecord(
  scenario: Scenario,
  plan: RoutePlan,
  algorithm: AlgorithmName,
  optimizerSeed: number | null,
  presetName: string,
  populationSize: number | null,
  iterations: number | null,
  candidateEvaluations: number | null,
  convergenceHistory: number[] | null,
  groupId: string,
  trafficProfile: string
): InitialRoutingExperimentRecord {
  const vehicles = scenario.vehicles;
  const vehicleCapacityTotal = vehicles.reduce((sum, v) => sum + v.capacity, 0);

  const capacityViolations = plan.capacityViolationVehicleIds.length;
  const duplicateCustomerCount = plan.duplicateCustomerIds.length;
  const blockedEdgeViolationCount = plan.blockedEdgeViolationIds.length;
  const unreachableVehicleCount = plan.unreachableVehicleIds.length;

  const routesUsed = plan.vehicleRoutes.filter(
    (r) => r.customerIds.length > 0 || r.fullPathNodeIds.length > 1
  ).length;

  return {
    id: generateId('rec'),
    timestamp: new Date().toISOString(),
    experimentGroupId: groupId,
    runType: 'initial_routing',
    scenarioId: scenario.id || 'scenario-default',
    scenarioName: scenario.name || 'Default Scenario',
    scenarioSeed: scenario.seed,
    trafficProfile: trafficProfile as any,
    algorithm,
    algorithmLabel: getAlgorithmLabel(algorithm),
    optimizerPreset: normalizePresetName(presetName as PsoPreset),
    optimizerSeed,
    populationSize,
    iterations,
    candidateEvaluations,
    runtimeMs: plan.runtimeMs,
    totalTravelMinutes: plan.totalTravelMinutes,
    totalDistanceKm: plan.totalDistanceKm,
    congestionPenalty: plan.congestionPenalty,
    routingScore: plan.routingScore,
    customersAssigned: plan.customersServed,
    customersUnserved: plan.customerCount - plan.customersServed,
    customerCount: plan.customerCount,
    vehiclesUsed: routesUsed,
    vehicleCapacityTotal,
    capacityViolationCount: capacityViolations,
    duplicateCustomerCount,
    blockedEdgeViolationCount,
    unreachableVehicleCount,
    feasible: plan.isFeasible,
    warnings: [...plan.warnings],
    convergenceHistory,
    routePlan: plan,
  };
}

/**
 * Builds a DynamicReroutingExperimentRecord from a real ReroutingResult.
 */
function buildDynamicRecord(
  scenario: Scenario,
  reroutingResult: any,
  initialAlgorithm: AlgorithmName,
  initialPreset: string,
  groupId: string
): DynamicReroutingExperimentRecord {
  const revisedPlan = reroutingResult.revisedSnapshot?.routePlan;
  const incident = reroutingResult.incident;
  const vehicleDynamicStates = reroutingResult.revisedSnapshot?.vehicleDynamicStates || [];

  // Count completed (locked) customers across all vehicle states before re-routing
  // These are customers that were delivered prior to incident
  const completedSet = new Set<string>();
  const pendingSet = new Set<string>();
  vehicleDynamicStates.forEach((vs: any) => {
    vs.deliveredCustomerIds?.forEach((c: string) => completedSet.add(c));
    vs.pendingCustomerIds?.forEach((c: string) => pendingSet.add(c));
  });

  return {
    id: generateId('rec'),
    timestamp: new Date().toISOString(),
    experimentGroupId: groupId,
    runType: 'dynamic_rerouting',
    scenarioId: scenario.id || 'scenario-default',
    scenarioName: scenario.name || 'Default Scenario',
    scenarioSeed: scenario.seed,
    initialAlgorithm,
    initialAlgorithmLabel: getAlgorithmLabel(initialAlgorithm),
    initialPreset,
    reroutingAlgorithm: reroutingResult.reroutingAlgorithm,
    reroutingAlgorithmLabel: getAlgorithmLabel(reroutingResult.reroutingAlgorithm),
    reroutingPreset: reroutingResult.reroutingPreset,
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

/**
 * Runs a single initial-routing algorithm on a cloned scenario and returns a record.
 */
function runInitialRoutingAlgorithm(

  scenarioPreset: ScenarioPreset,
  seed: number,
  algorithm: AlgorithmName,
  psoPreset: PsoPreset,
  qpsoPreset: QpsoPreset,
  optimizerSeed: number,
  groupId: string,
  trafficProfile: string,
  onStep: (progress: ExperimentRunProgress) => void,
  stepIndex: number,
  totalSteps: number
): InitialRoutingExperimentRecord {
  const clonedScenario = cloneScenario(generateScenario(scenarioPreset, seed));

  if (algorithm === 'greedy') {
    const plan = runGreedyRouting(clonedScenario);
    return buildInitialRecord(
      clonedScenario, plan, 'greedy', null, 'standard', null, null, null, null,
      groupId, trafficProfile
    );
  }

  if (algorithm === 'pso') {
    const result: PsoRunResult = runClassicalPso(clonedScenario, { presetName: psoPreset, seed: optimizerSeed });
    return buildInitialRecord(
      clonedScenario, result.bestPlan, 'pso', optimizerSeed, psoPreset,
      result.populationSize, result.iterationsCompleted, result.candidateEvaluations,
      result.convergenceHistory, groupId, trafficProfile
    );
  }

  // qpso
  const result: QpsoRunResult = runQuantumPso(clonedScenario, { presetName: qpsoPreset, seed: optimizerSeed });
  return buildInitialRecord(
    clonedScenario, result.bestPlan, 'qpso', optimizerSeed, qpsoPreset,
    result.populationSize, result.iterationsCompleted, result.candidateEvaluations,
    result.convergenceHistory, groupId, trafficProfile
  );
}

/**
 * Runs a complete benchmark preset: executes all selected algorithms on cloned scenario copies.
 * Each algorithm gets its own independent scenario clone.
 */
export function runBenchmark(
  preset: BenchmarkPreset,
  onProgress: (progress: ExperimentRunProgress) => void
): ExperimentRecord[] {
  const groupId = generateId('bench');
  const records: ExperimentRecord[] = [];

  const steps: Array<{
    algorithm: AlgorithmName;
    label: string;
  }> = [];

  if (preset.includeGreedy) {
    steps.push({ algorithm: 'greedy', label: 'Greedy Routing' });
  }
  if (preset.includePso) {
    steps.push({ algorithm: 'pso', label: `Classical PSO (${preset.psoPreset})` });
  }
  if (preset.includeQpso) {
    steps.push({ algorithm: 'qpso', label: `Quantum-Inspired PSO (${preset.qpsoPreset})` });
  }

  onProgress({
    step: 'Starting benchmark',
    stepIndex: 0,
    totalSteps: steps.length,
    isRunning: true,
    groupId,
    error: null,
  });

  let stepIndex = 0;
  for (const step of steps) {
    const stepLabel = `Running ${stepIndex + 1} of ${steps.length}: ${step.label}`;
    onProgress({
      step: stepLabel,
      stepIndex,
      totalSteps: steps.length,
      isRunning: true,
      groupId,
      error: null,
    });

    try {
      const record = runInitialRoutingAlgorithm(
        preset.scenarioPreset,
        preset.scenarioSeed,
        step.algorithm,
        preset.psoPreset,
        preset.qpsoPreset,
        preset.optimizerSeed,
        groupId,
        preset.trafficProfile,
        onProgress,
        stepIndex,
        steps.length
      );
      records.push(record);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      records.push({
        id: generateId('rec'),
        timestamp: new Date().toISOString(),
        experimentGroupId: groupId,
        runType: 'initial_routing',
        scenarioId: 'scenario-default',
        scenarioName: 'Default Scenario',
        scenarioSeed: preset.scenarioSeed,
        trafficProfile: preset.trafficProfile,
        algorithm: step.algorithm,
        algorithmLabel: step.label,
        optimizerPreset: 'balanced',
        optimizerSeed: null,
        populationSize: null,
        iterations: null,
        candidateEvaluations: null,
        runtimeMs: 0,
        totalTravelMinutes: 0,
        totalDistanceKm: 0,
        congestionPenalty: 0,
        routingScore: Infinity,
        customersAssigned: 0,
        customersUnserved: 0,
        customerCount: 0,
        vehiclesUsed: 0,
        vehicleCapacityTotal: 0,
        capacityViolationCount: 0,
        duplicateCustomerCount: 0,
        blockedEdgeViolationCount: 0,
        unreachableVehicleCount: 0,
        feasible: false,
        warnings: [],
        convergenceHistory: null,
        error: { error: true, message: errorMsg, runtimeMs: 0 },
      });
    }

    stepIndex++;
  }

  onProgress({
    step: `Benchmark complete: ${records.filter(r => r.runType === 'initial_routing' && r.feasible !== false).length}/${records.length} feasible`,
    stepIndex: steps.length,
    totalSteps: steps.length,
    isRunning: false,
    groupId,
    error: null,
  });

  return records;
}

/**
 * Runs the Fast Re-route Demonstration: initial QPSO planning + guided incident + QPSO re-routing.
 */
export function runFastRerouteDemo(
  onProgress: (progress: ExperimentRunProgress) => void
): ExperimentRecord[] {
  const groupId = generateId('demo');
  const records: ExperimentRecord[] = [];

  onProgress({
    step: 'Running 1 of 2: QPSO Balanced Initial Planning',
    stepIndex: 0,
    totalSteps: 2,
    isRunning: true,
    groupId,
    error: null,
  });

  const scenario = cloneScenario(generateScenario('normal', 26137));

  try {
    // Step 1: Initial QPSO Balanced planning
    const qpsoResult = runQuantumPso(scenario, { presetName: 'Balanced', seed: OPTIMIZER_SEED });
    const initialRecord = buildInitialRecord(
      scenario,
      qpsoResult.bestPlan,
      'qpso',
      OPTIMIZER_SEED,
      'Balanced',
      qpsoResult.populationSize,
      qpsoResult.iterationsCompleted,
      qpsoResult.candidateEvaluations,
      qpsoResult.convergenceHistory,
      groupId,
      'normal'
    );
    records.push(initialRecord);

    // Step 2: Simulate partial execution
    const initialSnapshot = createInitialSnapshot(qpsoResult.bestPlan, scenario);
    const { preIncidentSnapshot, vehicleDynamicStates } = simulatePartialExecution(
      initialSnapshot,
      scenario,
      1
    );

    // Step 3: Inject guided demo incident
    const candidates = findCandidateIncidentEdges(
      scenario,
      vehicleDynamicStates,
      scenario.edges
    );

    const guided = candidates.length > 0
      ? { edgeId: candidates[0].edgeId, affectedVehicleIds: candidates[0].affectedVehicleIds }
      : selectGuidedDemoEdge(scenario, vehicleDynamicStates, scenario.edges);

    if (!guided) {
      throw new Error('No eligible pending route edges found for guided incident.');
    }

    onProgress({
      step: 'Running 2 of 2: Injecting Guided Demo Incident + QPSO Fast Re-route',
      stepIndex: 1,
      totalSteps: 2,
      isRunning: true,
      groupId,
      error: null,
    });

    const {
      incident,
      incidentEdges,
      originalRemainingTravelMinutes,
      incidentAdjustedRemainingTravelMinutes,
      updatedVehicleStates,
    } = injectDynamicIncident(
      scenario,
      preIncidentSnapshot,
      vehicleDynamicStates,
      'road_closure',
      3,
      guided.edgeId
    );

    // Step 4: Re-route with QPSO Fast Re-route
    const reroutingResult = runDynamicRerouting(
      scenario,
      incidentEdges,
      updatedVehicleStates,
      incident,
      originalRemainingTravelMinutes,
      incidentAdjustedRemainingTravelMinutes,
      'qpso',
      'Fast Re-route',
      initialSnapshot,
      preIncidentSnapshot
    );

    const dynamicRecord = buildDynamicRecord(
      scenario,
      reroutingResult,
      'qpso',
      'Balanced',
      groupId
    );
    records.push(dynamicRecord);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    onProgress({
      step: `Error: ${errorMsg}`,
      stepIndex: 2,
      totalSteps: 2,
      isRunning: false,
      groupId,
      error: errorMsg,
    });

    const errorRecord: DynamicReroutingExperimentRecord = {
      id: generateId('rec'),
      timestamp: new Date().toISOString(),
      experimentGroupId: groupId,
      runType: 'dynamic_rerouting',
      scenarioId: scenario.id || 'scenario-default',
      scenarioName: scenario.name || 'Default Scenario',
      scenarioSeed: scenario.seed,
      initialAlgorithm: 'qpso',
      initialAlgorithmLabel: 'Quantum-Inspired PSO',
      initialPreset: 'Balanced',
      reroutingAlgorithm: 'qpso',
      reroutingAlgorithmLabel: 'Quantum-Inspired PSO',
      reroutingPreset: 'fast',
      optimizerSeed: OPTIMIZER_SEED,
      incidentType: 'road_closure',
      incidentId: '',
      incidentEdgeIds: [],
      incidentSeverity: 3,
      affectedVehicleIds: [],
      completedCustomerCount: 0,
      lockedCustomerCount: 0,
      pendingCustomerCount: 0,
      eligibleCustomerIds: [],
      reroutingRuntimeMs: 0,
      populationSize: null,
      iterations: null,
      candidateEvaluations: null,
      originalRemainingTravelMinutes: null,
      incidentAdjustedRemainingTravelMinutes: null,
      revisedRemainingTravelMinutes: null,
      delayAvoidedMinutes: null,
      routeStabilityChanges: 0,
      revisedRoutingScore: null,
      revisedCustomersAssigned: 0,
      revisedCustomersUnserved: 0,
      revisedFeasible: false,
      warnings: [],
      error: { error: true, message: errorMsg, runtimeMs: 0 },
    };
    records.push(errorRecord);
  }

  onProgress({
    step: `Demo complete: ${records.length} record(s) generated`,
    stepIndex: 2,
    totalSteps: 2,
    isRunning: false,
    groupId,
    error: null,
  });

  return records;
}
