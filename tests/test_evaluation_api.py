import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def make_valid_evaluate_request() -> dict:
    return {
        "scenario": {
            "id": "demo_scenario_001",
            "name": "Demo Scenario",
            "seed": 26137,
            "depotNodeId": "n_3_4",
            "nodes": [
                {"id": "n_3_4", "x": 3, "y": 4, "kind": "depot"},
                {"id": "n_3_5", "x": 3, "y": 5, "kind": "intersection"},
                {"id": "n_4_4", "x": 4, "y": 4, "kind": "customer"},
                {"id": "n_4_5", "x": 4, "y": 5, "kind": "intersection"},
            ],
            "edges": [
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
            "customers": [
                {"id": "C01", "nodeId": "n_4_4", "demand": 5, "status": "pending"},
            ],
            "vehicles": [
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
            "incidents": [],
        },
        "routePlan": {
            "algorithm": "greedy",
            "scenarioId": "demo_scenario_001",
            "seed": 26137,
            "depotNodeId": "n_3_4",
            "vehicleRoutes": [
                {
                    "vehicleId": "V1",
                    "customerIds": ["C01"],
                    "fullPathNodeIds": ["n_3_4", "n_4_4", "n_3_4"],
                    "fullPathEdgeIds": ["e_n_3_4_to_n_4_4", "e_n_4_4_to_n_3_4"],
                    "startNodeId": "n_3_4",
                    "endNodeId": "n_3_4",
                    "completedCustomerIds": [],
                    "pendingCustomerIds": ["C01"],
                    "isDynamicReroute": False,
                }
            ],
            "mode": "initial",
        },
    }


class TestEvaluationAPI:
    def test_valid_evaluate_request_returns_200_feasible_response(self) -> None:
        request = make_valid_evaluate_request()
        response = client.post("/api/v1/evaluate", json=request)

        assert response.status_code == 200
        data = response.json()
        assert data["validation"]["valid"] is True
        assert data["validation"]["capacityCompliant"] is True
        assert data["validation"]["customerCoverageComplete"] is True
        assert data["validation"]["noDuplicateCustomerService"] is True
        assert data["validation"]["allRoutesStartCorrectly"] is True
        assert data["validation"]["allRoutesEndAtDepot"] is True
        assert data["validation"]["noBlockedEdgesUsed"] is True
        assert data["validation"]["allRoutePathsReachable"] is True

    def test_infeasible_route_plan_returns_200_and_feasible_false(self) -> None:
        request = make_valid_evaluate_request()
        request["routePlan"]["vehicleRoutes"][0]["fullPathNodeIds"] = ["n_3_4", "n_4_4"]
        request["routePlan"]["vehicleRoutes"][0]["fullPathEdgeIds"] = ["e_n_3_4_to_n_4_4"]
        request["routePlan"]["vehicleRoutes"][0]["endNodeId"] = "n_4_4"

        response = client.post("/api/v1/evaluate", json=request)

        assert response.status_code == 200
        data = response.json()
        assert data["validation"]["valid"] is False
        assert data["validation"]["allRoutesEndAtDepot"] is False

    def test_invalid_schema_returns_422(self) -> None:
        request = {
            "scenario": {},
            "routePlan": {"algorithm": "greedy"},
        }
        response = client.post("/api/v1/evaluate", json=request)

        assert response.status_code == 422

    def test_response_includes_all_required_fields(self) -> None:
        request = make_valid_evaluate_request()
        response = client.post("/api/v1/evaluate", json=request)

        assert response.status_code == 200
        data = response.json()

        assert "routePlan" in data
        assert "validation" in data
        assert "vehicleEvaluations" in data
        assert "totalTravelMinutes" in data
        assert "totalDistanceKm" in data
        assert "totalCongestionPenalty" in data
        assert "routingScore" in data
        assert "customersAssigned" in data
        assert "customersUnserved" in data
        assert "unservedCustomerIds" in data
        assert "duplicateCustomerIds" in data
        assert "capacityViolationVehicleIds" in data
        assert "blockedEdgeViolationIds" in data
        assert "unreachableVehicleIds" in data
        assert "pathContinuityViolationVehicleIds" in data
        assert "penaltyTotal" in data
        assert "warnings" in data

        assert isinstance(data["vehicleEvaluations"], list)
        assert len(data["vehicleEvaluations"]) == 1
        v_eval = data["vehicleEvaluations"][0]
        assert "vehicleId" in v_eval
        assert "customerIds" in v_eval
        assert "computedTravelMinutes" in v_eval
        assert "computedDistanceKm" in v_eval
        assert "computedCongestionPenalty" in v_eval
        assert "computedUsedCapacity" in v_eval
        assert "computedRemainingCapacity" in v_eval
        assert "startsCorrectly" in v_eval
        assert "endsAtDepot" in v_eval
        assert "pathReachable" in v_eval
        assert "blockedEdgeIds" in v_eval
        assert "unknownEdgeIds" in v_eval
        assert "continuityErrors" in v_eval
        assert "warnings" in v_eval

    def test_docs_endpoint_returns_200(self) -> None:
        response = client.get("/docs")
        assert response.status_code == 200

    def test_openapi_schema_contains_evaluate_endpoint(self) -> None:
        response = client.get("/openapi.json")
        assert response.status_code == 200
        schema = response.json()
        assert "/api/v1/evaluate" in schema["paths"]
        assert "post" in schema["paths"]["/api/v1/evaluate"]