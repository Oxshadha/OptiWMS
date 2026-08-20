package com.optiwms.coreapp.slotting;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;

/**
 * Reports how far a slotting optimization has got.
 *
 * The optimize call is synchronous, so the browser cannot learn anything from
 * the request itself until it returns. Progress is published here as the run
 * moves through its phases and read back over a separate polling endpoint,
 * which is what lets the UI show a real percentage rather than an animation.
 *
 * State is in-memory and per-instance: progress is disposable telemetry, not a
 * record worth persisting. An unknown plan simply reports nothing.
 */
@Component
public class SlottingProgressTracker {

    /** Ordered phases with the percentage complete once each phase finishes. */
    public enum Phase {
        LOADING_LOCATIONS("Reading warehouse locations", 10),
        LOADING_DEMAND("Building demand profiles", 25),
        OPTIMIZING_RAW_MATERIAL("Placing raw materials", 45),
        OPTIMIZING_PACKAGING("Placing packaging materials", 60),
        OPTIMIZING_PRODUCT("Placing finished goods", 75),
        SOLVING_MILP("Running the MILP solver", 90),
        PERSISTING("Saving the plan", 97),
        DONE("Complete", 100);

        private final String label;
        private final int percent;

        Phase(String label, int percent) {
            this.label = label;
            this.percent = percent;
        }

        public String label() {
            return label;
        }

        public int percent() {
            return percent;
        }
    }

    public record Progress(int percent, String phase, boolean running, Instant updatedAt) {}

    private final Map<UUID, Progress> progressByPlan = new ConcurrentHashMap<>();

    public void start(UUID planId) {
        progressByPlan.put(planId, new Progress(0, "Starting", true, Instant.now()));
    }

    public void advance(UUID planId, Phase phase) {
        progressByPlan.put(planId,
                new Progress(phase.percent(), phase.label(), phase != Phase.DONE, Instant.now()));
    }

    public void finish(UUID planId) {
        progressByPlan.put(planId, new Progress(100, Phase.DONE.label(), false, Instant.now()));
    }

    /** Marks a failed run so the UI stops polling instead of hanging at the last phase. */
    public void fail(UUID planId, String reason) {
        progressByPlan.put(planId, new Progress(100, "Failed: " + reason, false, Instant.now()));
    }

    public Progress get(UUID planId) {
        return progressByPlan.getOrDefault(planId, new Progress(0, "Idle", false, Instant.now()));
    }
}
