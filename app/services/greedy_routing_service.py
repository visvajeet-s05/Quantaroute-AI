from __future__ import annotations

import functools
import time
from typing import Any, Collection, Sequence

from app.algorithms.dijkstra import DijkstraResult, GraphEdge, find_shortest_path
from app.schemas.common import AlgorithmName
from app.schemas.optimization import (
    OptimizationMetadataSchema,
    OptimizationPreset,
    OptimizationRequest,
    OptimizationResponse,
)
from app.schemas.routing import (
    EvaluateRequest,
    RoutePlanSchema,
    RoutingMode,
    VehicleRouteSchema,
)
from app.schemas.scenario import CustomerSchema, ScenarioSchema, VehicleSchema
from app.services.route_plan_evaluator import evaluate_route_plan


class UnsupportedOptimizationError(Exception):
    def __init__(self, code: str, message: str, details: dict[str, Any] | None = None) -> None:
        self.code = code
        self.message = message
        self.details = details or {}
        super().__init__(message)


def build_initial_routing_context(
    scenario: ScenarioSchema,
) -> tuple[list[str], list[GraphEdge], dict[str, CustomerSchema], list[VehicleSchema]]:
    """Extract and sort initial data structures from scenario without mutating it."""
    node_ids = [node.id for node in scenario.nodes]
    graph_edges = [
        GraphEdge(
            edge_id=edge.id,
            from_node_id=edge.from_,
            to_node_id=edge.to,
            distance_km=edge.distance_km,
            base_travel_minutes=edge.base_travel_minutes,
            congestion_multiplier=edge.congestion_multiplier,
            is_blocked=edge.is_blocked,
        )
        for edge in scenario.edges
    ]
    # Sorted customer dict by customer ID (lexicographical)
    sorted_customers = sorted(scenario.customers, key=lambda c: c.id)
    customer_map = {c.id: c for c in sorted_customers}

    # Sorted vehicles by vehicle ID (lexicographical)
    sorted_vehicles = sorted(scenario.vehicles, key=lambda v: v.id)

    return node_ids, graph_edges, customer_map, sorted_vehicles


def _compare_candidates(a: dict[str, Any], b: dict[str, Any]) -> int:
    """Deterministic tie-breaking comparator:

    1. lowest travel_minutes (with 1e-6 floating tolerance)
    2. customer.id lexicographically
    3. customer.node_id lexicographically
    """
    diff = a["travel_minutes"] - b["travel_minutes"]
    if abs(diff) > 1e-6:
        return -1 if diff < 0 else 1

    cust_a: CustomerSchema = a["customer"]
    cust_b: CustomerSchema = b["customer"]

    if cust_a.id != cust_b.id:
        return -1 if cust_a.id < cust_b.id else 1

    if cust_a.node_id != cust_b.node_id:
        return -1 if cust_a.node_id < cust_b.node_id else 1

    return 0


def choose_next_customer(
    current_node_id: str,
    remaining_capacity: int,
    pending_customers: Sequence[CustomerSchema],
    node_ids: Collection[str],
    graph_edges: Sequence[GraphEdge],
) -> dict[str, Any] | None:
    """Find the nearest reachable pending customer that fits remaining vehicle capacity."""
    # 1. Filter candidates by capacity
    capacity_candidates = [
        cust for cust in pending_customers if cust.demand <= remaining_capacity
    ]
    if not capacity_candidates:
        return None

    # 2. Evaluate Dijkstra shortest path from current_node_id to candidate.node_id
    reachable_candidates: list[dict[str, Any]] = []
    for candidate in capacity_candidates:
        result: DijkstraResult = find_shortest_path(
            node_ids=node_ids,
            edges=graph_edges,
            source_node_id=current_node_id,
            destination_node_id=candidate.node_id,
        )
        if result.reachable:
            reachable_candidates.append({
                "customer": candidate,
                "travel_minutes": result.travel_minutes,
                "distance_km": result.distance_km,
                "node_ids": result.node_ids,
                "edge_ids": result.edge_ids,
            })

    if not reachable_candidates:
        return None

    # 3. Deterministic sort
    reachable_candidates.sort(key=functools.cmp_to_key(_compare_candidates))
    return reachable_candidates[0]


def concatenate_path_leg(
    full_path_node_ids: list[str],
    full_path_edge_ids: list[str],
    leg_node_ids: list[str],
    leg_edge_ids: list[str],
) -> None:
    """Concatenate a path leg without duplicating the connecting node."""
    if not full_path_node_ids:
        full_path_node_ids.extend(leg_node_ids)
    else:
        full_path_node_ids.extend(leg_node_ids[1:])
    full_path_edge_ids.extend(leg_edge_ids)


