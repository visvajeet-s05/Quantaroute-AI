import pytest

from app.schemas.pathfinding import PathRequest
from app.schemas.scenario import ScenarioSchema
from app.services.pathfinding_service import compute_path


def make_demo_scenario() -> ScenarioSchema:
    return ScenarioSchema(
        id="demo_scenario_001",
        name="Demo Scenario",
        seed=26137,
        depotNodeId="n_3_4",
        nodes=[
            {"id": "n_3_4", "x": 3, "y": 4, "kind": "depot"},
            {"id": "n_3_5", "x": 3, "y": 5, "kind": "intersection"},
            {"id": "n_4_4", "x": 4, "y": 4, "kind": "customer"},
            {"id": "n_4_5", "x": 4, "y": 5, "kind": "intersection"},
        ],
        edges=[
            {
                "id": "e_n_3_4_to_n_3_5",
                "from": "n_3_4",
                "to": "n_3_5",
                "distanceKm": 1.0,
                "baseTravelMinutes": 2.0,
                "congestionMultiplier": 1.0,
                "isBlocked": False,
            },
            {
                "id": "e_n_3_5_to_n_3_4",
                "from": "n_3_5",
                "to": "n_3_4",
                "distanceKm": 1.0,
                "baseTravelMinutes": 2.0,
                "congestionMultiplier": 1.0,
                "isBlocked": False,
            },
            {
                "id": "e_n_3_4_to_n_4_4",
                "from": "n_3_4",
                "to": "n_4_4",
                "distanceKm": 1.0,
                "baseTravelMinutes": 2.0,
                "congestionMultiplier": 1.0,
                "isBlocked": False,
            },
            {
                "id": "e_n_4_4_to_n_3_4",
                "from": "n_4_4",
                "to": "n_3_4",
                "distanceKm": 1.0,
                "baseTravelMinutes": 2.0,
                "congestionMultiplier": 1.0,
                "isBlocked": False,
            },
        ],
        customers=[
            {"id": "C01", "nodeId": "n_4_4", "demand": 5, "status": "pending"},
        ],
        vehicles=[
            {
                "id": "V1",
                "label": "Vehicle V1",
                "capacity": 30,
                "usedCapacity": 0,
                "currentNodeId": "n_3_4",
                "assignedCustomerIds": [],
                "completedCustomerIds": [],
                "color": "#2563eb",
                "status": "awaiting_optimization",
            },
        ],
        incidents=[],
    )


