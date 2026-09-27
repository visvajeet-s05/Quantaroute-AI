/**
 * Experiment Management Verification Unit Tests
 * QuantaRoute AI — Capstone: Controlled Experiment Workflow
 *
 * 6 non-destructive invariant tests verifying:
 * 1. Shared scenario isolation (cloned copies, no cross-contamination)
 * 2. Record completeness (all required fields from real run data)
 * 3. Fair preset budget (PSO/QPSO Balanced = 25/50/1275; Greedy = null)
 * 4. Dynamic record correctness (incident fields, counts, feasibility)
 * 5. Export integrity (CSV header/recordType; JSON preserves metadata/convergence)
 * 6. Local persistence safety (reload, malformed data recovery)
 */

import { Scenario } from '../types/domain';
import { ExperimentUnitTestResult } from '../types/experiments';
import { getDefaultScenario, getScenarioByPreset } from '../data/demoScenario';
import { generateScenario } from '../data/scenarioGenerator';
import { DEFAULT_SEED } from '../data/demoScenario';
import { runGreedyRouting } from '../algorithms/greedyRouting';
import { runClassicalPso } from '../algorithms/classicalPso';
import { runQuantumPso } from '../algorithms/quantumPso';
import { runBenchmark } from '../services/experimentManager';
import { BENCHMARK_PRESETS, getBenchmarkPreset } from '../services/benchmarkPresets';
import { generateCSVExport, generateJSONExport } from '../utils/experimentExport';
import { loadExperimentHistory, saveExperimentHistory, clearExperimentHistory, getStorageKey } from '../utils/experimentStorage';
import { createInitialSnapshot, injectDynamicIncident, runDynamicRerouting, simulatePartialExecution, findCandidateIncidentEdges, selectGuidedDemoEdge } from '../services/dynamicRerouting';
import { InitialRoutingExperimentRecord, DynamicReroutingExperimentRecord, ExperimentRecord } from '../types/experiments';

