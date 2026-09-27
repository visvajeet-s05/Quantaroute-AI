import pytest

from app.algorithms.dijkstra import DijkstraResult, GraphEdge, find_shortest_path


def make_edge(
    edge_id: str,
    from_node: str,
    to_node: str,
    distance_km: float = 1.0,
    base_travel_minutes: float = 2.0,
    congestion_multiplier: float = 1.0,
    is_blocked: bool = False,
) -> GraphEdge:
    return GraphEdge(
        edge_id=edge_id,
        from_node_id=from_node,
        to_node_id=to_node,
        distance_km=distance_km,
        base_travel_minutes=base_travel_minutes,
        congestion_multiplier=congestion_multiplier,
        is_blocked=is_blocked,
    )


class TestSourceEqualsDestination:
    def test_single_node(self) -> None:
        result = find_shortest_path(
            node_ids={"n1"},
            edges=[],
            source_node_id="n1",
            destination_node_id="n1",
        )
        assert result.reachable is True
        assert result.node_ids == ["n1"]
        assert result.edge_ids == []
        assert result.travel_minutes == 0.0
        assert result.distance_km == 0.0
        assert result.congestion_penalty == 0.0
        assert result.visited_node_count == 1

    def test_multi_node_graph_same_source_dest(self) -> None:
        edges = [
            make_edge("e1", "n1", "n2"),
            make_edge("e2", "n2", "n1"),
        ]
        result = find_shortest_path(
            node_ids={"n1", "n2"},
            edges=edges,
            source_node_id="n1",
            destination_node_id="n1",
        )
        assert result.reachable is True
        assert result.node_ids == ["n1"]
        assert result.edge_ids == []
        assert result.travel_minutes == 0.0
        assert result.distance_km == 0.0
        assert result.congestion_penalty == 0.0
        assert result.visited_node_count == 1


class TestNormalDirectedRoute:
    def test_simple_two_node_path(self) -> None:
        edges = [
            make_edge("e1", "n1", "n2", base_travel_minutes=2.0),
        ]
        result = find_shortest_path(
            node_ids={"n1", "n2"},
            edges=edges,
            source_node_id="n1",
            destination_node_id="n2",
        )
        assert result.reachable is True
        assert result.node_ids == ["n1", "n2"]
        assert result.edge_ids == ["e1"]
        assert result.travel_minutes == 2.0
        assert result.distance_km == 1.0
        assert result.congestion_penalty == 0.0
        assert result.visited_node_count == 2

    def test_three_node_path(self) -> None:
        edges = [
            make_edge("e1", "n1", "n2", base_travel_minutes=2.0),
            make_edge("e2", "n2", "n3", base_travel_minutes=3.0),
        ]
        result = find_shortest_path(
            node_ids={"n1", "n2", "n3"},
            edges=edges,
            source_node_id="n1",
            destination_node_id="n3",
        )
        assert result.reachable is True
        assert result.node_ids == ["n1", "n2", "n3"]
        assert result.edge_ids == ["e1", "e2"]
        assert result.travel_minutes == 5.0
        assert result.distance_km == 2.0
        assert result.visited_node_count == 3


class TestDirectedEdgeEnforcement:
    def test_reverse_only_edge_unreachable(self) -> None:
        edges = [
            make_edge("e1", "n2", "n1"),
        ]
        result = find_shortest_path(
            node_ids={"n1", "n2"},
            edges=edges,
            source_node_id="n1",
            destination_node_id="n2",
        )
        assert result.reachable is False
        assert result.node_ids == []
        assert result.edge_ids == []
        assert result.travel_minutes == 0.0
        assert result.visited_node_count == 1

    def test_bidirectional_edges_work(self) -> None:
        edges = [
            make_edge("e1", "n1", "n2"),
            make_edge("e2", "n2", "n1"),
        ]
        result = find_shortest_path(
            node_ids={"n1", "n2"},
            edges=edges,
            source_node_id="n1",
            destination_node_id="n2",
        )
        assert result.reachable is True
        assert result.edge_ids == ["e1"]


class TestBlockedEdgeAvoidance:
    def test_direct_edge_blocked_detour_exists(self) -> None:
        edges = [
            make_edge("e_direct", "n1", "n3", is_blocked=True),
            make_edge("e1", "n1", "n2"),
            make_edge("e2", "n2", "n3"),
        ]
        result = find_shortest_path(
            node_ids={"n1", "n2", "n3"},
            edges=edges,
            source_node_id="n1",
            destination_node_id="n3",
        )
        assert result.reachable is True
        assert result.edge_ids == ["e1", "e2"]
        assert "e_direct" not in result.edge_ids

    def test_all_paths_blocked_unreachable(self) -> None:
        edges = [
            make_edge("e1", "n1", "n2", is_blocked=True),
            make_edge("e2", "n2", "n3", is_blocked=True),
        ]
        result = find_shortest_path(
            node_ids={"n1", "n2", "n3"},
            edges=edges,
            source_node_id="n1",
            destination_node_id="n3",
        )
        assert result.reachable is False
        assert result.visited_node_count == 1


