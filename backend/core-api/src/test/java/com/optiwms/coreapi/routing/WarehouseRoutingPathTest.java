package com.optiwms.coreapi.routing;

import com.optiwms.coreapi.routing.RoutingModels.GraphEdge;
import com.optiwms.coreapi.routing.RoutingModels.GraphNode;
import com.optiwms.coreapi.routing.RoutingModels.WarehouseGraph;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Two workers should not be sent down the same aisle when a parallel one exists.
 *
 * <p>The graph below is a rectilinear pair of routes from START to END: a 30 m direct aisle and
 * a 50 m detour. Coordinates keep the Manhattan heuristic admissible, so the search is optimal
 * against the costs it is given and these tests measure the costs, not the search.
 */
class WarehouseRoutingPathTest {

    private static final OffsetDateTime T0 = OffsetDateTime.of(
            2026, 8, 19, 9, 0, 0, 0, ZoneOffset.UTC);

    @Test
    void takesTheDirectAisleWhenNobodyElseClaimsIt() {
        List<String> nodes = walk(path(50));
        assertEquals(List.of("START", "A1", "A2", "END"), nodes);
    }

    /**
     * The point of the whole exercise: worker two gets their own aisle, even though the direct
     * one carries no timing conflict at all.
     */
    @Test
    void divertsToTheParallelAisleWhenTheDirectOneIsClaimed() {
        List<String> nodes = walk(path(50, "EDGE:e-start-a1", "EDGE:e-a1-a2", "EDGE:e-a2-end"));
        assertEquals(List.of("START", "B0", "B1", "B2", "B3", "END"), nodes);
    }

    /**
     * A claimed edge is dearer, not forbidden. The staging-to-parking spine every route shares
     * has no alternative at any price, and refusing it would fail the route outright.
     */
    @Test
    void stillTakesAClaimedAisleWhenTheAlternativeCostsTooMuch() {
        // A 90 m detour against a 30 m aisle: past the 1.7x a claimed edge is worth.
        List<String> nodes = walk(path(90, "EDGE:e-start-a1", "EDGE:e-a1-a2", "EDGE:e-a2-end"));
        assertEquals(List.of("START", "A1", "A2", "END"), nodes);
    }

    @Test
    void reportsTheDistanceItActuallyTravelled() {
        var result = path(50, "EDGE:e-start-a1", "EDGE:e-a1-a2", "EDGE:e-a2-end");
        assertEquals(50.0, result.distanceM(), 0.001);
        assertFalse(result.steps().isEmpty());
        // Nothing was blocked in time, so the diversion is a choice about space, not a queue.
        assertEquals(0.0, result.waitSeconds(), 0.001);
    }

    private WarehouseRoutingService.PathResult path(double detourLength, String... claimedEdges) {
        List<WarehouseRoutingService.ReservationWindow> windows = new ArrayList<>();
        for (String edge : claimedEdges) {
            // A window far in the past: it can never block departure, so only the spatial cost
            // of the claim can change the outcome.
            windows.add(new WarehouseRoutingService.ReservationWindow(
                    UUID.randomUUID(), edge, T0.minusHours(2), T0.minusHours(1)));
        }
        return service().timeAwarePath(graph(detourLength), "START", "END", T0, windows, "FORKLIFT");
    }

    private List<String> walk(WarehouseRoutingService.PathResult result) {
        List<String> nodes = new ArrayList<>();
        assertTrue(!result.steps().isEmpty(), "expected a route");
        nodes.add(result.steps().get(0).edge().from());
        result.steps().forEach(step -> nodes.add(step.edge().to()));
        return nodes;
    }

    /** The search is pure: it reads the graph and the windows handed to it, nothing else. */
    private WarehouseRoutingService service() {
        return new WarehouseRoutingService(null, null, null);
    }

    /**
     * START-A1-A2-END is 30 m along y=0. The B detour climbs to y=height, runs across, and comes
     * back down, so its length is 2*height + 30.
     *
     * <p>Every edge length equals the distance between its own endpoints. That consistency is
     * what keeps the Manhattan heuristic admissible; a graph whose edges are shorter than its
     * coordinates imply makes the heuristic overestimate and A* stops at the first route it
     * finds rather than the cheapest.
     */
    private WarehouseRoutingService.GraphData graph(double detourLength) {
        double height = (detourLength - 30) / 2;
        List<GraphNode> nodes = List.of(
                node("START", 0, 0),
                node("A1", 10, 0),
                node("A2", 20, 0),
                node("END", 30, 0),
                node("B0", 0, height),
                node("B1", 10, height),
                node("B2", 20, height),
                node("B3", 30, height));
        List<GraphEdge> edges = List.of(
                edge("e-start-a1", "START", "A1", 10),
                edge("e-a1-a2", "A1", "A2", 10),
                edge("e-a2-end", "A2", "END", 10),
                edge("e-start-b0", "START", "B0", height),
                edge("e-b0-b1", "B0", "B1", 10),
                edge("e-b1-b2", "B1", "B2", 10),
                edge("e-b2-b3", "B2", "B3", 10),
                edge("e-b3-end", "B3", "END", height));

        Map<String, GraphNode> byId = new HashMap<>();
        nodes.forEach(n -> byId.put(n.id(), n));
        Map<String, List<GraphEdge>> adjacency = new HashMap<>();
        edges.forEach(e -> adjacency.computeIfAbsent(e.from(), key -> new ArrayList<>()).add(e));

        WarehouseGraph graph = new WarehouseGraph(
                UUID.randomUUID(), UUID.randomUUID(), "TEST", "TEST", "hash",
                0, nodes, edges, List.of());
        return new WarehouseRoutingService.GraphData(graph, byId, adjacency, Map.of());
    }

    private static GraphNode node(String id, double x, double y) {
        return new GraphNode(id, "FACE", id, x, y, Map.of());
    }

    private static GraphEdge edge(String id, String from, String to, double distance) {
        return new GraphEdge(id, from, to, id, "AISLE", distance, distance / 1.5, 3.0, 1);
    }
}