def build_greedy_route_plan(
    scenario: ScenarioSchema,
) -> RoutePlanSchema:
    """Construct deterministic capacity-aware Greedy multi-vehicle routes."""
    node_ids, graph_edges, customer_map, sorted_vehicles = build_initial_routing_context(scenario)

    # Pending customers remaining to be served (ordered by customer ID)
    pending_customers = {cid: cust for cid, cust in customer_map.items()}

    vehicle_routes: list[VehicleRouteSchema] = []

    for vehicle in sorted_vehicles:
        current_node_id = scenario.depot_node_id
        remaining_capacity = vehicle.capacity
        route_customer_ids: list[str] = []
        full_path_node_ids: list[str] = []
        full_path_edge_ids: list[str] = []

        # Greedily assign customers that fit remaining capacity
        while pending_customers:
            best_candidate = choose_next_customer(
                current_node_id=current_node_id,
                remaining_capacity=remaining_capacity,
                pending_customers=list(pending_customers.values()),
                node_ids=node_ids,
                graph_edges=graph_edges,
            )
            if best_candidate is None:
                break

            chosen_cust: CustomerSchema = best_candidate["customer"]
            route_customer_ids.append(chosen_cust.id)
            remaining_capacity -= chosen_cust.demand

            concatenate_path_leg(
                full_path_node_ids=full_path_node_ids,
                full_path_edge_ids=full_path_edge_ids,
                leg_node_ids=best_candidate["node_ids"],
                leg_edge_ids=best_candidate["edge_ids"],
            )

            current_node_id = chosen_cust.node_id
            del pending_customers[chosen_cust.id]

        if route_customer_ids:
            # Return leg back to depot
            return_result: DijkstraResult = find_shortest_path(
                node_ids=node_ids,
                edges=graph_edges,
                source_node_id=current_node_id,
                destination_node_id=scenario.depot_node_id,
            )
            if return_result.reachable:
                concatenate_path_leg(
                    full_path_node_ids=full_path_node_ids,
                    full_path_edge_ids=full_path_edge_ids,
                    leg_node_ids=return_result.node_ids,
                    leg_edge_ids=return_result.edge_ids,
                )
            # If unreachable, keep path as is; evaluator will flag end node mismatch / reachability

            vehicle_routes.append(
                VehicleRouteSchema(
                    vehicleId=vehicle.id,
                    customerIds=route_customer_ids,
                    fullPathNodeIds=full_path_node_ids,
                    fullPathEdgeIds=full_path_edge_ids,
                    startNodeId=scenario.depot_node_id,
                    endNodeId=scenario.depot_node_id,
                    completedCustomerIds=[],
                    pendingCustomerIds=list(route_customer_ids),
                    isDynamicReroute=False,
                )
            )
        else:
            # Empty inactive vehicle route
            vehicle_routes.append(
                VehicleRouteSchema(
                    vehicleId=vehicle.id,
                    customerIds=[],
                    fullPathNodeIds=[],
                    fullPathEdgeIds=[],
                    startNodeId=scenario.depot_node_id,
                    endNodeId=scenario.depot_node_id,
                    completedCustomerIds=[],
                    pendingCustomerIds=[],
                    isDynamicReroute=False,
                )
            )

    return RoutePlanSchema(
        algorithm=AlgorithmName.greedy,
        scenarioId=scenario.id,
        seed=scenario.seed,
        depotNodeId=scenario.depot_node_id,
        vehicleRoutes=vehicle_routes,
        mode=RoutingMode.INITIAL,
        routingContext=None,
    )


def optimize_greedy(
    request: OptimizationRequest,
) -> OptimizationResponse:
    """Deterministic Capacity-Aware Greedy Fleet Routing Service.

    Constructs vehicle routes using traffic-aware Dijkstra and scores the plan
    using the shared backend evaluator.
    """
    if request.algorithm != AlgorithmName.greedy:
        raise UnsupportedOptimizationError(
            code="UNSUPPORTED_ALGORITHM",
            message="Backend optimizer currently supports only algorithm='greedy'.",
            details={"requestedAlgorithm": request.algorithm},
        )

    if request.mode != RoutingMode.INITIAL:
        raise UnsupportedOptimizationError(
            code="UNSUPPORTED_MODE",
            message="Backend Greedy optimizer currently supports only mode='initial'.",
            details={"requestedMode": request.mode},
        )

    if request.preset != OptimizationPreset.STANDARD:
        raise UnsupportedOptimizationError(
            code="UNSUPPORTED_PRESET",
            message="Backend Greedy optimizer currently supports only preset='standard'.",
            details={"requestedPreset": request.preset},
        )

    start_time = time.perf_counter()

    route_plan = build_greedy_route_plan(request.scenario)
    evaluation = evaluate_route_plan(
        EvaluateRequest(scenario=request.scenario, routePlan=route_plan)
    )

    runtime_ms = (time.perf_counter() - start_time) * 1000.0

    return OptimizationResponse(
        metadata=OptimizationMetadataSchema(
            algorithm=AlgorithmName.greedy,
            preset=request.preset,
            optimizerSeed=request.optimizer_seed,
            mode=request.mode,
            runtimeMs=runtime_ms,
            deterministic=True,
            notes=["Deterministic capacity-aware Greedy fleet routing."],
        ),
        routePlan=route_plan,
        evaluation=evaluation,
    )
