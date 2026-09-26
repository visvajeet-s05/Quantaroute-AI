import { Customer, Edge, Scenario, Vehicle } from '../types/domain';
import { RoutePlan, RoutePlanValidationResult } from '../types/routing';

/**
 * Shared Multi-Vehicle RoutePlan Validator
 * Verifies graph topological continuity, vehicle capacity constraints,
 * single-visit customer coverage, depot returns, and zero blocked edges.
 */
export function validateRoutePlan(
  plan: RoutePlan,
  scenario: Scenario
): RoutePlanValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const customerMap = new Map<string, Customer>();
  scenario.customers.forEach((c) => customerMap.set(c.id, c));

  const edgeMap = new Map<string, Edge>();
  scenario.edges.forEach((e) => edgeMap.set(e.id, e));

  const vehicleMap = new Map<string, Vehicle>();
  scenario.vehicles.forEach((v) => vehicleMap.set(v.id, v));

  let capacityCompliant = true;
  let customerCoverageComplete = plan.unservedCustomerIds.length === 0;
  let noDuplicateCustomerService = plan.duplicateCustomerIds.length === 0;
  let allRoutesStartAtDepot = true;
  let allRoutesEndAtDepot = true;
  let noBlockedEdgesUsed = true;
  let allRoutePathsReachable = true;

  // 1. Duplicate & unserved checks
  if (plan.duplicateCustomerIds.length > 0) {
    errors.push(
      `Duplicate customer assignment detected: ${plan.duplicateCustomerIds.join(', ')}.`
    );
  }

  if (plan.unservedCustomerIds.length > 0) {
    warnings.push(
      `${plan.unservedCustomerIds.length} customer(s) unserved: ${plan.unservedCustomerIds.join(', ')}.`
    );
  }

  const totalAccounted = plan.customersServed + plan.unservedCustomerIds.length;
  if (totalAccounted !== plan.customerCount) {
    errors.push(
      `Customer count discrepancy: ${plan.customersServed} served + ${plan.unservedCustomerIds.length} unserved !== ${plan.customerCount} total.`
    );
  }

  // 2. Validate individual vehicle routes
  for (const route of plan.vehicleRoutes) {
    const vDef = vehicleMap.get(route.vehicleId);
    const capacityLimit = vDef ? vDef.capacity : 30;

    // Check capacity
    if (route.usedCapacity > capacityLimit) {
      capacityCompliant = false;
      errors.push(
        `Vehicle ${route.vehicleId} exceeded capacity: ${route.usedCapacity} > ${capacityLimit}.`
      );
    }

    // Check depot start and end
    if (!route.startsAtDepot) {
      allRoutesStartAtDepot = false;
      errors.push(`Vehicle ${route.vehicleId} route does not start at Central Hub depot.`);
    }

    if (route.customerIds.length > 0 && !route.endsAtDepot) {
      allRoutesEndAtDepot = false;
      errors.push(`Vehicle ${route.vehicleId} active route does not terminate at Central Hub depot.`);
    }

    if (!route.reachable) {
      allRoutePathsReachable = false;
      errors.push(`Vehicle ${route.vehicleId} route contains unreachable legs.`);
    }

    // Check customer node presence in route stops
    for (const custId of route.customerIds) {
      const cust = customerMap.get(custId);
      if (!cust) {
        errors.push(`Customer ${custId} in vehicle ${route.vehicleId} does not exist.`);
        continue;
      }
      if (!route.fullPathNodeIds.includes(cust.nodeId)) {
        errors.push(
          `Customer ${custId} node ${cust.nodeId} missing from vehicle ${route.vehicleId} path nodes.`
        );
      }
    }

    // Check edge-to-node topology and blocked edges
    if (route.fullPathEdgeIds.length > 0) {
      if (route.fullPathNodeIds.length !== route.fullPathEdgeIds.length + 1) {
        errors.push(
          `Vehicle ${route.vehicleId} sequence mismatch: ${route.fullPathNodeIds.length} nodes vs ${route.fullPathEdgeIds.length} edges.`
        );
      }

      for (let i = 0; i < route.fullPathEdgeIds.length; i++) {
        const edgeId = route.fullPathEdgeIds[i];
        const edge = edgeMap.get(edgeId);

        if (!edge) {
          errors.push(`Vehicle ${route.vehicleId} traverses unknown edge ${edgeId}.`);
          continue;
        }

        if (edge.isBlocked) {
          noBlockedEdgesUsed = false;
          errors.push(`Vehicle ${route.vehicleId} traversed blocked edge ${edgeId}.`);
        }

        const u = route.fullPathNodeIds[i];
        const v = route.fullPathNodeIds[i + 1];
        if (edge.from !== u || edge.to !== v) {
          errors.push(
            `Vehicle ${route.vehicleId} path discontinuity at step ${i}: edge ${edgeId} (${edge.from}->${edge.to}) does not connect ${u}->${v}.`
          );
        }
      }
    }
  }

  const valid =
    errors.length === 0 &&
    capacityCompliant &&
    noDuplicateCustomerService &&
    allRoutesStartAtDepot &&
    allRoutesEndAtDepot &&
    noBlockedEdgesUsed &&
    allRoutePathsReachable;

  return {
    valid,
    capacityCompliant,
    customerCoverageComplete,
    noDuplicateCustomerService,
    allRoutesStartAtDepot,
    allRoutesEndAtDepot,
    noBlockedEdgesUsed,
    allRoutePathsReachable,
    errors,
    warnings,
  };
}
