import assert from "node:assert/strict";
import { buildInventoryPlan } from "../lib/forecast-planning.ts";

const buckets = ["2026-01-01", "2026-02-01", "2026-03-01", "2026-04-01"].map((period) => ({
  period,
  label: period.slice(0, 7),
  p10: 320,
  p50: 400,
  p90: 500,
}));

const plan = buildInventoryPlan(buckets, {
  onHand: 1_000,
  safetyStock: 300,
  reorderPoint: 500,
  targetMax: 1_200,
  leadTimeDays: 45,
  moq: 600,
  orderMultiple: 200,
});

assert.equal(plan.rows.length, 4);
assert.equal(plan.rows[0].beginning, 1_000);
assert.equal(plan.rows[0].endingP50, 600, "forecast demand must reduce stock");
assert.equal(plan.rows[1].endingP50, 200);
assert.equal(plan.rows[1].orderReleaseQty, 1_000, "order quantity must round to the configured multiple");
assert.equal(plan.rows[1].orderDueLabel, "2026-04");
assert.equal(plan.rows[2].receipt, 0, "lead-time supply must not arrive early");
assert.equal(plan.rows[3].receipt, 1_000, "supply must arrive in its due bucket");
assert.ok(plan.projectedFillRate < 1, "the plan must expose shortages instead of silently replacing demand");
assert.ok(plan.projectedRiskFillRate <= plan.projectedFillRate);
assert.ok(plan.rows.every((row) => Number.isFinite(row.daysOfSupply)));

const beyondHorizon = buildInventoryPlan(buckets.slice(0, 2), {
  onHand: 100,
  safetyStock: 200,
  reorderPoint: 500,
  targetMax: 1_000,
  leadTimeDays: 120,
  moq: 500,
  orderMultiple: 100,
});
assert.equal(beyondHorizon.releaseCount, 1, "an open order due after the horizon must prevent duplicate releases");
assert.equal(beyondHorizon.rows[0].orderDuePeriod, "outside-horizon");
assert.equal(beyondHorizon.rows[1].orderReleaseQty, 0);
assert.equal(beyondHorizon.rows[0].pipelineAfterRelease, 1_000);

const empty = buildInventoryPlan([], {
  onHand: 0,
  safetyStock: 0,
  reorderPoint: 0,
  targetMax: 0,
  leadTimeDays: 30,
  moq: 0,
  orderMultiple: 1,
});
assert.deepEqual(empty.rows, []);

console.log("forecast-planning tests passed");
