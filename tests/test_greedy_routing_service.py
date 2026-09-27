import copy
import pytest

from app.schemas.common import AlgorithmName
from app.schemas.optimization import (
    OptimizationPreset,
    OptimizationRequest,
)
from app.schemas.routing import (
    EvaluateRequest,
    RoutingMode,
)
from app.schemas.scenario import ScenarioSchema
from app.services.greedy_routing_service import (
    UnsupportedOptimizationError,
    optimize_greedy,
)
from app.services.route_plan_evaluator import evaluate_route_plan


def make_grid_scenario(**overrides) -> ScenarioSchema:
    data = {
        "id": "scenario_test_grid",
        "name": "Test Grid Scenario",
        "seed": 42,
        "depotNodeId": "n_0_0",
        "nodes": [
            {"id": "n_0_0", "x": 0.0, "y": 0.0, "kind": "depot"},
            {"id": "n_1_0", "x": 1.0, "y": 0.0, "kind": "customer"},
            {"id": "n_2_0", "x": 2.0, "y": 0.0, "kind": "customer"},
            {"id": "n_0_1", "x": 0.0, "y": 1.0, "kind": "intersection"},
            {"id": "n_1_1", "x": 1.0, "y": 1.0, "kind": "intersection"},
        ],
        "edges": [
            {"id": "e_00_10", "from": "n_0_0", "to": "n_1_0", "distanceKm": 1.0, "baseTravelMinutes": 2.0, "congestionMultiplier": 1.0, "isBlocked": False},
            {"id": "e_10_00", "from": "n_1_0", "to": "n_0_0", "distanceKm": 1.0, "baseTravelMinutes": 2.0, "congestionMultiplier": 1.0, "isBlocked": False},
            {"id": "e_10_20", "from": "n_1_0", "to": "n_2_0", "distanceKm": 1.0, "baseTravelMinutes": 2.0, "congestionMultiplier": 1.0, "isBlocked": False},
            {"id": "e_20_10", "from": "n_2_0", "to": "n_1_0", "distanceKm": 1.0, "baseTravelMinutes": 2.0, "congestionMultiplier": 1.0, "isBlocked": False},
            {"id": "e_20_00", "from": "n_2_0", "to": "n_0_0", "distanceKm": 2.0, "baseTravelMinutes": 4.0, "congestionMultiplier": 1.0, "isBlocked": False},
            {"id": "e_00_01", "from": "n_0_0", "to": "n_0_1", "distanceKm": 1.0, "baseTravelMinutes": 2.0, "congestionMultiplier": 1.0, "isBlocked": False},
            {"id": "e_01_00", "from": "n_0_1", "to": "n_0_0", "distanceKm": 1.0, "baseTravelMinutes": 2.0, "congestionMultiplier": 1.0, "isBlocked": False},
            {"id": "e_01_11", "from": "n_0_1", "to": "n_1_1", "distanceKm": 1.0, "baseTravelMinutes": 2.0, "congestionMultiplier": 1.0, "isBlocked": False},
            {"id": "e_11_01", "from": "n_1_1", "to": "n_0_1", "distanceKm": 1.0, "baseTravelMinutes": 2.0, "congestionMultiplier": 1.0, "isBlocked": False},
            {"id": "e_11_10", "from": "n_1_1", "to": "n_1_0", "distanceKm": 1.0, "baseTravelMinutes": 2.0, "congestionMultiplier": 1.0, "isBlocked": False},
            {"id": "e_10_11", "from": "n_1_0", "to": "n_1_1", "distanceKm": 1.0, "baseTravelMinutes": 2.0, "congestionMultiplier": 1.0, "isBlocked": False},
        ],
        "customers": [
            {"id": "C01", "nodeId": "n_1_0", "demand": 5, "status": "pending"},
            {"id": "C02", "nodeId": "n_2_0", "demand": 4, "status": "pending"},
        ],
        "vehicles": [
            {
                "id": "V1",
                "label": "Vehicle V1",
                "capacity": 10,
                "usedCapacity": 0,
                "currentNodeId": "n_0_0",
                "assignedCustomerIds": [],
                "completedCustomerIds": [],
                "color": "#2563eb",
                "status": "awaiting_optimization",
            }
        ],
        "incidents": [],
    }
    data.update(overrides)
    return ScenarioSchema.model_validate(data)


