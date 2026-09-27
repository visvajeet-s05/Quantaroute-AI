from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.common import AlgorithmName, BaseSchema


class FrontendParityMetadataSchema(BaseSchema):
    source: Annotated[str, Field(min_length=1)]
    export_kind: Annotated[str, Field(min_length=1, alias="exportKind")]
    exported_at: Annotated[datetime, Field(alias="exportedAt")]
    scenario_seed: Annotated[int, Field(ge=0, alias="scenarioSeed")]
    algorithm: AlgorithmName
    preset: str | None = None
    optimizer_seed: Annotated[int | None, Field(default=None, ge=0, alias="optimizerSeed")] = None
    app_version: Annotated[str | None, Field(default=None, alias="appVersion")] = None
    source_verified: Annotated[bool | None, Field(default=None, alias="sourceVerified")] = None


class FrontendEvaluationSchema(BaseSchema):
    total_travel_minutes: Annotated[float, Field(ge=0, alias="totalTravelMinutes")]
    total_distance_km: Annotated[float, Field(ge=0, alias="totalDistanceKm")]
    total_congestion_penalty: Annotated[float, Field(ge=0, alias="totalCongestionPenalty")]
    routing_score: Annotated[float, Field(ge=0, alias="routingScore")]
    penalty_total: Annotated[float, Field(ge=0, alias="penaltyTotal")]
    customers_assigned: Annotated[int, Field(ge=0, alias="customersAssigned")]
    customers_unserved: Annotated[int, Field(ge=0, alias="customersUnserved")]
    unserved_customer_ids: Annotated[list[str], Field(alias="unservedCustomerIds")]
    duplicate_customer_ids: Annotated[list[str], Field(alias="duplicateCustomerIds")]
    capacity_violation_vehicle_ids: Annotated[list[str], Field(alias="capacityViolationVehicleIds")]
    blocked_edge_violation_ids: Annotated[list[str], Field(alias="blockedEdgeViolationIds")]
    unreachable_vehicle_ids: Annotated[list[str], Field(alias="unreachableVehicleIds")]
    path_continuity_violation_vehicle_ids: Annotated[list[str], Field(alias="pathContinuityViolationVehicleIds")]
    feasible: bool
    warnings: list[str]


class FrontendParityExportSchema(BaseSchema):
    metadata: FrontendParityMetadataSchema
    scenario: Annotated[Any, Field(description="ScenarioSchema - adapted by adapter")]
    route_plan: Annotated[Any, Field(description="RoutePlanSchema - adapted by adapter", alias="routePlan")]
    frontend_evaluation: Annotated[FrontendEvaluationSchema, Field(alias="frontendEvaluation")]


class ParityMismatchSchema(BaseSchema):
    field: Annotated[str, Field(min_length=1)]
    frontend_value: Annotated[Any, Field(alias="frontendValue")]
    backend_value: Annotated[Any, Field(alias="backendValue")]
    difference: float | None
    tolerance: float | None
    severity: Literal["error", "warning"]
    message: str


class ParityComparisonResponse(BaseSchema):
    source_verified: Annotated[bool, Field(alias="sourceVerified")]
    passed: bool
    tolerance: float
    export_metadata: Annotated[FrontendParityMetadataSchema, Field(alias="exportMetadata")]
    backend_evaluation: Annotated[Any | None, Field(default=None, alias="backendEvaluation")]
    mismatches: list[ParityMismatchSchema]
    compared_fields: Annotated[list[str], Field(alias="comparedFields")]
    summary: str