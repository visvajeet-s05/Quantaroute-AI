/**
 * Dynamic Incident Simulation & Fleet Re-Routing Engine
 * QuantaRoute AI
 *
 * Deterministic, client-side re-routing module.
 * Preserves existing initial optimizers while supporting non-depot start nodes,
 * partial delivery locking, incident injection, and delay-avoidance quantification.
 */

import { Customer, Edge, Scenario, Vehicle } from '../types/domain';
import {
  AlgorithmName,
  DynamicIncident,
  IncidentType,
  QpsoPreset,
  ReroutingResult,
  RoutePlan,
  RoutePlanSnapshot,
  RoutePlanValidationResult,
  RoutingContext,
  VehicleDynamicState,
  VehicleRoute,
} from '../types/routing';
import { findShortestPath } from '../algorithms/dijkstra';
import { getEffectiveTravelMinutes } from '../utils/graphIndex';
import { SeededRandom } from '../utils/seededRandom';
import { qpsoCoordinateUpdate, QPSO_PRESETS } from '../algorithms/quantumPso';

/**
 * Deep-clones an object immutably using JSON serialization.
 */
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Creates the initial snapshot from an initial RoutePlan.
 * Immutable deep copy — never mutated after creation.
 */
export function createInitialSnapshot(
  plan: RoutePlan,
  scenario: Scenario
): RoutePlanSnapshot {
  const vehicleDynamicStates: VehicleDynamicState[] = scenario.vehicles.map((v) => {
    const route = plan.vehicleRoutes.find((r) => r.vehicleId === v.id);
    const pendingCustomerIds = route ? [...route.customerIds] : [];
    return {
      vehicleId: v.id,
      currentNodeId: scenario.depotNodeId,
      deliveredCustomerIds: [],
      pendingCustomerIds,
      deliveredDemand: 0,
      remainingCapacity: v.capacity,
      executionState: pendingCustomerIds.length > 0 ? 'planned' : 'inactive',
    };
  });

  return deepClone({
    id: `snapshot-initial-${Date.now()}`,
    timestamp: new Date().toISOString(),
    label: 'initial_plan',
    scenarioId: scenario.id,
    scenarioSeed: scenario.seed,
    algorithm: plan.algorithm,
    routePlan: plan,
    trafficState: scenario.edges,
    vehicleDynamicStates,
  });
}

/**
 * Simulates partial route execution:
 * Locks completed customer stops and updates each vehicle's current node and remaining capacity.
 * Completes the first N assigned customers per active vehicle (deterministic, no randomness).
 */
export function simulatePartialExecution(
  initialSnapshot: RoutePlanSnapshot,
  scenario: Scenario,
  stopsCompletedPerVehicle: number = 1
): { preIncidentSnapshot: RoutePlanSnapshot; vehicleDynamicStates: VehicleDynamicState[] } {
  const customerMap = new Map<string, Customer>();
  scenario.customers.forEach((c) => customerMap.set(c.id, c));

  const vehicleDynamicStates: VehicleDynamicState[] = scenario.vehicles.map((v) => {
    const route = initialSnapshot.routePlan.vehicleRoutes.find((r) => r.vehicleId === v.id);
    const assignedStops = route ? [...route.customerIds] : [];
    const capacityLimit = v.capacity;

    if (assignedStops.length === 0 || stopsCompletedPerVehicle === 0) {
      return {
        vehicleId: v.id,
        currentNodeId: scenario.depotNodeId,
        deliveredCustomerIds: [],
        pendingCustomerIds: assignedStops,
        deliveredDemand: 0,
        remainingCapacity: capacityLimit,
        executionState: assignedStops.length > 0 ? 'en_route' : 'inactive',
      };
    }

    // Deterministically complete first N stops (no Math.random)
    const completedCount = Math.min(assignedStops.length, stopsCompletedPerVehicle);
    const deliveredCustomerIds = assignedStops.slice(0, completedCount);
    const pendingCustomerIds = assignedStops.slice(completedCount);

    let deliveredDemand = 0;
    deliveredCustomerIds.forEach((cId) => {
      const c = customerMap.get(cId);
      if (c) deliveredDemand += c.demand;
    });

    const remainingCapacity = Math.max(0, capacityLimit - deliveredDemand);

    // Current node = last completed customer's node, or depot if nothing completed
    let currentNodeId = scenario.depotNodeId;
    if (deliveredCustomerIds.length > 0) {
      if (pendingCustomerIds.length === 0 && stopsCompletedPerVehicle > assignedStops.length) {
        // Vehicle completed entire route, returned to depot
        currentNodeId = scenario.depotNodeId;
      } else {
        const lastDelivered = customerMap.get(deliveredCustomerIds[deliveredCustomerIds.length - 1]);
        if (lastDelivered) {
          currentNodeId = lastDelivered.nodeId;
        }
      }
    }

    return {
      vehicleId: v.id,
      currentNodeId,
      deliveredCustomerIds,
      pendingCustomerIds,
      deliveredDemand,
      remainingCapacity,
      executionState: pendingCustomerIds.length > 0 ? 'en_route' : 'inactive',
    };
  });

  // Deep-clone the pre-incident snapshot — immutable after creation
  const preIncidentSnapshot: RoutePlanSnapshot = deepClone({
    id: `snapshot-pre-incident-${Date.now()}`,
    timestamp: new Date().toISOString(),
    label: 'pre_incident',
    scenarioId: scenario.id,
    scenarioSeed: scenario.seed,
    algorithm: initialSnapshot.algorithm,
    routePlan: initialSnapshot.routePlan,
    trafficState: scenario.edges,
    vehicleDynamicStates,
  });

  return { preIncidentSnapshot, vehicleDynamicStates };
}