def test_1_single_vehicle_one_customer():
    scenario = make_grid_scenario(
        customers=[{"id": "C01", "nodeId": "n_1_0", "demand": 5, "status": "pending"}]
    )
    req = OptimizationRequest(scenario=scenario, algorithm=AlgorithmName.greedy)
    res = optimize_greedy(req)

    assert len(res.route_plan.vehicle_routes) == 1
    v_route = res.route_plan.vehicle_routes[0]
    assert v_route.customer_ids == ["C01"]
    assert v_route.full_path_node_ids == ["n_0_0", "n_1_0", "n_0_0"]
    assert v_route.full_path_edge_ids == ["e_00_10", "e_10_00"]
    assert res.evaluation.validation.valid is True
    assert res.evaluation.customers_assigned == 1
    assert res.evaluation.customers_unserved == 0


def test_2_multiple_customers_nearest_traffic_time_first():
    # C02 is at n_2_0 (takes longer from depot than n_1_0)
    # Even if C02 has lower ID, C01 at n_1_0 is nearer by travelMinutes (2.0 vs 3.0+)
    scenario = make_grid_scenario(
        customers=[
            {"id": "C02", "nodeId": "n_2_0", "demand": 3, "status": "pending"},
            {"id": "C01", "nodeId": "n_1_0", "demand": 3, "status": "pending"},
        ]
    )
    req = OptimizationRequest(scenario=scenario, algorithm=AlgorithmName.greedy)
    res = optimize_greedy(req)

    v_route = res.route_plan.vehicle_routes[0]
    # C01 should be chosen first because travelMinutes is lower (2.0 vs 4.0 via 1_0 or direct)
    assert v_route.customer_ids[0] == "C01"
    assert v_route.customer_ids[1] == "C02"


def test_3_capacity_limit_exceeding_customer_unserved():
    # Vehicle capacity is 10. C01 demand=6, C02 demand=5 -> total 11 > 10.
    scenario = make_grid_scenario(
        customers=[
            {"id": "C01", "nodeId": "n_1_0", "demand": 6, "status": "pending"},
            {"id": "C02", "nodeId": "n_2_0", "demand": 5, "status": "pending"},
        ]
    )
    req = OptimizationRequest(scenario=scenario, algorithm=AlgorithmName.greedy)
    res = optimize_greedy(req)

    v_route = res.route_plan.vehicle_routes[0]
    assert v_route.customer_ids == ["C01"]
    assert res.evaluation.customers_assigned == 1
    assert res.evaluation.customers_unserved == 1
    assert res.evaluation.unserved_customer_ids == ["C02"]
    # Feasibility is false because unserved customer penalty is applied
    assert res.evaluation.validation.valid is False


def test_4_multiple_vehicles_assignments_spread_after_capacity_filled():
    # V1 cap=6, V2 cap=6. C01 demand=5, C02 demand=5.
    scenario = make_grid_scenario(
        vehicles=[
            {"id": "V1", "label": "V1", "capacity": 6, "usedCapacity": 0, "currentNodeId": "n_0_0", "assignedCustomerIds": [], "completedCustomerIds": [], "color": "#1", "status": "awaiting_optimization"},
            {"id": "V2", "label": "V2", "capacity": 6, "usedCapacity": 0, "currentNodeId": "n_0_0", "assignedCustomerIds": [], "completedCustomerIds": [], "color": "#2", "status": "awaiting_optimization"},
        ],
        customers=[
            {"id": "C01", "nodeId": "n_1_0", "demand": 5, "status": "pending"},
            {"id": "C02", "nodeId": "n_2_0", "demand": 5, "status": "pending"},
        ],
    )
    req = OptimizationRequest(scenario=scenario, algorithm=AlgorithmName.greedy)
    res = optimize_greedy(req)

    v1_route = res.route_plan.vehicle_routes[0]
    v2_route = res.route_plan.vehicle_routes[1]
    assert v1_route.customer_ids == ["C01"]
    assert v2_route.customer_ids == ["C02"]
    assert res.evaluation.customers_assigned == 2
    assert res.evaluation.customers_unserved == 0
    assert res.evaluation.validation.valid is True


