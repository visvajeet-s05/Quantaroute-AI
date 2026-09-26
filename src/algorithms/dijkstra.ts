import { Edge, Node } from '../types/domain';
import { PathResult } from '../types/pathfinding';
import { MinPriorityQueue } from './priorityQueue';
import { buildGraphIndex, getEffectiveTravelMinutes } from '../utils/graphIndex';

/**
 * Executes Dijkstra's algorithm using cumulative effective travel time as edge weights.
 *
 * Edge cost rule:
 * effectiveTravelMinutes = edge.baseTravelMinutes * edge.congestionMultiplier
 *
 * If edge.isBlocked === true, it is strictly skipped and cannot be traversed.
 */
export function findShortestPath(
  nodes: Node[],
  edges: Edge[],
  sourceNodeId: string,
  destinationNodeId: string
): PathResult {
  // Edge Case: Source is destination
  if (sourceNodeId === destinationNodeId) {
    return {
      sourceNodeId,
      destinationNodeId,
      nodeIds: [sourceNodeId],
      edgeIds: [],
      travelMinutes: 0,
      distanceKm: 0,
      reachable: true,
      visitedNodeCount: 1,
    };
  }

  const { outgoingEdges, edgeMap, nodeMap } = buildGraphIndex(nodes, edges);

  // Validate that source and destination nodes exist in the graph
  if (!nodeMap.has(sourceNodeId) || !nodeMap.has(destinationNodeId)) {
    return {
      sourceNodeId,
      destinationNodeId,
      nodeIds: [],
      edgeIds: [],
      travelMinutes: 0,
      distanceKm: 0,
      reachable: false,
      visitedNodeCount: 0,
    };
  }

  // Distances map: cumulative effective travel time in minutes
  const distances = new Map<string, number>();
  // Predecessor tracking for path reconstruction
  const prevNode = new Map<string, string>();
  const prevEdge = new Map<string, string>();
  const visited = new Set<string>();

  for (const node of nodes) {
    distances.set(node.id, Infinity);
  }
  distances.set(sourceNodeId, 0);

  const pq = new MinPriorityQueue<string>();
  pq.enqueue(sourceNodeId, 0);

  let destinationReached = false;

  while (!pq.isEmpty()) {
    const entry = pq.dequeue();
    if (!entry) break;

    const u = entry.item;
    const currentDist = entry.priority;

    // Skip stale queue entries if a shorter route was already relaxed
    if (visited.has(u)) continue;
    visited.add(u);

    // Stop early once destination node is popped
    if (u === destinationNodeId) {
      destinationReached = true;
      break;
    }

    const outEdges = outgoingEdges.get(u) || [];
    for (let i = 0; i < outEdges.length; i++) {
      const edge = outEdges[i];

      // Blocked edges are impassable
      if (edge.isBlocked) continue;

      const v = edge.to;
      if (visited.has(v)) continue;

      const weight = getEffectiveTravelMinutes(edge);
      // Guard against non-negative constraint
      const safeWeight = Math.max(0, weight);
      const newDist = currentDist + safeWeight;

      if (newDist < (distances.get(v) ?? Infinity)) {
        distances.set(v, newDist);
        prevNode.set(v, u);
        prevEdge.set(v, edge.id);
        pq.enqueue(v, newDist);
      }
    }
  }

  // If unreachable, return clean safe values
  if (!destinationReached) {
    return {
      sourceNodeId,
      destinationNodeId,
      nodeIds: [],
      edgeIds: [],
      travelMinutes: 0,
      distanceKm: 0,
      reachable: false,
      visitedNodeCount: visited.size,
    };
  }

  // Reconstruct path backward from destination to source
  const reverseNodeIds: string[] = [];
  const reverseEdgeIds: string[] = [];
  let curr: string | undefined = destinationNodeId;

  while (curr && curr !== sourceNodeId) {
    reverseNodeIds.push(curr);
    const edgeId = prevEdge.get(curr);
    if (!edgeId) break;
    reverseEdgeIds.push(edgeId);
    curr = prevNode.get(curr);
  }

  reverseNodeIds.push(sourceNodeId);

  const nodeIds = reverseNodeIds.reverse();
  const edgeIds = reverseEdgeIds.reverse();

  // Accumulate total accurate travel minutes and distance from reconstructed edge list
  let totalMinutes = 0;
  let totalKm = 0;

  for (let i = 0; i < edgeIds.length; i++) {
    const edge = edgeMap.get(edgeIds[i]);
    if (edge) {
      totalMinutes += getEffectiveTravelMinutes(edge);
      totalKm += edge.distanceKm;
    }
  }

  return {
    sourceNodeId,
    destinationNodeId,
    nodeIds,
    edgeIds,
    travelMinutes: totalMinutes,
    distanceKm: totalKm,
    reachable: true,
    visitedNodeCount: visited.size,
  };
}
