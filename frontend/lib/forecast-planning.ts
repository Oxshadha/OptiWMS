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

const firstReceiptBucket = (
  buckets: PlanningForecastBucket[],
  releaseIndex: number,
  leadTimeDays: number,
): number => {
  const releaseDate = dateFromPeriod(buckets[releaseIndex]?.period ?? "");
  if (!releaseDate) return Math.min(releaseIndex + 1, buckets.length);
  const dueAt = new Date(releaseDate);
  dueAt.setUTCDate(dueAt.getUTCDate() + Math.max(1, Math.ceil(leadTimeDays)));
  for (let index = releaseIndex + 1; index < buckets.length; index += 1) {
    const bucketDate = dateFromPeriod(buckets[index].period);
    if (bucketDate && bucketDate.getTime() >= dueAt.getTime()) return index;
  }
  return buckets.length;
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
 * forecast and min/max policy. Orders are released when the projected
 * inventory position crosses the reorder point, but stock only increases in
 * the first forecast bucket whose start is on or after the due date.
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
    reorderPoint: finiteNonNegative(inputPolicy.reorderPoint),
    targetMax: finiteNonNegative(inputPolicy.targetMax),
    leadTimeDays: Math.max(1, Math.round(finiteNonNegative(inputPolicy.leadTimeDays) || 30)),
    moq: finiteNonNegative(inputPolicy.moq),
    orderMultiple: finiteNonNegative(inputPolicy.orderMultiple),
    recommendedOrderQty: finiteNonNegative(inputPolicy.recommendedOrderQty),
  };

  const receipts = Array.from({ length: buckets.length }, () => 0);
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
    const receipt = receipts[index];
    const beginning = currentP50;
    const availableP50 = beginning + receipt;
    const availableP90 = currentP90 + receipt;
    const demandP10 = finiteNonNegative(bucket.p10);
    const demandP50 = finiteNonNegative(bucket.p50);
    const demandP90 = Math.max(demandP50, finiteNonNegative(bucket.p90));
    const fulfilledP50 = Math.min(availableP50, demandP50);
    const fulfilledP90 = Math.min(availableP90, demandP90);
    const shortageP50 = Math.max(0, demandP50 - fulfilledP50);
    currentP50 = Math.max(0, availableP50 - demandP50);
    currentP90 = Math.max(0, availableP90 - demandP90);

    totalDemandP50 += demandP50;
    totalDemandP90 += demandP90;
    totalFulfilledP50 += fulfilledP50;
    totalFulfilledP90 += fulfilledP90;

    const openPipeline = receipts.slice(index + 1).reduce((sum, qty) => sum + qty, 0)
      + outsideHorizonPipeline;
    const projectedPosition = currentP50 + openPipeline;
    let orderReleaseQty = 0;
    let orderDuePeriod: string | null = null;
    let orderDueLabel: string | null = null;
    if (projectedPosition <= policy.reorderPoint) {
      const targetRequirement = Math.max(0, policy.targetMax - projectedPosition);
      const policyRequirement = releaseCount === 0 ? policy.recommendedOrderQty : 0;
      orderReleaseQty = roundedOrderQuantity(
        Math.max(targetRequirement, policyRequirement),
        policy.moq,
        policy.orderMultiple,
      );
      if (orderReleaseQty > 0) {
        const dueIndex = firstReceiptBucket(buckets, index, policy.leadTimeDays);
        if (dueIndex < buckets.length) {
          receipts[dueIndex] += orderReleaseQty;
          orderDuePeriod = buckets[dueIndex].period;
          orderDueLabel = buckets[dueIndex].label;
          totalPlannedReceipts += orderReleaseQty;
        } else {
          orderDuePeriod = "outside-horizon";
          orderDueLabel = "After horizon";
          outsideHorizonPipeline += orderReleaseQty;
        }
        releaseCount += 1;
      }
    }

    const pipelineAfterRelease = receipts.slice(index + 1).reduce((sum, qty) => sum + qty, 0)
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
      daysInPeriod: daysInPeriod(bucket.period),
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