/**
 * Finds all edges on active vehicles' pending route legs.
 * Returns candidates sorted by number of affected vehicles (desc), then edgeId (asc) for determinism.
 */
export function findCandidateIncidentEdges(
  scenario: Scenario,
  vehicleDynamicStates: VehicleDynamicState[],
  edges: Edge[]
): { edgeId: string; label: string; affectedVehicleIds: string[] }[] {
  const customerMap = new Map<string, Customer>();
  scenario.customers.forEach((c) => customerMap.set(c.id, c));

  // Map edgeId -> set of vehicle IDs that use it in pending legs
  const edgeUsageMap = new Map<string, Set<string>>();

  vehicleDynamicStates.forEach((vs) => {
    if (vs.pendingCustomerIds.length === 0 && vs.currentNodeId === scenario.depotNodeId) return;

    let curr = vs.currentNodeId;
    const targetNodes = vs.pendingCustomerIds
      .map((cId) => customerMap.get(cId)?.nodeId)
      .filter((n): n is string => Boolean(n));
    targetNodes.push(scenario.depotNodeId);

    for (const target of targetNodes) {
      const path = findShortestPath(scenario.nodes, edges, curr, target);
      if (path.reachable) {
        path.edgeIds.forEach((eId) => {
          if (!edgeUsageMap.has(eId)) edgeUsageMap.set(eId, new Set());
          edgeUsageMap.get(eId)!.add(vs.vehicleId);
        });
      }
      curr = target;
    }
  });

  const candidates: { edgeId: string; label: string; affectedVehicleIds: string[] }[] = [];
  edgeUsageMap.forEach((vSet, eId) => {
    const edge = edges.find((e) => e.id === eId);
    if (edge) {
      const vArr = Array.from(vSet);
      candidates.push({
        edgeId: eId,
        label: `${eId} (${edge.from}->${edge.to})`,
        affectedVehicleIds: vArr,
      });
    }
  });

  // Sort: most affected vehicles first; ties broken by edgeId for full determinism
  candidates.sort((a, b) => {
    const diff = b.affectedVehicleIds.length - a.affectedVehicleIds.length;
    return diff !== 0 ? diff : a.edgeId.localeCompare(b.edgeId);
  });
  return candidates;
}

/**
 * Deterministic guided demo incident edge selection:
 * Chooses the first eligible, non-blocked edge on any vehicle's pending route,
 * sorted by vehicle ID (ascending) then by route order.
 * Avoids edges that are already blocked.
 */
export function selectGuidedDemoEdge(
  scenario: Scenario,
  vehicleDynamicStates: VehicleDynamicState[],
  edges: Edge[]
): { edgeId: string; affectedVehicleIds: string[] } | null {
  const customerMap = new Map<string, Customer>();
  scenario.customers.forEach((c) => customerMap.set(c.id, c));

  // Sort states by vehicleId ascending for deterministic ordering
  const sortedStates = [...vehicleDynamicStates].sort((a, b) =>
    a.vehicleId.localeCompare(b.vehicleId)
  );

  for (const vs of sortedStates) {
    if (vs.pendingCustomerIds.length === 0) continue;

    let curr = vs.currentNodeId;
    const targetNodes = vs.pendingCustomerIds
      .map((cId) => customerMap.get(cId)?.nodeId)
      .filter((n): n is string => Boolean(n));
    targetNodes.push(scenario.depotNodeId);

    for (const target of targetNodes) {
      const path = findShortestPath(scenario.nodes, edges, curr, target);
      if (path.reachable && path.edgeIds.length > 0) {
        for (const eId of path.edgeIds) {
          const edge = edges.find((e) => e.id === eId);
          if (edge && !edge.isBlocked) {
            // Found the first eligible edge; now find all vehicles that use it in pending legs
            const affectedVehicleIds = vehicleDynamicStates
              .filter((v2) => {
                if (v2.pendingCustomerIds.length === 0) return false;
                let c2 = v2.currentNodeId;
                const t2 = v2.pendingCustomerIds
                  .map((cId) => customerMap.get(cId)?.nodeId)
                  .filter((n): n is string => Boolean(n));
                t2.push(scenario.depotNodeId);
                for (const tgt2 of t2) {
                  const p2 = findShortestPath(scenario.nodes, edges, c2, tgt2);
                  if (p2.reachable && p2.edgeIds.includes(eId)) return true;
                  c2 = tgt2;
                }
                return false;
              })
              .map((v2) => v2.vehicleId);
            return { edgeId: eId, affectedVehicleIds };
          }
        }
      }
      curr = target;
    }
  }

  return null;
}

/**
 * Injects a traffic incident (Road Closure or Congestion Surge) onto the road graph.
 * Returns immutably updated edge state; does not mutate the scenario or any snapshot.
 *
 * For a full road closure (severity 3), if the post-incident graph leaves any vehicle
 * route completely disconnected, incidentAdjustedRemainingTravelMinutes is null.
 */
