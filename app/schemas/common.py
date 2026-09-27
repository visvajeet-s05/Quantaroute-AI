from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class NodeKind(str, Enum):
    intersection = "intersection"
    depot = "depot"
    customer = "customer"


class CustomerStatus(str, Enum):
    pending = "pending"
    assigned = "assigned"
    served = "served"


class VehicleExecutionState(str, Enum):
    awaiting_optimization = "awaiting_optimization"
    planned = "planned"
    en_route = "en_route"
    rerouting = "rerouting"
    revised = "revised"
    inactive = "inactive"
    infeasible = "infeasible"


class AlgorithmName(str, Enum):
    dijkstra = "dijkstra"
    greedy = "greedy"
    pso = "pso"
    qpso = "qpso"


class IncidentType(str, Enum):
    road_closure = "road_closure"
    congestion_surge = "congestion_surge"


class BaseSchema(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        populate_by_name=True,
        use_enum_values=True,
        str_strip_whitespace=True,
        validate_assignment=True,
    )

    @classmethod
    def now_utc(cls) -> datetime:
        return datetime.now(timezone.utc)