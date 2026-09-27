from __future__ import annotations

import heapq
import math
from dataclasses import dataclass
from typing import Collection, Sequence


@dataclass(frozen=True, slots=True)
class GraphEdge:
    edge_id: str
    from_node_id: str
    to_node_id: str
    distance_km: float
    base_travel_minutes: float
    congestion_multiplier: float
    is_blocked: bool

    @property
    def effective_travel_minutes(self) -> float:
        return self.base_travel_minutes * self.congestion_multiplier

    @property
    def congestion_penalty(self) -> float:
        return self.base_travel_minutes * max(0.0, self.congestion_multiplier - 1.0)


@dataclass(frozen=True, slots=True)
class DijkstraResult:
    node_ids: list[str]
    edge_ids: list[str]
    travel_minutes: float
    distance_km: float
    congestion_penalty: float
    reachable: bool
    visited_node_count: int


def _build_adjacency(edges: Sequence[GraphEdge]) -> dict[str, list[GraphEdge]]:
    adjacency: dict[str, list[GraphEdge]] = {}
    for edge in edges:
        if edge.is_blocked:
            continue
        if edge.from_node_id not in adjacency:
            adjacency[edge.from_node_id] = []
        adjacency[edge.from_node_id].append(edge)

    for edge_list in adjacency.values():
        edge_list.sort(key=lambda e: (e.edge_id, e.to_node_id))

    return adjacency


def find_shortest_path(
    node_ids: Collection[str],
    edges: Sequence[GraphEdge],
    source_node_id: str,
    destination_node_id: str,
) -> DijkstraResult:
    if source_node_id == destination_node_id:
        return DijkstraResult(
            node_ids=[source_node_id],
            edge_ids=[],
            travel_minutes=0.0,
            distance_km=0.0,
            congestion_penalty=0.0,
            reachable=True,
            visited_node_count=1,
        )

    if source_node_id not in node_ids or destination_node_id not in node_ids:
        return DijkstraResult(
            node_ids=[],
            edge_ids=[],
            travel_minutes=0.0,
            distance_km=0.0,
            congestion_penalty=0.0,
            reachable=False,
            visited_node_count=0,
        )

    adjacency = _build_adjacency(edges)

    dist: dict[str, float] = {nid: math.inf for nid in node_ids}
    dist[source_node_id] = 0.0

    prev_node: dict[str, str] = {}
    prev_edge: dict[str, str] = {}

    visited: set[str] = set()
    heap: list[tuple[float, str]] = [(0.0, source_node_id)]

    while heap:
        current_dist, u = heapq.heappop(heap)

        if u in visited:
            continue
        visited.add(u)

        if u == destination_node_id:
            break

        if current_dist > dist[u]:
            continue

        for edge in adjacency.get(u, []):
            v = edge.to_node_id
            if v in visited:
                continue

            weight = edge.effective_travel_minutes
            new_dist = current_dist + weight

            if new_dist + 1e-12 < dist[v]:
                dist[v] = new_dist
                prev_node[v] = u
                prev_edge[v] = edge.edge_id
                heapq.heappush(heap, (new_dist, v))
            elif math.isclose(new_dist, dist[v], rel_tol=1e-12, abs_tol=1e-12):
                existing_edge_id = prev_edge.get(v)
                if existing_edge_id is not None and edge.edge_id < existing_edge_id:
                    prev_node[v] = u
                    prev_edge[v] = edge.edge_id
                    heapq.heappush(heap, (new_dist, v))
                elif existing_edge_id is None:
                    prev_node[v] = u
                    prev_edge[v] = edge.edge_id
                    heapq.heappush(heap, (new_dist, v))

    if destination_node_id not in prev_node and source_node_id != destination_node_id:
        return DijkstraResult(
            node_ids=[],
            edge_ids=[],
            travel_minutes=0.0,
            distance_km=0.0,
            congestion_penalty=0.0,
            reachable=False,
            visited_node_count=len(visited),
        )

    node_path: list[str] = []
    edge_path: list[str] = []
    curr = destination_node_id
    while curr != source_node_id:
        node_path.append(curr)
        edge_path.append(prev_edge[curr])
        curr = prev_node[curr]
    node_path.append(source_node_id)
    node_path.reverse()
    edge_path.reverse()

    total_travel = 0.0
    total_distance = 0.0
    total_penalty = 0.0
    edge_map = {e.edge_id: e for e in edges if not e.is_blocked}
    for edge_id in edge_path:
        edge = edge_map.get(edge_id)
        if edge is not None:
            total_travel += edge.effective_travel_minutes
            total_distance += edge.distance_km
            total_penalty += edge.congestion_penalty

    return DijkstraResult(
        node_ids=node_path,
        edge_ids=edge_path,
        travel_minutes=total_travel,
        distance_km=total_distance,
        congestion_penalty=total_penalty,
        reachable=True,
        visited_node_count=len(visited),
    )