import { Customer, Edge, Scenario, Vehicle } from '../types/domain';
import { AlgorithmName, RoutePlan, VehicleRoute } from '../types/routing';
import { getEffectiveTravelMinutes } from '../utils/graphIndex';

/**
 * Shared Multi-Vehicle RoutePlan Evaluator
 * Evaluates road paths, capacity usage, congestion penalties, and the standardized objective function:
 * F = 0.55*T + 0.25*D + 0.20*C + 10000*P
 */
export function evaluateRoutePlan(
  algorithm: AlgorithmName,
  scenario: Scenario,
  vehicleRoutes: VehicleRoute[],
  runtimeMs: number
): RoutePlan {
  const edgeMap = new Map<string, Edge>();
  scenario.edges.forEach((e) => edgeMap.set(e.id, e));

  const customerMap = new Map<string, Customer>();
  scenario.customers.forEach((c) => customerMap.set(c.id, c));

  const vehicleMap = new Map<string, Vehicle>();
  scenario.vehicles.forEach((v) => vehicleMap.set(v.id, v));

  let totalTravelMinutes = 0;
  let totalDistanceKm = 0;
  let totalCongestionPenalty = 0;

  const assignedCustomerSet = new Set<string>();
  const duplicateCustomerIds: string[] = [];
  const capacityViolationVehicleIds: string[] = [];
  const blockedEdgeViolationIds: string[] = [];
  const unreachableVehicleIds: string[] = [];
  const invalidDepotVehicleIds: string[] = [];
  const warnings: string[] = [];

  // Evaluate each vehicle route independently
  const evaluatedRoutes: VehicleRoute[] = vehicleRoutes.map((route) => {
    const vDef = vehicleMap.get(route.vehicleId);
    const capacityLimit = vDef ? vDef.capacity : 30;

    // Calculate actual edge-level metrics
    let routeMinutes = 0;
    let routeDistance = 0;
    let routeCongestionPenalty = 0;
    let routeHasBlockedEdge = false;

    for (const edgeId of route.fullPathEdgeIds) {
      const edge = edgeMap.get(edgeId);
      if (edge) {
        routeMinutes += getEffectiveTravelMinutes(edge);
        routeDistance += edge.distanceKm;

        // Congestion penalty: baseTravelMinutes * max(0, congestionMultiplier - 1)
        const congestionContrib =
          edge.baseTravelMinutes * Math.max(0, edge.congestionMultiplier - 1);
        routeCongestionPenalty += congestionContrib;

        if (edge.isBlocked) {
          routeHasBlockedEdge = true;
          if (!blockedEdgeViolationIds.includes(edgeId)) {
            blockedEdgeViolationIds.push(edgeId);
          }
        }
      } else {
        warnings.push(`Edge ${edgeId} in vehicle ${route.vehicleId} route not found in graph.`);
      }
    }

    // Capacity verification
    let computedLoad = 0;
    for (const custId of route.customerIds) {
      if (assignedCustomerSet.has(custId)) {
        if (!duplicateCustomerIds.includes(custId)) {
          duplicateCustomerIds.push(custId);
        }
      } else {
        assignedCustomerSet.add(custId);
      }

      const cust = customerMap.get(custId);
      if (cust) {
        computedLoad += cust.demand;
      }
    }

    const capacityExceeded = computedLoad > capacityLimit;
    if (capacityExceeded) {
      capacityViolationVehicleIds.push(route.vehicleId);
    }

    const routeWarnings = [...route.warnings];
    if (capacityExceeded) {
      routeWarnings.push(
        `Capacity exceeded: ${computedLoad} units vs max ${capacityLimit} units.`
      );
    }
    if (routeHasBlockedEdge) {
      routeWarnings.push(`Route traverses one or more blocked street segments.`);
    }
    if (!route.reachable) {
      unreachableVehicleIds.push(route.vehicleId);
      routeWarnings.push(`Route contains unreachable road segments.`);
    }

    const startsAtDepot = route.startsAtDepot;
    const endsAtDepot = route.customerIds.length === 0 ? true : route.endsAtDepot;
    if (!startsAtDepot || !endsAtDepot) {
      invalidDepotVehicleIds.push(route.vehicleId);
      routeWarnings.push(`Route does not properly start and end at the Central Hub depot.`);
    }

    const routeFeasible =
      !capacityExceeded &&
      !routeHasBlockedEdge &&
      route.reachable &&
      startsAtDepot &&
      endsAtDepot;

    totalTravelMinutes += routeMinutes;
    totalDistanceKm += routeDistance;
    totalCongestionPenalty += routeCongestionPenalty;

    return {
      ...route,
      travelMinutes: routeMinutes,
      distanceKm: routeDistance,
      congestionPenalty: routeCongestionPenalty,
      usedCapacity: computedLoad,
      remainingCapacity: Math.max(0, capacityLimit - computedLoad),
      startsAtDepot,
      endsAtDepot,
      feasible: routeFeasible,
      warnings: routeWarnings,
    };
  });

  // Calculate unserved customers
  const unservedCustomerIds: string[] = [];
  for (const c of scenario.customers) {
    if (!assignedCustomerSet.has(c.id)) {
      unservedCustomerIds.push(c.id);
    }
  }

  if (unservedCustomerIds.length > 0) {
    warnings.push(`${unservedCustomerIds.length} customer(s) remained unassigned/unserved.`);
  }

  // Calculate penalty violations P:
  // - each unserved customer: 10,000
  // - each duplicate customer: 10,000
  // - each capacity violation vehicle: 10,000
  // - each blocked edge route: 50,000
  // - each unreachable route: 50,000
  // - each depot violation: 10,000
  const penaltyP =
    unservedCustomerIds.length * 10000 +
    duplicateCustomerIds.length * 10000 +
    capacityViolationVehicleIds.length * 10000 +
    blockedEdgeViolationIds.length * 50000 +
    unreachableVehicleIds.length * 50000 +
    invalidDepotVehicleIds.length * 10000;

  const isFeasible = penaltyP === 0;

  // Standardized objective function:
  // F = 0.55*T + 0.25*D + 0.20*C + 10000*P
  // Note: P here is the exact violation penalty score
  const routingScore =
    0.55 * totalTravelMinutes +
    0.25 * totalDistanceKm +
    0.20 * totalCongestionPenalty +
    penaltyP;

  return {
    algorithm,
    scenarioId: scenario.id,
    seed: scenario.seed,
    depotNodeId: scenario.depotNodeId,
    vehicleRoutes: evaluatedRoutes,
    totalTravelMinutes,
    totalDistanceKm,
    congestionPenalty: totalCongestionPenalty,
    routingScore,
    customersServed: assignedCustomerSet.size,
    customerCount: scenario.customers.length,
    unservedCustomerIds,
    duplicateCustomerIds,
    capacityViolationVehicleIds,
    blockedEdgeViolationIds,
    unreachableVehicleIds,
    isFeasible,
    warnings,
    runtimeMs,
  };
}
