from __future__ import annotations

from typing import Any

from app.schemas.routing import (
    EvaluateRequest,
    RoutePlanEvaluationResponse,
    RoutePlanSchema,
    RoutePlanValidationResultSchema,
    VehicleRouteEvaluationSchema,
)
from app.schemas.scenario import ScenarioSchema
from app.services.route_plan_validator import (
    ValidationIssue,
    ValidationResult,
    VehicleValidationResult,
    validate_route_plan,
)


PENALTY_UNSERVED_CUSTOMER = 10000.0
PENALTY_DUPLICATE_CUSTOMER = 10000.0
PENALTY_CAPACITY_VIOLATION = 10000.0
PENALTY_BLOCKED_EDGE = 50000.0
PENALTY_UNREACHABLE_VEHICLE = 50000.0
PENALTY_INVALID_START_END = 10000.0
PENALTY_PATH_CONTINUITY = 50000.0


def evaluate_route_plan(request: EvaluateRequest) -> RoutePlanEvaluationResponse:
    scenario = request.scenario
    if isinstance(scenario, dict):
        from app.schemas.scenario import ScenarioSchema
        scenario = ScenarioSchema.model_validate(scenario)
    route_plan = request.route_plan

    validation_result = validate_route_plan(scenario, route_plan)

    vehicle_evaluations: list[VehicleRouteEvaluationSchema] = []
    total_travel_minutes = 0.0
    total_distance_km = 0.0
    total_congestion_penalty = 0.0

    for v_result in validation_result.vehicle_results.values():
        v_eval = VehicleRouteEvaluationSchema(
            vehicleId=v_result.vehicle_id,
            customerIds=list(v_result.customer_ids_in_route),
            computedTravelMinutes=v_result.computed_travel_minutes,
            computedDistanceKm=v_result.computed_distance_km,
            computedCongestionPenalty=v_result.computed_congestion_penalty,
            computedUsedCapacity=v_result.computed_used_capacity,
            computedRemainingCapacity=v_result.computed_remaining_capacity,
            startsCorrectly=v_result.starts_correctly,
            endsAtDepot=v_result.ends_at_depot,
            pathReachable=v_result.path_reachable,
            blockedEdgeIds=list(v_result.blocked_edge_ids),
            unknownEdgeIds=list(v_result.unknown_edge_ids),
            continuityErrors=list(v_result.continuity_errors),
            warnings=list(v_result.warnings),
        )
        vehicle_evaluations.append(v_eval)

        total_travel_minutes += v_result.computed_travel_minutes
        total_distance_km += v_result.computed_distance_km
        total_congestion_penalty += v_result.computed_congestion_penalty

    penalty_unserved = len(validation_result.unserved_customer_ids) * PENALTY_UNSERVED_CUSTOMER
    penalty_duplicate = len(validation_result.duplicate_customer_ids) * PENALTY_DUPLICATE_CUSTOMER
    penalty_capacity = len(validation_result.capacity_violation_vehicle_ids) * PENALTY_CAPACITY_VIOLATION
    penalty_blocked = len(validation_result.blocked_edge_violation_ids) * PENALTY_BLOCKED_EDGE
    penalty_unreachable = len(validation_result.unreachable_vehicle_ids) * PENALTY_UNREACHABLE_VEHICLE
    penalty_start_end = len(validation_result.invalid_start_or_end_vehicle_ids) * PENALTY_INVALID_START_END
    penalty_continuity = len(validation_result.path_continuity_violation_vehicle_ids) * PENALTY_PATH_CONTINUITY

    penalty_total = (
        penalty_unserved
        + penalty_duplicate
        + penalty_capacity
        + penalty_blocked
        + penalty_unreachable
        + penalty_start_end
        + penalty_continuity
    )

    routing_score = (
        0.55 * total_travel_minutes
        + 0.25 * total_distance_km
        + 0.20 * total_congestion_penalty
        + penalty_total
    )

    validation = RoutePlanValidationResultSchema(
        valid=(
            len(validation_result.unserved_customer_ids) == 0
            and len(validation_result.duplicate_customer_ids) == 0
            and len(validation_result.capacity_violation_vehicle_ids) == 0
            and len(validation_result.blocked_edge_violation_ids) == 0
            and len(validation_result.unreachable_vehicle_ids) == 0
            and len(validation_result.invalid_start_or_end_vehicle_ids) == 0
            and len(validation_result.path_continuity_violation_vehicle_ids) == 0
        ),
        capacityCompliant=len(validation_result.capacity_violation_vehicle_ids) == 0,
        customerCoverageComplete=len(validation_result.unserved_customer_ids) == 0,
        noDuplicateCustomerService=len(validation_result.duplicate_customer_ids) == 0,
        allRoutesStartCorrectly=len(validation_result.invalid_start_or_end_vehicle_ids) == 0,
        allRoutesEndAtDepot=len(validation_result.invalid_start_or_end_vehicle_ids) == 0,
        noBlockedEdgesUsed=len(validation_result.blocked_edge_violation_ids) == 0,
        allRoutePathsReachable=len(validation_result.unreachable_vehicle_ids) == 0,
        errors=[i.message for i in validation_result.all_issues],
        warnings=list(validation_result.warnings),
        violationCounts={
            "unservedCustomers": len(validation_result.unserved_customer_ids),
            "duplicateCustomers": len(validation_result.duplicate_customer_ids),
            "capacityViolations": len(validation_result.capacity_violation_vehicle_ids),
            "blockedEdges": len(validation_result.blocked_edge_violation_ids),
            "unreachableVehicles": len(validation_result.unreachable_vehicle_ids),
            "invalidStartOrEnd": len(validation_result.invalid_start_or_end_vehicle_ids),
            "pathContinuity": len(validation_result.path_continuity_violation_vehicle_ids),
        },
    )

    return RoutePlanEvaluationResponse(
        routePlan=route_plan,
        validation=validation,
        vehicleEvaluations=vehicle_evaluations,
        totalTravelMinutes=total_travel_minutes,
        totalDistanceKm=total_distance_km,
        totalCongestionPenalty=total_congestion_penalty,
        routingScore=routing_score,
        customersAssigned=sum(len(v.customer_ids) for v in vehicle_evaluations),
        customersUnserved=len(validation_result.unserved_customer_ids),
        unservedCustomerIds=list(validation_result.unserved_customer_ids),
        duplicateCustomerIds=list(validation_result.duplicate_customer_ids),
        capacityViolationVehicleIds=list(validation_result.capacity_violation_vehicle_ids),
        blockedEdgeViolationIds=list(validation_result.blocked_edge_violation_ids),
        unreachableVehicleIds=list(validation_result.unreachable_vehicle_ids),
        pathContinuityViolationVehicleIds=list(validation_result.path_continuity_violation_vehicle_ids),
        penaltyTotal=penalty_total,
        warnings=list(validation_result.warnings),
    )