class TestPathfindingService:
    def test_valid_request_returns_correct_response(self) -> None:
        scenario = make_demo_scenario()
        request = PathRequest(sourceNodeId="n_3_4", destinationNodeId="n_4_4")

        response = compute_path(request, scenario)

        assert response.source_node_id == "n_3_4"
        assert response.destination_node_id == "n_4_4"
        assert response.reachable is True
        assert response.node_ids == ["n_3_4", "n_4_4"]
        assert response.edge_ids == ["e_n_3_4_to_n_4_4"]
        assert response.travel_minutes == 2.0
        assert response.distance_km == 1.0

    def test_service_does_not_mutate_source_scenario(self) -> None:
        scenario = make_demo_scenario()
        original_nodes = [node.id for node in scenario.nodes]
        original_edges = [edge.id for edge in scenario.edges]
        request = PathRequest(sourceNodeId="n_3_4", destinationNodeId="n_4_4")

        compute_path(request, scenario)

        assert [node.id for node in scenario.nodes] == original_nodes
        assert [edge.id for edge in scenario.edges] == original_edges

    def test_blocked_edge_behavior_preserved(self) -> None:
        scenario = make_demo_scenario()
        # Block the direct edge n_3_4 -> n_4_4
        scenario.edges[2] = scenario.edges[2].model_copy(update={"is_blocked": True})

        request = PathRequest(sourceNodeId="n_3_4", destinationNodeId="n_4_4")
        response = compute_path(request, scenario)

        assert response.reachable is False
        assert response.node_ids == []
        assert response.edge_ids == []

    def test_response_is_valid_path_response(self) -> None:
        scenario = make_demo_scenario()
        request = PathRequest(sourceNodeId="n_3_4", destinationNodeId="n_4_4")
        response = compute_path(request, scenario)

        assert response.model_dump() is not None
        dump = response.model_dump(by_alias=True)
        assert "sourceNodeId" in dump
        assert "destinationNodeId" in dump
        assert "nodeIds" in dump
        assert "edgeIds" in dump
        assert "travelMinutes" in dump
        assert "distanceKm" in dump
        assert "reachable" in dump
        assert "visitedNodeCount" in dump

    def test_same_source_destination_returns_zero_cost(self) -> None:
        scenario = make_demo_scenario()
        request = PathRequest(sourceNodeId="n_3_4", destinationNodeId="n_3_4")
        response = compute_path(request, scenario)

        assert response.reachable is True
        assert response.node_ids == ["n_3_4"]
        assert response.edge_ids == []
        assert response.travel_minutes == 0.0
        assert response.distance_km == 0.0
        assert response.visited_node_count == 1

    def test_unreachable_destination_returns_safe_response(self) -> None:
        scenario = make_demo_scenario()
        request = PathRequest(sourceNodeId="n_3_4", destinationNodeId="n_9_9")
        response = compute_path(request, scenario)

        assert response.reachable is False
        assert response.node_ids == []
        assert response.edge_ids == []
        assert response.travel_minutes == 0.0
        assert response.distance_km == 0.0

    def test_congestion_affects_route_selection(self) -> None:
        scenario = make_demo_scenario()
        scenario.edges = [
            {
                "id": "e_direct",
                "from": "n_3_4",
                "to": "n_4_4",
                "distanceKm": 1.0,
                "baseTravelMinutes": 1.0,
                "congestionMultiplier": 5.0,
                "isBlocked": False,
            },
            {
                "id": "e_n_3_4_to_n_3_5",
                "from": "n_3_4",
                "to": "n_3_5",
                "distanceKm": 1.0,
                "baseTravelMinutes": 1.0,
                "congestionMultiplier": 1.0,
                "isBlocked": False,
            },
            {
                "id": "e_n_3_5_to_n_4_4",
                "from": "n_3_5",
                "to": "n_4_4",
                "distanceKm": 1.0,
                "baseTravelMinutes": 1.0,
                "congestionMultiplier": 1.0,
                "isBlocked": False,
            },
        ]
        scenario.nodes = [
            {"id": "n_3_4", "x": 3, "y": 4, "kind": "depot"},
            {"id": "n_3_5", "x": 3, "y": 5, "kind": "intersection"},
            {"id": "n_4_4", "x": 4, "y": 4, "kind": "customer"},
        ]

        request = PathRequest(sourceNodeId="n_3_4", destinationNodeId="n_4_4")
        response = compute_path(request, scenario)

        assert response.reachable is True
        assert response.edge_ids == ["e_n_3_4_to_n_3_5", "e_n_3_5_to_n_4_4"]
        assert response.travel_minutes == 2.0
        assert response.distance_km == 2.0

    def test_multiple_calls_are_independent(self) -> None:
        scenario = make_demo_scenario()
        request1 = PathRequest(sourceNodeId="n_3_4", destinationNodeId="n_4_4")
        request2 = PathRequest(sourceNodeId="n_4_4", destinationNodeId="n_3_4")

        response1 = compute_path(request1, scenario)
        response2 = compute_path(request2, scenario)

        assert response1.source_node_id == "n_3_4"
        assert response1.destination_node_id == "n_4_4"
        assert response2.source_node_id == "n_4_4"
        assert response2.destination_node_id == "n_3_4"
        assert response1.edge_ids != response2.edge_ids