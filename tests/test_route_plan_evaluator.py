import pytest

from app.schemas.common import AlgorithmName
from app.schemas.routing import (
    EvaluateRequest,
    RoutePlanSchema,
    VehicleRouteSchema,
    RoutingContextSchema,
    RoutingMode,
)
from app.schemas.scenario import ScenarioSchema
from app.services.route_plan_evaluator import evaluate_route_plan


def make_test_scenario() -> ScenarioSchema:
    return ScenarioSchema(
        id="test_scenario",
        name="Test Scenario",
        seed=12345,
        depotNodeId="n_0_0",
        nodes=[
            {"id": "n_0_0", "x": 0, "y": 0, "kind": "depot"},
            {"id": "n_1_0", "x": 1, "y": 0, "kind": "customer"},
            {"id": "n_2_0", "x": 2, "y": 0, "kind": "customer"},
            {"id": "n_0_1", "x": 0, "y": 1, "kind": "intersection"},
        ],
        edges=[
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
            {
                "id": "e_1_0_to_2_0",
                "from": "n_1_0",
                "to": "n_2_0",
                "distanceKm": 1.0,
                "baseTravelMinutes": 2.0,
                "congestionMultiplier": 1.0,
                "isBlocked": False,
            },
            {
                "id": "e_2_0_to_0_0",
                "from": "n_2_0",
                "to": "n_0_0",
                "distanceKm": 1.5,
                "baseTravelMinutes": 3.0,
                "congestionMultiplier": 1.0,
                "isBlocked": False,
            },
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
        ],
        customers=[
            {"id": "C01", "nodeId": "n_1_0", "demand": 5, "status": "pending"},
            {"id": "C02", "nodeId": "n_2_0", "demand": 6, "status": "pending"},
        ],
        vehicles=[
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
            {
                "id": "V2",
                "label": "Vehicle 2",
                "capacity": 20,
                "usedCapacity": 0,
                "currentNodeId": "n_0_0",
                "assignedCustomerIds": [],
                "completedCustomerIds": [],
                "color": "#9333ea",
                "status": "awaiting_optimization",
            },
        ],
        incidents=[],
    )


def make_feasible_route_plan() -> RoutePlanSchema:
    return RoutePlanSchema(
        algorithm=AlgorithmName.greedy,
        scenarioId="test_scenario",
        seed=12345,
        depotNodeId="n_0_0",
        vehicleRoutes=[
            VehicleRouteSchema(
                vehicleId="V1",
                customerIds=["C01", "C02"],
                fullPathNodeIds=["n_0_0", "n_1_0", "n_2_0", "n_0_0"],
                fullPathEdgeIds=["e_0_0_to_1_0", "e_1_0_to_2_0", "e_2_0_to_0_0"],
                startNodeId="n_0_0",
                endNodeId="n_0_0",
                completedCustomerIds=[],
                pendingCustomerIds=["C01", "C02"],
                isDynamicReroute=False,
            ),
        ],
        mode=RoutingMode.INITIAL,
    )


