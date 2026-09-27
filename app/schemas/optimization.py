from __future__ import annotations

from enum import Enum
from typing import Annotated, Any

from pydantic import Field

from app.schemas.common import AlgorithmName, BaseSchema
from app.schemas.routing import (
    RoutePlanEvaluationResponse,
    RoutePlanSchema,
    RoutingMode,
)
from app.schemas.scenario import ScenarioSchema


class OptimizationPreset(str, Enum):
    STANDARD = "standard"
    FAST = "fast"
    BALANCED = "balanced"
    HIGH_QUALITY = "highQuality"


class OptimizationRequest(BaseSchema):
    scenario: ScenarioSchema
    algorithm: AlgorithmName
    preset: OptimizationPreset = OptimizationPreset.STANDARD
    optimizer_seed: Annotated[int | None, Field(default=None, alias="optimizerSeed")] = None
    mode: RoutingMode = RoutingMode.INITIAL


class OptimizationMetadataSchema(BaseSchema):
    algorithm: AlgorithmName
    preset: OptimizationPreset
    optimizer_seed: Annotated[int | None, Field(default=None, alias="optimizerSeed")] = None
    mode: RoutingMode
    runtime_ms: Annotated[float, Field(ge=0, alias="runtimeMs")]
    deterministic: bool = True
    notes: list[str] = Field(default_factory=list)


class OptimizationResponse(BaseSchema):
    metadata: OptimizationMetadataSchema
    route_plan: Annotated[RoutePlanSchema, Field(alias="routePlan")]
    evaluation: RoutePlanEvaluationResponse


class ErrorDetailSchema(BaseSchema):
    code: str
    message: str
    details: dict[str, Any] = Field(default_factory=dict)


class OptimizationErrorResponse(BaseSchema):
    error: ErrorDetailSchema
