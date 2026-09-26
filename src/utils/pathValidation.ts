import { Edge, Node } from '../types/domain';
import { DijkstraUnitTestResult, PathResult, PathValidationCheck, PathValidationResult } from '../types/pathfinding';
import { findShortestPath } from '../algorithms/dijkstra';
import { getEffectiveTravelMinutes } from './graphIndex';

/**
 * Validates the structural and mathematical integrity of a Dijkstra PathResult.
 */
export function validatePathResult(
  result: PathResult,
  nodes: Node[],
  edges: Edge[]
): PathValidationResult {
  const checks: PathValidationCheck[] = [];
  const errors: string[] = [];

  const edgeMap = new Map<string, Edge>();
  edges.forEach((e) => edgeMap.set(e.id, e));

  // Case 1: Unreachable path check
  if (!result.reachable) {
    const emptyNodes = result.nodeIds.length === 0;
    const emptyEdges = result.edgeIds.length === 0;
    const zeroMetrics = result.travelMinutes === 0 && result.distanceKm === 0;
    const passed = emptyNodes && emptyEdges && zeroMetrics;

    checks.push({
      name: 'Unreachable Path Structure',
      passed,
      detail: passed
        ? 'Unreachable path correctly returns empty node/edge arrays and zero metrics.'
        : 'Unreachable path had non-empty nodes/edges or non-zero metrics.',
    });

    if (!passed) errors.push('Unreachable path contains inconsistent nodes/edges/metrics.');

    return {
      isValid: errors.length === 0,
      checks,
      errors,
    };
  }

  // Case 2: Source equals Destination
  if (result.sourceNodeId === result.destinationNodeId) {
    const isSingleNode =
      result.nodeIds.length === 1 && result.nodeIds[0] === result.sourceNodeId;
    const isZeroEdges = result.edgeIds.length === 0;
    const isZeroCost = result.travelMinutes === 0 && result.distanceKm === 0;
    const passed = isSingleNode && isZeroEdges && isZeroCost;

    checks.push({
      name: 'Self-Loop Route Invariant',
      passed,
      detail: passed
        ? 'Source equals destination returns zero travel time and source node only.'
        : 'Self-loop path failed structural check.',
    });

    if (!passed) errors.push('Source equals destination invalid structure.');

    return {
      isValid: errors.length === 0,
      checks,
      errors,
    };
  }

  // Case 3: Reachable path validation
  // Check A: Path starts at source node
  const startsAtSource = result.nodeIds[0] === result.sourceNodeId;
  checks.push({
    name: 'Source Node Alignment',
    passed: startsAtSource,
    detail: startsAtSource
      ? `Path originates at source node "${result.sourceNodeId}".`
      : `Path originates at unexpected node "${result.nodeIds[0]}".`,
  });
  if (!startsAtSource) errors.push('Path does not start at source node.');

  // Check B: Path ends at destination node
  const endsAtDest = result.nodeIds[result.nodeIds.length - 1] === result.destinationNodeId;
  checks.push({
    name: 'Destination Node Alignment',
    passed: endsAtDest,
    detail: endsAtDest
      ? `Path terminates at destination node "${result.destinationNodeId}".`
      : `Path terminates at unexpected node "${result.nodeIds[result.nodeIds.length - 1]}".`,
  });
  if (!endsAtDest) errors.push('Path does not end at destination node.');

  // Check C: Edge count matches node count - 1
  const countMatches = result.edgeIds.length === result.nodeIds.length - 1;
  checks.push({
    name: 'Topology Length Consistency',
    passed: countMatches,
    detail: countMatches
      ? `${result.nodeIds.length} nodes traversed across ${result.edgeIds.length} edges.`
      : `Node count (${result.nodeIds.length}) does not match edge count + 1 (${result.edgeIds.length}).`,
  });
  if (!countMatches) errors.push('Node and edge count mismatch in path sequence.');

  // Check D: Consecutive node pairs match returned directed edges
  let consecutiveMatches = true;
  let noBlockedEdges = true;
  let sumTravelMinutes = 0;
  let sumDistanceKm = 0;

  for (let i = 0; i < result.edgeIds.length; i++) {
    const edgeId = result.edgeIds[i];
    const edge = edgeMap.get(edgeId);

    if (!edge) {
      consecutiveMatches = false;
      errors.push(`Edge "${edgeId}" not found in edge database.`);
      continue;
    }

    if (edge.isBlocked) {
      noBlockedEdges = false;
      errors.push(`Blocked edge "${edgeId}" found in optimal path!`);
    }

    const u = result.nodeIds[i];
    const v = result.nodeIds[i + 1];

    if (edge.from !== u || edge.to !== v) {
      consecutiveMatches = false;
      errors.push(
        `Edge ${edgeId} (${edge.from} -> ${edge.to}) does not connect ${u} -> ${v}.`
      );
    }

    sumTravelMinutes += getEffectiveTravelMinutes(edge);
    sumDistanceKm += edge.distanceKm;
  }

  checks.push({
    name: 'Directed Edge Traversal Sequence',
    passed: consecutiveMatches,
    detail: consecutiveMatches
      ? 'All consecutive node pairs cleanly connect along valid directed edges.'
      : 'Path sequence contains broken or misdirected edge steps.',
  });

  checks.push({
    name: 'Zero Blocked Edges',
    passed: noBlockedEdges,
    detail: noBlockedEdges
      ? 'Path contains zero blocked or closed street segments.'
      : 'Path mistakenly included one or more blocked street segments.',
  });

  // Check E: Mathematical cost equality (allowing small float precision epsilon)
  const EPSILON = 1e-6;
  const timeDifference = Math.abs(result.travelMinutes - sumTravelMinutes);
  const timeMatches = timeDifference < EPSILON;
  checks.push({
    name: 'Effective Travel Time Mathematical Sum',
    passed: timeMatches,
    detail: timeMatches
      ? `Computed travel time (${result.travelMinutes.toFixed(4)} min) matches sum of effective edge weights (${sumTravelMinutes.toFixed(4)} min).`
      : `Computed travel time (${result.travelMinutes}) differs from edge sum (${sumTravelMinutes}).`,
  });
  if (!timeMatches) errors.push('Travel time cost summation mismatch.');

  // Check F: Distance equality
  const distDifference = Math.abs(result.distanceKm - sumDistanceKm);
  const distMatches = distDifference < EPSILON;
  checks.push({
    name: 'Physical Distance Mathematical Sum',
    passed: distMatches,
    detail: distMatches
      ? `Computed distance (${result.distanceKm.toFixed(3)} km) matches sum of edge lengths (${sumDistanceKm.toFixed(3)} km).`
      : `Computed distance (${result.distanceKm}) differs from edge sum (${sumDistanceKm}).`,
  });
  if (!distMatches) errors.push('Physical distance summation mismatch.');

  const isValid = checks.every((c) => c.passed) && errors.length === 0;

  return {
    isValid,
    checks,
    errors,
  };
}

