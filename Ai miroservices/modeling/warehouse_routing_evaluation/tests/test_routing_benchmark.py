from pathlib import Path
import sys

import pandas as pd

MODULE = Path(__file__).resolve().parents[1]
ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(MODULE))

from routing_benchmark import (  # noqa: E402
    build_graph,
    count_temporal_conflicts,
    reservation_astar,
    reserve,
    shortest_path,
)

LAYOUT = (
    ROOT
    / "Ai miroservices/modeling/v8_controlled_synthetic_validation/outputs/physical_layout.csv.gz"
)


def graph():
    return build_graph(pd.read_csv(LAYOUT))


def test_graph_collapses_bins_to_floor_rack_bays():
    route_graph = graph()
    assert route_graph.rack_count == 280
    assert len(route_graph.rack_access) == 4_200
    assert len(route_graph.nodes) == 956
    assert route_graph.edge_count == 1_980


def test_astar_preserves_dijkstra_optimal_distance():
    route_graph = graph()
    start = route_graph.stations["STG-01"]
    goals = sorted({nodes[0] for nodes in route_graph.rack_access.values()})
    for goal in goals[::17]:
        dijkstra = shortest_path(route_graph, start, goal, "dijkstra")
        astar = shortest_path(route_graph, start, goal, "astar")
        assert astar.distance_m == dijkstra.distance_m
        assert astar.expanded <= dijkstra.expanded


def test_paths_never_cross_rack_footprints():
    route_graph = graph()
    result = shortest_path(
        route_graph,
        route_graph.stations["PARK-IN"],
        route_graph.rack_access["A-01-01-1-A"][0],
        "astar",
    )
    assert result.nodes
    assert all(
        node.startswith(("AISLE:", "FACE:", "STATION:", "WAIT:", "PARKING:"))
        for node in result.nodes
    )


def test_reservation_astar_prevents_opposite_edge_and_node_conflicts():
    route_graph = graph()
    reservations = {}
    goals = sorted({nodes[0] for nodes in route_graph.rack_access.values()})
    requests = [
        (route_graph.stations["PARK-IN"], goals[index])
        for index in (0, 0, 1, 1, 2, 2, 3, 3)
    ]
    paths = []
    for start, goal in requests:
        result = reservation_astar(route_graph, start, goal, reservations)
        reserve(result, reservations)
        paths.append(result)
    assert count_temporal_conflicts(paths) == 0
    assert any(result.wait_seconds > 0 for result in paths[1:])


def test_benchmark_is_deterministic_in_route_geometry():
    route_graph = graph()
    start = route_graph.stations["PACK-01"]
    goal = route_graph.rack_access[sorted(route_graph.rack_access)[-1]][0]
    first = shortest_path(route_graph, start, goal, "astar")
    second = shortest_path(route_graph, start, goal, "astar")
    assert first.nodes == second.nodes
    assert first.distance_m == second.distance_m
