from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.schemas.routing import (
    RoutePlanSchema,
    RoutingMode,
    VehicleRouteSchema,
)
from app.schemas.scenario import CustomerSchema, EdgeSchema, ScenarioSchema, VehicleSchema


@dataclass
class ValidationIssue:
    category: str
    message: str
    vehicle_id: str | None = None
    edge_id: str | None = None
    customer_id: str | None = None


@dataclass
class VehicleValidationResult:
    vehicle_id: str
    route: VehicleRouteSchema
    issues: list[ValidationIssue] = field(default_factory=list)
    customer_ids_in_route: set[str] = field(default_factory=set)
    completed_customer_ids: set[str] = field(default_factory=set)
    pending_customer_ids: set[str] = field(default_factory=set)
    starts_correctly: bool = True
    ends_at_depot: bool = True
    path_reachable: bool = True
    blocked_edge_ids: set[str] = field(default_factory=set)
    unknown_edge_ids: set[str] = field(default_factory=set)
    continuity_errors: list[str] = field(default_factory=list)
    computed_used_capacity: int = 0
    computed_remaining_capacity: int = 0
    computed_travel_minutes: float = 0.0
    computed_distance_km: float = 0.0
    computed_congestion_penalty: float = 0.0
    warnings: list[str] = field(default_factory=list)


@dataclass
class ValidationResult:
    vehicle_results: dict[str, VehicleValidationResult] = field(default_factory=dict)
    all_issues: list[ValidationIssue] = field(default_factory=list)
    unserved_customer_ids: set[str] = field(default_factory=set)
    duplicate_customer_ids: set[str] = field(default_factory=set)
    capacity_violation_vehicle_ids: set[str] = field(default_factory=set)
    blocked_edge_violation_ids: set[str] = field(default_factory=set)
    unreachable_vehicle_ids: set[str] = field(default_factory=set)
    path_continuity_violation_vehicle_ids: set[str] = field(default_factory=set)
    invalid_start_or_end_vehicle_ids: set[str] = field(default_factory=set)
    warnings: list[str] = field(default_factory=list)


def _build_edge_map(scenario: ScenarioSchema) -> dict[str, EdgeSchema]:
    return {edge.id: edge for edge in scenario.edges}


def _build_customer_map(scenario: ScenarioSchema) -> dict[str, CustomerSchema]:
    return {customer.id: customer for customer in scenario.customers}


def _build_vehicle_map(scenario: ScenarioSchema) -> dict[str, VehicleSchema]:
    return {vehicle.id: vehicle for vehicle in scenario.vehicles}


def _get_required_start_node(
    route: VehicleRouteSchema,
    route_plan: RoutePlanSchema,
    scenario: ScenarioSchema,
    routing_context: Any | None,
) -> str:
    if route_plan.mode == RoutingMode.INITIAL:
        return route_plan.depot_node_id
    if routing_context and route.vehicle_id in routing_context.start_node_by_vehicle_id:
        return routing_context.start_node_by_vehicle_id[route.vehicle_id]
    vehicle = _build_vehicle_map(scenario).get(route.vehicle_id)
    return vehicle.current_node_id if vehicle else route_plan.depot_node_id


def _get_available_capacity(
    route: VehicleRouteSchema,
    route_plan: RoutePlanSchema,
    scenario: ScenarioSchema,
    routing_context: Any | None,
) -> int:
    vehicle_map = _build_vehicle_map(scenario)
    vehicle = vehicle_map.get(route.vehicle_id)
    if not vehicle:
        return 0

    if route_plan.mode == RoutingMode.INITIAL:
        return vehicle.capacity

    if routing_context and route.vehicle_id in routing_context.remaining_capacity_by_vehicle_id:
        return routing_context.remaining_capacity_by_vehicle_id[route.vehicle_id]

    return max(0, vehicle.capacity - vehicle.used_capacity)


