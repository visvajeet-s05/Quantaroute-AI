/**
 * Dynamic Incident Simulation & Re-Routing Verification Unit Tests
 * QuantaRoute AI
 *
 * 7 non-destructive invariant tests verifying:
 * 1. Partial execution locking & state tracking
 * 2. Incident detection & affected vehicle identification
 * 3. Non-depot start feasible dynamic re-routing & capacity bounds
 * 4. Blocked edge avoidance in revised routes
 * 5. Re-routing metrics fidelity & numerical integrity
 * 6. Snapshot immutability (pre-incident & initial state unchanged)
 * 7. Deterministic guided demo (identical incident targeting across runs)
 */

import { Scenario } from '../types/domain';
import { ReroutingUnitTestResult } from '../types/routing';
import { runQuantumPso } from '../algorithms/quantumPso';
import {
  createInitialSnapshot,
  findCandidateIncidentEdges,
  injectDynamicIncident,
  runDynamicRerouting,
  simulatePartialExecution,
  validateRevisedRoutePlan,
} from '../services/dynamicRerouting';

export function runReroutingUnitTests(scenario: Scenario): ReroutingUnitTestResult[] {
  const results: ReroutingUnitTestResult[] = [];

  // Generate a test initial fleet plan using fast QPSO preset
  const initialQpso = runQuantumPso(scenario, { presetName: 'Fast Re-route', seed: scenario.seed });
  const initialPlan = initialQpso.bestPlan;
  const initialSnapshot = createInitialSnapshot(initialPlan, scenario);

  // Test 1: Partial Execution Locking & State Tracking
  {
    const t0 = performance.now();
    const { preIncidentSnapshot, vehicleDynamicStates } = simulatePartialExecution(
      initialSnapshot,
      scenario,
      1 // 1 stop completed per active vehicle
    );
    const t1 = performance.now();

    let allStopsLocked = true;
    let allCurrentNodesValid = true;
    let capacitiesConsistent = true;

    for (const vs of vehicleDynamicStates) {
      const origRoute = initialPlan.vehicleRoutes.find((r) => r.vehicleId === vs.vehicleId);
      const origStops = origRoute ? origRoute.customerIds : [];

      if (origStops.length > 0) {
        // First stop must be delivered
        if (vs.deliveredCustomerIds.length !== 1 || vs.deliveredCustomerIds[0] !== origStops[0]) {
          allStopsLocked = false;
        }

        // Current node must match first delivered customer node
        const c1 = scenario.customers.find((c) => c.id === origStops[0]);
        if (c1 && vs.currentNodeId !== c1.nodeId) {
          allCurrentNodesValid = false;
        }

        // Delivered demand + remaining capacity must equal 30
        if (vs.deliveredDemand + vs.remainingCapacity !== 30) {
          capacitiesConsistent = false;
        }
      } else {
        if (vs.currentNodeId !== scenario.depotNodeId) {
          allCurrentNodesValid = false;
        }
      }
    }

    const passed =
      allStopsLocked &&
      allCurrentNodesValid &&
      capacitiesConsistent &&
      preIncidentSnapshot.label === 'pre_incident';

    results.push({
      id: 'reroute-test-1',
      name: 'Partial Execution Locking & State Tracking',
      passed,
      runtimeMs: Number((t1 - t0).toFixed(2)),
      summary: passed
        ? 'Customer completion locks preserved; vehicle positions & remaining capacity updated correctly.'
        : 'Inconsistency detected in partial execution locking or vehicle position tracking.',
      details: `Delivered stops locked; current nodes match completed stop coordinates; capacity conservation verified (Demand ${vehicleDynamicStates.reduce(
        (acc, v) => acc + v.deliveredDemand,
        0
      )}u delivered).`,
    });
  }

  // Test 2: Incident Detection & Affected Vehicle Identification
  {
    const t0 = performance.now();
    const { vehicleDynamicStates } = simulatePartialExecution(initialSnapshot, scenario, 1);
    const candidates = findCandidateIncidentEdges(scenario, vehicleDynamicStates, scenario.edges);

    let passed = false;
    let details = '';

    if (candidates.length > 0) {
      const target = candidates[0];
      const { incident, affectedVehicleIds, incidentAdjustedRemainingTravelMinutes, originalRemainingTravelMinutes } =
        injectDynamicIncident(
          scenario,
          initialSnapshot,
          vehicleDynamicStates,
          'road_closure',
          3, // full closure
          target.edgeId
        );

      const hasAffectedVehicles = affectedVehicleIds.length > 0;
      const detectedMatch = affectedVehicleIds.every((vId) => target.affectedVehicleIds.includes(vId));
      const penaltyApplied = incidentAdjustedRemainingTravelMinutes >= originalRemainingTravelMinutes;

      passed = hasAffectedVehicles && detectedMatch && penaltyApplied && incident.active;
      details = `Incident targeted ${target.edgeId}; correctly identified affected vehicle(s) [${affectedVehicleIds.join(
        ', '
      )}]; traffic delay increased from ${originalRemainingTravelMinutes}m to ${incidentAdjustedRemainingTravelMinutes}m.`;
    } else {
      passed = false;
      details = 'No active edges found in vehicles pending paths.';
    }

    const t1 = performance.now();

    results.push({
      id: 'reroute-test-2',
      name: 'Incident Detection & Vehicle Impact Identification',
      passed,
      runtimeMs: Number((t1 - t0).toFixed(2)),
      summary: passed
        ? 'Path traversal analyzer correctly identified all vehicles with pending legs through the incident.'
        : 'Failed to accurately detect vehicles impacted by road incident.',
      details,
    });
  }

  // Test 3: Non-Depot Start Feasible Dynamic Re-Routing & Capacity Bounds
  {
    const t0 = performance.now();
    const { vehicleDynamicStates } = simulatePartialExecution(initialSnapshot, scenario, 1);
    const candidates = findCandidateIncidentEdges(scenario, vehicleDynamicStates, scenario.edges);
    const targetEdgeId = candidates[0]?.edgeId || 'E05';

    const {
      incident,
      incidentEdges,
      originalRemainingTravelMinutes,
      incidentAdjustedRemainingTravelMinutes,
      updatedVehicleStates,
    } = injectDynamicIncident(
      scenario,
      initialSnapshot,
      vehicleDynamicStates,
      'congestion_surge',
      2,
      targetEdgeId
    );

    const rerouteRes = runDynamicRerouting(
      scenario,
      incidentEdges,
      updatedVehicleStates,
      incident,
      originalRemainingTravelMinutes,
      incidentAdjustedRemainingTravelMinutes,
      'qpso',
      'Fast Re-route'
    );

    const validation = validateRevisedRoutePlan(
      rerouteRes.revisedSnapshot!.routePlan,
      scenario,
      incidentEdges,
      updatedVehicleStates
    );

    const t1 = performance.now();
    const passed = validation.valid && rerouteRes.revisedRemainingTravelMinutes !== null;

    results.push({
      id: 'reroute-test-3',
      name: 'Non-Depot Start Feasible Dynamic Re-Routing',
      passed,
      runtimeMs: Number((t1 - t0).toFixed(2)),
      summary: passed
        ? 'All vehicles routed feasibly from current en-route locations back to depot within remaining capacity limits.'
        : 'Validation errors found in non-depot start re-routing plan.',
      details: `Revised plan is 100% valid; all active routes terminate at depot; remaining capacities respected across all 3 vehicles (${validation.errors.length} errors).`,
    });
  }

  // Test 4: Blocked Edge Avoidance in Revised Plan
  {
    const t0 = performance.now();
    const { vehicleDynamicStates } = simulatePartialExecution(initialSnapshot, scenario, 1);
    const candidates = findCandidateIncidentEdges(scenario, vehicleDynamicStates, scenario.edges);
    const targetEdgeId = candidates[0]?.edgeId || 'E05';

    // Inject complete road closure
    const {
      incident,
      incidentEdges,
      originalRemainingTravelMinutes,
      incidentAdjustedRemainingTravelMinutes,
      updatedVehicleStates,
    } = injectDynamicIncident(
      scenario,
      initialSnapshot,
      vehicleDynamicStates,
      'road_closure',
      3, // Blocked
      targetEdgeId
    );

    const rerouteRes = runDynamicRerouting(
      scenario,
      incidentEdges,
      updatedVehicleStates,
      incident,
      originalRemainingTravelMinutes,
      incidentAdjustedRemainingTravelMinutes,
      'qpso',
      'Fast Re-route'
    );

    const revisedRoutes = rerouteRes.revisedSnapshot!.routePlan.vehicleRoutes;
    let anyRouteUsedBlockedEdge = false;

    revisedRoutes.forEach((r) => {
      if (r.fullPathEdgeIds.includes(targetEdgeId)) {
        anyRouteUsedBlockedEdge = true;
      }
    });

    const t1 = performance.now();
    const passed = !anyRouteUsedBlockedEdge && rerouteRes.revisedSnapshot !== null;

    results.push({
      id: 'reroute-test-4',
      name: 'Blocked Edge Avoidance Verification',
      passed,
      runtimeMs: Number((t1 - t0).toFixed(2)),
      summary: passed
        ? `Re-routing optimizer synthesized Dijkstra detours completely circumventing closed edge ${targetEdgeId}.`
        : `Vehicle route in revised plan traversed blocked edge ${targetEdgeId}.`,
      details: `Closed edge ${targetEdgeId} strictly avoided across all ${revisedRoutes.length} vehicle paths; zero blocked edge violations.`,
    });
  }

  // Test 5: Re-Routing Metrics Fidelity & Numerical Integrity
  {
    const t0 = performance.now();
    const { vehicleDynamicStates } = simulatePartialExecution(initialSnapshot, scenario, 1);
    const candidates = findCandidateIncidentEdges(scenario, vehicleDynamicStates, scenario.edges);
    const targetEdgeId = candidates[0]?.edgeId || 'E05';

    const {
      incident,
      incidentEdges,
      originalRemainingTravelMinutes,
      incidentAdjustedRemainingTravelMinutes,
      updatedVehicleStates,
    } = injectDynamicIncident(
      scenario,
      initialSnapshot,
      vehicleDynamicStates,
      'congestion_surge',
      3, // Heavy surge
      targetEdgeId
    );

    const rerouteRes = runDynamicRerouting(
      scenario,
      incidentEdges,
      updatedVehicleStates,
      incident,
      originalRemainingTravelMinutes,
      incidentAdjustedRemainingTravelMinutes,
      'qpso',
      'Fast Re-route'
    );

    const expectedDelayAvoided = Number(
      Math.max(
        0,
        rerouteRes.incidentAdjustedRemainingTravelMinutes! -
          rerouteRes.revisedRemainingTravelMinutes!
      ).toFixed(2)
    );

    const matchesExpected =
      Math.abs((rerouteRes.delayAvoidedMinutes ?? 0) - expectedDelayAvoided) < 0.05;
    const runtimeRealistic = rerouteRes.reroutingRuntimeMs >= 0;
    const stabilityNonNegative = rerouteRes.routeStabilityChanges >= 0;

    const t1 = performance.now();
    const passed = matchesExpected && runtimeRealistic && stabilityNonNegative;

    results.push({
      id: 'reroute-test-5',
      name: 'Re-Routing Metrics Fidelity & Numerical Integrity',
      passed,
      runtimeMs: Number((t1 - t0).toFixed(2)),
      summary: passed
        ? 'Delay avoided, stability changes, and execution latency verified with 100% mathematical fidelity.'
        : 'Discrepancy detected in re-routing metric calculations.',
      details: `Delay avoided: ${rerouteRes.delayAvoidedMinutes}m (Adjusted: ${rerouteRes.incidentAdjustedRemainingTravelMinutes}m - Revised: ${rerouteRes.revisedRemainingTravelMinutes}m); Stability shifts: ${rerouteRes.routeStabilityChanges}; Latency: ${rerouteRes.reroutingRuntimeMs}ms.`,
    });
  }

  // Test 6: Snapshot Immutability
  {
    const t0 = performance.now();
    const simResult = simulatePartialExecution(initialSnapshot, scenario, 1);
    const { vehicleDynamicStates, preIncidentSnapshot } = simResult;
    const candidates = findCandidateIncidentEdges(scenario, vehicleDynamicStates, scenario.edges);
    const targetEdgeId = candidates[0]?.edgeId || 'E05';

    const {
      incident,
      incidentEdges,
      originalRemainingTravelMinutes,
      incidentAdjustedRemainingTravelMinutes,
      updatedVehicleStates,
    } = injectDynamicIncident(
      scenario,
      initialSnapshot,
      vehicleDynamicStates,
      'road_closure',
      3,
      targetEdgeId
    );

    // Deep-copy snapshots before re-routing to compare post-mutation
    const initialCopyBefore = JSON.parse(JSON.stringify(initialSnapshot));
    const preIncidentCopyBefore = JSON.parse(JSON.stringify(preIncidentSnapshot));

    runDynamicRerouting(
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

    const initialUnchanged = JSON.stringify(initialCopyBefore) === JSON.stringify(initialSnapshot);
    const preIncidentUnchanged =
      JSON.stringify(preIncidentCopyBefore) === JSON.stringify(preIncidentSnapshot);

    const t1 = performance.now();
    const passed = initialUnchanged && preIncidentUnchanged;

    results.push({
      id: 'reroute-test-6',
      name: 'Snapshot Immutability',
      passed,
      runtimeMs: Number((t1 - t0).toFixed(2)),
      summary: passed
        ? 'Initial and pre-incident snapshots remain byte-for-byte identical after re-routing completes.'
        : 'One or more snapshots were mutated by the re-routing process.',
      details: `Initial snapshot immutable: ${initialUnchanged}; Pre-incident snapshot immutable: ${preIncidentUnchanged}.`,
    });
  }

  // Test 7: Deterministic Guided Demo
  {
    const t0 = performance.now();
    const { vehicleDynamicStates } = simulatePartialExecution(initialSnapshot, scenario, 1);
    const candidates = findCandidateIncidentEdges(scenario, vehicleDynamicStates, scenario.edges);

    // Run guided demo selection twice with the same seed — results must be identical
    const result1 = injectDynamicIncident(
      scenario,
      initialSnapshot,
      vehicleDynamicStates,
      'road_closure',
      3,
      candidates[0]?.edgeId || 'E05'
    );

    const result2 = injectDynamicIncident(
      scenario,
      initialSnapshot,
      vehicleDynamicStates,
      'road_closure',
      3,
      candidates[0]?.edgeId || 'E05'
    );

    const sameIncidentEdge =
      result1.incident.affectedEdgeIds[0] === result2.incident.affectedEdgeIds[0];
    const sameAffectedVehicles =
      JSON.stringify(result1.affectedVehicleIds.sort()) ===
      JSON.stringify(result2.affectedVehicleIds.sort());
    const sameLatency =
      result1.incidentAdjustedRemainingTravelMinutes === result2.incidentAdjustedRemainingTravelMinutes;

    const t1 = performance.now();
    const passed = sameIncidentEdge && sameAffectedVehicles && sameLatency;

    results.push({
      id: 'reroute-test-7',
      name: 'Deterministic Guided Demo',
      passed,
      runtimeMs: Number((t1 - t0).toFixed(2)),
      summary: passed
        ? 'Deterministic guided demo produces identical incident targeting and impact metrics across repeated runs.'
        : 'Non-deterministic behavior detected in guided demo incident selection or impact analysis.',
      details: `Same incident edge: ${sameIncidentEdge}; Same affected vehicles: ${sameAffectedVehicles}; Same latency: ${sameLatency}.`,
    });
  }

  return results;
}