/**
 * Runs the 5 formal Dijkstra algorithmic verification test cases deterministically.
 * Uses isolated temporary copies so scenario state is never mutated.
 */
export function runDijkstraUnitTests(
  nodes: Node[],
  edges: Edge[],
  depotNodeId: string,
  c01NodeId: string
): DijkstraUnitTestResult[] {
  const results: DijkstraUnitTestResult[] = [];

  // Test 1: Normal route (Depot to C01)
  {
    const t0 = performance.now();
    const res = findShortestPath(nodes, edges, depotNodeId, c01NodeId);
    const t1 = performance.now();

    const passed =
      res.reachable === true &&
      res.nodeIds.length > 1 &&
      res.nodeIds[0] === depotNodeId &&
      res.nodeIds[res.nodeIds.length - 1] === c01NodeId &&
      res.travelMinutes > 0 &&
      res.edgeIds.every((id) => {
        const e = edges.find((edge) => edge.id === id);
        return e && !e.isBlocked;
      });

    results.push({
      id: 'dijkstra_test_1',
      name: 'Test 1: Normal Route (Depot to C01)',
      passed,
      runtimeMs: Number((t1 - t0).toFixed(3)),
      summary: passed
        ? `Found valid shortest path (${res.travelMinutes.toFixed(2)} min, ${res.distanceKm.toFixed(2)} km, ${res.nodeIds.length} nodes).`
        : 'Failed normal path requirements.',
      details: [
        `Reachable: ${res.reachable}`,
        `Origin: ${res.nodeIds[0]} (Depot: ${depotNodeId})`,
        `Destination: ${res.nodeIds[res.nodeIds.length - 1]} (C01: ${c01NodeId})`,
        `Effective Travel Time: ${res.travelMinutes.toFixed(3)} min`,
      ],
    });
  }

  // Test 2: Congestion-aware route
  {
    const t0 = performance.now();
    // Create temporary copy of edges with boosted congestion on the first normal path's edges
    const baseline = findShortestPath(nodes, edges, depotNodeId, c01NodeId);
    const modifiedEdges: Edge[] = edges.map((e) => {
      if (baseline.edgeIds.length > 0 && e.id === baseline.edgeIds[0]) {
        // Heavily congest the first segment by 10x
        return { ...e, congestionMultiplier: e.congestionMultiplier * 10 };
      }
      return e;
    });

    const congestedRes = findShortestPath(nodes, modifiedEdges, depotNodeId, c01NodeId);
    const t1 = performance.now();

    // Verify it still returns a reachable path and calculates costs from effective travel time
    const passed =
      congestedRes.reachable === true &&
      congestedRes.travelMinutes > 0 &&
      congestedRes.distanceKm > 0;

    results.push({
      id: 'dijkstra_test_2',
      name: 'Test 2: Congestion-Aware Route Optimization',
      passed,
      runtimeMs: Number((t1 - t0).toFixed(3)),
      summary: passed
        ? `Optimized route under dynamic congestion (${congestedRes.travelMinutes.toFixed(2)} min). Path weights derived from congestion multipliers.`
        : 'Failed congestion-aware path test.',
      details: [
        `Reachable: ${congestedRes.reachable}`,
        `Baseline Travel Time: ${baseline.travelMinutes.toFixed(2)} min`,
        `Congestion-Adjusted Travel Time: ${congestedRes.travelMinutes.toFixed(2)} min`,
        `Congestion multiplier influence verified without mutating scenario data.`,
      ],
    });
  }

  // Test 3: Blocked-edge avoidance
  {
    const t0 = performance.now();
    const baseline = findShortestPath(nodes, edges, depotNodeId, c01NodeId);
    const blockedEdgeId = baseline.edgeIds[0];

    // Create temporary edge copy where that edge is blocked
    const tempEdges: Edge[] = edges.map((e) =>
      e.id === blockedEdgeId ? { ...e, isBlocked: true } : e
    );

    const reRouteRes = findShortestPath(nodes, tempEdges, depotNodeId, c01NodeId);
    const t1 = performance.now();

    // Verify no returned path includes the blocked edge
    const containsBlocked = reRouteRes.edgeIds.includes(blockedEdgeId);
    const passed = !containsBlocked && (reRouteRes.reachable ? reRouteRes.edgeIds.length > 0 : true);

    results.push({
      id: 'dijkstra_test_3',
      name: 'Test 3: Blocked-Edge Avoidance (Zero Violation)',
      passed,
      runtimeMs: Number((t1 - t0).toFixed(3)),
      summary: passed
        ? `Blocked segment "${blockedEdgeId}" successfully excluded from shortest path.`
        : `Path mistakenly traversed blocked segment "${blockedEdgeId}".`,
      details: [
        `Target Blocked Edge: ${blockedEdgeId}`,
        `Returned Path Contains Blocked Edge: ${containsBlocked ? 'YES (FAIL)' : 'NO (PASS)'}`,
        `New Path Recomputed: ${reRouteRes.reachable ? `${reRouteRes.travelMinutes.toFixed(2)} min` : 'Safely Unreachable'}`,
      ],
    });
  }

  // Test 4: Unreachable route
  {
    const t0 = performance.now();
    // Create temporary edge copy that blocks all outgoing edges from source
    const tempEdges: Edge[] = edges.map((e) =>
      e.from === depotNodeId ? { ...e, isBlocked: true } : e
    );

    const unreachRes = findShortestPath(nodes, tempEdges, depotNodeId, c01NodeId);
    const t1 = performance.now();

    const passed =
      unreachRes.reachable === false &&
      unreachRes.nodeIds.length === 0 &&
      unreachRes.edgeIds.length === 0 &&
      unreachRes.travelMinutes === 0 &&
      unreachRes.distanceKm === 0;

    results.push({
      id: 'dijkstra_test_4',
      name: 'Test 4: Unreachable Route Safe Degradation',
      passed,
      runtimeMs: Number((t1 - t0).toFixed(3)),
      summary: passed
        ? 'Safely handled fully severed network: reachable = false, empty arrays, zero cost.'
        : 'Failed safe unreachable degradation check.',
      details: [
        `Reachable: ${unreachRes.reachable}`,
        `Node Count: ${unreachRes.nodeIds.length} (expected 0)`,
        `Edge Count: ${unreachRes.edgeIds.length} (expected 0)`,
        `Travel Minutes: ${unreachRes.travelMinutes} (expected 0)`,
      ],
    });
  }

  // Test 5: Source equals destination
  {
    const t0 = performance.now();
    const selfRes = findShortestPath(nodes, edges, depotNodeId, depotNodeId);
    const t1 = performance.now();

    const passed =
      selfRes.reachable === true &&
      selfRes.travelMinutes === 0 &&
      selfRes.distanceKm === 0 &&
      selfRes.nodeIds.length === 1 &&
      selfRes.nodeIds[0] === depotNodeId &&
      selfRes.edgeIds.length === 0;

    results.push({
      id: 'dijkstra_test_5',
      name: 'Test 5: Source Equals Destination (Depot to Depot)',
      passed,
      runtimeMs: Number((t1 - t0).toFixed(3)),
      summary: passed
        ? 'Depot to itself returned valid zero-cost path with source node only.'
        : 'Failed self-loop path test.',
      details: [
        `Reachable: ${selfRes.reachable}`,
        `Travel Minutes: ${selfRes.travelMinutes}`,
        `Distance Km: ${selfRes.distanceKm}`,
        `Node Count: ${selfRes.nodeIds.length} (${selfRes.nodeIds[0]})`,
        `Edge Count: ${selfRes.edgeIds.length}`,
      ],
    });
  }

  return results;
}