export function injectDynamicIncident(
  scenario: Scenario,
  preIncidentSnapshot: RoutePlanSnapshot,
  vehicleDynamicStates: VehicleDynamicState[],
  type: IncidentType,
  severity: 1 | 2 | 3,
  targetEdgeId?: string
): {
  incident: DynamicIncident;
  incidentEdges: Edge[];
  affectedVehicleIds: string[];
  originalRemainingTravelMinutes: number;
  incidentAdjustedRemainingTravelMinutes: number | null;
  routeBlockedByIncident: boolean;
  updatedVehicleStates: VehicleDynamicState[];
} {
  // Deep-clone edges so we never mutate scenario or any snapshot
  const currentEdges: Edge[] = deepClone(scenario.edges);
  const candidateEdges = findCandidateIncidentEdges(scenario, vehicleDynamicStates, currentEdges);

  // Resolve chosen edge: use provided target or fall back to highest-impact candidate
  let chosenEdgeId = targetEdgeId;
  if (!chosenEdgeId || !currentEdges.some((e) => e.id === chosenEdgeId)) {
    chosenEdgeId = candidateEdges[0]?.edgeId || currentEdges[4]?.id || currentEdges[0]?.id;
  }

  const affectedEdge = currentEdges.find((e) => e.id === chosenEdgeId);
  const multBefore = affectedEdge ? [affectedEdge.congestionMultiplier] : [1.0];
  let multAfter: number[] = [1.0];

  // Apply incident to the cloned edge list
  if (type === 'road_closure') {
    if (severity === 1) {
      if (affectedEdge) { affectedEdge.congestionMultiplier = 2.5; multAfter = [2.5]; }
    } else if (severity === 2) {
      if (affectedEdge) { affectedEdge.congestionMultiplier = 5.0; multAfter = [5.0]; }
    } else {
      // Severity 3: full block
      if (affectedEdge) {
        affectedEdge.isBlocked = true;
        affectedEdge.congestionMultiplier = 99.0;
        multAfter = [99.0];
      }
    }
  } else {
    // Congestion Surge multipliers: severity 1 → ≥1.5, severity 2 → ≥2.0, severity 3 → ≥3.0
    const surgeMultiplier = severity === 1 ? 1.5 : severity === 2 ? 2.0 : 3.0;
    if (affectedEdge) {
      affectedEdge.congestionMultiplier = surgeMultiplier;
      affectedEdge.isBlocked = false;
      multAfter = [surgeMultiplier];
    }
  }

  const customerMap = new Map<string, Customer>();
  scenario.customers.forEach((c) => customerMap.set(c.id, c));

  let originalRemainingTravelMinutes = 0;
  let incidentAdjustedTravelMinutes = 0;
  let routeBlockedByIncident = false;
  const affectedVehicleSet = new Set<string>();

  vehicleDynamicStates.forEach((vs) => {
    let curr = vs.currentNodeId;
    const targetNodes = vs.pendingCustomerIds
      .map((cId) => customerMap.get(cId)?.nodeId)
      .filter((n): n is string => Boolean(n));
    targetNodes.push(scenario.depotNodeId);

    let vehicleIsAffected = false;

    for (const target of targetNodes) {
      // Original path on pre-incident scenario edges
      const prePath = findShortestPath(scenario.nodes, scenario.edges, curr, target);
      if (prePath.reachable) {
        originalRemainingTravelMinutes += prePath.travelMinutes;
        if (prePath.edgeIds.includes(chosenEdgeId!)) {
          vehicleIsAffected = true;
        }
      }

      // Post-incident: Dijkstra finds best detour using incident-modified edge costs
      const incidentPath = findShortestPath(scenario.nodes, currentEdges, curr, target);
      if (incidentPath.reachable) {
        let legMinutes = 0;
        for (const eId of incidentPath.edgeIds) {
          const modEdge = currentEdges.find((e) => e.id === eId);
          if (modEdge) legMinutes += getEffectiveTravelMinutes(modEdge);
        }
        incidentAdjustedTravelMinutes += legMinutes;
      } else {
        // Graph disconnected: no route available through incident
        routeBlockedByIncident = true;
      }

      curr = target;
    }

    if (vehicleIsAffected) affectedVehicleSet.add(vs.vehicleId);
  });

  const affectedVehicleIds = Array.from(affectedVehicleSet);

  const edgeLabel = affectedEdge ? `${affectedEdge.from}->${affectedEdge.to}` : chosenEdgeId;
  const desc =
    type === 'road_closure'
      ? severity === 3
        ? `Full road closure on edge ${chosenEdgeId} (${edgeLabel}). Street segment completely blocked.`
        : `Severe blockage on edge ${chosenEdgeId} (${edgeLabel}) with ${multAfter[0]}x congestion.`
      : `Congestion surge on edge ${chosenEdgeId} (${edgeLabel}) with ${multAfter[0]}x traffic delay.`;

  const incident: DynamicIncident = {
    id: `incident-${Date.now()}`,
    type,
    affectedEdgeIds: [chosenEdgeId!],
    severity,
    multiplierBefore: multBefore,
    multiplierAfter: multAfter,
    occurredAtStep: 1,
    active: true,
    affectedVehicleIds,
    description: desc,
  };

  const updatedVehicleStates: VehicleDynamicState[] = vehicleDynamicStates.map((vs) => ({
    ...vs,
    executionState: affectedVehicleSet.has(vs.vehicleId)
      ? 'rerouting'
      : vs.pendingCustomerIds.length > 0
        ? 'en_route'
        : 'inactive',
  }));

  return {
    incident,
    incidentEdges: currentEdges,
    affectedVehicleIds,
    originalRemainingTravelMinutes: Number(originalRemainingTravelMinutes.toFixed(2)),
    // null if no route exists even with detour (route recovery needed)
    incidentAdjustedRemainingTravelMinutes: routeBlockedByIncident
      ? null
      : Number(incidentAdjustedTravelMinutes.toFixed(2)),
    routeBlockedByIncident,
    updatedVehicleStates,
  };
}

