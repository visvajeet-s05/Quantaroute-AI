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
from app.services.route_plan_validator import validate_route_plan, ValidationIssue


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


def make_valid_initial_route_plan() -> RoutePlanSchema:
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


class TestRoutePlanValidator:
    def test_valid_initial_route_plan(self) -> None:
        scenario = make_test_scenario()
        route_plan = make_valid_initial_route_plan()
        result = validate_route_plan(scenario, route_plan)

        assert len(result.all_issues) == 0
        assert len(result.unserved_customer_ids) == 0
        assert len(result.duplicate_customer_ids) == 0
        assert len(result.capacity_violation_vehicle_ids) == 0
        assert len(result.blocked_edge_violation_ids) == 0
        assert len(result.unreachable_vehicle_ids) == 0
        assert len(result.path_continuity_violation_vehicle_ids) == 0
        assert len(result.invalid_start_or_end_vehicle_ids) == 0

    def test_duplicate_vehicle_route_ids_flagged(self) -> None:
        scenario = make_test_scenario()
        with pytest.raises(ValueError, match="vehicle route IDs must be unique"):
            RoutePlanSchema(
                algorithm=AlgorithmName.greedy,
                scenarioId="test_scenario",
                seed=12345,
                depotNodeId="n_0_0",
                vehicleRoutes=[
                    VehicleRouteSchema(
                        vehicleId="V1",
                        customerIds=["C01"],
                        fullPathNodeIds=["n_0_0", "n_1_0", "n_0_0"],
                        fullPathEdgeIds=["e_0_0_to_1_0", "e_0_1_to_0_0"],
                        startNodeId="n_0_0",
                        endNodeId="n_0_0",
                    ),
                    VehicleRouteSchema(
                        vehicleId="V1",
                        customerIds=["C02"],
                        fullPathNodeIds=["n_0_0", "n_2_0", "n_0_0"],
                        fullPathEdgeIds=["e_0_0_to_1_0", "e_1_0_to_2_0", "e_2_0_to_0_0"],
                        startNodeId="n_0_0",
                        endNodeId="n_0_0",
                    ),
                ],
                mode=RoutingMode.INITIAL,
            )

    def test_unknown_vehicle_flagged(self) -> None:
        scenario = make_test_scenario()
        route_plan = RoutePlanSchema(
            algorithm=AlgorithmName.greedy,
            scenarioId="test_scenario",
            seed=12345,
            depotNodeId="n_0_0",
            vehicleRoutes=[
                VehicleRouteSchema(
                    vehicleId="V99",
                    customerIds=["C01"],
                    fullPathNodeIds=["n_0_0", "n_1_0", "n_0_0"],
                    fullPathEdgeIds=["e_0_0_to_1_0", "e_0_1_to_0_0"],
                    startNodeId="n_0_0",
                    endNodeId="n_0_0",
                ),
            ],
            mode=RoutingMode.INITIAL,
        )
        result = validate_route_plan(scenario, route_plan)
        assert any(i.category == "unknown_vehicle" for i in result.all_issues)
        assert any("V99" in i.message for i in result.all_issues)

    def test_unknown_customer_flagged(self) -> None:
        scenario = make_test_scenario()
        route_plan = RoutePlanSchema(
            algorithm=AlgorithmName.greedy,
            scenarioId="test_scenario",
            seed=12345,
            depotNodeId="n_0_0",
            vehicleRoutes=[
                VehicleRouteSchema(
                    vehicleId="V1",
                    customerIds=["C99"],
                    fullPathNodeIds=["n_0_0", "n_1_0", "n_0_0"],
                    fullPathEdgeIds=["e_0_0_to_1_0", "e_0_1_to_0_0"],
                    startNodeId="n_0_0",
                    endNodeId="n_0_0",
                ),
            ],
            mode=RoutingMode.INITIAL,
        )
        result = validate_route_plan(scenario, route_plan)
        assert any(i.category == "unknown_customer" for i in result.all_issues)

    def test_duplicate_customer_across_vehicles_detected(self) -> None:
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
                    fullPathEdgeIds=["e_0_0_to_1_0", "e_0_1_to_0_0"],
                    startNodeId="n_0_0",
                    endNodeId="n_0_0",
                ),
                VehicleRouteSchema(
                    vehicleId="V2",
                    customerIds=["C01"],
                    fullPathNodeIds=["n_0_0", "n_1_0", "n_0_0"],
                    fullPathEdgeIds=["e_0_0_to_1_0", "e_0_1_to_0_0"],
                    startNodeId="n_0_0",
                    endNodeId="n_0_0",
                ),
            ],
            mode=RoutingMode.INITIAL,
        )
        result = validate_route_plan(scenario, route_plan)
        assert "C01" in result.duplicate_customer_ids
        assert any(i.category == "duplicate_customer" for i in result.all_issues)

    def test_missing_unserved_customer_detected(self) -> None:
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
                    fullPathEdgeIds=["e_0_0_to_1_0", "e_0_1_to_0_0"],
                    startNodeId="n_0_0",
                    endNodeId="n_0_0",
                ),
            ],
            mode=RoutingMode.INITIAL,
        )
        result = validate_route_plan(scenario, route_plan)
        assert "C02" in result.unserved_customer_ids

    def test_initial_route_wrong_start_detected(self) -> None:
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
                    fullPathNodeIds=["n_1_0", "n_0_0"],
                    fullPathEdgeIds=["e_0_1_to_0_0"],
                    startNodeId="n_1_0",
                    endNodeId="n_0_0",
                ),
            ],
            mode=RoutingMode.INITIAL,
        )
        result = validate_route_plan(scenario, route_plan)
        assert any(i.category == "invalid_start" for i in result.all_issues)
        assert "V1" in result.invalid_start_or_end_vehicle_ids

    def test_route_wrong_end_detected(self) -> None:
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
                    fullPathNodeIds=["n_0_0", "n_1_0"],
                    fullPathEdgeIds=["e_0_0_to_1_0"],
                    startNodeId="n_0_0",
                    endNodeId="n_1_0",
                ),
            ],
            mode=RoutingMode.INITIAL,
        )
        result = validate_route_plan(scenario, route_plan)
        assert any(i.category == "invalid_end" for i in result.all_issues)
        assert "V1" in result.invalid_start_or_end_vehicle_ids

    def test_reroute_uses_current_vehicle_start(self) -> None:
        scenario = make_test_scenario()
        scenario.vehicles[0].current_node_id = "n_1_0"
        scenario.vehicles[0].used_capacity = 5

        routing_context = RoutingContextSchema(
            mode=RoutingMode.REROUTE,
            depotNodeId="n_0_0",
            startNodeByVehicleId={"V1": "n_1_0"},
            remainingCapacityByVehicleId={"V1": 25},
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
        result = validate_route_plan(scenario, route_plan)
        assert "V1" not in result.invalid_start_or_end_vehicle_ids
        v_result = result.vehicle_results["V1"]
        assert v_result.starts_correctly is True

    def test_reroute_incorrect_current_start_detected(self) -> None:
        scenario = make_test_scenario()
        scenario.vehicles[0].current_node_id = "n_1_0"

        routing_context = RoutingContextSchema(
            mode=RoutingMode.REROUTE,
            depotNodeId="n_0_0",
            startNodeByVehicleId={"V1": "n_1_0"},
            remainingCapacityByVehicleId={"V1": 25},
            lockedCustomerIds=[],
            eligibleCustomerIds=["C01", "C02"],
        )

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
                    fullPathEdgeIds=["e_0_0_to_1_0", "e_0_1_to_0_0"],
                    startNodeId="n_0_0",
                    endNodeId="n_0_0",
                    completedCustomerIds=[],
                    pendingCustomerIds=["C01"],
                    isDynamicReroute=True,
                ),
            ],
            mode=RoutingMode.REROUTE,
            routingContext=routing_context,
        )
        result = validate_route_plan(scenario, route_plan)
        assert any(i.category == "invalid_start" for i in result.all_issues)
        assert "V1" in result.invalid_start_or_end_vehicle_ids

    def test_capacity_violation_detected(self) -> None:
        scenario = make_test_scenario()
        scenario.vehicles[0].capacity = 5

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
            ],
            mode=RoutingMode.INITIAL,
        )
        result = validate_route_plan(scenario, route_plan)
        assert "V1" in result.capacity_violation_vehicle_ids
        assert any(i.category == "capacity_violation" for i in result.all_issues)

    def test_capacity_uses_remaining_capacity_in_reroute_mode(self) -> None:
        scenario = make_test_scenario()
        scenario.vehicles[0].capacity = 30
        scenario.vehicles[0].used_capacity = 20

        routing_context = RoutingContextSchema(
            mode=RoutingMode.REROUTE,
            depotNodeId="n_0_0",
            startNodeByVehicleId={"V1": "n_0_0"},
            remainingCapacityByVehicleId={"V1": 5},
            lockedCustomerIds=[],
            eligibleCustomerIds=["C01"],
        )

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
                    fullPathEdgeIds=["e_0_0_to_1_0", "e_0_1_to_0_0"],
                    startNodeId="n_0_0",
                    endNodeId="n_0_0",
                    completedCustomerIds=[],
                    pendingCustomerIds=["C01"],
                    isDynamicReroute=True,
                ),
            ],
            mode=RoutingMode.REROUTE,
            routingContext=routing_context,
        )
        result = validate_route_plan(scenario, route_plan)
        v_result = result.vehicle_results["V1"]
        assert v_result.computed_remaining_capacity == 0

    def test_blocked_edge_detected(self) -> None:
        scenario = make_test_scenario()
        for edge in scenario.edges:
            if edge.id == "e_0_0_to_1_0":
                edge.is_blocked = True
                break

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
                    fullPathEdgeIds=["e_0_0_to_1_0", "e_0_1_to_0_0"],
                    startNodeId="n_0_0",
                    endNodeId="n_0_0",
                ),
            ],
            mode=RoutingMode.INITIAL,
        )
        result = validate_route_plan(scenario, route_plan)
        assert "e_0_0_to_1_0" in result.blocked_edge_violation_ids
        assert any(i.category == "blocked_edge" for i in result.all_issues)

    def test_unknown_edge_detected(self) -> None:
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
                    fullPathEdgeIds=["e_0_0_to_1_0", "e_unknown_edge"],
                    startNodeId="n_0_0",
                    endNodeId="n_0_0",
                ),
            ],
            mode=RoutingMode.INITIAL,
        )
        result = validate_route_plan(scenario, route_plan)
        assert "e_unknown_edge" in result.vehicle_results["V1"].unknown_edge_ids
        assert any(i.category == "unknown_edge" for i in result.all_issues)
        assert "V1" in result.path_continuity_violation_vehicle_ids

    def test_discontinuous_directed_edge_path_detected(self) -> None:
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
                    fullPathEdgeIds=["e_0_1_to_0_0", "e_0_0_to_1_0"],
                    startNodeId="n_0_0",
                    endNodeId="n_0_0",
                ),
            ],
            mode=RoutingMode.INITIAL,
        )
        result = validate_route_plan(scenario, route_plan)
        assert "V1" in result.path_continuity_violation_vehicle_ids
        assert any(i.category == "continuity_error" for i in result.all_issues)

    def test_edge_node_count_mismatch_detected(self) -> None:
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
                    fullPathEdgeIds=["e_0_0_to_1_0"],
                    startNodeId="n_0_0",
                    endNodeId="n_0_0",
                ),
            ],
            mode=RoutingMode.INITIAL,
        )
        result = validate_route_plan(scenario, route_plan)
        assert "V1" in result.path_continuity_violation_vehicle_ids
        assert any(i.category == "edge_node_count_mismatch" for i in result.all_issues)

    def test_customer_node_absent_from_path_detected(self) -> None:
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
                    fullPathNodeIds=["n_0_0", "n_0_0"],
                    fullPathEdgeIds=["e_0_0_to_0_1", "e_0_1_to_0_0"],
                    startNodeId="n_0_0",
                    endNodeId="n_0_0",
                ),
            ],
            mode=RoutingMode.INITIAL,
        )
        result = validate_route_plan(scenario, route_plan)
        assert "V1" in result.path_continuity_violation_vehicle_ids
        assert any(i.category == "customer_node_absent" for i in result.all_issues)

    def test_empty_customer_route_detected_as_unreachable(self) -> None:
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
                    fullPathNodeIds=[],
                    fullPathEdgeIds=[],
                    startNodeId="n_0_0",
                    endNodeId="n_0_0",
                ),
            ],
            mode=RoutingMode.INITIAL,
        )
        result = validate_route_plan(scenario, route_plan)
        assert "V1" in result.unreachable_vehicle_ids
        assert any(i.category == "unreachable" or i.category == "empty_path_with_customers" for i in result.all_issues)

    def test_locked_customer_excluded_from_reroute_expected_coverage(self) -> None:
        scenario = make_test_scenario()

        routing_context = RoutingContextSchema(
            mode=RoutingMode.REROUTE,
            depotNodeId="n_0_0",
            startNodeByVehicleId={"V1": "n_0_0"},
            remainingCapacityByVehicleId={"V1": 30},
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
                    fullPathNodeIds=["n_0_0", "n_2_0", "n_0_0"],
                    fullPathEdgeIds=["e_0_0_to_1_0", "e_1_0_to_2_0", "e_2_0_to_0_0"],
                    startNodeId="n_0_0",
                    endNodeId="n_0_0",
                    completedCustomerIds=["C01"],
                    pendingCustomerIds=["C02"],
                    isDynamicReroute=True,
                ),
            ],
            mode=RoutingMode.REROUTE,
            routingContext=routing_context,
        )
        result = validate_route_plan(scenario, route_plan)
        assert "C01" not in result.unserved_customer_ids
        assert "C02" not in result.unserved_customer_ids

    def test_route_mode_inconsistency_warning(self) -> None:
        scenario = make_test_scenario()

        routing_context = RoutingContextSchema(
            mode=RoutingMode.REROUTE,
            depotNodeId="n_0_0",
            startNodeByVehicleId={"V1": "n_0_0"},
            remainingCapacityByVehicleId={"V1": 30},
            lockedCustomerIds=[],
            eligibleCustomerIds=["C01", "C02"],
        )

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
                    fullPathEdgeIds=["e_0_0_to_1_0", "e_0_1_to_0_0"],
                    startNodeId="n_0_0",
                    endNodeId="n_0_0",
                    completedCustomerIds=[],
                    pendingCustomerIds=["C01"],
                    isDynamicReroute=False,
                ),
            ],
            mode=RoutingMode.REROUTE,
            routingContext=routing_context,
        )
        result = validate_route_plan(scenario, route_plan)
        assert any("isDynamicReroute is false" in w for w in result.warnings)