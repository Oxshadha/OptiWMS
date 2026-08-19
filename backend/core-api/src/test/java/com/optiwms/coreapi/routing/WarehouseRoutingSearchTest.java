package com.optiwms.coreapi.routing;

import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The two pieces of the router that decide whether a second worker gets their own path.
 */
class WarehouseRoutingSearchTest {

    private static final OffsetDateTime T0 = OffsetDateTime.of(
            2026, 8, 19, 9, 0, 0, 0, ZoneOffset.UTC);

    /**
     * The bug that made conflict avoidance unreachable: a costlier state that arrives earlier is
     * the one that clears a reservation window, and keying the search on node alone threw it away.
     */
    @Test
    void keepsACostlierStateThatArrivesEarlier() {
        Map<String, List<WarehouseRoutingService.Frontier>> frontier = new HashMap<>();

        assertTrue(WarehouseRoutingService.admit(frontier, "A", 10.0, T0.plusSeconds(60)));
        assertTrue(WarehouseRoutingService.admit(frontier, "A", 25.0, T0.plusSeconds(20)));

        assertEquals(2, frontier.get("A").size());
    }

    @Test
    void discardsAStateThatIsWorseOnBothCostAndArrival() {
        Map<String, List<WarehouseRoutingService.Frontier>> frontier = new HashMap<>();

        assertTrue(WarehouseRoutingService.admit(frontier, "A", 10.0, T0.plusSeconds(20)));

        assertFalse(WarehouseRoutingService.admit(frontier, "A", 12.0, T0.plusSeconds(30)));
        assertTrue(WarehouseRoutingService.isDominated(frontier, "A", 12.0, T0.plusSeconds(30)));
        assertEquals(1, frontier.get("A").size());
    }

    /** A state better on both axes evicts the one it supersedes rather than piling up beside it. */
    @Test
    void supersedesAStateItBeatsOnBothAxes() {
        Map<String, List<WarehouseRoutingService.Frontier>> frontier = new HashMap<>();

        assertTrue(WarehouseRoutingService.admit(frontier, "A", 30.0, T0.plusSeconds(90)));
        assertTrue(WarehouseRoutingService.admit(frontier, "A", 10.0, T0.plusSeconds(20)));

        List<WarehouseRoutingService.Frontier> kept = new ArrayList<>(frontier.get("A"));
        assertEquals(1, kept.size());
        assertEquals(10.0, kept.get(0).cost());
    }

    /**
     * The distinction the search turns on, pinned so it cannot be collapsed again.
     *
     * A state is always dominated by its own frontier entry, so testing dominance when a state
     * is popped discards it immediately and the search abandons every route -- no path for
     * anyone, not merely a worse one. What the pop needs to ask is whether the state is still
     * on the frontier at all.
     */
    @Test
    void aFreshlyAdmittedStateIsNotSupersededEvenThoughItDominatesItself() {
        Map<String, List<WarehouseRoutingService.Frontier>> frontier = new HashMap<>();
        WarehouseRoutingService.admit(frontier, "A", 10.0, T0.plusSeconds(20));

        assertTrue(WarehouseRoutingService.isDominated(frontier, "A", 10.0, T0.plusSeconds(20)));
        assertFalse(WarehouseRoutingService.isSuperseded(frontier, "A", 10.0, T0.plusSeconds(20)));
    }

    /** Once a strictly better state evicts it, the stale one is skipped on pop. */
    @Test
    void anEvictedStateIsSuperseded() {
        Map<String, List<WarehouseRoutingService.Frontier>> frontier = new HashMap<>();
        WarehouseRoutingService.admit(frontier, "A", 30.0, T0.plusSeconds(90));
        WarehouseRoutingService.admit(frontier, "A", 10.0, T0.plusSeconds(20));

        assertTrue(WarehouseRoutingService.isSuperseded(frontier, "A", 30.0, T0.plusSeconds(90)));
        assertFalse(WarehouseRoutingService.isSuperseded(frontier, "A", 10.0, T0.plusSeconds(20)));
    }

    @Test
    void chargesTheMostForAFaceAnotherWorkerIsBoundFor() {
        Set<String> claimedNodes = Set.of("FACE:R-A-02:WEST");
        Set<String> claimedRacks = Set.of("FACE:R-A-02");

        // The exact face another worker is heading to.
        assertEquals(40.0, WarehouseRoutingService.congestionPenaltyM(
                "FACE:R-A-02:WEST", claimedNodes, claimedRacks));
        // The far side of the same rack: same aisle, so still penalised, but less.
        assertEquals(15.0, WarehouseRoutingService.congestionPenaltyM(
                "FACE:R-A-02:EAST", claimedNodes, claimedRacks));
        // A different rack entirely is free.
        assertEquals(0.0, WarehouseRoutingService.congestionPenaltyM(
                "FACE:R-A-07:WEST", claimedNodes, claimedRacks));
    }

    @Test
    void treatsBothFacesOfARackAsOneAisle() {
        assertEquals("FACE:R-A-02", WarehouseRoutingService.rackOfAccessNode("FACE:R-A-02:WEST"));
        assertEquals("FACE:R-A-02", WarehouseRoutingService.rackOfAccessNode("FACE:R-A-02:EAST"));
        assertNull(WarehouseRoutingService.rackOfAccessNode(null));
        assertNull(WarehouseRoutingService.rackOfAccessNode("STATION"));
    }
}
