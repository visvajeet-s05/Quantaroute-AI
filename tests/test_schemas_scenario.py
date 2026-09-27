import pytest

from app.schemas.common import NodeKind, VehicleExecutionState
from app.schemas.scenario import (
    CustomerSchema,
    EdgeSchema,
    IncidentSchema,
    NodeSchema,
    ScenarioSchema,
    VehicleSchema,
)


def make_minimal_scenario(**overrides: Any) -> dict:
    base = {
        "id": "test_scenario",
        "name": "Test Scenario",
        "seed": 12345,
        "depotNodeId": "n_0_0",
        "nodes": [
            {"id": "n_0_0", "x": 0, "y": 0, "kind": "depot"},
            {"id": "n_0_1", "x": 0, "y": 1, "kind": "intersection"},
            {"id": "n_1_0", "x": 1, "y": 0, "kind": "customer"},
        ],
        "edges": [
            {
                "id": "e_0_0_to_0_1",
                "from": "n_0_0",
                "to": "n_0_1",
                "distanceKm": 1.0,
                "baseTravelMinutes": 2.0,
                "congestionMultiplier": 1.0,
                "isBlocked": False,
            },
            {
                "id": "e_0_1_to_0_0",
                "from": "n_0_1",
                "to": "n_0_0",
                "distanceKm": 1.0,
                "baseTravelMinutes": 2.0,
                "congestionMultiplier": 1.0,
                "isBlocked": False,
            },
            {
                "id": "e_0_0_to_1_0",
                "from": "n_0_0",
                "to": "n_1_0",
                "distanceKm": 1.0,
                "baseTravelMinutes": 2.0,
                "congestionMultiplier": 1.0,
                "isBlocked": False,
            },
            {
                "id": "e_1_0_to_0_0",
                "from": "n_1_0",
                "to": "n_0_0",
                "distanceKm": 1.0,
                "baseTravelMinutes": 2.0,
                "congestionMultiplier": 1.0,
                "isBlocked": False,
            },
        ],
        "customers": [
            {"id": "C01", "nodeId": "n_1_0", "demand": 5, "status": "pending"},
        ],
        "vehicles": [
            {
                "id": "V1",
                "label": "Vehicle 1",
                "capacity": 30,
                "usedCapacity": 0,
                "currentNodeId": "n_0_0",
                "assignedCustomerIds": [],
                "completedCustomerIds": [],
                "color": "#2563eb",
                "status": "awaiting_optimization",
            },
        ],
        "incidents": [],
    }
    base.update(overrides)
    return base


