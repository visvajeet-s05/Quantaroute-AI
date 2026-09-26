/**
 * Domain models for QuantaRoute AI
 * Quantum-Inspired Dynamic Fleet Routing
 */

export type NodeKind = 'intersection' | 'depot' | 'customer';

export type Node = {
  id: string;
  x: number;
  y: number;
  kind: NodeKind;
};

export type Edge = {
  id: string;
  from: string;
  to: string;
  distanceKm: number;
  baseTravelMinutes: number;
  congestionMultiplier: number;
  isBlocked: boolean;
};

export type CustomerStatus = 'pending' | 'assigned' | 'served';

export type Customer = {
  id: string;
  nodeId: string;
  demand: number;
  status: CustomerStatus;
};

export type VehicleStatus = 'awaiting_optimization' | 'active' | 'rerouting';

export type Vehicle = {
  id: string;
  label: string;
  capacity: number;
  usedCapacity: number;
  currentNodeId: string;
  assignedCustomerIds: string[];
  completedCustomerIds: string[];
  color: string;
  status: VehicleStatus;
};

export type IncidentType = 'road_closure' | 'congestion_surge';
export type IncidentSeverity = 1 | 2 | 3;

export type Incident = {
  id: string;
  affectedEdgeIds: string[];
  type: IncidentType;
  severity: IncidentSeverity;
  active: boolean;
};

export type ScenarioPreset = 'normal' | 'peak' | 'closure';

export type Scenario = {
  id: string;
  name: string;
  seed: number;
  depotNodeId: string;
  nodes: Node[];
  edges: Edge[];
  customers: Customer[];
  vehicles: Vehicle[];
  incidents: Incident[];
};

export type TrafficLevel = 'free_flow' | 'moderate' | 'heavy' | 'blocked';

export interface ScenarioValidationReport {
  isValid: boolean;
  timestamp: string;
  seed: number;
  totalCustomers: number;
  totalDemand: number;
  maxFleetCapacity: number;
  totalVehicles: number;
  depotNodeId: string;
  checks: {
    name: string;
    passed: boolean;
    detail: string;
  }[];
}