def test_5_blocked_direct_edge_detour_chosen():
    # Block e_00_10 directly to n_1_0; route must detour via n_0_1 -> n_1_1 -> n_1_0
    scenario = make_grid_scenario(
        customers=[{"id": "C01", "nodeId": "n_1_0", "demand": 2, "status": "pending"}]
    )
    for edge in scenario.edges:
        if edge.id == "e_00_10":
            edge.is_blocked = True

    req = OptimizationRequest(scenario=scenario, algorithm=AlgorithmName.greedy)
    res = optimize_greedy(req)

    v_route = res.route_plan.vehicle_routes[0]
    assert v_route.customer_ids == ["C01"]
    # Path should detour via n_0_1, n_1_1 to reach n_1_0
    assert "e_00_10" not in v_route.full_path_edge_ids
    assert "n_0_1" in v_route.full_path_node_ids
    assert "n_1_1" in v_route.full_path_node_ids
    assert res.evaluation.validation.no_blocked_edges_used is True


def test_6_unreachable_customer_remains_unserved():
    # Customer at isolated node with no incoming edges
    scenario = make_grid_scenario(
        nodes=[
            {"id": "n_0_0", "x": 0.0, "y": 0.0, "kind": "depot"},
            {"id": "n_isolated", "x": 9.0, "y": 9.0, "kind": "customer"},
        ],
        edges=[],
        customers=[{"id": "C_iso", "nodeId": "n_isolated", "demand": 1, "status": "pending"}],
    )
    req = OptimizationRequest(scenario=scenario, algorithm=AlgorithmName.greedy)
    res = optimize_greedy(req)

    v_route = res.route_plan.vehicle_routes[0]
    assert v_route.customer_ids == []
    assert res.evaluation.unserved_customer_ids == ["C_iso"]
    assert res.evaluation.customers_unserved == 1


def test_7_directed_return_unreachable_marked_infeasible():
    # Customer reachable outbound, but no edges go back to depot
    scenario = make_grid_scenario(
        nodes=[
            {"id": "n_0_0", "x": 0.0, "y": 0.0, "kind": "depot"},
            {"id": "n_1_0", "x": 1.0, "y": 0.0, "kind": "customer"},
        ],
        edges=[
            {"id": "e_out", "from": "n_0_0", "to": "n_1_0", "distanceKm": 1.0, "baseTravelMinutes": 2.0, "congestionMultiplier": 1.0, "isBlocked": False},
        ],
        customers=[{"id": "C01", "nodeId": "n_1_0", "demand": 2, "status": "pending"}],
    )
    req = OptimizationRequest(scenario=scenario, algorithm=AlgorithmName.greedy)
    res = optimize_greedy(req)

    v_route = res.route_plan.vehicle_routes[0]
    assert v_route.customer_ids == ["C01"]
    # Path ends at n_1_0 since return is unreachable
    assert v_route.full_path_node_ids[-1] == "n_1_0"
    # Evaluator marks end failure / valid is False
    assert res.evaluation.validation.valid is False
    assert res.evaluation.validation.all_routes_end_at_depot is False


def test_8_determinism_identical_runs():
    scenario = make_grid_scenario()
    req1 = OptimizationRequest(scenario=scenario, algorithm=AlgorithmName.greedy, optimizerSeed=123)
    req2 = OptimizationRequest(scenario=scenario, algorithm=AlgorithmName.greedy, optimizerSeed=123)

    res1 = optimize_greedy(req1)
    res2 = optimize_greedy(req2)

    assert res1.route_plan.model_dump(exclude={"runtimeMs"}) == res2.route_plan.model_dump(exclude={"runtimeMs"})
    assert res1.evaluation.total_travel_minutes == res2.evaluation.total_travel_minutes
    assert res1.evaluation.routing_score == res2.evaluation.routing_score


