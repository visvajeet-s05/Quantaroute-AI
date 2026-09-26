import { Edge, Scenario, Vehicle } from '../types/domain';
import { GreedyUnitTestResult } from '../types/routing';
import { runGreedyRouting } from '../algorithms/greedyRouting';
import { validateRoutePlan } from '../services/routePlanValidator';

/**
 * Runs 5 non-destructive verification tests for the Greedy Routing Baseline.
 * Uses isolated copies so active scenario state is never mutated.
 */
export function runGreedyUnitTests(scenario: Scenario): GreedyUnitTestResult[] {
  const results: GreedyUnitTestResult[] = [];

  // Test 1: Normal scenario coverage and capacity
  {
    const t0 = performance.now();
    const plan = runGreedyRouting(scenario);
    const validation = validateRoutePlan(plan, scenario);
    const t1 = performance.now();

    const noDuplicates = plan.duplicateCustomerIds.length === 0;
    const capacityOk = plan.capacityViolationVehicleIds.length === 0;
    const allDepot = plan.vehicleRoutes.every(
      (r) => r.startsAtDepot && (r.customerIds.length === 0 || r.endsAtDepot)
    );
    const coverageSumMatches =
      plan.customersServed + plan.unservedCustomerIds.length === scenario.customers.length;

    const passed =
      validation.valid &&
      noDuplicates &&
      capacityOk &&
      allDepot &&
      coverageSumMatches;

    results.push({
      id: 'greedy_test_1',
      name: 'Test 1: Normal Scenario Coverage & Capacity Constraints',
      passed,
      runtimeMs: Number((t1 - t0).toFixed(3)),
      summary: passed
        ? `Greedy assigned ${plan.customersServed}/${plan.customerCount} customers across 3 vehicles without capacity violations.`
        : `Greedy failed coverage/capacity check: ${validation.errors.join('; ')}`,
      details: [
        `Customers Assigned: ${plan.customersServed} / ${plan.customerCount}`,
        `Unserved Customers: ${plan.unservedCustomerIds.length}`,
        `Capacity Violations: ${plan.capacityViolationVehicleIds.length}`,
        `Duplicate Customer Visits: ${plan.duplicateCustomerIds.length}`,
        `All Routes Start & End at Depot: ${allDepot ? 'YES' : 'NO'}`,
      ],
    });
  }

  // Test 2: Route path continuity
  {
    const t0 = performance.now();
    const plan = runGreedyRouting(scenario);
    const edgeMap = new Map<string, Edge>();
    scenario.edges.forEach((e) => edgeMap.set(e.id, e));

    let continuityOk = true;
    let noBlocked = true;
    let sumsMatch = true;

    for (const route of plan.vehicleRoutes) {
      if (route.fullPathEdgeIds.length > 0) {
        let routeTimeSum = 0;
        let routeDistSum = 0;

        for (let i = 0; i < route.fullPathEdgeIds.length; i++) {
          const eId = route.fullPathEdgeIds[i];
          const edge = edgeMap.get(eId);
          if (!edge) {
            continuityOk = false;
            break;
          }
          if (edge.isBlocked) {
            noBlocked = false;
          }
          const u = route.fullPathNodeIds[i];
          const v = route.fullPathNodeIds[i + 1];
          if (edge.from !== u || edge.to !== v) {
            continuityOk = false;
          }
          routeTimeSum += edge.baseTravelMinutes * edge.congestionMultiplier;
          routeDistSum += edge.distanceKm;
        }

        if (
          Math.abs(routeTimeSum - route.travelMinutes) > 1e-4 ||
          Math.abs(routeDistSum - route.distanceKm) > 1e-4
        ) {
          sumsMatch = false;
        }
      }
    }

    const t1 = performance.now();
    const passed = continuityOk && noBlocked && sumsMatch;

    results.push({
      id: 'greedy_test_2',
      name: 'Test 2: Route Path Continuity & Physical Edge Sums',
      passed,
      runtimeMs: Number((t1 - t0).toFixed(3)),
      summary: passed
        ? 'All route segments maintain 100% graph connectivity with exact mathematical cost sums.'
        : 'Path continuity or edge cost mismatch detected.',
      details: [
        `Directed Edge Continuity: ${continuityOk ? 'PASS' : 'FAIL'}`,
        `Zero Blocked Edges: ${noBlocked ? 'PASS' : 'FAIL'}`,
        `Travel Time & Distance Edge Sum Equality: ${sumsMatch ? 'PASS' : 'FAIL'}`,
      ],
    });
  }

  // Test 3: Capacity enforcement
  {
    const t0 = performance.now();
    // Create copy with V1 capacity artificially lowered to 10
    const constrainedVehicles: Vehicle[] = scenario.vehicles.map((v) =>
      v.id === 'V1' ? { ...v, capacity: 10 } : { ...v }
    );
    const constrainedScenario: Scenario = {
      ...scenario,
      vehicles: constrainedVehicles,
    };

    const plan = runGreedyRouting(constrainedScenario);
    const t1 = performance.now();

    const v1Route = plan.vehicleRoutes.find((r) => r.vehicleId === 'V1');
    const v1LoadWithin10 = v1Route ? v1Route.usedCapacity <= 10 : false;
    const totalCountMatches =
      plan.customersServed + plan.unservedCustomerIds.length === scenario.customers.length;

    const passed = v1LoadWithin10 && totalCountMatches;

    results.push({
      id: 'greedy_test_3',
      name: 'Test 3: Capacity Enforcement with Constrained Fleet',
      passed,
      runtimeMs: Number((t1 - t0).toFixed(3)),
      summary: passed
        ? `Strict capacity limit enforced: V1 load = ${v1Route?.usedCapacity}u <= 10u. Overflows safely preserved in unserved list.`
        : 'Capacity limit violated on constrained vehicle.',
      details: [
        `V1 Configured Capacity: 10 units`,
        `V1 Used Capacity: ${v1Route?.usedCapacity} units`,
        `Unserved Customers Tracked: ${plan.unservedCustomerIds.length}`,
        `No Customer Silently Dropped: ${totalCountMatches ? 'PASS' : 'FAIL'}`,
      ],
    });
  }

  // Test 4: Blocked-road avoidance
  {
    const t0 = performance.now();
    // Block first 3 edges connected to depot
    const depotOutgoing = scenario.edges.filter((e) => e.from === scenario.depotNodeId);
    const blockedEdgeIds = depotOutgoing.slice(0, 2).map((e) => e.id);

    const blockedEdges: Edge[] = scenario.edges.map((e) =>
      blockedEdgeIds.includes(e.id) ? { ...e, isBlocked: true } : { ...e }
    );
    const blockedScenario: Scenario = {
      ...scenario,
      edges: blockedEdges,
    };

    const plan = runGreedyRouting(blockedScenario);
    const t1 = performance.now();

    let traversedBlocked = false;
    for (const r of plan.vehicleRoutes) {
      for (const eId of r.fullPathEdgeIds) {
        if (blockedEdgeIds.includes(eId)) {
          traversedBlocked = true;
          break;
        }
      }
    }

    const passed = !traversedBlocked;

    results.push({
      id: 'greedy_test_4',
      name: 'Test 4: Blocked-Road Avoidance (Detour Compliance)',
      passed,
      runtimeMs: Number((t1 - t0).toFixed(3)),
      summary: passed
        ? `Vehicles successfully avoided ${blockedEdgeIds.length} artificially blocked arterial segments.`
        : 'Route path mistakenly traversed a blocked street segment.',
      details: [
        `Target Blocked Edge IDs: ${blockedEdgeIds.join(', ')}`,
        `Traversed Blocked Segment: ${traversedBlocked ? 'YES (FAIL)' : 'NO (PASS)'}`,
        `Routing Plan Recomputed Under Obstacles: ${plan.totalTravelMinutes.toFixed(2)} min`,
      ],
    });
  }

  // Test 5: Determinism
  {
    const t0 = performance.now();
    const runA = runGreedyRouting(scenario);
    const runB = runGreedyRouting(scenario);
    const t1 = performance.now();

    const sameScore = Math.abs(runA.routingScore - runB.routingScore) < 1e-6;
    const sameTime = Math.abs(runA.totalTravelMinutes - runB.totalTravelMinutes) < 1e-6;
    const sameDist = Math.abs(runA.totalDistanceKm - runB.totalDistanceKm) < 1e-6;

    let sameStops = true;
    for (let i = 0; i < runA.vehicleRoutes.length; i++) {
      const stopsA = runA.vehicleRoutes[i].customerIds.join(',');
      const stopsB = runB.vehicleRoutes[i].customerIds.join(',');
      if (stopsA !== stopsB) {
        sameStops = false;
        break;
      }
    }

    const passed = sameScore && sameTime && sameDist && sameStops;

    results.push({
      id: 'greedy_test_5',
      name: 'Test 5: Deterministic Fleet Solution Reproducibility',
      passed,
      runtimeMs: Number((t1 - t0).toFixed(3)),
      summary: passed
        ? `100% identical multi-vehicle stop sequences, travel times, and score (${runA.routingScore.toFixed(2)}) across consecutive runs.`
        : 'Non-deterministic result variance detected.',
      details: [
        `Run A Score: ${runA.routingScore.toFixed(4)} | Run B Score: ${runB.routingScore.toFixed(4)}`,
        `Total Travel Time A vs B: ${runA.totalTravelMinutes.toFixed(4)} vs ${runB.totalTravelMinutes.toFixed(4)} min`,
        `Identical Stop Sequences: ${sameStops ? 'YES' : 'NO'}`,
      ],
    });
  }

  return results;
}