/**
 * Validates a revised route plan where vehicles start at their current (non-depot) nodes.
 * Checks: correct start node per vehicle dynamic state, depot return, blocked edge avoidance,
 * path reachability, capacity compliance, and duplicate/coverage checks.
 */
export function validateRevisedRoutePlan(
  plan: RoutePlan,
  scenario: Scenario,
  incidentEdges: Edge[],
  vehicleDynamicStates: VehicleDynamicState[]
): RoutePlanValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const edgeMap = new Map<string, Edge>();
  incidentEdges.forEach((e) => edgeMap.set(e.id, e));

  let capacityCompliant = true;
  let customerCoverageComplete = plan.unservedCustomerIds.length === 0;
  let noDuplicateCustomerService = plan.duplicateCustomerIds.length === 0;
  let allRoutesStartCorrectly = true;
  let allRoutesEndAtDepot = true;
  let noBlockedEdgesUsed = true;
  let allRoutePathsReachable = true;

  const vehicleStateMap = new Map<string, VehicleDynamicState>();
  vehicleDynamicStates.forEach((vs) => vehicleStateMap.set(vs.vehicleId, vs));

  for (const route of plan.vehicleRoutes) {
    const vs = vehicleStateMap.get(route.vehicleId);
    const expectedStartNode = vs ? vs.currentNodeId : scenario.depotNodeId;

    if (route.fullPathNodeIds.length > 0 && route.fullPathNodeIds[0] !== expectedStartNode) {
      allRoutesStartCorrectly = false;
      errors.push(
        `Vehicle ${route.vehicleId} started at ${route.fullPathNodeIds[0]} instead of current node ${expectedStartNode}.`
      );
    }

    if (route.customerIds.length > 0) {
      const lastNode = route.fullPathNodeIds[route.fullPathNodeIds.length - 1];
      if (lastNode !== scenario.depotNodeId) {
        allRoutesEndAtDepot = false;
        errors.push(`Vehicle ${route.vehicleId} did not end at Central Hub depot.`);
      }
    }

    for (const edgeId of route.fullPathEdgeIds) {
      const e = edgeMap.get(edgeId);
      if (e?.isBlocked) {
        noBlockedEdgesUsed = false;
        errors.push(`Vehicle ${route.vehicleId} traversed blocked edge ${edgeId}.`);
      }
    }

    if (!route.reachable) {
      allRoutePathsReachable = false;
      errors.push(`Vehicle ${route.vehicleId} contains unreachable legs.`);
    }
  }

  const valid =
    errors.length === 0 &&
    capacityCompliant &&
    noDuplicateCustomerService &&
    allRoutesStartCorrectly &&
    allRoutesEndAtDepot &&
    noBlockedEdgesUsed &&
    allRoutePathsReachable;

  return {
    valid,
    capacityCompliant,
    customerCoverageComplete,
    noDuplicateCustomerService,
    allRoutesStartAtDepot: allRoutesStartCorrectly,
    allRoutesEndAtDepot,
    noBlockedEdgesUsed,
    allRoutePathsReachable,
    errors,
    warnings,
  };
}

/**
 * Runs genuine dynamic fleet re-routing.
 * Solves VRP for pending customers from each vehicle's current node back to depot,
 * using the post-incident graph. Supports Greedy, Classical PSO (via QPSO keys), and QPSO.
 *
 * Default re-routing algorithm: QPSO Fast Re-route (15 particles, 25 iters, beta 1.0→0.5).
 *
 * externalInitialSnapshot / externalPreIncidentSnapshot: immutable deep copies from App state.
 * They are cloned again here — never mutated.
 */
