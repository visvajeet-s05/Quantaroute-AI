import { Customer, Scenario, Vehicle } from '../types/domain';
import { RoutePlan, VehicleRoute } from '../types/routing';
import { findShortestPath } from './dijkstra';
import { evaluateRoutePlan } from '../services/routePlanEvaluator';

/**
 * Capacity-Aware Greedy Fleet Routing Heuristic
 *
 * Algorithm Strategy:
 * 1. Iterates vehicles in order (V1, V2, V3).
 * 2. Each vehicle starts at Central Hub depot.
 * 3. While pending customers exist that fit within remaining capacity:
 *    - Evaluates Dijkstra shortest paths from current vehicle position to each feasible candidate.
 *    - Picks nearest candidate by travelMinutes (tie-break by customer ID then node ID).
 *    - Concatenates path without node duplication.
 * 4. When capacity is filled or no feasible candidates remain, routes vehicle back to Central Hub.
 * 5. Evaluates and scores final multi-vehicle RoutePlan with shared objective function.
 */
export function runGreedyRouting(scenario: Scenario): RoutePlan {
  const t0 = performance.now();

  const pendingCustomers = new Map<string, Customer>();
  scenario.customers.forEach((c) => pendingCustomers.set(c.id, { ...c }));

  const vehicleRoutes: VehicleRoute[] = [];

  for (const vehicle of scenario.vehicles) {
    let currentNodeId = scenario.depotNodeId;
    let usedCapacity = 0;
    const assignedCustomerIds: string[] = [];
    const stopNodeIds: string[] = [scenario.depotNodeId];
    const fullPathNodeIds: string[] = [scenario.depotNodeId];
    const fullPathEdgeIds: string[] = [];
    const warnings: string[] = [];
    let isReachable = true;

    // Greedy nearest-neighbor search for this vehicle
    while (true) {
      const remainingCapacity = vehicle.capacity - usedCapacity;

      // Filter feasible pending customers by capacity
      const candidates: Customer[] = [];
      for (const cust of pendingCustomers.values()) {
        if (cust.demand <= remainingCapacity) {
          candidates.push(cust);
        }
      }

      if (candidates.length === 0) {
        break; // No pending customer fits remaining capacity
      }

      // Compute Dijkstra path from currentNodeId to each candidate
      type CandidatePath = {
        customer: Customer;
        travelMinutes: number;
        nodeIds: string[];
        edgeIds: string[];
        distanceKm: number;
      };

      const reachableCandidates: CandidatePath[] = [];

      for (const candidate of candidates) {
        const pathRes = findShortestPath(
          scenario.nodes,
          scenario.edges,
          currentNodeId,
          candidate.nodeId
        );

        if (pathRes.reachable) {
          reachableCandidates.push({
            customer: candidate,
            travelMinutes: pathRes.travelMinutes,
            nodeIds: pathRes.nodeIds,
            edgeIds: pathRes.edgeIds,
            distanceKm: pathRes.distanceKm,
          });
        }
      }

      if (reachableCandidates.length === 0) {
        // Feasible by capacity, but all candidates are blocked/unreachable
        warnings.push(
          `Vehicle ${vehicle.id} has remaining capacity (${remainingCapacity}u), but all remaining candidates are unreachable from ${currentNodeId}.`
        );
        break;
      }

      // Sort by travelMinutes ascending, tie-break by customer ID, then node ID
      reachableCandidates.sort((a, b) => {
        const timeDiff = a.travelMinutes - b.travelMinutes;
        if (Math.abs(timeDiff) > 1e-6) {
          return timeDiff;
        }
        const idComp = a.customer.id.localeCompare(b.customer.id);
        if (idComp !== 0) return idComp;
        return a.customer.nodeId.localeCompare(b.customer.nodeId);
      });

      const best = reachableCandidates[0];

      // Assign customer to vehicle
      assignedCustomerIds.push(best.customer.id);
      stopNodeIds.push(best.customer.nodeId);
      usedCapacity += best.customer.demand;

      // Concatenate path nodes without duplicating connecting node
      // best.nodeIds starts with currentNodeId
      for (let i = 1; i < best.nodeIds.length; i++) {
        fullPathNodeIds.push(best.nodeIds[i]);
      }
      for (const eId of best.edgeIds) {
        fullPathEdgeIds.push(eId);
      }

      currentNodeId = best.customer.nodeId;
      pendingCustomers.delete(best.customer.id);
    }

    // Return to Central Hub depot if any customer was assigned
    if (assignedCustomerIds.length > 0) {
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
          `Vehicle ${vehicle.id} could not find a return path to Central Hub depot from ${currentNodeId}.`
        );
      }
    } else {
      // Empty route: starts and ends at depot with zero cost
      warnings.push(`Vehicle ${vehicle.id} was not assigned any customers.`);
    }

    vehicleRoutes.push({
      vehicleId: vehicle.id,
      vehicleLabel: vehicle.label,
      customerIds: assignedCustomerIds,
      stopNodeIds,
      fullPathNodeIds,
      fullPathEdgeIds,
      travelMinutes: 0, // Computed by evaluator
      distanceKm: 0, // Computed by evaluator
      congestionPenalty: 0, // Computed by evaluator
      usedCapacity,
      remainingCapacity: vehicle.capacity - usedCapacity,
      startsAtDepot: true,
      endsAtDepot: true,
      reachable: isReachable,
      feasible: true, // Evaluator will verify
      warnings,
    });
  }

  const t1 = performance.now();
  const runtimeMs = Number((t1 - t0).toFixed(3));

  // Run through shared evaluator for standardized metrics and objective function F
  return evaluateRoutePlan('greedy', scenario, vehicleRoutes, runtimeMs);
}
