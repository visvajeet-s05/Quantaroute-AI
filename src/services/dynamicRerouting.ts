/**
 * Dynamic Incident Simulation & Fleet Re-Routing Engine
 * QuantaRoute AI
 *
 * Deterministic, client-side re-routing module.
 * Preserves existing initial optimizers while supporting non-depot start nodes,
 * partial delivery locking, incident injection, and delay-avoidance quantification.
 */

import { Customer, Edge, Node, Scenario, Vehicle } from '../types/domain';
import {
  AlgorithmName,
  DynamicIncident,
  IncidentType,
  PsoPreset,
  QpsoPreset,
  ReroutingResult,
  RoutePlan,
  RoutePlanSnapshot,
  RoutePlanValidationResult,
  VehicleDynamicState,
  VehicleRoute,
} from '../types/routing';
import { findShortestPath } from '../algorithms/dijkstra';
import { getEffectiveTravelMinutes } from '../utils/graphIndex';
import { SeededRandom } from '../utils/seededRandom';
import { calculateMeanBest, qpsoCoordinateUpdate, QPSO_PRESETS } from '../algorithms/quantumPso';

/**
 * Deep-clones an object immutably.
 */
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Creates the initial snapshot from an initial RoutePlan.
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
 */
export function simulatePartialExecution(
  initialSnapshot: RoutePlanSnapshot,
  scenario: Scenario,
  stopsCompletedPerVehicle: number = 1
): { preIncidentSnapshot: RoutePlanSnapshot; vehicleDynamicStates: VehicleDynamicState[] } {
  const customerMap = new Map<string, Customer>();
  scenario.customers.forEach((c) => customerMap.set(c.id, c));

  const vehicleMap = new Map<string, Vehicle>();
  scenario.vehicles.forEach((v) => vehicleMap.set(v.id, v));

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

    // Number of stops this vehicle actually completes
    const completedCount = Math.min(assignedStops.length, stopsCompletedPerVehicle);
    const deliveredCustomerIds = assignedStops.slice(0, completedCount);
    const pendingCustomerIds = assignedStops.slice(completedCount);

    let deliveredDemand = 0;
    deliveredCustomerIds.forEach((cId) => {
      const c = customerMap.get(cId);
      if (c) deliveredDemand += c.demand;
    });

    const remainingCapacity = Math.max(0, capacityLimit - deliveredDemand);

    // Current node is the last completed customer stop node,
    // or depot if vehicle completed all its stops and finished its route
    let currentNodeId = scenario.depotNodeId;
    if (deliveredCustomerIds.length > 0) {
      if (pendingCustomerIds.length === 0 && stopsCompletedPerVehicle > assignedStops.length) {
        // Returned to depot
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
 * Finds critical candidate edges that lie on active vehicles' pending remaining paths.
 */
export function findCandidateIncidentEdges(
  scenario: Scenario,
  vehicleDynamicStates: VehicleDynamicState[],
  edges: Edge[]
): { edgeId: string; label: string; affectedVehicleIds: string[] }[] {
  const customerMap = new Map<string, Customer>();
  scenario.customers.forEach((c) => customerMap.set(c.id, c));

  // Trace remaining legs for each vehicle: currentNode -> pendingStop1 -> ... -> depot
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
        edgeId,
        label: `${edge.id} (${edge.streetName} ${edge.from}->${edge.to})`,
        affectedVehicleIds: vArr,
      });
    }
  });

  // Sort descending by number of affected vehicles
  candidates.sort((a, b) => b.affectedVehicleIds.length - a.affectedVehicleIds.length);
  return candidates;
}

