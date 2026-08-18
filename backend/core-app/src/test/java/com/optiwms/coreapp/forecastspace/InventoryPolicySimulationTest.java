package com.optiwms.coreapp.forecastspace;

import com.optiwms.coreapp.forecastspace.InventoryPolicyRecommendationService.SimulationInputs;
import com.optiwms.coreapp.forecastspace.InventoryPolicyRecommendationService.SimulationOutcome;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static com.optiwms.coreapp.forecastspace.InventoryPolicyRecommendationService.runTrials;
import static com.optiwms.coreapp.forecastspace.InventoryPolicyRecommendationService.sensitivityJson;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The Monte Carlo behind a min/max recommendation.
 *
 * <p>These assert the properties the evidence claims rather than specific numbers:
 * that the run reproduces, that the retained distribution is coherent, and that the
 * sensitivity isolates one input at a time instead of measuring fresh random draws.
 */
class InventoryPolicySimulationTest {

    private static SimulationInputs baseline() {
        return new SimulationInputs(
                40.0,   // dailyMean
                8.0,    // dailyStd
                14.0,   // leadMean
                3.0,    // leadStd
                500.0,  // currentLevel
                900.0); // proposedLevel
    }

    @Test
    @DisplayName("the same seed reproduces the run exactly")
    void deterministic() {
        SimulationOutcome first = runTrials(4242L, baseline());
        SimulationOutcome second = runTrials(4242L, baseline());

        assertEquals(second.fillRate(), first.fillRate());
        assertEquals(second.demandTotal(), first.demandTotal());
        assertEquals(second.percentile(95), first.percentile(95));
    }

    @Test
    @DisplayName("a different seed gives a different sample, so the seed is doing work")
    void seedMatters() {
        assertNotEquals(runTrials(2L, baseline()).demandTotal(),
                runTrials(1L, baseline()).demandTotal());
    }

    @Test
    @DisplayName("retained percentiles are ordered and bracket the mean demand")
    void percentilesAreCoherent() {
        SimulationOutcome outcome = runTrials(7L, baseline());

        assertTrue(outcome.percentile(5) <= outcome.percentile(25), "p5 <= p25");
        assertTrue(outcome.percentile(25) <= outcome.percentile(50), "p25 <= p50");
        assertTrue(outcome.percentile(50) <= outcome.percentile(75), "p50 <= p75");
        assertTrue(outcome.percentile(75) <= outcome.percentile(95), "p75 <= p95");

        double mean = outcome.demandTotal() / 1000.0;
        assertTrue(mean >= outcome.percentile(5) && mean <= outcome.percentile(95),
                "mean demand should sit inside the p5-p95 band");
    }

    @Test
    @DisplayName("holding more stock cannot lower the fill rate")
    void moreStockNeverHurtsService() {
        double low = runTrials(11L, baseline().scaled("target_stock", 0.5)).fillRate();
        double high = runTrials(11L, baseline().scaled("target_stock", 1.5)).fillRate();
        assertTrue(high >= low, "more stock lowered the fill rate: " + high + " < " + low);
    }

    @Test
    @DisplayName("a longer lead time cannot raise the fill rate")
    void longerLeadTimeNeverHelps() {
        double shorter = runTrials(11L, baseline().scaled("lead_mean", 0.8)).fillRate();
        double longer = runTrials(11L, baseline().scaled("lead_mean", 1.2)).fillRate();
        assertTrue(longer <= shorter,
                "a longer lead time raised the fill rate: " + longer + " > " + shorter);
    }

    @Test
    @DisplayName("perturbing one input leaves the others untouched")
    void oneFactorAtATime() {
        SimulationInputs base = baseline();
        SimulationInputs bumped = base.scaled("lead_mean", 1.2);

        assertEquals(base.leadMean() * 1.2, bumped.leadMean());
        assertEquals(base.dailyMean(), bumped.dailyMean());
        assertEquals(base.dailyStd(), bumped.dailyStd());
        assertEquals(base.leadStd(), bumped.leadStd());
        assertEquals(base.proposedLevel(), bumped.proposedLevel());
    }

    @Test
    @DisplayName("sensitivity covers every input, ordered by swing, largest first")
    void sensitivityIsOrdered() {
        SimulationInputs base = baseline();
        String json = sensitivityJson(99L, base, runTrials(99L, base).fillRate());

        for (String factor : new String[]{"daily_mean", "daily_std", "lead_mean", "lead_std", "target_stock"}) {
            assertTrue(json.contains(factor), "sensitivity is missing " + factor);
        }

        java.util.List<Double> swings = new java.util.ArrayList<>();
        java.util.regex.Matcher m =
                java.util.regex.Pattern.compile("\"swing\":([0-9.]+)").matcher(json);
        while (m.find()) swings.add(Double.parseDouble(m.group(1)));

        assertEquals(5, swings.size());
        for (int i = 1; i < swings.size(); i++) {
            assertTrue(swings.get(i - 1) >= swings.get(i),
                    "swings are not ordered largest first: " + swings);
        }
    }

    @Test
    @DisplayName("sensitivity is attributable to the factor, not to a new random sample")
    void sensitivityHoldsTheSeedFixed() {
        // Perturbing by a factor of exactly 1.0 must change nothing at all. If the
        // seed were re-drawn per pass this would differ, and every reported swing
        // would be partly Monte Carlo noise rather than the input's effect.
        SimulationInputs base = baseline();
        assertEquals(runTrials(5L, base).fillRate(),
                runTrials(5L, base.scaled("daily_mean", 1.0)).fillRate());
    }
}
