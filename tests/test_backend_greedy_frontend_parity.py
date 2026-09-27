import json
import math
from pathlib import Path

import pytest

from app.schemas.common import AlgorithmName
from app.schemas.optimization import OptimizationPreset, OptimizationRequest
from app.schemas.routing import RoutingMode
from app.schemas.scenario import ScenarioSchema
from app.services.greedy_routing_service import optimize_greedy

FIXTURE_PATH = (
    Path(__file__).parent / "fixtures" / "frontend_exports" / "backend_greedy_expected.json"
)


def load_backend_greedy_fixture() -> dict:
    if not FIXTURE_PATH.exists():
        pytest.skip("Requires genuine frontend Greedy export: fixture file does not exist.")
    with open(FIXTURE_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def test_backend_greedy_frontend_route_plan_parity():
    """Verify backend Greedy optimization matches genuine frontend Greedy export.

    To replace or update the fixture:
    1. Run frontend parity export with algorithm='greedy', preset='standard', seed=26137.
    2. Save the resulting JSON to tests/fixtures/frontend_exports/backend_greedy_expected.json.
    """
    raw_fixture = load_backend_greedy_fixture()
    metadata = raw_fixture.get("metadata", {})

    if not metadata.get("sourceVerified", False) or metadata.get("source") != "QuantaRoute AI Frontend":
        pytest.skip("Requires genuine frontend Greedy export.")

    scenario = ScenarioSchema.model_validate(raw_fixture["scenario"])
    frontend_route_plan = raw_fixture["routePlan"]
    frontend_evaluation = raw_fixture["frontendEvaluation"]

    opt_request = OptimizationRequest(
        scenario=scenario,
        algorithm=AlgorithmName.greedy,
        preset=OptimizationPreset.STANDARD,
        optimizerSeed=scenario.seed,
        mode=RoutingMode.INITIAL,
    )

    opt_response = optimize_greedy(opt_request)
    backend_route_plan = opt_response.route_plan
    backend_evaluation = opt_response.evaluation

    # 1. Compare vehicle route counts
    assert len(backend_route_plan.vehicle_routes) == len(frontend_route_plan["vehicleRoutes"])

    # 2. Compare vehicle route customerIds exact order, fullPathNodeIds, fullPathEdgeIds
    for backend_route, frontend_route in zip(
        backend_route_plan.vehicle_routes, frontend_route_plan["vehicleRoutes"]
    ):
        assert backend_route.vehicle_id == frontend_route["vehicleId"]
        assert backend_route.customer_ids == frontend_route["customerIds"]
        assert backend_route.full_path_node_ids == frontend_route["fullPathNodeIds"]
        assert backend_route.full_path_edge_ids == frontend_route["fullPathEdgeIds"]

    # 3. Numeric metrics comparison within tolerance 1e-8
    tol = 1e-8
    assert math.isclose(
        backend_evaluation.total_travel_minutes,
        frontend_evaluation["totalTravelMinutes"],
        abs_tol=tol,
        rel_tol=tol,
    )
    assert math.isclose(
        backend_evaluation.total_distance_km,
        frontend_evaluation["totalDistanceKm"],
        abs_tol=tol,
        rel_tol=tol,
    )
    assert math.isclose(
        backend_evaluation.total_congestion_penalty,
        frontend_evaluation["totalCongestionPenalty"],
        abs_tol=tol,
        rel_tol=tol,
    )
    assert math.isclose(
        backend_evaluation.routing_score,
        frontend_evaluation["routingScore"],
        abs_tol=tol,
        rel_tol=tol,
    )

    # 4. Feasibility and coverage exact matches
    assert backend_evaluation.validation.valid == frontend_evaluation["feasible"]
    assert set(backend_evaluation.unserved_customer_ids) == set(
        frontend_evaluation.get("unservedCustomerIds", [])
    )
    assert (
        backend_evaluation.customers_assigned
        == frontend_evaluation["customersAssigned"]
    )
    assert (
        backend_evaluation.customers_unserved
        == frontend_evaluation["customersUnserved"]
    )
