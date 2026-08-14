export interface PlanningForecastBucket {
  period: string;
  label: string;
  p10: number;
  p50: number;
  p90: number;
}

export interface InventoryPlanningPolicy {
  onHand: number;
  safetyStock: number;
  reorderPoint: number;
  targetMax: number;
  leadTimeDays: number;
  moq: number;
  orderMultiple: number;
  recommendedOrderQty?: number;
}

export type InventoryPlanStatus = "healthy" | "watch" | "order" | "stockout";

export interface InventoryPlanRow {
  period: string;
  label: string;
  daysInPeriod: number;
  beginning: number;
  receipt: number;
  demandP10: number;
  demandP50: number;
  demandP90: number;
  fulfilledP50: number;
  shortageP50: number;
  endingP50: number;
  endingP90: number;
  safetyStock: number;
  reorderPoint: number;
  orderReleaseQty: number;
  orderDuePeriod: string | null;
  orderDueLabel: string | null;
  pipelineAfterRelease: number;
  daysOfSupply: number;
  status: InventoryPlanStatus;
}

export interface InventoryPlan {
  rows: InventoryPlanRow[];
  projectedFillRate: number;
  projectedRiskFillRate: number;
  releaseCount: number;
  totalPlannedReceipts: number;
  firstRiskPeriod: string | null;
  minimumDaysOfSupply: number | null;
}

const finiteNonNegative = (value: number | null | undefined): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.max(0, n) : 0;
};

