package com.optiwms.coreapi.operations;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.optiwms.coreapp.operations.PutawayCapacityPlanningService;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The order wizard's capacity-review step posts to the batch endpoint, so its response has to
 * serialize. A failure here returns 500 and the step cannot be passed for any material.
 */
class BatchSplitPlanSerializationTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void emptyBatchResultSerializes() throws Exception {
        var result = new PutawayCapacityPlanningService.BatchSplitPlanResult(
                List.of(), List.of("No inbound items were provided for capacity review."));
        assertTrue(mapper.writeValueAsString(result).contains("No inbound items"));
    }

    @Test
    void populatedBatchResultSerializes() throws Exception {
        var plan = new PutawayCapacityPlanningService.SplitPlanResult(
                true, 200, 200, 0, 1, 1, "226",
                List.of(new PutawayCapacityPlanningService.SplitPlanLine(
                        "A-01-04-1-A", 200, "Pallet slot 1 on rack A-01-004", null)),
                List.of("Handling model: 226 units/pallet, 1 pallet(s) required."));
        var result = new PutawayCapacityPlanningService.BatchSplitPlanResult(
                List.of(new PutawayCapacityPlanningService.BatchSplitPlanLine(0, true, null, plan)),
                List.of());
        assertTrue(mapper.writeValueAsString(result).contains("A-01-04-1-A"));
    }
}