class TestRoutePlanEvaluator:
    def test_feasible_score_manually_verified(self) -> None:
        scenario = make_test_scenario()
        route_plan = make_feasible_route_plan()
        request = EvaluateRequest(scenario=scenario, routePlan=route_plan)
        response = evaluate_route_plan(request)

        assert response.validation.valid is True
        assert response.total_travel_minutes == 7.0
        assert response.total_distance_km == 3.5
        assert response.total_congestion_penalty == 0.0
        assert response.routing_score == 0.55 * 7.0 + 0.25 * 3.5 + 0.20 * 0.0
        assert response.penalty_total == 0.0
        assert response.customers_unserved == 0
        assert response.customers_assigned == 2

    def test_travel_time_distance_congestion_totals_correct(self) -> None:
        scenario = make_test_scenario()
        # Find edges by ID and set congestion
        for edge in scenario.edges:
            if edge.id == "e_0_0_to_1_0":
                edge.congestion_multiplier = 2.0
            elif edge.id == "e_1_0_to_2_0":
                edge.congestion_multiplier = 1.5
            elif edge.id == "e_2_0_to_0_0":
                edge.congestion_multiplier = 1.0

        route_plan = make_feasible_route_plan()
        request = EvaluateRequest(scenario=scenario, routePlan=route_plan)
        response = evaluate_route_plan(request)

        expected_travel = 2.0 * 2.0 + 2.0 * 1.5 + 3.0 * 1.0
        expected_distance = 1.0 + 1.0 + 1.5
        expected_penalty = 2.0 * (2.0 - 1.0) + 2.0 * (1.5 - 1.0) + 3.0 * 0.0

        assert response.total_travel_minutes == expected_travel
        assert response.total_distance_km == expected_distance
        assert response.total_congestion_penalty == expected_penalty

    def test_unserved_penalty_correct(self) -> None:
        scenario = make_test_scenario()
        route_plan = RoutePlanSchema(
            algorithm=AlgorithmName.greedy,
            scenarioId="test_scenario",
            seed=12345,
            depotNodeId="n_0_0",
            vehicleRoutes=[
                VehicleRouteSchema(
                    vehicleId="V1",
                    customerIds=["C01"],
                    fullPathNodeIds=["n_0_0", "n_1_0", "n_0_0"],
                    fullPathEdgeIds=["e_0_0_to_1_0", "e_1_0_to_0_0"],
                    startNodeId="n_0_0",
                    endNodeId="n_0_0",
                    completedCustomerIds=[],
                    pendingCustomerIds=["C01"],
                    isDynamicReroute=False,
                ),
            ],
            mode=RoutingMode.INITIAL,
        )
        request = EvaluateRequest(scenario=scenario, routePlan=route_plan)
        response = evaluate_route_plan(request)

        assert response.customers_unserved == 1
        assert response.unserved_customer_ids == ["C02"]
        assert response.penalty_total == 10000.0

    def test_duplicate_penalty_correct(self) -> None:
        scenario = make_test_scenario()
        route_plan = RoutePlanSchema(
            algorithm=AlgorithmName.greedy,
            scenarioId="test_scenario",
            seed=12345,
            depotNodeId="n_0_0",
            vehicleRoutes=[
                VehicleRouteSchema(
                    vehicleId="V1",
                    customerIds=["C01"],
                    fullPathNodeIds=["n_0_0", "n_1_0", "n_0_0"],
                    fullPathEdgeIds=["e_0_0_to_1_0", "e_1_0_to_0_0"],
                    startNodeId="n_0_0",
                    endNodeId="n_0_0",
                ),
                VehicleRouteSchema(
                    vehicleId="V2",
                    customerIds=["C01", "C02"],
                    fullPathNodeIds=["n_0_0", "n_1_0", "n_2_0", "n_0_0"],
                    fullPathEdgeIds=["e_0_0_to_1_0", "e_1_0_to_2_0", "e_2_0_to_0_0"],
                    startNodeId="n_0_0",
                    endNodeId="n_0_0",
                ),
            ],
            mode=RoutingMode.INITIAL,
        )
        request = EvaluateRequest(scenario=scenario, routePlan=route_plan)
        response = evaluate_route_plan(request)

        assert response.duplicate_customer_ids == ["C01"]
        assert response.penalty_total == 10000.0

    def test_capacity_penalty_correct(self) -> None:
        scenario = make_test_scenario()
        scenario.vehicles[0].capacity = 5

        route_plan = make_feasible_route_plan()
        request = EvaluateRequest(scenario=scenario, routePlan=route_plan)
        response = evaluate_route_plan(request)

        assert "V1" in response.capacity_violation_vehicle_ids
        assert response.penalty_total == 10000.0

    def test_blocked_edge_penalty_correct(self) -> None:
        scenario = make_test_scenario()
        for edge in scenario.edges:
            if edge.id == "e_0_0_to_1_0":
                edge.is_blocked = True
                break

        route_plan = make_feasible_route_plan()
        request = EvaluateRequest(scenario=scenario, routePlan=route_plan)
        response = evaluate_route_plan(request)

        assert "e_0_0_to_1_0" in response.blocked_edge_violation_ids
        assert response.penalty_total == 50000.0

    def test_unreachable_penalty_correct(self) -> None:
        scenario = make_test_scenario()
        route_plan = RoutePlanSchema(
            algorithm=AlgorithmName.greedy,
            scenarioId="test_scenario",
            seed=12345,
            depotNodeId="n_0_0",
            vehicleRoutes=[
                VehicleRouteSchema(
                    vehicleId="V1",
                    customerIds=["C01", "C02"],
                    fullPathNodeIds=[],
                    fullPathEdgeIds=[],
                    startNodeId="n_0_0",
                    endNodeId="n_0_0",
                ),
            ],
            mode=RoutingMode.INITIAL,
        )
        request = EvaluateRequest(scenario=scenario, routePlan=route_plan)
        response = evaluate_route_plan(request)

        assert "V1" in response.unreachable_vehicle_ids
        # Penalty: 50000 (unreachable) + 50000 (path continuity - customer nodes not in path)
        assert response.penalty_total == 100000.0

    def test_start_end_penalty_correct(self) -> None:
        scenario = make_test_scenario()
        route_plan = RoutePlanSchema(
            algorithm=AlgorithmName.greedy,
            scenarioId="test_scenario",
            seed=12345,
            depotNodeId="n_0_0",
            vehicleRoutes=[
                VehicleRouteSchema(
                    vehicleId="V1",
                    customerIds=["C01", "C02"],
                    fullPathNodeIds=["n_1_0", "n_0_0"],
                    fullPathEdgeIds=["e_1_0_to_0_0"],
                    startNodeId="n_1_0",
                    endNodeId="n_0_0",
                ),
            ],
            mode=RoutingMode.INITIAL,
        )
        request = EvaluateRequest(scenario=scenario, routePlan=route_plan)
        response = evaluate_route_plan(request)

        assert "V1" in response.vehicle_evaluations[0].vehicle_id
        assert response.vehicle_evaluations[0].starts_correctly is False
        # Penalty: 10000 (start/end) + 50000 (path continuity - customer node not in path)
        assert response.penalty_total == 60000.0

    def test_continuity_penalty_correct(self) -> None:
        scenario = make_test_scenario()
        route_plan = RoutePlanSchema(
            algorithm=AlgorithmName.greedy,
            scenarioId="test_scenario",
            seed=12345,
            depotNodeId="n_0_0",
            vehicleRoutes=[
                VehicleRouteSchema(
                    vehicleId="V1",
                    customerIds=["C01", "C02"],
                    fullPathNodeIds=["n_0_0", "n_1_0", "n_0_0"],
                    fullPathEdgeIds=["e_0_1_to_0_0", "e_0_0_to_1_0"],
                    startNodeId="n_0_0",
                    endNodeId="n_0_0",
                ),
            ],
            mode=RoutingMode.INITIAL,
        )
        request = EvaluateRequest(scenario=scenario, routePlan=route_plan)
        response = evaluate_route_plan(request)

        assert "V1" in response.path_continuity_violation_vehicle_ids
        assert response.penalty_total == 50000.0

    def test_no_double_count_duplicate_blocked_edge_id(self) -> None:
        scenario = make_test_scenario()
        for edge in scenario.edges:
            if edge.id in ["e_0_0_to_1_0", "e_1_0_to_2_0"]:
                edge.is_blocked = True

        route_plan = RoutePlanSchema(
            algorithm=AlgorithmName.greedy,
            scenarioId="test_scenario",
            seed=12345,
            depotNodeId="n_0_0",
            vehicleRoutes=[
                VehicleRouteSchema(
                    vehicleId="V1",
                    customerIds=["C01", "C02"],
                    fullPathNodeIds=["n_0_0", "n_1_0", "n_2_0", "n_0_0"],
                    fullPathEdgeIds=["e_0_0_to_1_0", "e_1_0_to_2_0", "e_2_0_to_0_0"],
                    startNodeId="n_0_0",
                    endNodeId="n_0_0",
                ),
                VehicleRouteSchema(
                    vehicleId="V2",
                    customerIds=[],
                    fullPathNodeIds=["n_0_0"],
                    fullPathEdgeIds=[],
                    startNodeId="n_0_0",
                    endNodeId="n_0_0",
                ),
            ],
            mode=RoutingMode.INITIAL,
        )
        request = EvaluateRequest(scenario=scenario, routePlan=route_plan)
        response = evaluate_route_plan(request)

        assert len(response.blocked_edge_violation_ids) == 2
        assert response.penalty_total == 2 * 50000.0

    def test_no_mutation_of_request_object(self) -> None:
        scenario = make_test_scenario()
        route_plan = make_feasible_route_plan()
        original_edges = [edge.id for edge in scenario.edges]
        original_routes = [r.vehicle_id for r in route_plan.vehicle_routes]

        request = EvaluateRequest(scenario=scenario, routePlan=route_plan)
        evaluate_route_plan(request)

        assert [edge.id for edge in scenario.edges] == original_edges
        assert [r.vehicle_id for r in route_plan.vehicle_routes] == original_routes

    def test_reroute_remaining_capacity_metrics_correct(self) -> None:
        scenario = make_test_scenario()
        scenario.vehicles[0].capacity = 30
        scenario.vehicles[0].used_capacity = 10

        routing_context = RoutingContextSchema(
            mode=RoutingMode.REROUTE,
            depotNodeId="n_0_0",
            startNodeByVehicleId={"V1": "n_1_0"},
            remainingCapacityByVehicleId={"V1": 15},
            lockedCustomerIds=["C01"],
            eligibleCustomerIds=["C02"],
        )

        route_plan = RoutePlanSchema(
            algorithm=AlgorithmName.greedy,
            scenarioId="test_scenario",
            seed=12345,
            depotNodeId="n_0_0",
            vehicleRoutes=[
                VehicleRouteSchema(
                    vehicleId="V1",
                    customerIds=["C01", "C02"],
                    fullPathNodeIds=["n_1_0", "n_2_0", "n_0_0"],
                    fullPathEdgeIds=["e_1_0_to_2_0", "e_2_0_to_0_0"],
                    startNodeId="n_1_0",
                    endNodeId="n_0_0",
                    completedCustomerIds=["C01"],
                    pendingCustomerIds=["C02"],
                    isDynamicReroute=True,
                ),
            ],
            mode=RoutingMode.REROUTE,
            routingContext=routing_context,
        )
        request = EvaluateRequest(scenario=scenario, routePlan=route_plan)
        response = evaluate_route_plan(request)

        v_eval = response.vehicle_evaluations[0]
        assert v_eval.computed_used_capacity == 6
        assert v_eval.computed_remaining_capacity == 9
        assert v_eval.computed_travel_minutes == 5.0
        assert v_eval.computed_distance_km == 2.5