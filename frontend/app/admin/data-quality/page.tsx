"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ordersApi, type Order } from "@/lib/api/orders";
import { orderItemsApi } from "@/lib/api/orderItems";
import { suppliersApi, type SupplierMaterial } from "@/lib/api/suppliers";
import { materialsApi } from "@/lib/api/materials";
import { useReferenceSuppliers, useReferenceWarehouses } from "@/lib/hooks/useQuery";
import { logger } from "@/lib/utils/logger";

interface OrderAuditRow {
  order: Order;
  itemCount: number;
}

interface RuleGap {
  supplierName: string;
  materialCode: string;
  description: string;
}

function isCanonicalOrderNumber(order: Order) {
  const pattern = order.orderType === "outbound" ? /^SO-\d{8}-\d{6}$/ : /^PO-\d{8}-\d{6}$/;
  return pattern.test(order.orderNumber);
}

function formatDateRange(orders: Order[]) {
  const dates = orders
    .map((order) => order.orderDate)
    .filter((date): date is string => Boolean(date))
    .sort();
  if (!dates.length) {
    return "No order dates found";
  }
  const fmt = new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" });
  return `${fmt.format(new Date(dates[0]))}-${fmt.format(new Date(dates[dates.length - 1]))}`;
}

export default function DataQualityPage() {
  const suppliersQuery = useReferenceSuppliers();
  const warehousesQuery = useReferenceWarehouses();
  const [orders, setOrders] = useState<OrderAuditRow[]>([]);
  const [ruleGaps, setRuleGaps] = useState<RuleGap[]>([]);
  const [materialsMissingPackRules, setMaterialsMissingPackRules] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const [allOrders, materials, suppliers] = await Promise.all([
          ordersApi.getAll(),
          materialsApi.getAll(),
          suppliersApi.getAll(),
        ]);

        const auditedOrders = await Promise.all(
          allOrders.map(async (order) => {
            try {
              const items = await orderItemsApi.getByOrderId(order.id);
              return { order, itemCount: items.length };
            } catch (loadItemsError) {
              logger.warn(`Failed to audit order items for ${order.orderNumber}`, loadItemsError);
              return { order, itemCount: 0 };
            }
          })
        );

        const supplierRules = await Promise.all(
          suppliers.map(async (supplier) => {
            try {
              const linkedMaterials = await suppliersApi.getMaterials(supplier.id);
              return linkedMaterials
                .filter(hasEmptyPurchasingRules)
                .map((material) => ({
                  supplierName: supplier.name,
                  materialCode: material.materialCode,
                  description: material.description,
                }));
            } catch (loadSupplierError) {
              logger.warn(`Failed to audit supplier rules for ${supplier.name}`, loadSupplierError);
              return [];
            }
          })
        );

        setOrders(auditedOrders);
        setRuleGaps(supplierRules.flat());
        setMaterialsMissingPackRules(
          materials.filter(
            (material) =>
              !material.handlingUnitType ||
              !material.unitsPerHandlingUnit ||
              !material.orderMultiple ||
              !material.minOrderQuantity
          ).length
        );
      } catch (loadError) {
        logger.error("Failed to load data quality report:", loadError);
        setError(loadError instanceof Error ? loadError.message : "Failed to load data quality report");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const supplierIds = useMemo(
    () => new Set((suppliersQuery.data || []).map((supplier) => supplier.id)),
    [suppliersQuery.data]
  );
  const warehouseIds = useMemo(
    () => new Set((warehousesQuery.data || []).map((warehouse) => warehouse.id)),
    [warehousesQuery.data]
  );

  const zeroItemInbound = orders.filter(
    ({ order, itemCount }) => order.orderType === "inbound" && itemCount === 0
  );
  const zeroItemOrders = orders.filter(({ itemCount }) => itemCount === 0);
  const missingReferences = orders.filter(
    ({ order }) =>
      (order.orderType === "inbound" && !order.supplierId) ||
      (order.supplierId && !supplierIds.has(order.supplierId)) ||
      !order.warehouseId ||
      !warehouseIds.has(order.warehouseId)
  );
  const nonCanonicalOrders = orders.filter(({ order }) => !isCanonicalOrderNumber(order));
  const currentMonth = new Date().toISOString().slice(0, 7);
  const oldRecords = orders.filter(({ order }) => !order.orderDate?.startsWith(currentMonth));

  const cards = [
    {
      label: "Zero-item inbound shells",
      value: zeroItemInbound.length,
      tone: zeroItemInbound.length > 0 ? "text-warning" : "text-success",
      detail: "Safe cleanup target selected by admin policy",
    },
    {
      label: "Missing supplier/warehouse",
      value: missingReferences.length,
      tone: missingReferences.length > 0 ? "text-error" : "text-success",
      detail: "Orders needing master-data repair",
    },
    {
      label: "Supplier rule gaps",
      value: ruleGaps.length,
      tone: ruleGaps.length > 0 ? "text-warning" : "text-success",
      detail: "Linked supplier materials using product defaults",
    },
    {
      label: "Materials missing pack rules",
      value: materialsMissingPackRules,
      tone: materialsMissingPackRules > 0 ? "text-warning" : "text-success",
      detail: "Product catalog fields incomplete",
    },
  ];

  if (loading || suppliersQuery.isPending || warehousesQuery.isPending) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <span className="loading loading-spinner loading-lg"></span>
          <p className="mt-3 text-sm text-base-content/60">Auditing operational data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <span className="material-symbols-outlined">error</span>
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-base-content">Data Quality</h1>
        <p className="text-sm text-base-content/60 mt-1">
          Admin-only repair view for demo shells, missing references, and purchasing-rule gaps.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="card bg-base-100 border border-base-300 rounded-xl p-4">
            <div className="text-sm text-base-content/60">{card.label}</div>
            <div className={`text-3xl font-bold mt-2 ${card.tone}`}>{card.value}</div>
            <div className="text-xs text-base-content/55 mt-2">{card.detail}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card bg-base-100 border border-base-300 rounded-xl p-5">
          <h2 className="text-lg font-bold">Cleanup status</h2>
          <p className="text-sm text-base-content/65 mt-2">
            Existing outbound orders are preserved. Zero-item inbound orders are treated as demo shells and can be removed with the repair script.
          </p>
          <div className="mockup-code mt-4 text-xs">
            <pre data-prefix="$"><code>python3 scripts/repair_zero_item_inbound_orders.py --dry-run</code></pre>
            <pre data-prefix="$"><code>python3 scripts/repair_zero_item_inbound_orders.py --apply</code></pre>
          </div>
        </div>

        <div className="card bg-base-100 border border-base-300 rounded-xl p-5">
          <h2 className="text-lg font-bold">Activity period</h2>
          <p className="text-sm text-base-content/65 mt-2">
            Current month: {currentMonth}. Available order data: {formatDateRange(orders.map((row) => row.order))}.
          </p>
          <div className="mt-4 text-sm">
            <span className="font-semibold">{oldRecords.length}</span> order(s) are outside the current dashboard period.
          </div>
        </div>
      </div>

      <div className="card bg-base-100 border border-base-300 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-base-300 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Repair queues</h2>
            <p className="text-sm text-base-content/60">Normal order lists hide these noisy records.</p>
          </div>
          <Link href="/admin/orders/inbound" className="btn btn-ghost btn-sm">Inbound orders</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Issue</th>
                <th>Count</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Incomplete inbound order shells</td>
                <td>{zeroItemInbound.length}</td>
                <td>Run cleanup script after dry-run review</td>
              </tr>
              <tr>
                <td>Zero-item orders all flows</td>
                <td>{zeroItemOrders.length}</td>
                <td>Investigate non-inbound rows before cleanup</td>
              </tr>
              <tr>
                <td>Non-canonical order numbers</td>
                <td>{nonCanonicalOrders.length}</td>
                <td>Keep aliases, normalize through order-number repair</td>
              </tr>
              <tr>
                <td>Supplier purchasing rules using product defaults</td>
                <td>{ruleGaps.length}</td>
                <td>Fill overrides only where supplier differs from product default</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {ruleGaps.length > 0 && (
        <div className="card bg-base-100 border border-base-300 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-base-300">
            <h2 className="text-lg font-bold">Supplier rule gaps</h2>
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Supplier</th>
                  <th>Material</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {ruleGaps.slice(0, 50).map((gap) => (
                  <tr key={`${gap.supplierName}-${gap.materialCode}`}>
                    <td>{gap.supplierName}</td>
                    <td className="font-mono">{gap.materialCode}</td>
                    <td>{gap.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function hasEmptyPurchasingRules(material: SupplierMaterial) {
  return (
    material.minimumOrderQuantity == null ||
    material.orderMultiple == null ||
    material.unitsPerHandlingUnit == null ||
    material.leadTimeDays == null
  );
}
