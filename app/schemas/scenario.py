from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.common import (
    AlgorithmName,
    BaseSchema,
    CustomerStatus,
    IncidentType,
    NodeKind,
    VehicleExecutionState,
)


class NodeSchema(BaseSchema):
    id: Annotated[str, Field(min_length=1)]
    x: Annotated[int, Field(ge=0)]
    y: Annotated[int, Field(ge=0)]
    kind: NodeKind


class EdgeSchema(BaseSchema):
    id: Annotated[str, Field(min_length=1)]
    from_: Annotated[str, Field(min_length=1, alias="from")]
    to: Annotated[str, Field(min_length=1)]
    distance_km: Annotated[float, Field(gt=0, alias="distanceKm")]
    base_travel_minutes: Annotated[float, Field(gt=0, alias="baseTravelMinutes")]
    congestion_multiplier: Annotated[float, Field(ge=1.0, alias="congestionMultiplier")]
    is_blocked: Annotated[bool, Field(alias="isBlocked")] = False


class CustomerSchema(BaseSchema):
    id: Annotated[str, Field(min_length=1)]
    node_id: Annotated[str, Field(min_length=1, alias="nodeId")]
    demand: Annotated[int, Field(ge=1, le=6)]
    status: CustomerStatus = CustomerStatus.pending


class VehicleSchema(BaseSchema):
    id: Annotated[str, Field(min_length=1)]
    label: Annotated[str, Field(min_length=1)]
    capacity: Annotated[int, Field(gt=0)]
    used_capacity: Annotated[int, Field(ge=0, alias="usedCapacity")] = 0
    current_node_id: Annotated[str, Field(min_length=1, alias="currentNodeId")]
    assigned_customer_ids: Annotated[
        list[str], Field(default_factory=list, alias="assignedCustomerIds")
    ]
    completed_customer_ids: Annotated[
        list[str], Field(default_factory=list, alias="completedCustomerIds")
    ]
    color: Annotated[str, Field(min_length=1)]
    status: VehicleExecutionState = VehicleExecutionState.awaiting_optimization

    @field_validator("used_capacity", mode="after")
    @classmethod
    def validate_used_capacity(cls, v: int, info: Any) -> int:
        if info.data.get("capacity") is not None and v > info.data["capacity"]:
            raise ValueError("used_capacity cannot exceed capacity")
        return v

    @model_validator(mode="after")
    def validate_completed_subset_of_assigned(self) -> "VehicleSchema":
        assigned = set(self.assigned_customer_ids)
        completed = set(self.completed_customer_ids)
        if not completed.issubset(assigned):
            raise ValueError("completed_customer_ids must be subset of assigned_customer_ids")
        return self


class IncidentSchema(BaseSchema):
    id: Annotated[str, Field(min_length=1)]
    affected_edge_ids: Annotated[list[str], Field(default_factory=list, alias="affectedEdgeIds")]
    type: IncidentType
    severity: Annotated[Literal[1, 2, 3], Field(ge=1, le=3)]
    active: bool = True


