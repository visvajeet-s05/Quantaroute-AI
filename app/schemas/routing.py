from __future__ import annotations

from enum import Enum
from typing import Annotated, Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.common import AlgorithmName, BaseSchema, VehicleExecutionState


class RoutingMode(str, Enum):
    INITIAL = "initial"
    REROUTE = "reroute"


class VehicleRouteSchema(BaseSchema):
    vehicle_id: Annotated[str, Field(min_length=1, alias="vehicleId")]
    customer_ids: Annotated[list[str], Field(default_factory=list, alias="customerIds")]
    full_path_node_ids: Annotated[list[str], Field(default_factory=list, alias="fullPathNodeIds")]
    full_path_edge_ids: Annotated[list[str], Field(default_factory=list, alias="fullPathEdgeIds")]
    start_node_id: Annotated[str, Field(min_length=1, alias="startNodeId")]
    end_node_id: Annotated[str, Field(min_length=1, alias="endNodeId")]
    completed_customer_ids: Annotated[list[str], Field(default_factory=list, alias="completedCustomerIds")]
    pending_customer_ids: Annotated[list[str], Field(default_factory=list, alias="pendingCustomerIds")]
    is_dynamic_reroute: Annotated[bool, Field(default=False, alias="isDynamicReroute")]

    declared_used_capacity: Annotated[int | None, Field(default=None, alias="declaredUsedCapacity")] = None
    declared_travel_minutes: Annotated[float | None, Field(default=None, alias="declaredTravelMinutes")] = None
    declared_distance_km: Annotated[float | None, Field(default=None, alias="declaredDistanceKm")] = None

    @field_validator("customer_ids", mode="after")
    @classmethod
    def validate_customer_ids_unique(cls, v: list[str]) -> list[str]:
        if len(v) != len(set(v)):
            raise ValueError("customer_ids must be unique")
        return v

    @field_validator("completed_customer_ids", mode="after")
    @classmethod
    def validate_completed_customer_ids_unique(cls, v: list[str]) -> list[str]:
        if len(v) != len(set(v)):
            raise ValueError("completed_customer_ids must be unique")
        return v

    @field_validator("pending_customer_ids", mode="after")
    @classmethod
    def validate_pending_customer_ids_unique(cls, v: list[str]) -> list[str]:
        if len(v) != len(set(v)):
            raise ValueError("pending_customer_ids must be unique")
        return v

    @model_validator(mode="after")
    def validate_no_overlap_completed_pending(self) -> "VehicleRouteSchema":
        completed = set(self.completed_customer_ids)
        pending = set(self.pending_customer_ids)
        if completed & pending:
            raise ValueError("customer cannot be both completed and pending")
        return self

    @model_validator(mode="after")
    def validate_completed_subset_of_customer_ids(self) -> "VehicleRouteSchema":
        customer_ids = set(self.customer_ids)
        completed = set(self.completed_customer_ids)
        if not completed.issubset(customer_ids):
            raise ValueError("completed_customer_ids must be subset of customer_ids")
        return self

    @model_validator(mode="after")
    def validate_pending_subset_of_customer_ids(self) -> "VehicleRouteSchema":
        customer_ids = set(self.customer_ids)
        pending = set(self.pending_customer_ids)
        if not pending.issubset(customer_ids):
            raise ValueError("pending_customer_ids must be subset of customer_ids")
        return self


class RoutingContextSchema(BaseSchema):
    mode: RoutingMode = RoutingMode.INITIAL
    depot_node_id: Annotated[str, Field(min_length=1, alias="depotNodeId")]
    start_node_by_vehicle_id: Annotated[dict[str, str], Field(default_factory=dict, alias="startNodeByVehicleId")]
    remaining_capacity_by_vehicle_id: Annotated[dict[str, int], Field(default_factory=dict, alias="remainingCapacityByVehicleId")]
    locked_customer_ids: Annotated[list[str], Field(default_factory=list, alias="lockedCustomerIds")]
    eligible_customer_ids: Annotated[list[str], Field(default_factory=list, alias="eligibleCustomerIds")]

    @field_validator("remaining_capacity_by_vehicle_id", mode="after")
    @classmethod
    def validate_remaining_capacities_non_negative(cls, v: dict[str, int]) -> dict[str, int]:
        for vehicle_id, capacity in v.items():
            if capacity < 0:
                raise ValueError(f"remaining capacity for vehicle {vehicle_id} must be >= 0")
        return v

    @model_validator(mode="after")
    def validate_no_duplicate_locked_or_eligible(self) -> "RoutingContextSchema":
        if len(self.locked_customer_ids) != len(set(self.locked_customer_ids)):
            raise ValueError("locked_customer_ids must be unique")
        if len(self.eligible_customer_ids) != len(set(self.eligible_customer_ids)):
            raise ValueError("eligible_customer_ids must be unique")
        return self

    @model_validator(mode="after")
    def validate_locked_and_eligible_no_overlap(self) -> "RoutingContextSchema":
        locked = set(self.locked_customer_ids)
        eligible = set(self.eligible_customer_ids)
        if locked & eligible:
            raise ValueError("locked and eligible customers cannot overlap")
        return self