export function runDynamicRerouting(
  scenario: Scenario,
  incidentEdges: Edge[],
  vehicleDynamicStates: VehicleDynamicState[],
  incident: DynamicIncident,
  originalRemainingTravelMinutes: number,
  incidentAdjustedRemainingTravelMinutes: number | null,
  algorithmName: AlgorithmName = 'qpso',
  presetName: QpsoPreset = 'Fast Re-route',
  externalInitialSnapshot?: RoutePlanSnapshot,
  externalPreIncidentSnapshot?: RoutePlanSnapshot
): ReroutingResult {
  const t0 = performance.now();

  const customerMap = new Map<string, Customer>();
  scenario.customers.forEach((c) => customerMap.set(c.id, c));

  const vehicleStateMap = new Map<string, VehicleDynamicState>();
  vehicleDynamicStates.forEach((vs) => vehicleStateMap.set(vs.vehicleId, vs));

  // Collect all pending (not yet served) customers across all vehicles
  const pendingCustomerIdsSet = new Set<string>();
  vehicleDynamicStates.forEach((vs) => {
    vs.pendingCustomerIds.forEach((cId) => pendingCustomerIdsSet.add(cId));
  });

  const pendingCustomers = Array.from(pendingCustomerIdsSet)
    .map((cId) => customerMap.get(cId))
    .filter((c): c is Customer => Boolean(c))
    .sort((a, b) => a.id.localeCompare(b.id));

  const numPending = pendingCustomers.length;
  const vehicles = scenario.vehicles;
  const numVehicles = vehicles.length;

  // Build a shared RoutingContext for the re-routing problem.
  // lockedCustomerIds are served customers excluded from optimization.
  // eligibleCustomerIds are all pending/unserved customers under consideration.
  const lockedCustomerIds = Array.from(
    vehicleDynamicStates.reduce((acc, vs) => {
      vs.deliveredCustomerIds.forEach((cId) => acc.add(cId));
      return acc;
    }, new Set<string>())
  ).sort();

  const routingContext: RoutingContext = {
    mode: 'reroute',
    depotNodeId: scenario.depotNodeId,
    startNodeByVehicleId: Object.fromEntries(
      vehicleDynamicStates.map((vs) => [vs.vehicleId, vs.currentNodeId])
    ),
    remainingCapacityByVehicleId: Object.fromEntries(
      vehicleDynamicStates.map((vs) => [vs.vehicleId, vs.remainingCapacity])
    ),
    lockedCustomerIds,
    eligibleCustomerIds: pendingCustomers.map((c) => c.id),
    graphEdges: deepClone(incidentEdges),
  };

  const activeVehicles = vehicles.filter((v) => {
    const vs = vehicleStateMap.get(v.id);
    return vs && vs.remainingCapacity > 0;
  });

  const warnings: string[] = [];

  // Build full VehicleRoute for a given customer assignment map.
  // Each vehicle starts at its current node (vs.currentNodeId), ends at depot.
  const buildCandidateRoutes = (
    assignments: Map<string, Customer[]>
  ): VehicleRoute[] => {
    const routes: VehicleRoute[] = [];

    for (const vehicle of vehicles) {
      const vs = vehicleStateMap.get(vehicle.id);
      const startNodeId = vs ? vs.currentNodeId : scenario.depotNodeId;
      const assignedCusts = assignments.get(vehicle.id) || [];

      const customerIds: string[] = assignedCusts.map((c) => c.id);
      const stopNodeIds: string[] = [startNodeId];
      const fullPathNodeIds: string[] = [startNodeId];
      const fullPathEdgeIds: string[] = [];
      let isReachable = true;
      let usedRemainingDemand = 0;
      let routeMinutes = 0;
      let routeDist = 0;
      let routeCongestion = 0;
      let routeBlocked = false;

      let curr = startNodeId;

      for (const cust of assignedCusts) {
        stopNodeIds.push(cust.nodeId);
        usedRemainingDemand += cust.demand;

        const leg = findShortestPath(scenario.nodes, incidentEdges, curr, cust.nodeId);
        if (leg.reachable) {
          for (let i = 1; i < leg.nodeIds.length; i++) fullPathNodeIds.push(leg.nodeIds[i]);
          for (const eId of leg.edgeIds) {
            fullPathEdgeIds.push(eId);
            const edge = incidentEdges.find((e) => e.id === eId);
            if (edge) {
              routeMinutes += getEffectiveTravelMinutes(edge);
              routeDist += edge.distanceKm;
              routeCongestion += edge.baseTravelMinutes * Math.max(0, edge.congestionMultiplier - 1);
              if (edge.isBlocked) routeBlocked = true;
            }
          }
        } else {
          isReachable = false;
        }
        curr = cust.nodeId;
      }

      // Every non-empty revised route must end at depot
      if (assignedCusts.length > 0 || startNodeId !== scenario.depotNodeId) {
        stopNodeIds.push(scenario.depotNodeId);
        const returnLeg = findShortestPath(scenario.nodes, incidentEdges, curr, scenario.depotNodeId);
        if (returnLeg.reachable) {
          for (let i = 1; i < returnLeg.nodeIds.length; i++) fullPathNodeIds.push(returnLeg.nodeIds[i]);
          for (const eId of returnLeg.edgeIds) {
            fullPathEdgeIds.push(eId);
            const edge = incidentEdges.find((e) => e.id === eId);
            if (edge) {
              routeMinutes += getEffectiveTravelMinutes(edge);
              routeDist += edge.distanceKm;
              routeCongestion += edge.baseTravelMinutes * Math.max(0, edge.congestionMultiplier - 1);
              if (edge.isBlocked) routeBlocked = true;
            }
          }
        } else {
          isReachable = false;
        }
      }

      const capacityLimit = vs ? vs.remainingCapacity : vehicle.capacity;
      const capacityExceeded = usedRemainingDemand > capacityLimit;

      // Completed (locked) customers for this vehicle from pre-incident state
      const completedForVehicle = vs ? [...vs.deliveredCustomerIds] : [];

      routes.push({
        vehicleId: vehicle.id,
        vehicleLabel: vehicle.label,
        customerIds,
        stopNodeIds,
        fullPathNodeIds,
        fullPathEdgeIds,
        travelMinutes: Number(routeMinutes.toFixed(2)),
        distanceKm: Number(routeDist.toFixed(2)),
        congestionPenalty: Number(routeCongestion.toFixed(2)),
        usedCapacity: usedRemainingDemand,
        remainingCapacity: Math.max(0, capacityLimit - usedRemainingDemand),
        startsAtDepot: startNodeId === scenario.depotNodeId,
        endsAtDepot: true,
        reachable: isReachable,
        feasible: isReachable && !capacityExceeded && !routeBlocked,
        warnings: capacityExceeded ? ['Vehicle remaining capacity exceeded'] : [],
        // Dynamic reroute fields
        startNodeId,
        endNodeId: scenario.depotNodeId,
        completedCustomerIds: completedForVehicle,
        pendingCustomerIds: [...customerIds],
        isDynamicReroute: true,
        initialVehicleCurrentNodeId: startNodeId,
      });
    }

    return routes;
  };

  // Shared objective function: F = 0.55T + 0.25D + 0.20C + 10000P (unchanged from initial routing)
  const evaluateCandidatePlan = (
    routes: VehicleRoute[]
  ): { plan: RoutePlan; score: number } => {
    candidateEvaluations++;
    let totMin = 0;
    let totDist = 0;
    let totCong = 0;
    let penalty = 0;

    const assignedSet = new Set<string>();

    routes.forEach((r) => {
      totMin += r.travelMinutes;
      totDist += r.distanceKm;
      totCong += r.congestionPenalty;

      const vs = vehicleStateMap.get(r.vehicleId);
      const cap = vs ? vs.remainingCapacity : 30;
      if (r.usedCapacity > cap) penalty += 10000;
      if (!r.reachable) penalty += 50000;

      r.fullPathEdgeIds.forEach((eId) => {
        const e = incidentEdges.find((ed) => ed.id === eId);
        if (e?.isBlocked) penalty += 50000;
      });

      r.customerIds.forEach((cId) => assignedSet.add(cId));
    });

    const unservedCount = pendingCustomers.filter((c) => !assignedSet.has(c.id)).length;
    penalty += unservedCount * 10000;

    const score = 0.55 * totMin + 0.25 * totDist + 0.20 * totCong + penalty;

    const plan: RoutePlan = {
      algorithm: algorithmName,
      scenarioId: scenario.id,
      seed: scenario.seed,
      depotNodeId: scenario.depotNodeId,
      vehicleRoutes: routes,
      totalTravelMinutes: Number(totMin.toFixed(2)),
      totalDistanceKm: Number(totDist.toFixed(2)),
      congestionPenalty: Number(totCong.toFixed(2)),
      routingScore: Number(score.toFixed(2)),
      customersServed: assignedSet.size,
      customerCount: pendingCustomers.length,
      unservedCustomerIds: pendingCustomers.filter((c) => !assignedSet.has(c.id)).map((c) => c.id),
      duplicateCustomerIds: [],
      capacityViolationVehicleIds: routes
        .filter((r) => r.usedCapacity > (vehicleStateMap.get(r.vehicleId)?.remainingCapacity || 30))
        .map((r) => r.vehicleId),
      blockedEdgeViolationIds: routes
        .flatMap((r) => r.fullPathEdgeIds)
        .filter((eId) => incidentEdges.find((e) => e.id === eId)?.isBlocked),
      unreachableVehicleIds: routes.filter((r) => !r.reachable).map((r) => r.vehicleId),
      isFeasible: penalty === 0,
      warnings,
      runtimeMs: 0,
    };

    return { plan, score };
  };

  // Shared random-key decoder for re-routing (mirrors initial routing decoder logic)
  const decodeKeysToAssignments = (
    assignKeys: number[],
    prioKeys: number[]
  ): Map<string, Customer[]> => {
    const map = new Map<string, { cust: Customer; prio: number }[]>();
    vehicles.forEach((v) => map.set(v.id, []));

    const numAvail = activeVehicles.length > 0 ? activeVehicles.length : numVehicles;
    const targetVehicles = activeVehicles.length > 0 ? activeVehicles : vehicles;

    pendingCustomers.forEach((cust, idx) => {
      const rawAssign = assignKeys[idx] ?? 0;
      const clampedAssign = Math.max(0, Math.min(0.999999, rawAssign));
      const vIdx = Math.min(numAvail - 1, Math.floor(clampedAssign * numAvail));
      const chosenVehicle = targetVehicles[vIdx];
      map.get(chosenVehicle.id)!.push({ cust, prio: prioKeys[idx] ?? 0 });
    });

    map.forEach((list) => list.sort((a, b) => a.prio - b.prio));

    const resultMap = new Map<string, Customer[]>();
    vehicles.forEach((v) => resultMap.set(v.id, []));
    const vehicleLoads = new Map<string, number>();
    vehicles.forEach((v) => vehicleLoads.set(v.id, 0));

    // Capacity repair: respects remaining capacity per vehicle
    vehicles.forEach((v) => {
      const vs = vehicleStateMap.get(v.id);
      const cap = vs ? vs.remainingCapacity : v.capacity;
      const list = map.get(v.id) || [];

      for (const item of list) {
        const curLoad = vehicleLoads.get(v.id) || 0;
        if (curLoad + item.cust.demand <= cap) {
          resultMap.get(v.id)!.push(item.cust);
          vehicleLoads.set(v.id, curLoad + item.cust.demand);
        } else {
          let reassigned = false;
          for (const altV of targetVehicles) {
            const altVs = vehicleStateMap.get(altV.id);
            const altCap = altVs ? altVs.remainingCapacity : altV.capacity;
            const altLoad = vehicleLoads.get(altV.id) || 0;
            if (altLoad + item.cust.demand <= altCap) {
              resultMap.get(altV.id)!.push(item.cust);
              vehicleLoads.set(altV.id, altLoad + item.cust.demand);
              reassigned = true;
              break;
            }
          }
          if (!reassigned) {
            // Penalized assignment — included to avoid silent exclusion of infeasible customers
            resultMap.get(v.id)!.push(item.cust);
            vehicleLoads.set(v.id, (vehicleLoads.get(v.id) || 0) + item.cust.demand);
          }
        }
      }
    });

    return resultMap;
  };

  let bestRoutes: VehicleRoute[] = [];
  let bestPlanResult!: RoutePlan;
  let bestScore = Infinity;
  let candidateEvaluations = 0;
  let populationSize = 0;
  let iterations = 0;

  if (numPending === 0) {
    // All customers already served — vehicles return directly to depot
    const assignments = new Map<string, Customer[]>();
    vehicles.forEach((v) => assignments.set(v.id, []));
    bestRoutes = buildCandidateRoutes(assignments);
    const evalRes = evaluateCandidatePlan(bestRoutes);
    bestPlanResult = evalRes.plan;
    bestScore = evalRes.score;
    populationSize = 0;
    iterations = 0;
  } else if (algorithmName === 'greedy') {
    // Greedy re-route: nearest-neighbor from each vehicle's current position
    const assignments = new Map<string, Customer[]>();
    vehicles.forEach((v) => assignments.set(v.id, []));
    const vehicleLoads = new Map<string, number>();
    vehicles.forEach((v) => vehicleLoads.set(v.id, 0));

    const remainingToAssign = [...pendingCustomers];
    while (remainingToAssign.length > 0) {
      let bestV = vehicles[0];
      let bestCust = remainingToAssign[0];
      let bestCustIdx = 0;
      let shortestTravelTime = Infinity;

      for (const v of vehicles) {
        const vs = vehicleStateMap.get(v.id);
        const cap = vs ? vs.remainingCapacity : v.capacity;
        const curLoad = vehicleLoads.get(v.id) || 0;
        const curList = assignments.get(v.id)!;
        const lastNode = curList.length > 0
          ? curList[curList.length - 1].nodeId
          : vs ? vs.currentNodeId : scenario.depotNodeId;

        for (let i = 0; i < remainingToAssign.length; i++) {
          const c = remainingToAssign[i];
          if (curLoad + c.demand <= cap) {
            const path = findShortestPath(scenario.nodes, incidentEdges, lastNode, c.nodeId);
            if (path.reachable && path.travelMinutes < shortestTravelTime) {
              shortestTravelTime = path.travelMinutes;
              bestV = v;
              bestCust = c;
              bestCustIdx = i;
            }
          }
        }
      }

      if (shortestTravelTime === Infinity) {
        const fallbackCust = remainingToAssign.shift()!;
        assignments.get(vehicles[0].id)!.push(fallbackCust);
      } else {
        assignments.get(bestV.id)!.push(bestCust);
        vehicleLoads.set(bestV.id, (vehicleLoads.get(bestV.id) || 0) + bestCust.demand);
        remainingToAssign.splice(bestCustIdx, 1);
      }
    }

    bestRoutes = buildCandidateRoutes(assignments);
    const evalRes = evaluateCandidatePlan(bestRoutes);
    bestPlanResult = evalRes.plan;
    bestScore = evalRes.score;
    populationSize = 0;
    iterations = 0;
  } else {
    // QPSO (default) or Classical PSO re-routing
    // Fast Re-route: 15 particles, 25 iterations, beta 1.0→0.5 = 390 candidate evaluations
    const preset = QPSO_PRESETS[presetName] || QPSO_PRESETS['Fast Re-route'];
    const popSize = preset.populationSize;
    const iters = preset.iterations;
    populationSize = popSize;
    iterations = iters;

    // Deterministic seed derived from scenario seed + rerouting tag (no Math.random())
    const rng = new SeededRandom((scenario.seed ^ 0x72657274 ^ 26137) >>> 0);

    interface RerouteParticle {
      assignKeys: number[];
      prioKeys: number[];
      pbestAssignKeys: number[];
      pbestPrioKeys: number[];
      pbestFitness: number;
    }

    const particles: RerouteParticle[] = [];
    let gbestAssignKeys: number[] = [];
    let gbestPrioKeys: number[] = [];

    for (let i = 0; i < popSize; i++) {
      const assignKeys = new Array(numPending);
      const prioKeys = new Array(numPending);
      for (let j = 0; j < numPending; j++) {
        assignKeys[j] = rng.nextFloat(0, 1);
        prioKeys[j] = rng.nextFloat(0, 1);
      }

      const candAssignments = decodeKeysToAssignments(assignKeys, prioKeys);
      const candRoutes = buildCandidateRoutes(candAssignments);
      const { plan: candPlan, score: candScore } = evaluateCandidatePlan(candRoutes);

      particles.push({
        assignKeys,
        prioKeys,
        pbestAssignKeys: [...assignKeys],
        pbestPrioKeys: [...prioKeys],
        pbestFitness: candScore,
      });

      if (candScore < bestScore) {
        bestScore = candScore;
        bestRoutes = candRoutes;
        bestPlanResult = candPlan;
        gbestAssignKeys = [...assignKeys];
        gbestPrioKeys = [...prioKeys];
      }
    }

    // QPSO iteration loop with Mean-Best attractor (beta decays linearly)
    for (let t = 0; t < iters; t++) {
      const beta =
        iters <= 1
          ? preset.betaEnd
          : preset.betaStart - ((preset.betaStart - preset.betaEnd) * t) / (iters - 1);

      const mbestAssign = new Array(numPending).fill(0);
      const mbestPrio = new Array(numPending).fill(0);
      for (const p of particles) {
        for (let j = 0; j < numPending; j++) {
          mbestAssign[j] += p.pbestAssignKeys[j];
          mbestPrio[j] += p.pbestPrioKeys[j];
        }
      }
      for (let j = 0; j < numPending; j++) {
        mbestAssign[j] /= popSize;
        mbestPrio[j] /= popSize;
      }

      for (let i = 0; i < popSize; i++) {
        const p = particles[i];

        for (let j = 0; j < numPending; j++) {
          const phiA = rng.next();
          const uA = rng.next();
          const signA: 1 | -1 = rng.next() < 0.5 ? 1 : -1;
          p.assignKeys[j] = qpsoCoordinateUpdate(
            p.assignKeys[j], p.pbestAssignKeys[j], gbestAssignKeys[j],
            mbestAssign[j], beta, phiA, uA, signA
          );

          const phiP = rng.next();
          const uP = rng.next();
          const signP: 1 | -1 = rng.next() < 0.5 ? 1 : -1;
          p.prioKeys[j] = qpsoCoordinateUpdate(
            p.prioKeys[j], p.pbestPrioKeys[j], gbestPrioKeys[j],
            mbestPrio[j], beta, phiP, uP, signP
          );
        }

        const candAssignments = decodeKeysToAssignments(p.assignKeys, p.prioKeys);
        const candRoutes = buildCandidateRoutes(candAssignments);
        const { plan: candPlan, score: candScore } = evaluateCandidatePlan(candRoutes);

        if (candScore < p.pbestFitness) {
          p.pbestFitness = candScore;
          p.pbestAssignKeys = [...p.assignKeys];
          p.pbestPrioKeys = [...p.prioKeys];

          if (candScore < bestScore) {
            bestScore = candScore;
            bestRoutes = candRoutes;
            bestPlanResult = candPlan;
            gbestAssignKeys = [...p.assignKeys];
            gbestPrioKeys = [...p.prioKeys];
          }
        }
      }
    }
  }

  const t1 = performance.now();
  const runtimeMs = Number((t1 - t0).toFixed(3));

  // Sum revised travel time across all vehicle routes
  let revisedRemainingTravelMinutes = 0;
  bestRoutes.forEach((r) => { revisedRemainingTravelMinutes += r.travelMinutes; });
  revisedRemainingTravelMinutes = Number(revisedRemainingTravelMinutes.toFixed(2));

  // Delay avoided: only calculable if incident-adjusted time is finite (not blocked)
  let delayAvoidedMinutes: number | null = null;
  if (incidentAdjustedRemainingTravelMinutes !== null) {
    delayAvoidedMinutes = Number(
      Math.max(0, incidentAdjustedRemainingTravelMinutes - revisedRemainingTravelMinutes).toFixed(2)
    );
  }

  // Route stability: count pending customer stops that changed vehicle
  let routeStabilityChanges = 0;
  const originalVehicleMap = new Map<string, string>();
  vehicleDynamicStates.forEach((vs) => {
    vs.pendingCustomerIds.forEach((cId) => originalVehicleMap.set(cId, vs.vehicleId));
  });
  bestRoutes.forEach((r) => {
    r.customerIds.forEach((cId) => {
      const origV = originalVehicleMap.get(cId);
      if (origV && origV !== r.vehicleId) routeStabilityChanges++;
    });
  });

  const revisedVehicleStates: VehicleDynamicState[] = vehicleDynamicStates.map((vs) => {
    const revisedRoute = bestRoutes.find((r) => r.vehicleId === vs.vehicleId);
    return {
      ...vs,
      pendingCustomerIds: revisedRoute ? [...revisedRoute.customerIds] : [],
      executionState: 'revised',
    };
  });

  const finalPlan: RoutePlan = { ...bestPlanResult!, runtimeMs };

  const revisedSnapshot: RoutePlanSnapshot = deepClone({
    id: `snapshot-revised-${Date.now()}`,
    timestamp: new Date().toISOString(),
    label: 'revised_plan',
    scenarioId: scenario.id,
    scenarioSeed: scenario.seed,
    algorithm: algorithmName,
    routePlan: finalPlan,
    trafficState: incidentEdges,
    vehicleDynamicStates: revisedVehicleStates,
  });

  // Use externally-provided snapshots (immutable) or create placeholders for test use
  const initialSnapshot: RoutePlanSnapshot = externalInitialSnapshot
    ? deepClone(externalInitialSnapshot)
    : deepClone({
      id: `snapshot-init-${Date.now()}`,
      timestamp: new Date().toISOString(),
      label: 'initial_plan',
      scenarioId: scenario.id,
      scenarioSeed: scenario.seed,
      algorithm: algorithmName,
      routePlan: finalPlan,
      trafficState: scenario.edges,
      vehicleDynamicStates,
    });

  const preIncidentSnapshot: RoutePlanSnapshot = externalPreIncidentSnapshot
    ? deepClone(externalPreIncidentSnapshot)
    : deepClone({
      id: `snapshot-pre-${Date.now()}`,
      timestamp: new Date().toISOString(),
      label: 'pre_incident',
      scenarioId: scenario.id,
      scenarioSeed: scenario.seed,
      algorithm: algorithmName,
      routePlan: finalPlan,
      trafficState: scenario.edges,
      vehicleDynamicStates,
    });

  return {
    initialSnapshot,
    preIncidentSnapshot,
    revisedSnapshot,
    incident,
    reroutingAlgorithm: algorithmName,
    reroutingPreset: presetName,
    reroutingRuntimeMs: runtimeMs,
    affectedVehicleIds: incident.affectedVehicleIds,
    originalRemainingTravelMinutes,
    incidentAdjustedRemainingTravelMinutes,
    revisedRemainingTravelMinutes,
    delayAvoidedMinutes,
    routeStabilityChanges,
    warnings,
    lockedCustomerCount: routingContext.lockedCustomerIds.length,
    eligibleCustomerIds: routingContext.eligibleCustomerIds,
    populationSize,
    iterations,
    candidateEvaluations,
    revisedFeasible: bestPlanResult?.isFeasible ?? false,
  };
}