def test_9_vehicle_processing_order_is_lexicographic():
    # Vehicles passed out of order: V2, V1. Processing should be V1 then V2.
    scenario = make_grid_scenario(
        vehicles=[
            {"id": "V2", "label": "V2", "capacity": 5, "usedCapacity": 0, "currentNodeId": "n_0_0", "assignedCustomerIds": [], "completedCustomerIds": [], "color": "#2", "status": "awaiting_optimization"},
            {"id": "V1", "label": "V1", "capacity": 5, "usedCapacity": 0, "currentNodeId": "n_0_0", "assignedCustomerIds": [], "completedCustomerIds": [], "color": "#1", "status": "awaiting_optimization"},
        ],
        customers=[
            {"id": "C01", "nodeId": "n_1_0", "demand": 4, "status": "pending"},
        ],
    )
    req = OptimizationRequest(scenario=scenario, algorithm=AlgorithmName.greedy)
    res = optimize_greedy(req)

    assert res.route_plan.vehicle_routes[0].vehicle_id == "V1"
    assert res.route_plan.vehicle_routes[1].vehicle_id == "V2"
    # V1 was processed first and got C01
    assert res.route_plan.vehicle_routes[0].customer_ids == ["C01"]
    assert res.route_plan.vehicle_routes[1].customer_ids == []


def test_10_customer_tie_breaker_customer_id():
    # Two customers at the same node n_1_0 with identical demands and travel times
    scenario = make_grid_scenario(
        customers=[
            {"id": "C09", "nodeId": "n_1_0", "demand": 2, "status": "pending"},
            {"id": "C02", "nodeId": "n_1_0", "demand": 2, "status": "pending"},
        ]
    )
    req = OptimizationRequest(scenario=scenario, algorithm=AlgorithmName.greedy)
    res = optimize_greedy(req)

    v_route = res.route_plan.vehicle_routes[0]
    # C02 is lexicographically before C09
    assert v_route.customer_ids == ["C02", "C09"]


def test_11_secondary_tie_breaker_customer_node_id():
    # When travel times are equal and customer IDs compare, secondary uses nodeId
    # Let two customers be at different equidistant nodes n_1_0 and n_0_1 (both 2.0 min)
    scenario = make_grid_scenario(
        customers=[
            {"id": "C_B", "nodeId": "n_1_0", "demand": 2, "status": "pending"},
            {"id": "C_A", "nodeId": "n_0_1", "demand": 2, "status": "pending"},
        ]
    )
    req = OptimizationRequest(scenario=scenario, algorithm=AlgorithmName.greedy)
    res = optimize_greedy(req)

    v_route = res.route_plan.vehicle_routes[0]
    assert v_route.customer_ids[0] == "C_A"


def test_12_empty_inactive_vehicle_route_valid():
    # Vehicle without assigned customers
    scenario = make_grid_scenario(
        vehicles=[
            {"id": "V1", "label": "V1", "capacity": 10, "usedCapacity": 0, "currentNodeId": "n_0_0", "assignedCustomerIds": [], "completedCustomerIds": [], "color": "#1", "status": "awaiting_optimization"},
            {"id": "V2", "label": "V2", "capacity": 10, "usedCapacity": 0, "currentNodeId": "n_0_0", "assignedCustomerIds": [], "completedCustomerIds": [], "color": "#2", "status": "awaiting_optimization"},
        ],
        customers=[{"id": "C01", "nodeId": "n_1_0", "demand": 2, "status": "pending"}],
    )
    req = OptimizationRequest(scenario=scenario, algorithm=AlgorithmName.greedy)
    res = optimize_greedy(req)

    v2_route = res.route_plan.vehicle_routes[1]
    assert v2_route.customer_ids == []
    assert v2_route.full_path_node_ids == []
    assert v2_route.full_path_edge_ids == []
    assert v2_route.start_node_id == "n_0_0"
    assert v2_route.end_node_id == "n_0_0"
    # Empty vehicle route should be valid
    assert res.evaluation.validation.valid is True


def test_13_scenario_object_unchanged_after_optimization():
    scenario = make_grid_scenario()
    original_dict = copy.deepcopy(scenario.model_dump())

    req = OptimizationRequest(scenario=scenario, algorithm=AlgorithmName.greedy)
    _ = optimize_greedy(req)

    assert scenario.model_dump() == original_dict


