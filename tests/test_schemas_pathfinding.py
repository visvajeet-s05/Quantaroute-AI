import pytest

from app.schemas.pathfinding import PathRequest, PathResponse, PathValidationIssueSchema, PathValidationResponse


class TestPathRequest:
    def test_path_request_default_algorithm(self) -> None:
        req = PathRequest(sourceNodeId="n1", destinationNodeId="n2")
        assert req.algorithm == "dijkstra"

    def test_path_request_custom_algorithm(self) -> None:
        req = PathRequest(sourceNodeId="n1", destinationNodeId="n2", algorithm="greedy")
        assert req.algorithm == "greedy"

    def test_path_request_requires_source_and_destination(self) -> None:
        with pytest.raises(ValueError):
            PathRequest(sourceNodeId="", destinationNodeId="n2")
        with pytest.raises(ValueError):
            PathRequest(sourceNodeId="n1", destinationNodeId="")


class TestPathResponse:
    def test_unreachable_path_requires_empty_lists_and_zero_metrics(self) -> None:
        resp = PathResponse(
            sourceNodeId="n1",
            destinationNodeId="n2",
            nodeIds=[],
            edgeIds=[],
            travelMinutes=0,
            distanceKm=0,
            reachable=False,
            visitedNodeCount=0,
        )
        assert resp.reachable is False
        assert resp.node_ids == []
        assert resp.edge_ids == []
        assert resp.travel_minutes == 0
        assert resp.distance_km == 0

    def test_unreachable_path_with_non_empty_nodes_raises(self) -> None:
        with pytest.raises(ValueError, match="Unreachable path must have empty node_ids"):
            PathResponse(
                sourceNodeId="n1",
                destinationNodeId="n2",
                nodeIds=["n1"],
                edgeIds=[],
                travelMinutes=0,
                distanceKm=0,
                reachable=False,
                visitedNodeCount=0,
            )

    def test_unreachable_path_with_non_zero_metrics_raises(self) -> None:
        with pytest.raises(ValueError, match="Unreachable path must have travel_minutes = 0"):
            PathResponse(
                sourceNodeId="n1",
                destinationNodeId="n2",
                nodeIds=[],
                edgeIds=[],
                travelMinutes=5.0,
                distanceKm=0,
                reachable=False,
                visitedNodeCount=0,
            )

    def test_same_node_path_requires_single_node_and_zero_edges(self) -> None:
        resp = PathResponse(
            sourceNodeId="n1",
            destinationNodeId="n1",
            nodeIds=["n1"],
            edgeIds=[],
            travelMinutes=0,
            distanceKm=0,
            reachable=True,
            visitedNodeCount=1,
        )
        assert resp.source_node_id == resp.destination_node_id
        assert len(resp.node_ids) == 1
        assert resp.node_ids[0] == "n1"
        assert resp.edge_ids == []

    def test_same_node_path_with_multiple_nodes_raises(self) -> None:
        with pytest.raises(ValueError, match="Self-loop path must have exactly one node"):
            PathResponse(
                sourceNodeId="n1",
                destinationNodeId="n1",
                nodeIds=["n1", "n2"],
                edgeIds=[],
                travelMinutes=0,
                distanceKm=0,
                reachable=True,
                visitedNodeCount=1,
            )

    def test_same_node_path_with_non_zero_metrics_raises(self) -> None:
        with pytest.raises(ValueError, match="Self-loop path must have travel_minutes = 0"):
            PathResponse(
                sourceNodeId="n1",
                destinationNodeId="n1",
                nodeIds=["n1"],
                edgeIds=[],
                travelMinutes=1.0,
                distanceKm=0,
                reachable=True,
                visitedNodeCount=1,
            )

    def test_reachable_path_requires_min_two_nodes(self) -> None:
        with pytest.raises(ValueError, match="Reachable path must have at least 2 nodes"):
            PathResponse(
                sourceNodeId="n1",
                destinationNodeId="n2",
                nodeIds=["n1"],
                edgeIds=[],
                travelMinutes=5.0,
                distanceKm=2.0,
                reachable=True,
                visitedNodeCount=1,
            )

    def test_reachable_path_edge_count_equals_node_count_minus_one(self) -> None:
        with pytest.raises(ValueError, match="Number of edges must equal number of nodes minus 1"):
            PathResponse(
                sourceNodeId="n1",
                destinationNodeId="n3",
                nodeIds=["n1", "n2", "n3"],
                edgeIds=["e1"],
                travelMinutes=5.0,
                distanceKm=2.0,
                reachable=True,
                visitedNodeCount=3,
            )

    def test_reachable_path_valid_structure(self) -> None:
        resp = PathResponse(
            sourceNodeId="n1",
            destinationNodeId="n3",
            nodeIds=["n1", "n2", "n3"],
            edgeIds=["e1", "e2"],
            travelMinutes=5.0,
            distanceKm=2.0,
            reachable=True,
            visitedNodeCount=5,
        )
        assert resp.reachable is True
        assert len(resp.node_ids) == 3
        assert len(resp.edge_ids) == 2
        assert resp.node_ids[0] == "n1"
        assert resp.node_ids[-1] == "n3"
        assert resp.visited_node_count >= len(resp.node_ids)

    def test_reachable_path_visited_count_below_nodes_raises(self) -> None:
        with pytest.raises(ValueError, match="visited_node_count must be >= number of nodes in path"):
            PathResponse(
                sourceNodeId="n1",
                destinationNodeId="n3",
                nodeIds=["n1", "n2", "n3"],
                edgeIds=["e1", "e2"],
                travelMinutes=5.0,
                distanceKm=2.0,
                reachable=True,
                visitedNodeCount=2,
            )

    def test_reachable_path_wrong_start_node_raises(self) -> None:
        with pytest.raises(ValueError, match="Path must start at source node"):
            PathResponse(
                sourceNodeId="n1",
                destinationNodeId="n3",
                nodeIds=["n2", "n3"],
                edgeIds=["e1"],
                travelMinutes=5.0,
                distanceKm=2.0,
                reachable=True,
                visitedNodeCount=2,
            )

    def test_reachable_path_wrong_end_node_raises(self) -> None:
        with pytest.raises(ValueError, match="Path must end at destination node"):
            PathResponse(
                sourceNodeId="n1",
                destinationNodeId="n3",
                nodeIds=["n1", "n2"],
                edgeIds=["e1"],
                travelMinutes=5.0,
                distanceKm=2.0,
                reachable=True,
                visitedNodeCount=2,
            )


class TestPathValidationIssueSchema:
    def test_path_validation_issue_schema(self) -> None:
        issue = PathValidationIssueSchema(name="Test Check", passed=True, detail="All good")
        assert issue.name == "Test Check"
        assert issue.passed is True
        assert issue.detail == "All good"


class TestPathValidationResponse:
    def test_path_validation_response(self) -> None:
        path_resp = PathResponse(
            sourceNodeId="n1",
            destinationNodeId="n2",
            nodeIds=["n1", "n2"],
            edgeIds=["e1"],
            travelMinutes=2.0,
            distanceKm=1.0,
            reachable=True,
            visitedNodeCount=2,
        )
        resp = PathValidationResponse(
            isValid=True,
            checks=[
                PathValidationIssueSchema(name="Check 1", passed=True, detail="OK"),
                PathValidationIssueSchema(name="Check 2", passed=True, detail="OK"),
            ],
            errors=[],
            pathResponse=path_resp,
        )
        assert resp.is_valid is True
        assert len(resp.checks) == 2
        assert resp.errors == []
        assert resp.path_response is not None
        assert resp.path_response.source_node_id == "n1"