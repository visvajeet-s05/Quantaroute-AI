from typing import Annotated, Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.common import AlgorithmName, BaseSchema


class PathRequest(BaseSchema):
    source_node_id: Annotated[str, Field(min_length=1, alias="sourceNodeId")]
    destination_node_id: Annotated[str, Field(min_length=1, alias="destinationNodeId")]
    algorithm: AlgorithmName = AlgorithmName.dijkstra


class PathResponse(BaseSchema):
    source_node_id: Annotated[str, Field(min_length=1, alias="sourceNodeId")]
    destination_node_id: Annotated[str, Field(min_length=1, alias="destinationNodeId")]
    node_ids: Annotated[list[str], Field(default_factory=list, alias="nodeIds")]
    edge_ids: Annotated[list[str], Field(default_factory=list, alias="edgeIds")]
    travel_minutes: Annotated[float, Field(ge=0, alias="travelMinutes")] = 0.0
    distance_km: Annotated[float, Field(ge=0, alias="distanceKm")] = 0.0
    congestion_penalty: Annotated[float, Field(ge=0, alias="congestionPenalty")] = 0.0
    reachable: bool
    visited_node_count: Annotated[int, Field(ge=0, alias="visitedNodeCount")] = 0

    @model_validator(mode="after")
    def validate_path_structure(self) -> "PathResponse":
        if not self.reachable:
            if self.node_ids:
                raise ValueError("Unreachable path must have empty node_ids")
            if self.edge_ids:
                raise ValueError("Unreachable path must have empty edge_ids")
            if self.travel_minutes != 0:
                raise ValueError("Unreachable path must have travel_minutes = 0")
            if self.distance_km != 0:
                raise ValueError("Unreachable path must have distance_km = 0")
            if self.congestion_penalty != 0:
                raise ValueError("Unreachable path must have congestion_penalty = 0")
            if self.visited_node_count < 0:
                raise ValueError("visited_node_count must be >= 0")
            return self

        if self.source_node_id == self.destination_node_id:
            if len(self.node_ids) != 1:
                raise ValueError("Self-loop path must have exactly one node")
            if self.node_ids[0] != self.source_node_id:
                raise ValueError("Self-loop path node must equal source node")
            if self.edge_ids:
                raise ValueError("Self-loop path must have empty edge_ids")
            if self.travel_minutes != 0:
                raise ValueError("Self-loop path must have travel_minutes = 0")
            if self.distance_km != 0:
                raise ValueError("Self-loop path must have distance_km = 0")
            if self.congestion_penalty != 0:
                raise ValueError("Self-loop path must have congestion_penalty = 0")
            return self

        if len(self.node_ids) < 2:
            raise ValueError("Reachable path must have at least 2 nodes (source and destination)")
        if self.node_ids[0] != self.source_node_id:
            raise ValueError("Path must start at source node")
        if self.node_ids[-1] != self.destination_node_id:
            raise ValueError("Path must end at destination node")
        if len(self.edge_ids) != len(self.node_ids) - 1:
            raise ValueError("Number of edges must equal number of nodes minus 1")
        if self.travel_minutes < 0:
            raise ValueError("travel_minutes must be >= 0")
        if self.distance_km < 0:
            raise ValueError("distance_km must be >= 0")
        if self.congestion_penalty < 0:
            raise ValueError("congestion_penalty must be >= 0")
        if self.visited_node_count < len(self.node_ids):
            raise ValueError("visited_node_count must be >= number of nodes in path")
        return self


class PathValidationIssueSchema(BaseSchema):
    name: Annotated[str, Field(min_length=1)]
    passed: bool
    detail: str


class PathValidationResponse(BaseSchema):
    is_valid: Annotated[bool, Field(alias="isValid")]
    checks: list[PathValidationIssueSchema]
    errors: list[str]
    path_response: Annotated[PathResponse | None, Field(alias="pathResponse")] = None

    @model_validator(mode="after")
    def validate_consistency(self) -> "PathValidationResponse":
        if self.path_response is not None:
            path_reachable = self.path_response.reachable
            path_valid = all(c.passed for c in self.checks) and len(self.errors) == 0
            if path_reachable and not path_valid:
                pass
            elif not path_reachable and path_valid:
                pass
        return self