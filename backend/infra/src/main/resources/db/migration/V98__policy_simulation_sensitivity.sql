-- Retain what the Monte Carlo already computes but throws away.
--
-- simulatePolicy() draws 1,000 lead-time demand samples per material and keeps
-- only aggregates, so the fill-rate claim cannot be inspected: a manager sees
-- "97% fill rate" with no way to ask how spread the underlying demand was, and an
-- auditor cannot tell which input the answer actually depends on.
--
-- The run is seeded per (run, material), so both the distribution and the
-- one-factor-at-a-time sensitivity below are reproducible rather than sampled
-- anew on each read.

ALTER TABLE inventory_policy_simulation_evidence
    -- Percentiles of simulated lead-time demand, in units.
    ADD COLUMN IF NOT EXISTS demand_p5   NUMERIC(20,4),
    ADD COLUMN IF NOT EXISTS demand_p25  NUMERIC(20,4),
    ADD COLUMN IF NOT EXISTS demand_p50  NUMERIC(20,4),
    ADD COLUMN IF NOT EXISTS demand_p75  NUMERIC(20,4),
    ADD COLUMN IF NOT EXISTS demand_p95  NUMERIC(20,4),
    -- One-factor-at-a-time sensitivity: each input perturbed +/-20% with the seed
    -- held fixed, so a change in fill rate is attributable to the factor and not
    -- to a different set of random draws.
    -- [{"factor":"daily_mean","low_fill_rate":..,"high_fill_rate":..,"swing":..}, ...]
    ADD COLUMN IF NOT EXISTS sensitivity_json JSONB;

COMMENT ON COLUMN inventory_policy_simulation_evidence.sensitivity_json IS
    'One-factor-at-a-time sensitivity of simulated fill rate to each policy input, '
    '+/-20% with the random seed fixed. Ordered by absolute swing, largest first.';
