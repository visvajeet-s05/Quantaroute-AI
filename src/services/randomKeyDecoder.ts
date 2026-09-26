import { AlgorithmName, RoutePlan, VehicleRoute } from '../types/routing';
import { Customer, Scenario, Vehicle } from '../types/domain';
import { findShortestPath } from '../algorithms/dijkstra';
import { evaluateRoutePlan } from './routePlanEvaluator';
import { AssignedCustomerItem, repairCapacityAllocations, VehicleAssignmentMap } from './capacityRepair';

/**
 * Decodes continuous random-key particle arrays into a fully validated Multi-Vehicle RoutePlan.
 *
 * Used by Classical PSO now and QPSO later for fair, standard benchmarking.
 *
 * Algorithm:
 * 1. Iterates customers in stable customer-ID order (C01..C25).
 * 2. Clamps assignmentKeys to [0, 1] and maps to initial vehicle:
 *    vehicleIndex = min(vehicleCount - 1, floor(assignmentKey * vehicleCount))
 * 3. Groups customers by initial vehicle, sorted by priorityKey ascending (tie-break by customer ID).
 * 4. Applies shared deterministic capacity repair to resolve vehicle over-allocations.
 * 5. Synthesizes full graph-level Dijkstra paths for all legs (depot -> stop1 -> ... -> depot).
 * 6. Evaluates via shared RoutePlan evaluator (F = 0.55*T + 0.25*D + 0.20*C + 10000*P).
 */
export function decodeRandomKeyParticleToRoutePlan(
  assignmentKeys: number[],
  priorityKeys: number[],
  scenario: Scenario,
  algorithmName: AlgorithmName = 'pso',
  runtimeMs: number = 0,
  travelTimeCache?: Map<string, number>
): RoutePlan {
  // 1. Sort customers stably by ID
  const stableCustomers = [...scenario.customers].sort((a, b) => a.id.localeCompare(b.id));
  const numVehicles = scenario.vehicles.length;

  // 2. Initial vehicle grouping by clamped assignmentKey
  const initialAssignments: VehicleAssignmentMap = new Map();
  scenario.vehicles.forEach((v) => initialAssignments.set(v.id, []));

  stableCustomers.forEach((cust, idx) => {
    const rawAssign = assignmentKeys[idx] ?? 0;
    const clampedAssign = Math.max(0, Math.min(0.999999, rawAssign));
    const vIdx = Math.min(numVehicles - 1, Math.floor(clampedAssign * numVehicles));
    const targetVehicle = scenario.vehicles[vIdx];

    const rawPriority = priorityKeys[idx] ?? 0;
    const clampedPriority = Math.max(0, Math.min(1, rawPriority));

    const list = initialAssignments.get(targetVehicle.id)!;
    list.push({
      customer: cust,
      priorityKey: clampedPriority,
    });
  });

  // 3. Sort each vehicle's customer group by priorityKey ascending, then customer ID
  scenario.vehicles.forEach((v) => {
    const list = initialAssignments.get(v.id)!;
    list.sort((a, b) => {
      const diff = a.priorityKey - b.priorityKey;
      if (Math.abs(diff) > 1e-6) return diff;
      return a.customer.id.localeCompare(b.customer.id);
    });
  });

  // 4. Apply deterministic capacity repair
  const { repairedAssignments, warnings: repairWarnings } = repairCapacityAllocations(
    initialAssignments,
    scenario,
    travelTimeCache
  );

  // 5. Build physical vehicle routes using Dijkstra for every leg
  const vehicleRoutes: VehicleRoute[] = [];

  for (const vehicle of scenario.vehicles) {
    const assignedItems = repairedAssignments.get(vehicle.id) || [];
    const customerIds: string[] = [];
    const stopNodeIds: string[] = [scenario.depotNodeId];
    const fullPathNodeIds: string[] = [scenario.depotNodeId];
    const fullPathEdgeIds: string[] = [];
    const warnings: string[] = [...repairWarnings];
    let isReachable = true;
    let usedCapacity = 0;

    let currentNodeId = scenario.depotNodeId;

    for (const item of assignedItems) {
      customerIds.push(item.customer.id);
      stopNodeIds.push(item.customer.nodeId);
      usedCapacity += item.customer.demand;

      const leg = findShortestPath(
        scenario.nodes,
        scenario.edges,
        currentNodeId,
        item.customer.nodeId
      );

      if (leg.reachable) {
        for (let i = 1; i < leg.nodeIds.length; i++) {
          fullPathNodeIds.push(leg.nodeIds[i]);
        }
        for (const eId of leg.edgeIds) {
          fullPathEdgeIds.push(eId);
        }
      } else {
        isReachable = false;
        warnings.push(
          `Vehicle ${vehicle.id} could not reach customer ${item.customer.id} (${item.customer.nodeId}) from ${currentNodeId}.`
        );
      }

      currentNodeId = item.customer.nodeId;
    }

    // Return leg to Central Hub depot if any customer was assigned
    if (assignedItems.length > 0) {
      stopNodeIds.push(scenario.depotNodeId);

      const returnLeg = findShortestPath(
        scenario.nodes,
        scenario.edges,
        currentNodeId,
        scenario.depotNodeId
      );

      if (returnLeg.reachable) {
        for (let i = 1; i < returnLeg.nodeIds.length; i++) {
          fullPathNodeIds.push(returnLeg.nodeIds[i]);
        }
        for (const eId of returnLeg.edgeIds) {
          fullPathEdgeIds.push(eId);
        }
      } else {
        isReachable = false;
        warnings.push(
          `Vehicle ${vehicle.id} could not find return path to Central Hub from ${currentNodeId}.`
        );
      }
    } else {
      warnings.push(`Vehicle ${vehicle.id} has no assigned customer stops.`);
    }

    vehicleRoutes.push({
      vehicleId: vehicle.id,
      vehicleLabel: vehicle.label,
      customerIds,
      stopNodeIds,
      fullPathNodeIds,
      fullPathEdgeIds,
      travelMinutes: 0, // Evaluator computes
      distanceKm: 0, // Evaluator computes
      congestionPenalty: 0, // Evaluator computes
      usedCapacity,
      remainingCapacity: Math.max(0, vehicle.capacity - usedCapacity),
      startsAtDepot: true,
      endsAtDepot: true,
      reachable: isReachable,
      feasible: isReachable && usedCapacity <= vehicle.capacity,
      warnings,
    });
  }

  // 6. Evaluate final plan with shared RoutePlan evaluator
  return evaluateRoutePlan(algorithmName, scenario, vehicleRoutes, runtimeMs);
}
