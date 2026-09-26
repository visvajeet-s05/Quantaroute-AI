import { Edge, Node } from '../types/domain';

export interface GraphIndex {
  outgoingEdges: Map<string, Edge[]>;
  edgeMap: Map<string, Edge>;
  nodeMap: Map<string, Node>;
}

/**
 * Builds an adjacency lookup structure from nodes and directed edges.
 * Does not mutate input arrays.
 */
export function buildGraphIndex(nodes: Node[], edges: Edge[]): GraphIndex {
  const outgoingEdges = new Map<string, Edge[]>();
  const edgeMap = new Map<string, Edge>();
  const nodeMap = new Map<string, Node>();

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    nodeMap.set(node.id, node);
    outgoingEdges.set(node.id, []);
  }

  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    edgeMap.set(edge.id, edge);

    let list = outgoingEdges.get(edge.from);
    if (!list) {
      list = [];
      outgoingEdges.set(edge.from, list);
    }
    list.push(edge);
  }

  return {
    outgoingEdges,
    edgeMap,
    nodeMap,
  };
}

/**
 * Core edge-cost formula:
 * effectiveTravelMinutes = baseTravelMinutes * congestionMultiplier
 */
export function getEffectiveTravelMinutes(edge: Edge): number {
  return edge.baseTravelMinutes * edge.congestionMultiplier;
}