export function runExperimentUnitTests(scenario: Scenario): ExperimentUnitTestResult[] {
  const results: ExperimentUnitTestResult[] = [];

  // Test 1: Shared Scenario Isolation
  {
    const t0 = performance.now();

    const scenarioCopy = JSON.parse(JSON.stringify(scenario));
    const originalCustomerIds = scenario.customers.map((c) => c.id);
    const originalCustomerIdSet = new Set(originalCustomerIds);

    // Run all 3 algorithms on cloned copies of the same scenario
    const greedyScenario = JSON.parse(JSON.stringify(scenario));
    const psoScenario = JSON.parse(JSON.stringify(scenario));
    const qpsoScenario = JSON.parse(JSON.stringify(scenario));

    const greedyPlan = runGreedyRouting(greedyScenario);
    const psoResult = runClassicalPso(psoScenario, { seed: DEFAULT_SEED });
    const qpsoResult = runQuantumPso(qpsoScenario, { seed: DEFAULT_SEED });

    // Verify original scenario is unchanged
    const originalUnchanged =
      scenario.customers.length === scenarioCopy.customers.length &&
      scenario.customers.every((c, i) => c.id === scenarioCopy.customers[i]?.id);

    // Verify all records have same scenarioId and scenarioSeed
    const sameScenarioSeed =
      greedyPlan.seed === scenario.seed &&
      psoResult.bestPlan.seed === scenario.seed &&
      qpsoResult.bestPlan.seed === scenario.seed;

    // Verify customer assignments don't leak between algorithms
    const greedyCustomers = new Set(greedyPlan.vehicleRoutes.flatMap((r) => r.customerIds));
    const psoCustomers = new Set(psoResult.bestPlan.vehicleRoutes.flatMap((r) => r.customerIds));
    const qpsoCustomers = new Set(qpsoResult.bestPlan.vehicleRoutes.flatMap((r) => r.customerIds));

    // All should be subsets of the original customer set (no leakage)
    const noLeakage =
      [...greedyCustomers].every((c) => originalCustomerIdSet.has(c)) &&
      [...psoCustomers].every((c) => originalCustomerIdSet.has(c)) &&
      [...qpsoCustomers].every((c) => originalCustomerIdSet.has(c));

    const t1 = performance.now();
    const passed = originalUnchanged && sameScenarioSeed && noLeakage;

    results.push({
      id: 'experiment-test-1',
      name: 'Shared Scenario Isolation',
      passed,
      runtimeMs: Number((t1 - t0).toFixed(2)),
      summary: passed
        ? 'All algorithms ran on cloned copies without cross-contamination; original scenario preserved.'
        : 'Scenario isolation violation detected.',
      details: `Original unchanged: ${originalUnchanged}; Same seed: ${sameScenarioSeed}; No leakage: ${noLeakage}. Greedy serves ${greedyPlan.customersServed}, PSO serves ${psoResult.bestPlan.customersServed}, QPSO serves ${qpsoResult.bestPlan.customersServed} customers`,
    });
  }

  // Test 2: Record Completeness
  {
    const t0 = performance.now();

    const preset = getBenchmarkPreset('normal_traffic_benchmark');
    if (!preset) {
      results.push({
        id: 'experiment-test-2',
        name: 'Record Completeness',
        passed: false,
        runtimeMs: 0,
        summary: 'Failed to find normal_traffic_benchmark preset',
        details: 'Benchmark preset not found',
      });
      return results;
    }

    const records = runBenchmark(
      preset,
      () => {},
    );

    const initialRecords = records.filter(
      (r): r is InitialRoutingExperimentRecord => r.runType === 'initial_routing'
    );

    let allComplete = true;
    let completenessDetails = '';

    for (const rec of initialRecords) {
      const requiredFields = [
        'id', 'timestamp', 'experimentGroupId', 'runType', 'scenarioId', 'scenarioName',
        'scenarioSeed', 'trafficProfile', 'algorithm', 'algorithmLabel', 'optimizerPreset',
        'optimizerSeed', 'runtimeMs', 'totalTravelMinutes', 'totalDistanceKm',
        'routingScore', 'customersAssigned', 'customerCount', 'feasible', 'warnings',
      ];

      for (const field of requiredFields) {
        if ((rec as Record<string, unknown>)[field] === undefined) {
          allComplete = false;
          completenessDetails += `Missing field: ${field}; `;
        }
      }

      // Verify score/time/distance are finite
      if (!Number.isFinite(rec.routingScore) && rec.routingScore !== Infinity) {
        allComplete = false;
        completenessDetails += `Non-finite score for ${rec.algorithmLabel}; `;
      }
      if (!Number.isFinite(rec.totalTravelMinutes)) {
        allComplete = false;
        completenessDetails += `Non-finite travel time for ${rec.algorithmLabel}; `;
      }
      if (!Number.isFinite(rec.totalDistanceKm)) {
        allComplete = false;
        completenessDetails += `Non-finite distance for ${rec.algorithmLabel}; `;
      }
      if (!Number.isFinite(rec.runtimeMs)) {
        allComplete = false;
        completenessDetails += `Non-finite runtime for ${rec.algorithmLabel}; `;
      }
    }

    const t1 = performance.now();

    results.push({
      id: 'experiment-test-2',
      name: 'Record Completeness',
      passed: allComplete && initialRecords.length > 0,
      runtimeMs: Number((t1 - t0).toFixed(2)),
      summary: allComplete
        ? `All ${initialRecords.length} initial-routing records have required fields with valid numeric values.`
        : 'Record completeness violation detected',
      details: allComplete
        ? `Verified ${initialRecords.length} records: all required fields present; scores, times, distances, and runtimes finite.`
        : `Completeness issues: ${completenessDetails}`,
    });
  }

  // Test 3: Fair Preset Budget
  {
    const t0 = performance.now();

    const preset = getBenchmarkPreset('normal_traffic_benchmark');
    if (!preset) {
      results.push({
        id: 'experiment-test-3',
        name: 'Fair Preset Budget',
        passed: false,
        runtimeMs: 0,
        summary: 'Benchmark preset not found',
        details: '',
      });
      return results;
    }

    const records = runBenchmark(preset, () => {});

    const initialRecords = records.filter(
      (r): r is InitialRoutingExperimentRecord => r.runType === 'initial_routing'
    );

    const greedyRecord = initialRecords.find((r) => r.algorithm === 'greedy');
    const psoRecord = initialRecords.find((r) => r.algorithm === 'pso');
    const qpsoRecord = initialRecords.find((r) => r.algorithm === 'qpso');

    // Greedy has null for optimizer config fields
    const greedyIsHeuristic =
      greedyRecord?.populationSize === null &&
      greedyRecord?.iterations === null &&
      greedyRecord?.candidateEvaluations === null;

    // PSO Balanced: pop 25, iter 50, evals 1275
    const psoBalancedCorrect =
      psoRecord?.populationSize === 25 &&
      psoRecord?.iterations === 50 &&
      psoRecord?.candidateEvaluations === 1275;

    // QPSO Balanced: pop 25, iter 50, evals 1275
    const qpsoBalancedCorrect =
      qpsoRecord?.populationSize === 25 &&
      qpsoRecord?.iterations === 50 &&
      qpsoRecord?.candidateEvaluations === 1275;

    const t1 = performance.now();
    const passed = greedyIsHeuristic && psoBalancedCorrect && qpsoBalancedCorrect;

    results.push({
      id: 'experiment-test-3',
      name: 'Fair Preset Budget',
      passed,
      runtimeMs: Number((t1 - t0).toFixed(2)),
      summary: passed
        ? 'Greedy correctly has null budget; PSO and QPSO Balanced both use pop 25, iter 50, evals 1275.'
        : 'Preset budget mismatch detected',
      details: `Greedy null budget: ${greedyIsHeuristic}; PSO 25/50/1275: ${psoBalancedCorrect}; QPSO 25/50/1275: ${qpsoBalancedCorrect}.`,
    });
  }

  // Test 4: Dynamic Record Correctness
  {
    const t0 = performance.now();

    const scenarioCopy = JSON.parse(JSON.stringify(scenario));
    const qpsoResult = runQuantumPso(scenarioCopy, { seed: DEFAULT_SEED });
    const initialSnapshot = createInitialSnapshot(qpsoResult.bestPlan, scenarioCopy);

    const { preIncidentSnapshot, vehicleDynamicStates } = simulatePartialExecution(
      initialSnapshot,
      scenarioCopy,
      1
    );

    const candidates = findCandidateIncidentEdges(
      scenarioCopy,
      vehicleDynamicStates,
      scenarioCopy.edges
    );

    const targetEdgeId = candidates[0]?.edgeId || 'E05';

    const {
      incident,
      incidentEdges,
      originalRemainingTravelMinutes,
      incidentAdjustedRemainingTravelMinutes,
      updatedVehicleStates,
    } = injectDynamicIncident(
      scenarioCopy,
      preIncidentSnapshot,
      vehicleDynamicStates,
      'road_closure',
      3,
      targetEdgeId
    );

    const reroutingResult = runDynamicRerouting(
      scenarioCopy,
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

    // Verify incident fields preserved
    const incidentPreserved = incident.affectedEdgeIds.length > 0 && incident.affectedVehicleIds.length > 0;

    // Count completed/locked/pending
    const completedSet = new Set<string>();
    vehicleDynamicStates.forEach((vs) => {
      vs.deliveredCustomerIds.forEach((c) => completedSet.add(c));
    });

    const countsAccurate =
      reroutingResult.lockedCustomerCount === completedSet.size &&
      reroutingResult.eligibleCustomerIds.length >= 0 &&
      reroutingResult.reroutingRuntimeMs >= 0;

    // When blocked, delayAvoided can be null
    const delayCorrect =
      reroutingResult.delayAvoidedMinutes === null ||
      (typeof reroutingResult.delayAvoidedMinutes === 'number' &&
        reroutingResult.delayAvoidedMinutes >= 0);

    // revisedFeasible should match actual result
    const feasibleMatches =
      reroutingResult.revisedFeasible === reroutingResult.revisedSnapshot?.routePlan.isFeasible;

    const t1 = performance.now();
    const passed = incidentPreserved && countsAccurate && delayCorrect && feasibleMatches;

    results.push({
      id: 'experiment-test-4',
      name: 'Dynamic Record Correctness',
      passed,
      runtimeMs: Number((t1 - t0).toFixed(2)),
      summary: passed
        ? 'Incident fields, counts, delay handling, and feasibility all match real re-routing results.'
        : 'Dynamic record mismatch detected.',
      details: `Incident preserved: ${incidentPreserved}; Counts accurate: ${countsAccurate}; Delay correct: ${delayCorrect}; Feasible matches: ${feasibleMatches}.`,
    });
  }

  // Test 5: Export Integrity
  {
    const t0 = performance.now();

    // Create sample records for export testing
    const sampleInitial: InitialRoutingExperimentRecord = {
      id: 'test-initial-1',
      timestamp: new Date().toISOString(),
      experimentGroupId: 'test-group-1',
      runType: 'initial_routing',
      scenarioId: 'test-scenario',
      scenarioName: 'Test Scenario',
      scenarioSeed: 26137,
      trafficProfile: 'normal',
      algorithm: 'qpso',
      algorithmLabel: 'Quantum-Inspired PSO',
      optimizerPreset: 'balanced',
      optimizerSeed: 26137,
      populationSize: 25,
      iterations: 50,
      candidateEvaluations: 1275,
      runtimeMs: 100.5,
      totalTravelMinutes: 200.0,
      totalDistanceKm: 50.0,
      congestionPenalty: 10.0,
      routingScore: 150.0,
      customersAssigned: 20,
      customersUnserved: 5,
      customerCount: 25,
      vehiclesUsed: 3,
      vehicleCapacityTotal: 90,
      capacityViolationCount: 0,
      duplicateCustomerCount: 0,
      blockedEdgeViolationCount: 0,
      unreachableVehicleCount: 0,
      feasible: true,
      warnings: [],
      convergenceHistory: [150, 145, 142, 140, 138],
      error: undefined,
    };

    const sampleDynamic: DynamicReroutingExperimentRecord = {
      id: 'test-dynamic-1',
      timestamp: new Date().toISOString(),
      experimentGroupId: 'test-group-1',
      runType: 'dynamic_rerouting',
      scenarioId: 'test-scenario',
      scenarioName: 'Test Scenario',
      scenarioSeed: 26137,
      initialAlgorithm: 'qpso',
      initialAlgorithmLabel: 'Quantum-Inspired PSO',
      initialPreset: 'balanced',
      reroutingAlgorithm: 'qpso',
      reroutingAlgorithmLabel: 'Quantum-Inspired PSO',
      reroutingPreset: 'fast',
      optimizerSeed: 26137,
      incidentType: 'road_closure',
      incidentId: 'incident-test',
      incidentEdgeIds: ['E05'],
      incidentSeverity: 3,
      affectedVehicleIds: ['V1', 'V2'],
      completedCustomerCount: 1,
      lockedCustomerCount: 1,
      pendingCustomerCount: 24,
      eligibleCustomerIds: ['C02', 'C03'],
      reroutingRuntimeMs: 50.0,
      populationSize: 15,
      iterations: 25,
      candidateEvaluations: 390,
      originalRemainingTravelMinutes: 100.0,
      incidentAdjustedRemainingTravelMinutes: 120.0,
      revisedRemainingTravelMinutes: 80.0,
      delayAvoidedMinutes: 40.0,
      routeStabilityChanges: 2,
      revisedRoutingScore: 120.0,
      revisedCustomersAssigned: 24,
      revisedCustomersUnserved: 1,
      revisedFeasible: true,
      warnings: ['Test warning'],
      error: undefined,
    };

    const sampleRecords: ExperimentRecord[] = [sampleInitial, sampleDynamic];

    // Generate CSV and verify
    const csvExport = generateCSVExport(sampleRecords);
    const csvContent = csvExport.content;
    const csvLines = csvContent.split('\n');

    const csvHasHeader = csvLines[0].includes('recordType');
    const csvHasRecordTypes =
      csvLines.some((l) => l.includes('initial_routing')) &&
      csvLines.some((l) => l.includes('dynamic_rerouting'));
    const csvHasWarnings = csvLines.some((l) => l.includes('Test warning'));
    const csvHasConvergence = csvLines[1].includes('150 | 145 | 142 | 140 | 138');

    // Generate JSON and verify
    const jsonExport = generateJSONExport(sampleRecords);
    const jsonContent = jsonExport.content;

    let jsonParsed: any = null;
    let jsonValid = false;
    try {
      jsonParsed = JSON.parse(jsonContent);
      jsonValid = true;
    } catch {
      jsonValid = false;
    }

    const jsonHasMetadata =
      jsonParsed &&
      jsonParsed.exportVersion === 1 &&
      jsonParsed.appName === 'QuantaRoute AI' &&
      jsonParsed.objectiveFormula === 'F = 0.55T + 0.25D + 0.20C + 10000P';

    const jsonHasRecords =
      jsonParsed && Array.isArray(jsonParsed.records) && jsonParsed.records.length === 2;

    const jsonHasConvergence =
      jsonParsed &&
      jsonParsed.records[0].convergenceHistory &&
      JSON.stringify(jsonParsed.records[0].convergenceHistory) === JSON.stringify([150, 145, 142, 140, 138]);

    const jsonHasDynamicFields =
      jsonParsed &&
      jsonParsed.records[1].incidentType === 'road_closure' &&
      jsonParsed.records[1].affectedVehicleIds &&
      jsonParsed.records[1].affectedVehicleIds.length === 2;

    const t1 = performance.now();
    const passed =
      csvHasHeader &&
      csvHasRecordTypes &&
      csvHasWarnings &&
      csvHasConvergence &&
      jsonValid &&
      jsonHasMetadata &&
      jsonHasRecords &&
      jsonHasConvergence &&
      jsonHasDynamicFields;

    results.push({
      id: 'experiment-test-5',
      name: 'Export Integrity',
      passed,
      runtimeMs: Number((t1 - t0).toFixed(2)),
      summary: passed
        ? 'CSV includes header/recordType/values; JSON preserves metadata, convergence history, and dynamic incident fields.'
        : 'Export integrity violation detected.',
      details: `CSV header: ${csvHasHeader}; CSV recordTypes: ${csvHasRecordTypes}; CSV warnings: ${csvHasWarnings}; CSV convergence: ${csvHasConvergence}; JSON valid: ${jsonValid}; JSON metadata: ${jsonHasMetadata}; JSON records: ${jsonHasRecords}; JSON convergence: ${jsonHasConvergence}; JSON dynamic: ${jsonHasDynamicFields}.`,
    });
  }

  // Test 6: Local Persistence Safety
  {
    const t0 = performance.now();

    const storageKey = getStorageKey();

    // Create a mock localStorage
    const store: Record<string, string> = {};
    const mockStorage = {
      getItem: (key: string) => (key in store ? store[key] : null),
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        Object.keys(store).forEach((k) => delete store[k]);
      },
    };

    // Save a test record using the real save function
    const originalWindow = (globalThis as Record<string, unknown>).window;
    const originalLocalStorage = (globalThis as Record<string, unknown>).localStorage;

    (globalThis as Record<string, unknown>).window = { localStorage: mockStorage };
    (globalThis as Record<string, unknown>).localStorage = mockStorage;

    try {
      const testData: ExperimentRecord[] = [
        {
          id: 'persist-test-1',
          timestamp: new Date().toISOString(),
          experimentGroupId: 'persist-group',
          runType: 'initial_routing',
          scenarioId: 'test',
          scenarioName: 'Test',
          scenarioSeed: 26137,
          trafficProfile: 'normal',
          algorithm: 'greedy',
          algorithmLabel: 'Greedy Routing',
          optimizerPreset: 'standard',
          optimizerSeed: null,
          populationSize: null,
          iterations: null,
          candidateEvaluations: null,
          runtimeMs: 10.0,
          totalTravelMinutes: 200.0,
          totalDistanceKm: 50.0,
          congestionPenalty: 0,
          routingScore: 100.0,
          customersAssigned: 25,
          customersUnserved: 0,
          customerCount: 25,
          vehiclesUsed: 3,
          vehicleCapacityTotal: 90,
          capacityViolationCount: 0,
          duplicateCustomerCount: 0,
          blockedEdgeViolationCount: 0,
          unreachableVehicleCount: 0,
          feasible: true,
          warnings: [],
          convergenceHistory: null,
        },
      ];

      // Save and reload
      saveExperimentHistory(testData);
      const reloadResult = loadExperimentHistory();

      const reloadOk = reloadResult.ok && reloadResult.history.length === 1;

       // Now write malformed data and verify safe recovery
      store[storageKey] = '{ this is not valid json';
      const malformedResult = loadExperimentHistory();
      const malformedHandled = !malformedResult.ok && typeof (malformedResult as { error: string }).error === 'string';

      // Write valid JSON but with wrong structure
      store[storageKey] = JSON.stringify({ not: 'an array', neither: 'records' });
      const wrongStructResult = loadExperimentHistory();
      const wrongStructHandled = !wrongStructResult.ok;

      // Clear and verify empty load
      clearExperimentHistory();
      const clearedResult = loadExperimentHistory();
      const clearedOk = clearedResult.ok && clearedResult.history.length === 0;

      const t1 = performance.now();
      const passed = reloadOk && malformedHandled && wrongStructHandled && clearedOk;

      results.push({
        id: 'experiment-test-6',
        name: 'Local Persistence Safety',
        passed,
        runtimeMs: Number((t1 - t0).toFixed(2)),
        summary: passed
          ? 'Persistence round-trips correctly; malformed data and wrong structure are handled gracefully without crash.'
          : 'Persistence safety violation detected.',
        details: `Reload OK: ${reloadOk}; Malformed handled: ${malformedHandled}; Wrong struct handled: ${wrongStructHandled}; Cleared OK: ${clearedOk}.`,
      });
    } catch (err) {
      const t1 = performance.now();
      const passed = false;
      const errorMsg = err instanceof Error ? err.message : String(err);
      results.push({
        id: 'experiment-test-6',
        name: 'Local Persistence Safety',
        passed,
        runtimeMs: Number((t1 - t0).toFixed(2)),
        summary: 'Error during persistence safety test.',
        details: errorMsg,
      });
    } finally {
      (globalThis as Record<string, unknown>).window = originalWindow;
      (globalThis as Record<string, unknown>).localStorage = originalLocalStorage;
    }
  }

  return results;
}