class ScenarioSchema(BaseSchema):
    id: Annotated[str, Field(min_length=1)]
    name: Annotated[str, Field(min_length=1)]
    seed: Annotated[int, Field(ge=0)]
    depot_node_id: Annotated[str, Field(min_length=1, alias="depotNodeId")]
    nodes: Annotated[list[NodeSchema], Field(min_length=1)]
    edges: Annotated[list[EdgeSchema], Field(min_length=1)]
    customers: Annotated[list[CustomerSchema], Field(default_factory=list)]
    vehicles: Annotated[list[VehicleSchema], Field(min_length=1)]
    incidents: Annotated[list[IncidentSchema], Field(default_factory=list)]

    @model_validator(mode="after")
    def validate_unique_node_ids(self) -> "ScenarioSchema":
        node_ids = [n.id for n in self.nodes]
        if len(node_ids) != len(set(node_ids)):
            raise ValueError("Duplicate node IDs found")
        return self

    @model_validator(mode="after")
    def validate_unique_edge_ids(self) -> "ScenarioSchema":
        edge_ids = [e.id for e in self.edges]
        if len(edge_ids) != len(set(edge_ids)):
            raise ValueError("Duplicate edge IDs found")
        return self

    @model_validator(mode="after")
    def validate_unique_customer_ids(self) -> "ScenarioSchema":
        customer_ids = [c.id for c in self.customers]
        if len(customer_ids) != len(set(customer_ids)):
            raise ValueError("Duplicate customer IDs found")
        return self

    @model_validator(mode="after")
    def validate_unique_vehicle_ids(self) -> "ScenarioSchema":
        vehicle_ids = [v.id for v in self.vehicles]
        if len(vehicle_ids) != len(set(vehicle_ids)):
            raise ValueError("Duplicate vehicle IDs found")
        return self

    @model_validator(mode="after")
    def validate_unique_incident_ids(self) -> "ScenarioSchema":
        incident_ids = [i.id for i in self.incidents]
        if len(incident_ids) != len(set(incident_ids)):
            raise ValueError("Duplicate incident IDs found")
        return self

    @model_validator(mode="after")
    def validate_depot_exists_and_is_depot(self) -> "ScenarioSchema":
        depot_node = next((n for n in self.nodes if n.id == self.depot_node_id), None)
        if depot_node is None:
            raise ValueError(f"Depot node '{self.depot_node_id}' not found in nodes")
        if depot_node.kind != NodeKind.depot:
            raise ValueError(f"Depot node '{self.depot_node_id}' must have kind 'depot'")
        return self

    @model_validator(mode="after")
    def validate_edge_endpoints_exist(self) -> "ScenarioSchema":
        node_ids = {n.id for n in self.nodes}
        for edge in self.edges:
            if edge.from_ not in node_ids:
                raise ValueError(f"Edge '{edge.id}' references non-existent from node '{edge.from_}'")
            if edge.to not in node_ids:
                raise ValueError(f"Edge '{edge.id}' references non-existent to node '{edge.to}'")
        return self

    @model_validator(mode="after")
    def validate_customers_not_on_depot(self) -> "ScenarioSchema":
        for customer in self.customers:
            if customer.node_id == self.depot_node_id:
                raise ValueError(f"Customer '{customer.id}' cannot be located at depot node '{self.depot_node_id}'")
        return self

    @model_validator(mode="after")
    def validate_customer_nodes_exist(self) -> "ScenarioSchema":
        node_ids = {n.id for n in self.nodes}
        for customer in self.customers:
            if customer.node_id not in node_ids:
                raise ValueError(f"Customer '{customer.id}' references non-existent node '{customer.node_id}'")
        return self

    @model_validator(mode="after")
    def validate_vehicle_capacity_and_current_node(self) -> "ScenarioSchema":
        node_ids = {n.id for n in self.nodes}
        for vehicle in self.vehicles:
            if vehicle.current_node_id not in node_ids:
                raise ValueError(f"Vehicle '{vehicle.id}' references non-existent current node '{vehicle.current_node_id}'")
            if vehicle.used_capacity > vehicle.capacity:
                raise ValueError(f"Vehicle '{vehicle.id}' used_capacity exceeds capacity")
        return self

    @model_validator(mode="after")
    def validate_vehicle_assigned_customers_exist(self) -> "ScenarioSchema":
        customer_ids = {c.id for c in self.customers}
        for vehicle in self.vehicles:
            for cust_id in vehicle.assigned_customer_ids:
                if cust_id not in customer_ids:
                    raise ValueError(f"Vehicle '{vehicle.id}' assigned to non-existent customer '{cust_id}'")
            for cust_id in vehicle.completed_customer_ids:
                if cust_id not in customer_ids:
                    raise ValueError(f"Vehicle '{vehicle.id}' completed non-existent customer '{cust_id}'")
        return self

    @model_validator(mode="after")
    def validate_incident_edges_exist(self) -> "ScenarioSchema":
        edge_ids = {e.id for e in self.edges}
        for incident in self.incidents:
            for edge_id in incident.affected_edge_ids:
                if edge_id not in edge_ids:
                    raise ValueError(f"Incident '{incident.id}' references non-existent edge '{edge_id}'")
        return self

    @model_validator(mode="after")
    def validate_total_demand_not_exceed_fleet_capacity(self) -> "ScenarioSchema":
        total_demand = sum(c.demand for c in self.customers)
        total_capacity = sum(v.capacity for v in self.vehicles)
        if total_demand > total_capacity:
            raise ValueError(f"Total customer demand ({total_demand}) exceeds total fleet capacity ({total_capacity})")
        return self