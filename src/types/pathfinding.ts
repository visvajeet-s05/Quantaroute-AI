/**
 * Pathfinding domain models for QuantaRoute AI
 */

export type PathResult = {
  sourceNodeId: string;
  destinationNodeId: string;
  nodeIds: string[];
  edgeIds: string[];
  travelMinutes: number;
  distanceKm: number;
  reachable: boolean;
  visitedNodeCount: number;
};

export type PathTestState = {
  selectedCustomerId: string | null;
  lastPathResult: PathResult | null;
  status: 'idle' | 'running' | 'success' | 'unreachable' | 'error';
  runtimeMs: number | null;
  errorMessage: string | null;
};

export interface PathValidationCheck {
  name: string;
  passed: boolean;
  detail: string;
}

export interface PathValidationResult {
  isValid: boolean;
  checks: PathValidationCheck[];
  errors: string[];
}

export interface DijkstraUnitTestResult {
  id: string;
  name: string;
  passed: boolean;
  runtimeMs: number;
  summary: string;
  details: string[];
}