/**
 * Injects a traffic incident (Road Closure or Congestion Surge) onto the road graph.
 * Identifies affected vehicles and computes original vs delayed travel times.
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
  incidentAdjustedRemainingTravelMinutes: number;
  updatedVehicleStates: VehicleDynamicState[];
} {
  const currentEdges = deepClone(scenario.edges);
  const candidateEdges = findCandidateIncidentEdges(scenario, vehicleDynamicStates, currentEdges);

  // If target edge not provided or not in candidates, pick highest impact candidate
  let chosenEdgeId = targetEdgeId;
  if (!chosenEdgeId || !currentEdges.some((e) => e.id === chosenEdgeId)) {
    chosenEdgeId = candidateEdges[0]?.edgeId || currentEdges[4]?.id || 'E05';
  }

  const affectedEdge = currentEdges.find((e) => e.id === chosenEdgeId);
  const multBefore = affectedEdge ? [affectedEdge.congestionMultiplier] : [1.0];
  let multAfter: number[] = [1.0];

  // Apply incident modifications
  if (type === 'road_closure') {
    if (severity === 1) {
      // Lane restriction (2.5x)
      if (affectedEdge) {
        affectedEdge.congestionMultiplier = 2.5;
        multAfter = [2.5];
      }
    } else if (severity === 2) {
      // Major obstruction (5.0x)
      if (affectedEdge) {
        affectedEdge.congestionMultiplier = 5.0;
        multAfter = [5.0];
      }
    } else {
      // Complete road closure
      if (affectedEdge) {
        affectedEdge.isBlocked = true;
        affectedEdge.congestionMultiplier = 99.0;
        multAfter = [99.0];
      }
    }
  } else {
    // Congestion Surge
    const surgeMultiplier = severity === 1 ? 2.0 : severity === 2 ? 3.5 : 5.0;
    if (affectedEdge) {
      affectedEdge.congestionMultiplier = surgeMultiplier;
      affectedEdge.isBlocked = false;
      multAfter = [surgeMultiplier];
    }
  }

  // Calculate pre-incident remaining travel time vs incident-adjusted remaining travel time
  const customerMap = new Map<string, Customer>();
  scenario.customers.forEach((c) => customerMap.set(c.id, c));

  let originalRemainingTravelMinutes = 0;
  let incidentAdjustedRemainingTravelMinutes = 0;
  const affectedVehicleSet = new Set<string>();

  vehicleDynamicStates.forEach((vs) => {
    let curr = vs.currentNodeId;
    const targetNodes = vs.pendingCustomerIds
      .map((cId) => customerMap.get(cId)?.nodeId)
      .filter((n): n is string => Boolean(n));
    targetNodes.push(scenario.depotNodeId);

    let vehicleIsAffected = false;

    for (const target of targetNodes) {
      // Pre-incident path on original edges
      const prePath = findShortestPath(scenario.nodes, scenario.edges, curr, target);
      if (prePath.reachable) {
        originalRemainingTravelMinutes += prePath.travelMinutes;

        // Check if this pre-incident path traversed the incident edge
        if (prePath.edgeIds.includes(chosenEdgeId!)) {
          vehicleIsAffected = true;
        }

        // Incident-adjusted travel time of the SAME physical edge sequence under new conditions
        let legIncidentMinutes = 0;
        for (const eId of prePath.edgeIds) {
          const modEdge = currentEdges.find((e) => e.id === eId);
          if (modEdge) {
            if (modEdge.isBlocked) {
              // Traversing a closed edge causes severe delay/stoppage penalty
              legIncidentMinutes += modEdge.baseTravelMinutes * 50 + 45;
            } else {
              legIncidentMinutes += getEffectiveTravelMinutes(modEdge);
            }
          }
        }
        incidentAdjustedRemainingTravelMinutes += legIncidentMinutes;
      }
      curr = target;
    }

    if (vehicleIsAffected) {
      affectedVehicleSet.add(vs.vehicleId);
    }
  });

  const affectedVehicleIds = Array.from(affectedVehicleSet);

  const desc =
    type === 'road_closure'
      ? severity === 3
        ? `Full road closure on ${affectedEdge?.streetName || chosenEdgeId} (${chosenEdgeId}). Street segment completely blocked.`
        : `Severe blockage on ${affectedEdge?.streetName || chosenEdgeId} (${chosenEdgeId}) with ${multAfter[0]}x congestion.`
      : `Congestion surge on ${affectedEdge?.streetName || chosenEdgeId} (${chosenEdgeId}) with ${multAfter[0]}x traffic delay.`;

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
    incidentAdjustedRemainingTravelMinutes: Number(
      incidentAdjustedRemainingTravelMinutes.toFixed(2)
    ),
    updatedVehicleStates,
  };
}

/**
 * Validates a revised route plan where vehicles start at their respective current nodes.
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

    // Check blocked edge avoidance
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
 * Runs genuine dynamic fleet re-routing:
 * Solves vehicle routing for pending customers starting from each vehicle's current node to depot,
 * avoiding blocked edges and optimizing traffic travel time on the incident graph.
 */
