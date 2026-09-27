import json
import pytest

from app.schemas.routing import EvaluateRequest
from app.services.route_plan_evaluator import evaluate_route_plan


def load_parity_fixture() -> dict:
    with open("tests/fixtures/frontend_parity_scenario.json", "r") as f:
        return json.load(f)


class TestFrontendParityFixture:
    def test_evaluator_returns_deterministic_metrics_for_fixture(self) -> None:
        fixture = load_parity_fixture()
        request = EvaluateRequest(scenario=fixture["scenario"], routePlan=fixture["routePlan"])
        response = evaluate_route_plan(request)

        expected = fixture["expectedMetrics"]

        assert response.customers_assigned == expected["customersAssigned"]
        assert response.customers_unserved == expected["customersUnserved"]
        assert response.penalty_total == expected["penaltyTotal"]

        assert response.total_travel_minutes == expected["totalTravelMinutes"]
        assert response.total_distance_km == expected["totalDistanceKm"]
        assert response.total_congestion_penalty == expected["totalCongestionPenalty"]
        assert abs(response.routing_score - expected["routingScore"]) < 1e-9

        v1_eval = next(v for v in response.vehicle_evaluations if v.vehicle_id == "V1")
        v2_eval = next(v for v in response.vehicle_evaluations if v.vehicle_id == "V2")

        assert v1_eval.computed_travel_minutes == expected["V1"]["travelMinutes"]
        assert v1_eval.computed_distance_km == expected["V1"]["distanceKm"]
        assert v1_eval.computed_congestion_penalty == expected["V1"]["congestionPenalty"]
        assert v1_eval.computed_used_capacity == expected["V1"]["usedCapacity"]
        assert v1_eval.computed_remaining_capacity == expected["V1"]["remainingCapacity"]

        assert v2_eval.computed_travel_minutes == expected["V2"]["travelMinutes"]
        assert v2_eval.computed_distance_km == expected["V2"]["distanceKm"]
        assert v2_eval.computed_congestion_penalty == expected["V2"]["congestionPenalty"]
        assert v2_eval.computed_used_capacity == expected["V2"]["usedCapacity"]
        assert v2_eval.computed_remaining_capacity == expected["V2"]["remainingCapacity"]

    def test_fixture_structure_is_valid(self) -> None:
        fixture = load_parity_fixture()

        assert "scenario" in fixture
        assert "routePlan" in fixture
        assert "expectedMetrics" in fixture

        scenario = fixture["scenario"]
        assert "id" in scenario
        assert "nodes" in scenario
        assert "edges" in scenario
        assert "customers" in scenario
        assert "vehicles" in scenario

        route_plan = fixture["routePlan"]
        assert "algorithm" in route_plan
        assert "vehicleRoutes" in route_plan
        assert len(route_plan["vehicleRoutes"]) == 2

    def test_fixture_has_no_violations(self) -> None:
        fixture = load_parity_fixture()
        request = EvaluateRequest(scenario=fixture["scenario"], routePlan=fixture["routePlan"])
        response = evaluate_route_plan(request)

        assert response.validation.valid is True
        assert len(response.validation.errors) == 0
        assert response.customers_unserved == 0
        assert len(response.duplicate_customer_ids) == 0
        assert len(response.capacity_violation_vehicle_ids) == 0
        assert len(response.blocked_edge_violation_ids) == 0
        assert len(response.unreachable_vehicle_ids) == 0
        assert len(response.path_continuity_violation_vehicle_ids) == 0

    def test_fixture_output_structure_easy_to_compare(self) -> None:
        fixture = load_parity_fixture()
        request = EvaluateRequest(scenario=fixture["scenario"], routePlan=fixture["routePlan"])
        response = evaluate_route_plan(request)

        output_dict = response.model_dump(by_alias=True)

        assert "routePlan" in output_dict
        assert "validation" in output_dict
        assert "vehicleEvaluations" in output_dict
        assert "totalTravelMinutes" in output_dict
        assert "totalDistanceKm" in output_dict
        assert "totalCongestionPenalty" in output_dict
        assert "routingScore" in output_dict
        assert "customersAssigned" in output_dict
        assert "customersUnserved" in output_dict
        assert "unservedCustomerIds" in output_dict
        assert "duplicateCustomerIds" in output_dict
        assert "capacityViolationVehicleIds" in output_dict
        assert "blockedEdgeViolationIds" in output_dict
        assert "unreachableVehicleIds" in output_dict
        assert "pathContinuityViolationVehicleIds" in output_dict
        assert "penaltyTotal" in output_dict
        assert "warnings" in output_dict

        for v_eval in output_dict["vehicleEvaluations"]:
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