const dateFromPeriod = (period: string): Date | null => {
  const parsed = new Date(`${period.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const daysInPeriod = (period: string): number => {
  const date = dateFromPeriod(period);
  if (!date) return 30;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
};

const roundedOrderQuantity = (required: number, moq: number, multiple: number): number => {
  if (required <= 0) return 0;
  const safeMultiple = multiple > 0 ? multiple : 1;
  const minimum = Math.max(required, moq > 0 ? moq : 0);
  return Math.ceil(minimum / safeMultiple) * safeMultiple;
};

const forwardDaysOfSupply = (
  endingStock: number,
  rows: PlanningForecastBucket[],
  currentIndex: number,
): number => {
  let remaining = finiteNonNegative(endingStock);
  let coveredDays = 0;
  const future = rows.slice(currentIndex + 1);
  const demandRows = future.length ? future : rows.slice(currentIndex, currentIndex + 1);
  for (const row of demandRows) {
    const demand = finiteNonNegative(row.p50);
    const periodDays = daysInPeriod(row.period);
    if (demand <= 0) {
      coveredDays += periodDays;
      continue;
    }
    if (remaining >= demand) {
      coveredDays += periodDays;
      remaining -= demand;
      continue;
    }
    coveredDays += (remaining / demand) * periodDays;
    remaining = 0;
    break;
  }
  return Math.max(0, Math.round(coveredDays));
};

/**
 * Builds a deterministic, lead-time-aware inventory plan from the published
 * monthly forecast and min/max policy. Demand is consumed daily inside each
 * month so an order is released on the day inventory position crosses the
 * reorder point. Supply becomes available on its due date after lead time.
 * The returned rows remain monthly for the UI, but the calculation does not
 * wait until month end to test the replenishment trigger.
 */
export function buildInventoryPlan(
  inputBuckets: PlanningForecastBucket[],
  inputPolicy: InventoryPlanningPolicy,
): InventoryPlan {
  const buckets = [...inputBuckets]
    .filter((row) => row.period)
    .sort((a, b) => a.period.localeCompare(b.period));
  if (!buckets.length) {
    return {
      rows: [],
      projectedFillRate: 0,
      projectedRiskFillRate: 0,
      releaseCount: 0,
      totalPlannedReceipts: 0,
      firstRiskPeriod: null,
      minimumDaysOfSupply: null,
    };
  }

  const policy = {
    onHand: finiteNonNegative(inputPolicy.onHand),
    safetyStock: finiteNonNegative(inputPolicy.safetyStock),
    reorderPoint: Math.max(
      finiteNonNegative(inputPolicy.reorderPoint),
      finiteNonNegative(inputPolicy.safetyStock),
    ),
    targetMax: Math.max(
      finiteNonNegative(inputPolicy.targetMax),
      finiteNonNegative(inputPolicy.reorderPoint),
      finiteNonNegative(inputPolicy.safetyStock),
    ),
    leadTimeDays: Math.max(1, Math.round(finiteNonNegative(inputPolicy.leadTimeDays) || 30)),
    moq: finiteNonNegative(inputPolicy.moq),
    orderMultiple: finiteNonNegative(inputPolicy.orderMultiple),
    recommendedOrderQty: finiteNonNegative(inputPolicy.recommendedOrderQty),
  };

  const horizonEnd = dateFromPeriod(buckets[buckets.length - 1].period) ?? new Date();
  horizonEnd.setUTCMonth(horizonEnd.getUTCMonth() + 1, 0);
  const pendingReceipts: Array<{ dueAt: Date; quantity: number }> = [];
  const rows: InventoryPlanRow[] = [];
  let currentP50 = policy.onHand;
  let currentP90 = policy.onHand;
  let totalDemandP50 = 0;
  let totalDemandP90 = 0;
  let totalFulfilledP50 = 0;
  let totalFulfilledP90 = 0;
  let releaseCount = 0;
  let totalPlannedReceipts = 0;
  let outsideHorizonPipeline = 0;

  for (let index = 0; index < buckets.length; index += 1) {
    const bucket = buckets[index];
    const beginning = currentP50;
    const demandP10 = finiteNonNegative(bucket.p10);
    const demandP50 = finiteNonNegative(bucket.p50);
    const demandP90 = Math.max(demandP50, finiteNonNegative(bucket.p90));
    const periodDays = daysInPeriod(bucket.period);
    const dailyP50 = demandP50 / periodDays;
    const dailyP90 = demandP90 / periodDays;
    const bucketStart = dateFromPeriod(bucket.period) ?? new Date();
    let receipt = 0;
    let fulfilledP50 = 0;
    let fulfilledP90 = 0;
    let shortageP50 = 0;
    let orderReleaseQty = 0;
    let orderDuePeriod: string | null = null;
    let orderDueLabel: string | null = null;

    for (let day = 0; day < periodDays; day += 1) {
      const currentDate = new Date(bucketStart);
      currentDate.setUTCDate(currentDate.getUTCDate() + day);

      for (let receiptIndex = pendingReceipts.length - 1; receiptIndex >= 0; receiptIndex -= 1) {
        const pending = pendingReceipts[receiptIndex];
        if (pending.dueAt.getTime() <= currentDate.getTime()) {
          currentP50 += pending.quantity;
          currentP90 += pending.quantity;
          receipt += pending.quantity;
          totalPlannedReceipts += pending.quantity;
          pendingReceipts.splice(receiptIndex, 1);
        }
      }

      const fulfilledTodayP50 = Math.min(currentP50, dailyP50);
      const fulfilledTodayP90 = Math.min(currentP90, dailyP90);
      fulfilledP50 += fulfilledTodayP50;
      fulfilledP90 += fulfilledTodayP90;
      shortageP50 += Math.max(0, dailyP50 - fulfilledTodayP50);
      currentP50 = Math.max(0, currentP50 - dailyP50);
      currentP90 = Math.max(0, currentP90 - dailyP90);

      const openPipeline = pendingReceipts.reduce((sum, pending) => sum + pending.quantity, 0)
        + outsideHorizonPipeline;
      const projectedPosition = currentP50 + openPipeline;
      if (projectedPosition <= policy.reorderPoint) {
        const targetRequirement = Math.max(0, policy.targetMax - projectedPosition);
        const policyRequirement = releaseCount === 0 ? policy.recommendedOrderQty : 0;
        const released = roundedOrderQuantity(
          Math.max(targetRequirement, policyRequirement),
          policy.moq,
          policy.orderMultiple,
        );
        if (released > 0) {
          const dueAt = new Date(currentDate);
          dueAt.setUTCDate(dueAt.getUTCDate() + policy.leadTimeDays);
          orderReleaseQty += released;
          orderDuePeriod ??= dueAt <= horizonEnd ? dueAt.toISOString().slice(0, 10) : "outside-horizon";
          orderDueLabel ??= dueAt <= horizonEnd
            ? dueAt.toLocaleDateString("en", { day: "numeric", month: "short", timeZone: "UTC" })
            : "After horizon";
          if (dueAt <= horizonEnd) pendingReceipts.push({ dueAt, quantity: released });
          else outsideHorizonPipeline += released;
          releaseCount += 1;
        }
      }
    }

    totalDemandP50 += demandP50;
    totalDemandP90 += demandP90;
    totalFulfilledP50 += fulfilledP50;
    totalFulfilledP90 += fulfilledP90;
    const pipelineAfterRelease = pendingReceipts.reduce((sum, pending) => sum + pending.quantity, 0)
      + outsideHorizonPipeline;
    const daysOfSupply = forwardDaysOfSupply(currentP50, buckets, index);
    const status: InventoryPlanStatus = shortageP50 > 0
      ? "stockout"
      : orderReleaseQty > 0
        ? "order"
        : currentP90 < policy.safetyStock
          ? "watch"
          : "healthy";

    rows.push({
      period: bucket.period,
      label: bucket.label,
      daysInPeriod: periodDays,
      beginning: Math.round(beginning),
      receipt: Math.round(receipt),
      demandP10: Math.round(demandP10),
      demandP50: Math.round(demandP50),
      demandP90: Math.round(demandP90),
      fulfilledP50: Math.round(fulfilledP50),
      shortageP50: Math.round(shortageP50),
      endingP50: Math.round(currentP50),
      endingP90: Math.round(currentP90),
      safetyStock: Math.round(policy.safetyStock),
      reorderPoint: Math.round(policy.reorderPoint),
      orderReleaseQty: Math.round(orderReleaseQty),
      orderDuePeriod,
      orderDueLabel,
      pipelineAfterRelease: Math.round(pipelineAfterRelease),
      daysOfSupply,
      status,
    });
  }

  const firstRisk = rows.find((row) => row.status !== "healthy");
  const coverageValues = rows.map((row) => row.daysOfSupply).filter(Number.isFinite);
  return {
    rows,
    projectedFillRate: totalDemandP50 > 0 ? totalFulfilledP50 / totalDemandP50 : 1,
    projectedRiskFillRate: totalDemandP90 > 0 ? totalFulfilledP90 / totalDemandP90 : 1,
    releaseCount,
    totalPlannedReceipts: Math.round(totalPlannedReceipts),
    firstRiskPeriod: firstRisk?.label ?? null,
    minimumDaysOfSupply: coverageValues.length ? Math.min(...coverageValues) : null,
  };
}