def test_14_no_customer_duplicated_across_routes():
    scenario = make_grid_scenario(
        vehicles=[
            {"id": "V1", "label": "V1", "capacity": 10, "usedCapacity": 0, "currentNodeId": "n_0_0", "assignedCustomerIds": [], "completedCustomerIds": [], "color": "#1", "status": "awaiting_optimization"},
            {"id": "V2", "label": "V2", "capacity": 10, "usedCapacity": 0, "currentNodeId": "n_0_0", "assignedCustomerIds": [], "completedCustomerIds": [], "color": "#2", "status": "awaiting_optimization"},
        ],
    )
    req = OptimizationRequest(scenario=scenario, algorithm=AlgorithmName.greedy)
    res = optimize_greedy(req)

    all_assigned = []
    for r in res.route_plan.vehicle_routes:
        all_assigned.extend(r.customer_ids)

    assert len(all_assigned) == len(set(all_assigned))
    assert res.evaluation.duplicate_customer_ids == []


def test_15_every_constructed_leg_has_directed_continuity():
    scenario = make_grid_scenario()
    req = OptimizationRequest(scenario=scenario, algorithm=AlgorithmName.greedy)
    res = optimize_greedy(req)

    edge_map = {e.id: e for e in scenario.edges}
    for r in res.route_plan.vehicle_routes:
        if not r.full_path_node_ids:
            continue
        assert len(r.full_path_edge_ids) == len(r.full_path_node_ids) - 1
        for i, edge_id in enumerate(r.full_path_edge_ids):
            edge = edge_map[edge_id]
            assert edge.from_ == r.full_path_node_ids[i]
            assert edge.to == r.full_path_node_ids[i + 1]


def test_16_all_constructed_paths_avoid_blocked_edges():
    scenario = make_grid_scenario()
    req = OptimizationRequest(scenario=scenario, algorithm=AlgorithmName.greedy)
    res = optimize_greedy(req)

    blocked_edge_ids = {e.id for e in scenario.edges if e.is_blocked}
    for r in res.route_plan.vehicle_routes:
        for edge_id in r.full_path_edge_ids:
            assert edge_id not in blocked_edge_ids


def test_17_evaluation_comes_from_shared_evaluator():
    scenario = make_grid_scenario()
    req = OptimizationRequest(scenario=scenario, algorithm=AlgorithmName.greedy)
    res = optimize_greedy(req)

    direct_eval = evaluate_route_plan(EvaluateRequest(scenario=scenario, routePlan=res.route_plan))
    assert res.evaluation.total_travel_minutes == direct_eval.total_travel_minutes
    assert res.evaluation.total_distance_km == direct_eval.total_distance_km
    assert res.evaluation.total_congestion_penalty == direct_eval.total_congestion_penalty
    assert res.evaluation.routing_score == direct_eval.routing_score
    assert res.evaluation.validation.valid == direct_eval.validation.valid


def test_18_optimizer_seed_does_not_alter_greedy_route_plan():
    scenario = make_grid_scenario()
    req1 = OptimizationRequest(scenario=scenario, algorithm=AlgorithmName.greedy, optimizerSeed=111)
    req2 = OptimizationRequest(scenario=scenario, algorithm=AlgorithmName.greedy, optimizerSeed=999)

    res1 = optimize_greedy(req1)
    res2 = optimize_greedy(req2)

    assert res1.route_plan.model_dump() == res2.route_plan.model_dump()
    assert res1.metadata.optimizer_seed == 111
    assert res2.metadata.optimizer_seed == 999


def test_19_all_returned_vehicle_routes_have_correct_start_end_metadata():
    scenario = make_grid_scenario()
    req = OptimizationRequest(scenario=scenario, algorithm=AlgorithmName.greedy)
    res = optimize_greedy(req)

    for r in res.route_plan.vehicle_routes:
        assert r.start_node_id == scenario.depot_node_id
        assert r.end_node_id == scenario.depot_node_id
        assert r.is_dynamic_reroute is False
        assert r.completed_customer_ids == []
        assert r.pending_customer_ids == list(r.customer_ids)


def test_20_no_internal_objective_calculation_duplicated():
    # Calling with invalid algorithm should be rejected by optimize_greedy
    scenario = make_grid_scenario()
    req = OptimizationRequest(scenario=scenario, algorithm=AlgorithmName.pso)
    with pytest.raises(UnsupportedOptimizationError) as exc_info:
        optimize_greedy(req)
    assert exc_info.value.code == "UNSUPPORTED_ALGORITHM"