class TestCongestionAwareSelection:
    def test_congestion_changes_route(self) -> None:
        edges = [
            make_edge("e_direct", "n1", "n3", base_travel_minutes=5.0, congestion_multiplier=3.0),
            make_edge("e1", "n1", "n2", base_travel_minutes=2.0, congestion_multiplier=1.0),
            make_edge("e2", "n2", "n3", base_travel_minutes=2.0, congestion_multiplier=1.0),
        ]
        result = find_shortest_path(
            node_ids={"n1", "n2", "n3"},
            edges=edges,
            source_node_id="n1",
            destination_node_id="n3",
        )
        assert result.reachable is True
        assert result.edge_ids == ["e1", "e2"]
        assert result.travel_minutes == 4.0
        assert result.distance_km == 2.0

    def test_distance_greater_but_time_lower(self) -> None:
        edges = [
            make_edge("e_short", "n1", "n3", distance_km=1.0, base_travel_minutes=1.0, congestion_multiplier=5.0),
            make_edge("e1", "n1", "n2", distance_km=2.0, base_travel_minutes=1.0, congestion_multiplier=1.0),
            make_edge("e2", "n2", "n3", distance_km=2.0, base_travel_minutes=1.0, congestion_multiplier=1.0),
        ]
        result = find_shortest_path(
            node_ids={"n1", "n2", "n3"},
            edges=edges,
            source_node_id="n1",
            destination_node_id="n3",
        )
        assert result.reachable is True
        assert result.edge_ids == ["e1", "e2"]
        assert result.distance_km == 4.0
        assert result.travel_minutes == 2.0
        assert result.congestion_penalty == 0.0


class TestUnreachableDestination:
    def test_isolated_destination(self) -> None:
        edges = [
            make_edge("e1", "n1", "n2"),
        ]
        result = find_shortest_path(
            node_ids={"n1", "n2", "n3"},
            edges=edges,
            source_node_id="n1",
            destination_node_id="n3",
        )
        assert result.reachable is False
        assert result.node_ids == []
        assert result.edge_ids == []
        assert result.travel_minutes == 0.0
        assert result.visited_node_count == 2

    def test_source_not_in_graph(self) -> None:
        edges = [make_edge("e1", "n1", "n2")]
        result = find_shortest_path(
            node_ids={"n1", "n2"},
            edges=edges,
            source_node_id="n99",
            destination_node_id="n2",
        )
        assert result.reachable is False
        assert result.visited_node_count == 0


class TestTieBreaking:
    def test_lexicographically_smaller_edge_id_wins(self) -> None:
        edges = [
            make_edge("e_a", "n1", "n2", base_travel_minutes=2.0),
            make_edge("e_b", "n1", "n3", base_travel_minutes=2.0),
            make_edge("e_c", "n2", "n4", base_travel_minutes=2.0),
            make_edge("e_d", "n3", "n4", base_travel_minutes=2.0),
        ]
        result = find_shortest_path(
            node_ids={"n1", "n2", "n3", "n4"},
            edges=edges,
            source_node_id="n1",
            destination_node_id="n4",
        )
        assert result.reachable is True
        assert result.edge_ids[0] == "e_a"

    def test_equal_cost_same_first_edge_different_second(self) -> None:
        edges = [
            make_edge("e1", "n1", "n2", base_travel_minutes=2.0),
            make_edge("e2_a", "n2", "n4", base_travel_minutes=2.0),
            make_edge("e2_b", "n2", "n4", base_travel_minutes=2.0),
        ]
        result = find_shortest_path(
            node_ids={"n1", "n2", "n4"},
            edges=edges,
            source_node_id="n1",
            destination_node_id="n4",
        )
        assert result.reachable is True
        assert result.edge_ids == ["e1", "e2_a"]


class TestStaleQueueHandling:
    def test_stale_entry_ignored(self) -> None:
        edges = [
            make_edge("e1", "n1", "n2", base_travel_minutes=10.0),
            make_edge("e2", "n1", "n3", base_travel_minutes=1.0),
            make_edge("e3", "n3", "n2", base_travel_minutes=1.0),
        ]
        result = find_shortest_path(
            node_ids={"n1", "n2", "n3"},
            edges=edges,
            source_node_id="n1",
            destination_node_id="n2",
        )
        assert result.reachable is True
        assert result.edge_ids == ["e2", "e3"]
        assert result.travel_minutes == 2.0


class TestCongestionPenaltyCalculation:
    def test_congestion_penalty_accumulated(self) -> None:
        edges = [
            make_edge("e1", "n1", "n2", base_travel_minutes=2.0, congestion_multiplier=2.0),
            make_edge("e2", "n2", "n3", base_travel_minutes=3.0, congestion_multiplier=1.5),
        ]
        result = find_shortest_path(
            node_ids={"n1", "n2", "n3"},
            edges=edges,
            source_node_id="n1",
            destination_node_id="n3",
        )
        assert result.reachable is True
        assert result.congestion_penalty == 2.0 * (2.0 - 1.0) + 3.0 * (1.5 - 1.0)

    def test_no_congestion_zero_penalty(self) -> None:
        edges = [
            make_edge("e1", "n1", "n2", base_travel_minutes=2.0, congestion_multiplier=1.0),
        ]
        result = find_shortest_path(
            node_ids={"n1", "n2"},
            edges=edges,
            source_node_id="n1",
            destination_node_id="n2",
        )
        assert result.congestion_penalty == 0.0