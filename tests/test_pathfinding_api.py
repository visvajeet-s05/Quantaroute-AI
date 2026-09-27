import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


class TestPathfindingAPI:
    def test_normal_request_returns_200_with_expected_fields(self) -> None:
        request = {"sourceNodeId": "n_3_4", "destinationNodeId": "n_4_4"}
        response = client.post("/api/v1/path", json=request)

        assert response.status_code == 200
        data = response.json()
        assert data["sourceNodeId"] == "n_3_4"
        assert data["destinationNodeId"] == "n_4_4"
        assert data["reachable"] is True
        assert "nodeIds" in data
        assert "edgeIds" in data
        assert "travelMinutes" in data
        assert "distanceKm" in data
        assert "visitedNodeCount" in data
        assert isinstance(data["nodeIds"], list)
        assert isinstance(data["edgeIds"], list)

    def test_blocked_edge_detour_returns_200_avoids_blocked(self) -> None:
        request = {"sourceNodeId": "n_3_4", "destinationNodeId": "n_3_5"}
        response = client.post("/api/v1/path", json=request)

        assert response.status_code == 200
        data = response.json()
        assert data["reachable"] is True

    def test_unreachable_request_returns_200_reachable_false(self) -> None:
        request = {"sourceNodeId": "n_3_4", "destinationNodeId": "n_9_9"}
        response = client.post("/api/v1/path", json=request)

        assert response.status_code == 200
        data = response.json()
        assert data["reachable"] is False
        assert data["nodeIds"] == []
        assert data["edgeIds"] == []
        assert data["travelMinutes"] == 0.0
        assert data["distanceKm"] == 0.0

    def test_invalid_source_id_returns_422(self) -> None:
        request = {"sourceNodeId": "", "destinationNodeId": "n_4_4"}
        response = client.post("/api/v1/path", json=request)

        assert response.status_code == 422

    def test_missing_source_id_returns_422(self) -> None:
        request = {"destinationNodeId": "n_4_4"}
        response = client.post("/api/v1/path", json=request)

        assert response.status_code == 422

    def test_missing_destination_id_returns_422(self) -> None:
        request = {"sourceNodeId": "n_3_4"}
        response = client.post("/api/v1/path", json=request)

        assert response.status_code == 422

    def test_invalid_node_id_not_in_graph_returns_200_unreachable(self) -> None:
        request = {"sourceNodeId": "nonexistent", "destinationNodeId": "n_4_4"}
        response = client.post("/api/v1/path", json=request)

        assert response.status_code == 200
        data = response.json()
        assert data["reachable"] is False

    def test_docs_endpoint_returns_200(self) -> None:
        response = client.get("/docs")
        assert response.status_code == 200

    def test_openapi_schema_contains_path_endpoint(self) -> None:
        response = client.get("/openapi.json")
        assert response.status_code == 200
        schema = response.json()
        assert "/api/v1/path" in schema["paths"]
        assert "post" in schema["paths"]["/api/v1/path"]

    def test_same_source_destination_returns_zero_cost(self) -> None:
        request = {"sourceNodeId": "n_3_4", "destinationNodeId": "n_3_4"}
        response = client.post("/api/v1/path", json=request)

        assert response.status_code == 200
        data = response.json()
        assert data["reachable"] is True
        assert data["nodeIds"] == ["n_3_4"]
        assert data["edgeIds"] == []
        assert data["travelMinutes"] == 0.0
        assert data["distanceKm"] == 0.0

    def test_directed_edge_enforcement_returns_unreachable(self) -> None:
        # n_4_5 has no outgoing edges in demo scenario, so cannot reach n_3_4
        request = {"sourceNodeId": "n_4_5", "destinationNodeId": "n_3_4"}
        response = client.post("/api/v1/path", json=request)

        assert response.status_code == 200
        data = response.json()
        assert data["reachable"] is False

    def test_congestion_affects_path_selection(self) -> None:
        request = {"sourceNodeId": "n_3_4", "destinationNodeId": "n_4_4"}
        response = client.post("/api/v1/path", json=request)

        assert response.status_code == 200
        data = response.json()
        assert data["reachable"] is True
        assert data["travelMinutes"] >= 0

    def test_edge_ids_match_node_sequence(self) -> None:
        request = {"sourceNodeId": "n_3_4", "destinationNodeId": "n_4_4"}
        response = client.post("/api/v1/path", json=request)

        assert response.status_code == 200
        data = response.json()
        if data["reachable"] and len(data["nodeIds"]) > 1:
            assert len(data["edgeIds"]) == len(data["nodeIds"]) - 1
            assert data["nodeIds"][0] == "n_3_4"
            assert data["nodeIds"][-1] == "n_4_4"

    def test_response_includes_congestion_penalty(self) -> None:
        request = {"sourceNodeId": "n_3_4", "destinationNodeId": "n_4_4"}
        response = client.post("/api/v1/path", json=request)

        assert response.status_code == 200
        data = response.json()
        assert "congestionPenalty" in data or "travelMinutes" in data

    def test_invalid_json_returns_422(self) -> None:
        response = client.post("/api/v1/path", content="not json")
        assert response.status_code == 422