def validate_route_plan(
    scenario: ScenarioSchema,
    route_plan: RoutePlanSchema,
) -> ValidationResult:
    result = ValidationResult()

    edge_map = _build_edge_map(scenario)
    customer_map = _build_customer_map(scenario)
    vehicle_map = _build_vehicle_map(scenario)

    routing_context = route_plan.routing_context

    all_customer_ids_in_routes: dict[str, list[str]] = {}

    for route in route_plan.vehicle_routes:
        v_result = VehicleValidationResult(
            vehicle_id=route.vehicle_id,
            route=route,
        )
        result.vehicle_results[route.vehicle_id] = v_result

        if route.vehicle_id not in vehicle_map:
            issue = ValidationIssue(
                category="unknown_vehicle",
                message=f"Vehicle '{route.vehicle_id}' not found in scenario",
                vehicle_id=route.vehicle_id,
            )
            v_result.issues.append(issue)
            result.all_issues.append(issue)
            continue

        if route_plan.mode == RoutingMode.REROUTE and not route.is_dynamic_reroute:
            v_result.warnings.append(
                f"Vehicle '{route.vehicle_id}' is in reroute mode but isDynamicReroute is false"
            )
            result.warnings.append(
                f"Vehicle '{route.vehicle_id}' is in reroute mode but isDynamicReroute is false"
            )

        customer_ids_in_this_route = set(route.customer_ids)
        v_result.customer_ids_in_route = customer_ids_in_this_route
        v_result.completed_customer_ids = set(route.completed_customer_ids)
        v_result.pending_customer_ids = set(route.pending_customer_ids)

        for cust_id in route.completed_customer_ids:
            if cust_id not in customer_map:
                issue = ValidationIssue(
                    category="unknown_customer",
                    message=f"Completed customer '{cust_id}' not found in scenario",
                    vehicle_id=route.vehicle_id,
                    customer_id=cust_id,
                )
                v_result.issues.append(issue)
                result.all_issues.append(issue)

        for cust_id in route.pending_customer_ids:
            if cust_id not in customer_map:
                issue = ValidationIssue(
                    category="unknown_customer",
                    message=f"Pending customer '{cust_id}' not found in scenario",
                    vehicle_id=route.vehicle_id,
                    customer_id=cust_id,
                )
                v_result.issues.append(issue)
                result.all_issues.append(issue)

        for cust_id in route.customer_ids:
            if cust_id not in customer_map:
                issue = ValidationIssue(
                    category="unknown_customer",
                    message=f"Customer '{cust_id}' not found in scenario",
                    vehicle_id=route.vehicle_id,
                    customer_id=cust_id,
                )
                v_result.issues.append(issue)
                result.all_issues.append(issue)
            else:
                all_customer_ids_in_routes.setdefault(cust_id, []).append(route.vehicle_id)

        available_capacity = _get_available_capacity(route, route_plan, scenario, routing_context)
        route_load = sum(
            customer_map[cid].demand
            for cid in route.customer_ids
            if cid not in route.completed_customer_ids and cid in customer_map
        )
        v_result.computed_used_capacity = route_load
        v_result.computed_remaining_capacity = available_capacity - route_load

        if route_load > available_capacity:
            issue = ValidationIssue(
                category="capacity_violation",
                message=f"Vehicle '{route.vehicle_id}' exceeds capacity: load {route_load} > available {available_capacity}",
                vehicle_id=route.vehicle_id,
            )
            v_result.issues.append(issue)
            result.all_issues.append(issue)
            result.capacity_violation_vehicle_ids.add(route.vehicle_id)

        required_start = _get_required_start_node(route, route_plan, scenario, routing_context)
        if route.full_path_node_ids:
            if route.full_path_node_ids[0] != required_start:
                issue = ValidationIssue(
                    category="invalid_start",
                    message=f"Vehicle '{route.vehicle_id}' path starts at '{route.full_path_node_ids[0]}' but required start is '{required_start}'",
                    vehicle_id=route.vehicle_id,
                )
                v_result.issues.append(issue)
                result.all_issues.append(issue)
                v_result.starts_correctly = False
                result.invalid_start_or_end_vehicle_ids.add(route.vehicle_id)
            if route.start_node_id != required_start:
                issue = ValidationIssue(
                    category="invalid_start",
                    message=f"Vehicle '{route.vehicle_id}' startNodeId '{route.start_node_id}' does not match required start '{required_start}'",
                    vehicle_id=route.vehicle_id,
                )
                v_result.issues.append(issue)
                result.all_issues.append(issue)
                v_result.starts_correctly = False
                result.invalid_start_or_end_vehicle_ids.add(route.vehicle_id)

            if route.full_path_node_ids[-1] != route_plan.depot_node_id:
                issue = ValidationIssue(
                    category="invalid_end",
                    message=f"Vehicle '{route.vehicle_id}' path ends at '{route.full_path_node_ids[-1]}' but must end at depot '{route_plan.depot_node_id}'",
                    vehicle_id=route.vehicle_id,
                )
                v_result.issues.append(issue)
                result.all_issues.append(issue)
                v_result.ends_at_depot = False
                result.invalid_start_or_end_vehicle_ids.add(route.vehicle_id)
            if route.end_node_id != route_plan.depot_node_id:
                issue = ValidationIssue(
                    category="invalid_end",
                    message=f"Vehicle '{route.vehicle_id}' endNodeId '{route.end_node_id}' does not match depot '{route_plan.depot_node_id}'",
                    vehicle_id=route.vehicle_id,
                )
                v_result.issues.append(issue)
                result.all_issues.append(issue)
                v_result.ends_at_depot = False
                result.invalid_start_or_end_vehicle_ids.add(route.vehicle_id)
        else:
            if route.customer_ids or route.full_path_edge_ids:
                issue = ValidationIssue(
                    category="empty_path_with_customers",
                    message=f"Vehicle '{route.vehicle_id}' has customers/edges but empty fullPathNodeIds",
                    vehicle_id=route.vehicle_id,
                )
                v_result.issues.append(issue)
                result.all_issues.append(issue)
                v_result.path_reachable = False
                result.unreachable_vehicle_ids.add(route.vehicle_id)
            else:
                if route.start_node_id != required_start:
                    issue = ValidationIssue(
                        category="invalid_start",
                        message=f"Vehicle '{route.vehicle_id}' empty route startNodeId '{route.start_node_id}' does not match required start '{required_start}'",
                        vehicle_id=route.vehicle_id,
                    )
                    v_result.issues.append(issue)
                    result.all_issues.append(issue)
                    v_result.starts_correctly = False
                    result.invalid_start_or_end_vehicle_ids.add(route.vehicle_id)
                if route.end_node_id != route_plan.depot_node_id:
                    issue = ValidationIssue(
                        category="invalid_end",
                        message=f"Vehicle '{route.vehicle_id}' empty route endNodeId '{route.end_node_id}' does not match depot '{route_plan.depot_node_id}'",
                        vehicle_id=route.vehicle_id,
                    )
                    v_result.issues.append(issue)
                    result.all_issues.append(issue)
                    v_result.ends_at_depot = False
                    result.invalid_start_or_end_vehicle_ids.add(route.vehicle_id)

        if route.full_path_edge_ids:
            if len(route.full_path_edge_ids) != len(route.full_path_node_ids) - 1:
                issue = ValidationIssue(
                    category="edge_node_count_mismatch",
                    message=f"Vehicle '{route.vehicle_id}' edge count ({len(route.full_path_edge_ids)}) != node count - 1 ({len(route.full_path_node_ids) - 1})",
                    vehicle_id=route.vehicle_id,
                )
                v_result.issues.append(issue)
                result.all_issues.append(issue)
                v_result.continuity_errors.append("edge count != node count - 1")
                result.path_continuity_violation_vehicle_ids.add(route.vehicle_id)

            for i, edge_id in enumerate(route.full_path_edge_ids):
                edge = edge_map.get(edge_id)
                if not edge:
                    issue = ValidationIssue(
                        category="unknown_edge",
                        message=f"Vehicle '{route.vehicle_id}' references unknown edge '{edge_id}'",
                        vehicle_id=route.vehicle_id,
                        edge_id=edge_id,
                    )
                    v_result.issues.append(issue)
                    result.all_issues.append(issue)
                    v_result.unknown_edge_ids.add(edge_id)
                    v_result.continuity_errors.append(f"unknown edge: {edge_id}")
                    result.path_continuity_violation_vehicle_ids.add(route.vehicle_id)
                    continue

                if edge.is_blocked:
                    issue = ValidationIssue(
                        category="blocked_edge",
                        message=f"Vehicle '{route.vehicle_id}' uses blocked edge '{edge_id}'",
                        vehicle_id=route.vehicle_id,
                        edge_id=edge_id,
                    )
                    v_result.issues.append(issue)
                    result.all_issues.append(issue)
                    v_result.blocked_edge_ids.add(edge_id)
                    result.blocked_edge_violation_ids.add(edge_id)

                if i < len(route.full_path_node_ids) - 1:
                    expected_from = route.full_path_node_ids[i]
                    expected_to = route.full_path_node_ids[i + 1]
                    if edge.from_ != expected_from or edge.to != expected_to:
                        issue = ValidationIssue(
                            category="continuity_error",
                            message=f"Vehicle '{route.vehicle_id}' edge '{edge_id}' connects {edge.from_}->{edge.to} but path expects {expected_from}->{expected_to}",
                            vehicle_id=route.vehicle_id,
                            edge_id=edge_id,
                        )
                        v_result.issues.append(issue)
                        result.all_issues.append(issue)
                        v_result.continuity_errors.append(f"edge {edge_id} direction mismatch: {edge.from_}->{edge.to} vs {expected_from}->{expected_to}")
                        result.path_continuity_violation_vehicle_ids.add(route.vehicle_id)

                v_result.computed_travel_minutes += edge.base_travel_minutes * edge.congestion_multiplier
                v_result.computed_distance_km += edge.distance_km
                v_result.computed_congestion_penalty += edge.base_travel_minutes * max(0.0, edge.congestion_multiplier - 1.0)

        if route.customer_ids and not route.full_path_node_ids:
            issue = ValidationIssue(
                category="unreachable",
                message=f"Vehicle '{route.vehicle_id}' has customers but no path nodes",
                vehicle_id=route.vehicle_id,
            )
            v_result.issues.append(issue)
            result.all_issues.append(issue)
            v_result.path_reachable = False
            result.unreachable_vehicle_ids.add(route.vehicle_id)

        for cust_id in route.customer_ids:
            customer = customer_map.get(cust_id)
            if customer and customer.node_id not in route.full_path_node_ids:
                issue = ValidationIssue(
                    category="customer_node_absent",
                    message=f"Vehicle '{route.vehicle_id}' customer '{cust_id}' node '{customer.node_id}' not in path",
                    vehicle_id=route.vehicle_id,
                    customer_id=cust_id,
                )
                v_result.issues.append(issue)
                result.all_issues.append(issue)
                v_result.continuity_errors.append(f"customer {cust_id} node {customer.node_id} not in path")
                result.path_continuity_violation_vehicle_ids.add(route.vehicle_id)

    for cust_id, vehicle_ids in all_customer_ids_in_routes.items():
        if len(vehicle_ids) > 1:
            result.duplicate_customer_ids.add(cust_id)
            for vid in vehicle_ids:
                issue = ValidationIssue(
                    category="duplicate_customer",
                    message=f"Customer '{cust_id}' assigned to multiple vehicles: {vehicle_ids}",
                    vehicle_id=vid,
                    customer_id=cust_id,
                )
                result.vehicle_results[vid].issues.append(issue)
                result.all_issues.append(issue)

    if route_plan.mode == RoutingMode.INITIAL:
        expected_customers = set(customer_map.keys())
    else:
        if routing_context and routing_context.eligible_customer_ids:
            expected_customers = set(routing_context.eligible_customer_ids)
        else:
            locked = set(routing_context.locked_customer_ids) if routing_context else set()
            expected_customers = set(customer_map.keys()) - locked

    assigned_customers = set()
    for v_result in result.vehicle_results.values():
        assigned_customers.update(v_result.customer_ids_in_route)

    result.unserved_customer_ids = expected_customers - assigned_customers

    if route_plan.mode == RoutingMode.REROUTE:
        for v_result in result.vehicle_results.values():
            if v_result.route.is_dynamic_reroute and not v_result.route.completed_customer_ids:
                v_result.warnings.append(
                    f"Vehicle '{v_result.vehicle_id}' in reroute mode has no completed customers"
                )
                result.warnings.append(
                    f"Vehicle '{v_result.vehicle_id}' in reroute mode has no completed customers"
                )

    return result