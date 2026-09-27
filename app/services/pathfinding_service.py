from __future__ import annotations

from app.algorithms.dijkstra import DijkstraResult, GraphEdge, find_shortest_path
from app.schemas.pathfinding import PathRequest, PathResponse
from app.schemas.scenario import ScenarioSchema


def _convert_edges_to_graph_edges(scenario: ScenarioSchema) -> list[GraphEdge]:
    graph_edges: list[GraphEdge] = []
    for edge in scenario.edges:
        graph_edges.append(
            GraphEdge(
                edge_id=edge.id,
                from_node_id=edge.from_,
                to_node_id=edge.to,
                distance_km=edge.distance_km,
                base_travel_minutes=edge.base_travel_minutes,
                congestion_multiplier=edge.congestion_multiplier,
                is_blocked=edge.is_blocked,
            )
        )
    return graph_edges


def compute_path(
    request: PathRequest,
    scenario: ScenarioSchema,
) -> PathResponse:
    node_ids = [node.id for node in scenario.nodes]
    graph_edges = _convert_edges_to_graph_edges(scenario)

    result: DijkstraResult = find_shortest_path(
        node_ids=node_ids,
        edges=graph_edges,
        source_node_id=request.source_node_id,
        destination_node_id=request.destination_node_id,
    )

    return PathResponse(
        sourceNodeId=request.source_node_id,
        destinationNodeId=request.destination_node_id,
        nodeIds=result.node_ids,
        edgeIds=result.edge_ids,
        travelMinutes=result.travel_minutes,
        distanceKm=result.distance_km,
        congestionPenalty=result.congestion_penalty,
        reachable=result.reachable,
        visitedNodeCount=result.visited_node_count,
    )