class TestScenarioValidation:
    def test_valid_scenario_passes(self) -> None:
        scenario = ScenarioSchema.model_validate(make_minimal_scenario())
        assert scenario.id == "test_scenario"
        assert len(scenario.nodes) == 3
        assert len(scenario.edges) == 4
        assert len(scenario.customers) == 1
        assert len(scenario.vehicles) == 1

    def test_duplicate_node_ids_raises(self) -> None:
        data = make_minimal_scenario()
        data["nodes"].append({"id": "n_0_0", "x": 2, "y": 2, "kind": "intersection"})
        with pytest.raises(ValueError, match="Duplicate node IDs"):
            ScenarioSchema.model_validate(data)

    def test_duplicate_edge_ids_raises(self) -> None:
        data = make_minimal_scenario()
        data["edges"].append({
            "id": "e_0_0_to_0_1",
            "from": "n_0_0",
            "to": "n_1_0",
            "distanceKm": 1.0,
            "baseTravelMinutes": 2.0,
            "congestionMultiplier": 1.0,
            "isBlocked": False,
        })
        with pytest.raises(ValueError, match="Duplicate edge IDs"):
            ScenarioSchema.model_validate(data)

    def test_duplicate_customer_ids_raises(self) -> None:
        data = make_minimal_scenario()
        data["customers"].append({"id": "C01", "nodeId": "n_0_1", "demand": 3, "status": "pending"})
        with pytest.raises(ValueError, match="Duplicate customer IDs"):
            ScenarioSchema.model_validate(data)

    def test_duplicate_vehicle_ids_raises(self) -> None:
        data = make_minimal_scenario()
        data["vehicles"].append({
            "id": "V1",
            "label": "Vehicle 2",
            "capacity": 30,
            "usedCapacity": 0,
            "currentNodeId": "n_0_0",
            "assignedCustomerIds": [],
            "completedCustomerIds": [],
            "color": "#9333ea",
            "status": "awaiting_optimization",
        })
        with pytest.raises(ValueError, match="Duplicate vehicle IDs"):
            ScenarioSchema.model_validate(data)

    def test_duplicate_incident_ids_raises(self) -> None:
        data = make_minimal_scenario()
        data["incidents"] = [
            {"id": "I1", "affectedEdgeIds": ["e_0_0_to_0_1"], "type": "road_closure", "severity": 1, "active": True},
            {"id": "I1", "affectedEdgeIds": ["e_0_0_to_1_0"], "type": "congestion_surge", "severity": 2, "active": True},
        ]
        with pytest.raises(ValueError, match="Duplicate incident IDs"):
            ScenarioSchema.model_validate(data)

    def test_depot_must_exist(self) -> None:
        data = make_minimal_scenario(depotNodeId="n_9_9")
        with pytest.raises(ValueError, match="Depot node.*not found"):
            ScenarioSchema.model_validate(data)

    def test_depot_must_be_depot_kind(self) -> None:
        data = make_minimal_scenario()
        data["nodes"][0]["kind"] = "intersection"
        with pytest.raises(ValueError, match="must have kind 'depot'"):
            ScenarioSchema.model_validate(data)

    def test_edge_endpoints_must_exist(self) -> None:
        data = make_minimal_scenario()
        data["edges"][0]["from"] = "n_9_9"
        with pytest.raises(ValueError, match="references non-existent from node"):
            ScenarioSchema.model_validate(data)

    def test_customer_cannot_be_on_depot(self) -> None:
        data = make_minimal_scenario()
        data["customers"][0]["nodeId"] = "n_0_0"
        with pytest.raises(ValueError, match="cannot be located at depot"):
            ScenarioSchema.model_validate(data)

    def test_customer_node_must_exist(self) -> None:
        data = make_minimal_scenario()
        data["customers"][0]["nodeId"] = "n_9_9"
        with pytest.raises(ValueError, match="references non-existent node"):
            ScenarioSchema.model_validate(data)

    def test_vehicle_capacity_constraint(self) -> None:
        data = make_minimal_scenario()
        data["vehicles"][0]["usedCapacity"] = 35
        with pytest.raises(ValueError, match="used_capacity cannot exceed capacity"):
            ScenarioSchema.model_validate(data)

    def test_vehicle_current_node_must_exist(self) -> None:
        data = make_minimal_scenario()
        data["vehicles"][0]["currentNodeId"] = "n_9_9"
        with pytest.raises(ValueError, match="references non-existent current node"):
            ScenarioSchema.model_validate(data)

    def test_completed_customers_must_be_subset_of_assigned(self) -> None:
        data = make_minimal_scenario()
        data["vehicles"][0]["assignedCustomerIds"] = ["C01"]
        data["vehicles"][0]["completedCustomerIds"] = ["C02"]
        with pytest.raises(ValueError, match="completed_customer_ids must be subset"):
            ScenarioSchema.model_validate(data)

    def test_incident_edges_must_exist(self) -> None:
        data = make_minimal_scenario()
        data["incidents"] = [
            {"id": "I1", "affectedEdgeIds": ["e_9_9_to_9_9"], "type": "road_closure", "severity": 1, "active": True},
        ]
        with pytest.raises(ValueError, match="references non-existent edge"):
            ScenarioSchema.model_validate(data)

    def test_total_demand_not_exceed_fleet_capacity(self) -> None:
        data = make_minimal_scenario()
        # Use 6 customers with max demand 6 each = 36 > 30 fleet capacity
        # Use node IDs that don't conflict with existing nodes (n_0_0, n_0_1, n_1_0)
        data["customers"] = [
            {"id": f"C{i:02d}", "nodeId": f"n_{i+10}_0", "demand": 6, "status": "pending"}
            for i in range(1, 7)
        ]
        # Add nodes for each customer
        for i in range(1, 7):
            data["nodes"].append({"id": f"n_{i+10}_0", "x": i + 10, "y": 0, "kind": "customer"})
        with pytest.raises(ValueError, match="Total customer demand.*exceeds total fleet capacity"):
            ScenarioSchema.model_validate(data)

    def test_customer_demand_bounds(self) -> None:
        data = make_minimal_scenario()
        data["customers"][0]["demand"] = 0
        with pytest.raises(ValueError):
            ScenarioSchema.model_validate(data)
        data["customers"][0]["demand"] = 7
        with pytest.raises(ValueError):
            ScenarioSchema.model_validate(data)


class TestNodeSchema:
    def test_node_kind_enum(self) -> None:
        node = NodeSchema(id="n1", x=0, y=0, kind=NodeKind.depot)
        assert node.kind == NodeKind.depot
        node2 = NodeSchema(id="n2", x=1, y=1, kind="customer")
        assert node2.kind == NodeKind.customer


class TestEdgeSchema:
    def test_edge_congestion_multiplier_min(self) -> None:
        edge = EdgeSchema(
            id="e1", from_="n1", to="n2", distance_km=1.0, base_travel_minutes=2.0, congestion_multiplier=1.0
        )
        assert edge.congestion_multiplier == 1.0

    def test_edge_congestion_multiplier_below_min_raises(self) -> None:
        with pytest.raises(ValueError):
            EdgeSchema(
                id="e1", from_="n1", to="n2", distance_km=1.0, base_travel_minutes=2.0, congestion_multiplier=0.5
            )


class TestCustomerSchema:
    def test_customer_default_status(self) -> None:
        c = CustomerSchema(id="C1", node_id="n1", demand=5)
        assert c.status == "pending"


class TestVehicleSchema:
    def test_vehicle_defaults(self) -> None:
        v = VehicleSchema(
            id="V1",
            label="Test",
            capacity=30,
            current_node_id="n1",
            color="#ff0000",
        )
        assert v.used_capacity == 0
        assert v.assigned_customer_ids == []
        assert v.completed_customer_ids == []
        assert v.status == VehicleExecutionState.awaiting_optimization

    def test_vehicle_used_capacity_validation(self) -> None:
        with pytest.raises(ValueError, match="used_capacity cannot exceed capacity"):
            VehicleSchema(
                id="V1", label="Test", capacity=10, used_capacity=15, current_node_id="n1", color="#ff0000"
            )


class TestIncidentSchema:
    def test_incident_severity_bounds(self) -> None:
        inc = IncidentSchema(id="I1", type="road_closure", severity=2)
        assert inc.severity == 2
        with pytest.raises(ValueError):
            IncidentSchema(id="I1", type="road_closure", severity=0)
        with pytest.raises(ValueError):
            IncidentSchema(id="I1", type="road_closure", severity=4)