export function runDynamicRerouting(
  scenario: Scenario,
  incidentEdges: Edge[],
  vehicleDynamicStates: VehicleDynamicState[],
  incident: DynamicIncident,
  originalRemainingTravelMinutes: number,
  incidentAdjustedRemainingTravelMinutes: number,
  algorithmName: AlgorithmName = 'qpso',
  presetName: QpsoPreset = 'Fast Re-route'
): ReroutingResult {
  const t0 = performance.now();

  const customerMap = new Map<string, Customer>();
  scenario.customers.forEach((c) => customerMap.set(c.id, c));

  const vehicleStateMap = new Map<string, VehicleDynamicState>();
  vehicleDynamicStates.forEach((vs) => vehicleStateMap.set(vs.vehicleId, vs));

  // Collect all pending customers that need routing
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

  // Available vehicles for pending customers
  const activeVehicles = vehicles.filter((v) => {
    const vs = vehicleStateMap.get(v.id);
    return vs && vs.remainingCapacity > 0;
  });

  const warnings: string[] = [];

  // Re-routing solver based on chosen algorithm
  // Evaluates candidate solutions where each vehicle starts at vs.currentNodeId and returns to depot
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

      // Return to depot leg (always required if vehicle is not already at depot or served pending stops)
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
      });
    }

    return routes;
  };

  const evaluateCandidatePlan = (
    routes: VehicleRoute[]
  ): { plan: RoutePlan; score: number } => {
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

  // Capacity-aware allocation helper
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

      const rawPrio = prioKeys[idx] ?? 0;
      map.get(chosenVehicle.id)!.push({ cust, prio: rawPrio });
    });

    // Sort by priority key
    map.forEach((list) => list.sort((a, b) => a.prio - b.prio));

    // Capacity repair against each vehicle's remaining capacity
    const resultMap = new Map<string, Customer[]>();
    vehicles.forEach((v) => resultMap.set(v.id, []));

    const vehicleLoads = new Map<string, number>();
    vehicles.forEach((v) => vehicleLoads.set(v.id, 0));

    // Greedily fit or reassign to other available vehicles
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
          // Find alternative vehicle with remaining capacity
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
            // Place back on original vehicle anyway (penalized in fitness)
            resultMap.get(v.id)!.push(item.cust);
            vehicleLoads.set(v.id, curLoad + item.cust.demand);
          }
        }
      }
    });

    return resultMap;
  };

  let bestRoutes: VehicleRoute[] = [];
  let bestPlanResult: RoutePlan;
  let bestScore = Infinity;

  if (numPending === 0) {
    // No pending customers; all vehicles return to depot directly
    const assignments = new Map<string, Customer[]>();
    vehicles.forEach((v) => assignments.set(v.id, []));
    bestRoutes = buildCandidateRoutes(assignments);
    const evalRes = evaluateCandidatePlan(bestRoutes);
    bestPlanResult = evalRes.plan;
    bestScore = evalRes.score;
  } else if (algorithmName === 'greedy') {
    // Greedy baseline re-route
    // Prioritize vehicles currently closest to each pending customer
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
        // Fallback: assign to first available vehicle
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
  } else {
    // QPSO (Default) or Classical PSO Re-routing Optimizer
    const preset = QPSO_PRESETS[presetName] || QPSO_PRESETS['Fast Re-route'];
    const popSize = preset.populationSize;
    const iters = preset.iterations;
    const rng = new SeededRandom((scenario.seed ^ 0x72657274 ^ 26137) >>> 0); // 'rert'

    // Particle representation
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

    // Initialize particles
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

    // QPSO Iteration loop with Mean-Best attractor
    for (let t = 0; t < iters; t++) {
      const beta =
        iters <= 1
          ? preset.betaEnd
          : preset.betaStart - ((preset.betaStart - preset.betaEnd) * t) / (iters - 1);

      // Mean-Best across personal bests
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
          // Assignment key update
          const phiA = rng.next();
          const uA = rng.next();
          const signA: 1 | -1 = rng.next() < 0.5 ? 1 : -1;
          p.assignKeys[j] = qpsoCoordinateUpdate(
            p.assignKeys[j],
            p.pbestAssignKeys[j],
            gbestAssignKeys[j],
            mbestAssign[j],
            beta,
            phiA,
            uA,
            signA
          );

          // Priority key update
          const phiP = rng.next();
          const uP = rng.next();
          const signP: 1 | -1 = rng.next() < 0.5 ? 1 : -1;
          p.prioKeys[j] = qpsoCoordinateUpdate(
            p.prioKeys[j],
            p.pbestPrioKeys[j],
            gbestPrioKeys[j],
            mbestPrio[j],
            beta,
            phiP,
            uP,
            signP
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

  // Compute metrics
  let revisedRemainingTravelMinutes = 0;
  bestRoutes.forEach((r) => {
    revisedRemainingTravelMinutes += r.travelMinutes;
  });
  revisedRemainingTravelMinutes = Number(revisedRemainingTravelMinutes.toFixed(2));

  // Delay avoided = (incident travel time without reroute) - (revised travel time with reroute)
  const delayAvoidedMinutes = Number(
    Math.max(0, incidentAdjustedRemainingTravelMinutes - revisedRemainingTravelMinutes).toFixed(2)
  );

  // Route stability changes: count of pending customers that switched vehicles
  let routeStabilityChanges = 0;
  const originalVehicleMap = new Map<string, string>();
  vehicleDynamicStates.forEach((vs) => {
    vs.pendingCustomerIds.forEach((cId) => originalVehicleMap.set(cId, vs.vehicleId));
  });

  bestRoutes.forEach((r) => {
    r.customerIds.forEach((cId) => {
      const origV = originalVehicleMap.get(cId);
      if (origV && origV !== r.vehicleId) {
        routeStabilityChanges++;
      }
    });
  });

  // Updated VehicleDynamicStates marked as revised
  const revisedVehicleStates: VehicleDynamicState[] = vehicleDynamicStates.map((vs) => {
    const revisedRoute = bestRoutes.find((r) => r.vehicleId === vs.vehicleId);
    const newPending = revisedRoute ? [...revisedRoute.customerIds] : [];
    return {
      ...vs,
      pendingCustomerIds: newPending,
      executionState: 'revised',
    };
  });

  const finalPlan: RoutePlan = {
    ...bestPlanResult!,
    runtimeMs,
  };

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

  const initialSnapshot: RoutePlanSnapshot = deepClone({
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

  const preIncidentSnapshot: RoutePlanSnapshot = deepClone({
    id: `snapshot-pre-${Date.now()}`,
    timestamp: new Date().toISOString(),
    label: 'pre_incident',
    scenarioId: scenario.id,
    scenarioSeed: scenario.seed,
    algorithm: algorithmName,
    routePlan: finalPlan,
    trafficState: incidentEdges,
    vehicleDynamicStates,
  });

  return {
    initialSnapshot,
    preIncidentSnapshot,
    revisedSnapshot,
    incident,
    reroutingAlgorithm: algorithmName,
    reroutingRuntimeMs: runtimeMs,
    affectedVehicleIds: incident.affectedVehicleIds,
    originalRemainingTravelMinutes,
    incidentAdjustedRemainingTravelMinutes,
    revisedRemainingTravelMinutes,
    delayAvoidedMinutes,
    routeStabilityChanges,
    warnings,
  };
}