class RoutePlanSchema(BaseSchema):
    algorithm: AlgorithmName
    scenario_id: Annotated[str, Field(min_length=1, alias="scenarioId")]
    seed: Annotated[int, Field(ge=0)]
    depot_node_id: Annotated[str, Field(min_length=1, alias="depotNodeId")]
    vehicle_routes: Annotated[list[VehicleRouteSchema], Field(default_factory=list, alias="vehicleRoutes")]
    mode: RoutingMode = RoutingMode.INITIAL
    routing_context: Annotated[RoutingContextSchema | None, Field(default=None, alias="routingContext")] = None

    @field_validator("vehicle_routes", mode="after")
    @classmethod
    def validate_vehicle_route_ids_unique(cls, v: list[VehicleRouteSchema]) -> list[VehicleRouteSchema]:
        vehicle_ids = [r.vehicle_id for r in v]
        if len(vehicle_ids) != len(set(vehicle_ids)):
            raise ValueError("vehicle route IDs must be unique")
        return v


class RoutePlanValidationResultSchema(BaseSchema):
    valid: bool
    capacity_compliant: Annotated[bool, Field(alias="capacityCompliant")]
    customer_coverage_complete: Annotated[bool, Field(alias="customerCoverageComplete")]
    no_duplicate_customer_service: Annotated[bool, Field(alias="noDuplicateCustomerService")]
    all_routes_start_correctly: Annotated[bool, Field(alias="allRoutesStartCorrectly")]
    all_routes_end_at_depot: Annotated[bool, Field(alias="allRoutesEndAtDepot")]
    no_blocked_edges_used: Annotated[bool, Field(alias="noBlockedEdgesUsed")]
    all_route_paths_reachable: Annotated[bool, Field(alias="allRoutePathsReachable")]
    errors: list[str]
    warnings: list[str]
    violation_counts: Annotated[dict[str, int], Field(alias="violationCounts")]


class VehicleRouteEvaluationSchema(BaseSchema):
    vehicle_id: Annotated[str, Field(alias="vehicleId")]
    customer_ids: Annotated[list[str], Field(alias="customerIds")]
    computed_travel_minutes: Annotated[float, Field(ge=0, alias="computedTravelMinutes")]
    computed_distance_km: Annotated[float, Field(ge=0, alias="computedDistanceKm")]
    computed_congestion_penalty: Annotated[float, Field(ge=0, alias="computedCongestionPenalty")]
    computed_used_capacity: Annotated[int, Field(ge=0, alias="computedUsedCapacity")]
    computed_remaining_capacity: Annotated[int, Field(alias="computedRemainingCapacity")]
    starts_correctly: Annotated[bool, Field(alias="startsCorrectly")]
    ends_at_depot: Annotated[bool, Field(alias="endsAtDepot")]
    path_reachable: Annotated[bool, Field(alias="pathReachable")]
    blocked_edge_ids: Annotated[list[str], Field(alias="blockedEdgeIds")]
    unknown_edge_ids: Annotated[list[str], Field(alias="unknownEdgeIds")]
    continuity_errors: Annotated[list[str], Field(alias="continuityErrors")]
    warnings: list[str]


class RoutePlanEvaluationResponse(BaseSchema):
    route_plan: Annotated[RoutePlanSchema, Field(alias="routePlan")]
    validation: RoutePlanValidationResultSchema
    vehicle_evaluations: Annotated[list[VehicleRouteEvaluationSchema], Field(alias="vehicleEvaluations")]
    total_travel_minutes: Annotated[float, Field(ge=0, alias="totalTravelMinutes")]
    total_distance_km: Annotated[float, Field(ge=0, alias="totalDistanceKm")]
    total_congestion_penalty: Annotated[float, Field(ge=0, alias="totalCongestionPenalty")]
    routing_score: Annotated[float, Field(ge=0, alias="routingScore")]
    customers_assigned: Annotated[int, Field(ge=0, alias="customersAssigned")]
    customers_unserved: Annotated[int, Field(ge=0, alias="customersUnserved")]
    unserved_customer_ids: Annotated[list[str], Field(alias="unservedCustomerIds")]
    duplicate_customer_ids: Annotated[list[str], Field(alias="duplicateCustomerIds")]
    capacity_violation_vehicle_ids: Annotated[list[str], Field(alias="capacityViolationVehicleIds")]
    blocked_edge_violation_ids: Annotated[list[str], Field(alias="blockedEdgeViolationIds")]
    unreachable_vehicle_ids: Annotated[list[str], Field(alias="unreachableVehicleIds")]
    path_continuity_violation_vehicle_ids: Annotated[list[str], Field(alias="pathContinuityViolationVehicleIds")]
    penalty_total: Annotated[float, Field(ge=0, alias="penaltyTotal")]
    warnings: list[str]


class EvaluateRequest(BaseSchema):
    scenario: Annotated[Any, Field(description="ScenarioSchema - imported dynamically to avoid circular import")]
    route_plan: Annotated[RoutePlanSchema, Field(alias="routePlan")]