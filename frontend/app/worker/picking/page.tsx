"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import { QRScanner } from "@/components/QRScanner";
import { WorkerRouteGuide } from "@/components/WorkerRouteGuide";
import { useOffline } from "@/hooks/useOffline";
import { useWorker } from "@/contexts/WorkerContext";
import { operationsApi } from "@/lib/api/operations";
import { orderItemsApi } from "@/lib/api/orderItems";
import { ordersApi } from "@/lib/api/orders";
import { tasksApi, Task } from "@/lib/api/tasks-api";
import { materialsApi } from "@/lib/api/materials";
import { warehousesApi } from "@/lib/api/warehouses";
import { addToSyncQueue } from "@/lib/indexeddb";
import { showToast } from "@/lib/utils/toast";
import { logger } from "@/lib/utils/logger";
import { formatMaterialDisplay } from "@/lib/utils/material-display";
import { Pick } from "./types";

type OrderOption = { id: string; orderNumber: string; status: string };

const parsePickQuantity = (notes?: string): number => {
  if (!notes) return 1;
  const match = notes.match(/Pick\s+(\d+)\s+units/i);
  if (!match?.[1]) return 1;
  const qty = Number(match[1]);
  return Number.isFinite(qty) && qty > 0 ? qty : 1;
};

const parseMaterialCode = (notes?: string): string | null => {
  if (!notes) return null;
  const match = notes.match(/Pick\s+\d+\s+units\s+of\s+(.+?)\s+from\s+location/i);
  if (!match?.[1]) return null;
  return match[1].trim();
};

const parseAllocationPolicy = (notes?: string): string | null => {
  if (!notes) return null;
  const match = notes.match(/\[Policy=([^\]]+)\]/i);
  return match?.[1]?.trim() || null;
};

const parseSkipReason = (notes?: string): string | null => {
  if (!notes) return null;
  const match = notes.match(/PICKING_ISSUE=[^\n\r]*\|REASON=([^\n\r|]+)/i);
  return match?.[1]?.trim() || null;
};

const normalizeLocation = (value: string): string => value.toUpperCase().replace(/[^A-Z0-9]/g, "");

const sortPicks = (items: Pick[]): Pick[] => {
  const completed = items.filter((p) => p.status === "completed");
  const active = items.filter((p) => p.status !== "completed");
  return [...active, ...completed];
};

export default function PickingPage() {
  const { isOnline } = useOffline();
  const { worker, isLoading: workerContextLoading } = useWorker();

  const [orders, setOrders] = useState<OrderOption[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<OrderOption | null>(null);
  const [scannedOrderNumber, setScannedOrderNumber] = useState("");
  const [showOrderScanner, setShowOrderScanner] = useState(false);
  const [showLocationScanner, setShowLocationScanner] = useState(false);

  const [picks, setPicks] = useState<Pick[]>([]);
  const [pickedQty, setPickedQty] = useState(0);
  const [scannedLocation, setScannedLocation] = useState("");
  const [locationVerified, setLocationVerified] = useState(false);

  const [showIssueForm, setShowIssueForm] = useState(false);
  const [availableQty, setAvailableQty] = useState(0);
  const [issueReason, setIssueReason] = useState("");

  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [isLoadingPicks, setIsLoadingPicks] = useState(false);
  const [startingTaskId, setStartingTaskId] = useState<string | null>(null);
  const [startedTaskIds, setStartedTaskIds] = useState<Set<string>>(new Set());
  const [resolvedWarehouseId, setResolvedWarehouseId] = useState<string | null>(null);
  const [resolvingWarehouse, setResolvingWarehouse] = useState(false);

  const warehouseDisplayName = worker?.warehouse || "";
  const hasWarehouseName =
    !!warehouseDisplayName &&
    warehouseDisplayName !== "Unknown" &&
    warehouseDisplayName !== "Unknown Warehouse" &&
    warehouseDisplayName !== "Unassigned";
  const effectiveWarehouseId = worker?.warehouseId || resolvedWarehouseId;

  const currentPick = useMemo(() => picks.find((p) => p.status === "current") || null, [picks]);
  const completedCount = useMemo(() => picks.filter((p) => p.status === "completed").length, [picks]);

  const withCurrentFlag = (items: Pick[]): Pick[] => {
    const normalized: Pick[] = items.map((p): Pick => ({
      ...p,
      status: p.status === "completed" ? "completed" : ("upcoming" as const),
    }));
    const firstPending = normalized.findIndex((p) => p.status !== "completed" && !p.skipReason);
    const indexToUse = firstPending >= 0 ? firstPending : normalized.findIndex((p) => p.status !== "completed");
    if (indexToUse >= 0) {
      normalized[indexToUse] = { ...normalized[indexToUse], status: "current" };
    }
    return sortPicks(normalized);
  };

  const transformTasksToPicks = async (tasks: Task[], orderId: string, orderNumber: string): Promise<Pick[]> => {
    const orderItems = await orderItemsApi.getByOrderId(orderId);
    const materialByCode = new Map<string, string>();
    const materialDisplayById = new Map<string, { sku: string; name: string }>();

    orderItems.forEach((item) => {
      if (item.materialId) {
        const display = formatMaterialDisplay(item.materialCode || null, item.materialName || null, item.materialId);
        materialDisplayById.set(item.materialId, { sku: display.sku, name: display.name });
      }
    });

    const materialIdsToFetch = Array.from(
      new Set(orderItems.map((item) => item.materialId).filter((id) => !!id && !materialDisplayById.get(id)))
    );
    await Promise.all(
      materialIdsToFetch.map(async (materialId) => {
        try {
          const material = await materialsApi.getById(materialId);
          const display = formatMaterialDisplay(material.materialCode, material.description, material.id);
          materialDisplayById.set(materialId, { sku: display.sku, name: display.name });
        } catch {
          // keep fallback from parse/ID
        }
      })
    );

    const resolveMaterialId = async (task: Task): Promise<string> => {
      const parsedCode = parseMaterialCode(task.notes || "");
      if (parsedCode) {
        if (materialByCode.has(parsedCode)) {
          return materialByCode.get(parsedCode) || "";
        }
        try {
          const material = await materialsApi.getByCode(parsedCode);
          materialByCode.set(parsedCode, material.id);
          return material.id;
        } catch {
          // fallback below
        }
      }

      if (orderItems.length === 1) {
        return orderItems[0].materialId;
      }
      return "";
    };

    const picksFromTasks = await Promise.all(
      tasks.map(async (task) => {
        const materialId = await resolveMaterialId(task);
        const materialDisplay = materialId ? materialDisplayById.get(materialId) : undefined;
        const parsedCode = parseMaterialCode(task.notes || "");
        const display = formatMaterialDisplay(
          materialDisplay?.sku || parsedCode || null,
          materialDisplay?.name || null,
          materialId || null
        );
        return {
          id: task.id,
          taskId: task.id,
          order: orderNumber,
          orderId,
          location: task.locationCode || "",
          item: display.name || "Item",
          sku: display.sku,
          materialId,
          qty: parsePickQuantity(task.notes || ""),
          allocationPolicy: parseAllocationPolicy(task.notes || "") || undefined,
          taskStatus: task.status,
          skipReason: parseSkipReason(task.notes || "") || undefined,
          status: task.status === "completed" ? "completed" : "upcoming",
          pickedLocations: [],
        } as Pick;
      })
    );

    return withCurrentFlag(picksFromTasks);
  };

  const loadOrdersNeedingPicking = async () => {
    if (!effectiveWarehouseId) return;
    setIsLoadingOrders(true);
    try {
      const tasks = await tasksApi.getAll("picking", undefined, undefined, effectiveWarehouseId, false);
      const activeTasks = tasks.filter((t) =>
        t.referenceType === "order" &&
        !!t.referenceId &&
        ["pending", "assigned", "in_progress"].includes((t.status || "").toLowerCase())
      );

      const orderIds = Array.from(new Set(activeTasks.map((t) => t.referenceId!).filter(Boolean)));
      const fetchedOrders = await Promise.all(
        orderIds.map(async (orderId) => {
          try {
            const order = await ordersApi.getById(orderId);
            if ((order.orderType || "").toLowerCase() !== "outbound") return null;
            return { id: order.id, orderNumber: order.orderNumber, status: order.status };
          } catch {
            return null;
          }
        })
      );
      setOrders(fetchedOrders.filter((o): o is OrderOption => !!o));
    } catch (error) {
      logger.error("Failed to load outbound orders for picking:", error);
      showToast.error("Failed to load outbound orders");
    } finally {
      setIsLoadingOrders(false);
    }
  };

  const loadPicksForOrder = async (order: OrderOption) => {
    if (!effectiveWarehouseId) return;
    setIsLoadingPicks(true);
    try {
      const findOrderTasks = async (): Promise<Task[]> => {
        const tasks = await tasksApi.getAll("picking", undefined, undefined, effectiveWarehouseId, false);
        const activeStatuses = new Set(["pending", "assigned", "in_progress", "completed"]);
        const workerVisible = (t: Task) => !t.assignedTo || !worker?.id || t.assignedTo === worker.id;

        const direct = tasks.filter(
          (t) =>
            (t.referenceType || "").toLowerCase() === "order" &&
            t.referenceId === order.id &&
            activeStatuses.has((t.status || "").toLowerCase()) &&
            workerVisible(t)
        );
        if (direct.length > 0) return direct;

        const orderItems = await orderItemsApi.getByOrderId(order.id);
        const orderItemIds = new Set(orderItems.map((item) => item.id));

        const legacyOrderItem = tasks.filter(
          (t) =>
            (t.referenceType || "").toLowerCase() === "order_item" &&
            !!t.referenceId &&
            orderItemIds.has(t.referenceId) &&
            activeStatuses.has((t.status || "").toLowerCase()) &&
            workerVisible(t)
        );
        if (legacyOrderItem.length > 0) return legacyOrderItem;

        const byPattern = tasks.filter((t) => {
          const normalizedTaskNumber = (t.taskNumber || "").toUpperCase();
          const normalizedNotes = (t.notes || "").toUpperCase();
          const normalizedOrder = order.orderNumber.toUpperCase();
          return (
            (normalizedTaskNumber.includes(normalizedOrder) || normalizedNotes.includes(normalizedOrder)) &&
            activeStatuses.has((t.status || "").toLowerCase()) &&
            workerVisible(t)
          );
        });

        return byPattern;
      };

      let orderTasks = await findOrderTasks();
      if (orderTasks.length === 0) {
        try {
          // Auto-heal missing task generation for this outbound order
          await ordersApi.createTasksByOrderId(order.id);
          orderTasks = await findOrderTasks();
        } catch (taskCreateErr) {
          logger.warn("Could not auto-create picking tasks for order:", taskCreateErr);
        }
      }

      if (orderTasks.length === 0) {
        showToast.error("No outbound picking tasks found for this order in your warehouse");
        setPicks([]);
        return;
      }

      const transformed = await transformTasksToPicks(orderTasks, order.id, order.orderNumber);
      setPicks(transformed);
      setStartedTaskIds(new Set());
      const firstCurrent = transformed.find((p) => p.status === "current");
      if (firstCurrent) {
        setPickedQty(firstCurrent.qty);
      }
      setScannedLocation("");
      setLocationVerified(false);
      setShowIssueForm(false);
      setAvailableQty(0);
      setIssueReason("");
    } catch (error) {
      logger.error("Failed to load picking tasks for order:", error);
      showToast.error("Failed to load order picking tasks");
    } finally {
      setIsLoadingPicks(false);
    }
  };

  useEffect(() => {
    const resolveWarehouseId = async () => {
      if (worker?.warehouseId) {
        setResolvedWarehouseId(worker.warehouseId);
        return;
      }
      if (!hasWarehouseName) {
        setResolvedWarehouseId(null);
        return;
      }

      try {
        setResolvingWarehouse(true);
        const warehouses = await warehousesApi.getAll();
        const matched = warehouses.find(
          (w) => w.name.trim().toLowerCase() === warehouseDisplayName.trim().toLowerCase()
        );
        if (matched?.id) {
          setResolvedWarehouseId(matched.id);
          return;
        }

        const looseMatch = warehouses.find((w) =>
          w.name.trim().toLowerCase().includes(warehouseDisplayName.trim().toLowerCase())
        );
        setResolvedWarehouseId(looseMatch?.id || null);
      } catch (error) {
        logger.error("Failed to resolve worker warehouse ID from name:", error);
        setResolvedWarehouseId(null);
      } finally {
        setResolvingWarehouse(false);
      }
    };

    void resolveWarehouseId();
  }, [worker?.warehouseId, warehouseDisplayName, hasWarehouseName]);

  useEffect(() => {
    if (!isOnline || !effectiveWarehouseId) return;
    void loadOrdersNeedingPicking();
    const interval = setInterval(() => {
      void loadOrdersNeedingPicking();
    }, 5000);
    return () => clearInterval(interval);
  }, [isOnline, effectiveWarehouseId]);

  useEffect(() => {
    if (!selectedOrder || !isOnline) return;
    void loadPicksForOrder(selectedOrder);
  }, [selectedOrder, isOnline]);

  useEffect(() => {
    if (!currentPick) return;
    setPickedQty(currentPick.qty);
    setScannedLocation("");
    setLocationVerified(false);
    setShowIssueForm(false);
    setAvailableQty(0);
    setIssueReason("");
  }, [currentPick?.id]);

  useEffect(() => {
    const startCurrentTask = async () => {
      if (!isOnline) return;
      if (!currentPick?.taskId || !worker?.id) return;
      if (currentPick.taskStatus === "completed") return;
      if (startedTaskIds.has(currentPick.taskId)) return;
      try {
        setStartingTaskId(currentPick.taskId);
        await tasksApi.updateStatus(currentPick.taskId, "in_progress", worker.id);
        setStartedTaskIds((prev) => new Set(prev).add(currentPick.taskId));
        setPicks((prev) =>
          prev.map((pick) =>
            pick.taskId === currentPick.taskId ? { ...pick, taskStatus: "in_progress" } : pick
          )
        );
      } catch (error) {
        logger.warn("Could not mark pick task in progress:", error);
      } finally {
        setStartingTaskId(null);
      }
    };
    void startCurrentTask();
  }, [currentPick?.taskId, currentPick?.taskStatus, isOnline, worker?.id, startedTaskIds]);

  const handleOrderScan = (result: string) => {
    const normalized = result.trim().toUpperCase();
    setScannedOrderNumber(normalized);
    setShowOrderScanner(false);
    void handleOrderSubmit(normalized);
  };

  const handleOrderSubmit = async (value?: string) => {
    const orderNumber = (value ?? scannedOrderNumber).trim().toUpperCase();
    if (!orderNumber) {
      showToast.error("Enter or scan outbound order number");
      return;
    }

    let order = orders.find((o) => o.orderNumber === orderNumber);
    if (!order) {
      try {
        const fetched = await ordersApi.getByOrderNumber(orderNumber);
        if ((fetched.orderType || "").toLowerCase() !== "outbound") {
          showToast.error("Only outbound orders can be picked");
          return;
        }
        order = { id: fetched.id, orderNumber: fetched.orderNumber, status: fetched.status };
      } catch {
        showToast.error(`Outbound order ${orderNumber} not found`);
        return;
      }
    }

    setSelectedOrder(order);
    setScannedOrderNumber("");
  };

  const handleSelectPick = (index: number) => {
    setPicks((prev) =>
      prev.map((pick, idx) => {
        if (pick.status === "completed") return pick;
        if (idx === index) return { ...pick, status: "current" };
        return { ...pick, status: "upcoming" };
      })
    );
  };

  const markCurrentAs = (kind: "completed" | "upcoming", skipReason?: string) => {
    setPicks((prev) => {
      const next = prev.map((pick) =>
        pick.id === currentPick?.id
          ? { ...pick, status: kind, skipReason: skipReason || pick.skipReason }
          : pick
      );
      return withCurrentFlag(next);
    });
  };

  const handleConfirmPick = async () => {
    if (!currentPick) return;
    if (!currentPick.materialId) {
      showToast.error("Material mapping is missing for this task");
      return;
    }
    if (pickedQty <= 0 || pickedQty > currentPick.qty) {
      showToast.error(`Pick quantity must be between 1 and ${currentPick.qty}`);
      return;
    }
    if (currentPick.location && !locationVerified) {
      showToast.error("Please scan or verify pick location first");
      return;
    }

    try {
      if (isOnline) {
        await operationsApi.completePicking(
          currentPick.taskId,
          {
            items: [
              {
                materialId: currentPick.materialId,
                quantity: pickedQty.toString(),
                locationCode: currentPick.location,
              },
            ],
          },
          worker?.id
        );
      } else {
        await addToSyncQueue({
          type: "operation",
          action: "create",
          data: {
            type: "picking_complete",
            taskId: currentPick.taskId,
            payload: {
              items: [
                {
                  materialId: currentPick.materialId,
                  quantity: pickedQty.toString(),
                  locationCode: currentPick.location,
                },
              ],
              workerId: worker?.id,
            },
          },
        });
      }

      markCurrentAs("completed");
      showToast.success(isOnline ? "Pick confirmed" : "Pick queued for sync");
    } catch (error) {
      logger.error("Error confirming pick:", error);
      showToast.error("Failed to confirm pick");
    }
  };

  const handleRaiseIssue = async () => {
    if (!currentPick) return;
    if (!currentPick.materialId) {
      showToast.error("Cannot raise issue without material mapping");
      return;
    }
    if (!issueReason.trim()) {
      showToast.error("Issue reason is required");
      return;
    }
    if (availableQty < 0 || availableQty > currentPick.qty) {
      showToast.error(`Available quantity must be between 0 and ${currentPick.qty}`);
      return;
    }
    try {
      if (isOnline) {
        await operationsApi.reportPickingIssue(
          currentPick.taskId,
          {
            materialId: currentPick.materialId,
            locationCode: currentPick.location || "",
            requestedQuantity: currentPick.qty.toString(),
            availableQuantity: availableQty.toString(),
            reason: issueReason.trim(),
          },
          worker?.id
        );
      } else {
        await addToSyncQueue({
          type: "operation",
          action: "create",
          data: {
            type: "picking_issue",
            taskId: currentPick.taskId,
            payload: {
              materialId: currentPick.materialId,
              locationCode: currentPick.location || "",
              requestedQuantity: currentPick.qty.toString(),
              availableQuantity: availableQty.toString(),
              reason: issueReason.trim(),
              workerId: worker?.id,
            },
          },
        });
      }
      markCurrentAs("upcoming", issueReason.trim());
      setShowIssueForm(false);
      setIssueReason("");
      setAvailableQty(0);
      showToast.success(isOnline ? "Issue raised and moved to next pick" : "Issue queued and moved to next pick");
    } catch (error) {
      logger.error("Error raising picking issue:", error);
      showToast.error("Failed to raise picking issue");
    }
  };

  const verifyLocation = (value: string) => {
    setScannedLocation(value);
    if (!currentPick?.location) {
      setLocationVerified(true);
      return;
    }
    const matched =
      normalizeLocation(value) === normalizeLocation(currentPick.location) ||
      normalizeLocation(value).includes(normalizeLocation(currentPick.location)) ||
      normalizeLocation(currentPick.location).includes(normalizeLocation(value));
    setLocationVerified(matched);
  };

  if (workerContextLoading) {
    return (
      <div className="p-4 flex flex-col items-center justify-center h-64 gap-3">
        <span className="loading loading-spinner loading-lg"></span>
        <p className="text-sm text-base-content/60">Loading worker context...</p>
      </div>
    );
  }

  if (!effectiveWarehouseId && !hasWarehouseName) {
    return (
      <div className="p-4">
        <div className="alert alert-warning">No warehouse assigned to your account.</div>
      </div>
    );
  }

  if (!effectiveWarehouseId && hasWarehouseName) {
    return (
      <div className="p-4">
        <div className="alert alert-info">
          {resolvingWarehouse
            ? "Resolving your warehouse access..."
            : "Warehouse name exists but warehouse ID is not resolved yet. Refresh once, or contact admin to reassign warehouse."}
        </div>
      </div>
    );
  }

  if (!selectedOrder) {
    return (
      <div className="p-4 space-y-4">
        <div className="bg-base-100 rounded-xl p-4 border border-base-300">
          <h2 className="text-xl font-bold mb-4">Select Outbound Order</h2>
          <label className="label">
            <span className="label-text font-medium">Scan or Enter Outbound Order Number</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              className="input input-bordered flex-1"
              placeholder="OUT-001770976901690"
              value={scannedOrderNumber}
              onChange={(e) => setScannedOrderNumber(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  void handleOrderSubmit();
                }
              }}
            />
            <button className="btn btn-primary" onClick={() => void handleOrderSubmit()}>
              Load
            </button>
            <button className="btn btn-outline" onClick={() => setShowOrderScanner(true)}>
              <span className="material-symbols-outlined">qr_code_scanner</span>
            </button>
          </div>
        </div>

        <div className="bg-base-100 rounded-xl p-4 border border-base-300">
          {isLoadingOrders ? (
            <div className="flex justify-center py-8">
              <span className="loading loading-spinner"></span>
            </div>
          ) : orders.length === 0 ? (
            <div className="alert alert-info">No outbound orders currently have picking tasks.</div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-base-content/60">Ready to pick orders:</p>
              {orders.map((order) => (
                <button
                  key={order.id}
                  className="btn btn-outline w-full justify-start"
                  onClick={() => setSelectedOrder(order)}
                >
                  <span className="material-symbols-outlined">local_shipping</span>
                  <span className="font-mono font-bold">{order.orderNumber}</span>
                  <span className="badge ml-auto">{order.status}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <Modal isOpen={showOrderScanner} onClose={() => setShowOrderScanner(false)} title="Scan Outbound Order">
          <QRScanner isOpen={showOrderScanner} onClose={() => setShowOrderScanner(false)} onScan={handleOrderScan} />
        </Modal>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <div className="flex items-center justify-between">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setSelectedOrder(null);
              setPicks([]);
            }}
          >
            <span className="material-symbols-outlined">arrow_back</span>
            Back to Orders
          </button>
          <span className="badge badge-primary badge-lg">{selectedOrder.orderNumber}</span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <progress className="progress progress-primary flex-1" value={completedCount} max={Math.max(picks.length, 1)} />
          <span className="text-sm font-semibold">
            {completedCount}/{picks.length}
          </span>
        </div>
      </div>

      {isLoadingPicks ? (
        <div className="bg-base-100 rounded-xl p-6 border border-base-300 flex justify-center">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : currentPick ? (
        <div className="bg-primary/10 border-2 border-primary rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs text-primary font-medium">Current Pick</div>
            <span className="badge badge-primary">Active</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-base-content/60">Order</div>
              <div className="font-bold">{currentPick.order}</div>
            </div>
            <div>
              <div className="text-xs text-base-content/60">Location</div>
              <div className="font-bold">{currentPick.location || "TBD"}</div>
            </div>
            <div>
              <div className="text-xs text-base-content/60">Item</div>
              <div className="font-semibold">{currentPick.item}</div>
            </div>
            <div>
              <div className="text-xs text-base-content/60">Required Qty</div>
              <div className="font-semibold">{currentPick.qty}</div>
            </div>
            <div className="col-span-2">
              <div className="text-xs text-base-content/60">Allocation Policy</div>
              <div className="font-medium">{currentPick.allocationPolicy || "FIFO/FEFO standard rule"}</div>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              className="input input-bordered flex-1"
              placeholder="Scan or enter pick location"
              value={scannedLocation}
              onChange={(e) => verifyLocation(e.target.value)}
            />
            <button className="btn btn-outline" onClick={() => setShowLocationScanner(true)}>
              <span className="material-symbols-outlined">qr_code_scanner</span>
            </button>
          </div>
          {currentPick.location ? (
            <div className={`text-xs ${locationVerified ? "text-success" : "text-warning"}`}>
              {locationVerified
                ? `Location verified: ${currentPick.location}`
                : `Verify exact location before pick: ${currentPick.location}`}
            </div>
          ) : (
            <div className="text-xs text-info">Task has no fixed location. Confirm actual bin before picking.</div>
          )}

          <WorkerRouteGuide
            warehouseId={effectiveWarehouseId || undefined}
            orderId={selectedOrder?.id}
            targetLocationCode={currentPick.location}
            targetLocationCodes={picks
              .filter((pick) => pick.status !== "completed" && !pick.skipReason)
              .map((pick) => pick.location)}
            completedLocationCodes={picks
              .filter((pick) => pick.status === "completed")
              .map((pick) => pick.location)}
            operationType="picking"
          />

          <div>
            <label className="label">
              <span className="label-text">Picked Quantity</span>
            </label>
            <input
              type="number"
              className="input input-bordered w-full"
              min={1}
              max={currentPick.qty}
              value={pickedQty}
              onChange={(e) => setPickedQty(Number(e.target.value) || 0)}
            />
          </div>

          <button
            className="btn btn-primary w-full"
            onClick={() => void handleConfirmPick()}
            disabled={
              pickedQty <= 0 ||
              pickedQty > currentPick.qty ||
              startingTaskId === currentPick.taskId ||
              (Boolean(currentPick.location) && !locationVerified)
            }
          >
            Confirm Pick
          </button>

          {!showIssueForm ? (
            <button className="btn btn-outline w-full" onClick={() => setShowIssueForm(true)}>
              Raise Missing/Shortage Issue
            </button>
          ) : (
            <div className="bg-base-100 border border-base-300 rounded-lg p-3 space-y-2">
              <div className="text-sm font-semibold">Raise Picking Issue</div>
              <input
                type="number"
                className="input input-bordered w-full"
                min={0}
                max={currentPick.qty}
                placeholder="Available quantity at location"
                value={availableQty}
                onChange={(e) => setAvailableQty(Number(e.target.value) || 0)}
              />
              <textarea
                className="textarea textarea-bordered w-full"
                rows={2}
                placeholder="Reason (e.g., bin empty, damaged, mismatch)"
                value={issueReason}
                onChange={(e) => setIssueReason(e.target.value)}
              />
              <div className="flex gap-2">
                <button className="btn btn-warning flex-1" onClick={() => void handleRaiseIssue()}>
                  Submit Issue and Continue
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setShowIssueForm(false);
                    setIssueReason("");
                    setAvailableQty(0);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="alert alert-success">All pick tasks for this order are done.</div>
      )}

      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <div className="font-semibold mb-3">Pick Task List</div>
        <div className="space-y-2">
          {picks.map((pick, idx) => {
            const isDone = pick.status === "completed";
            const isCurrent = pick.status === "current";
            const isSkipped = !!pick.skipReason && !isDone;
            return (
              <button
                key={pick.id}
                type="button"
                className={`w-full p-3 rounded-lg border text-left ${
                  isDone
                    ? "bg-success/10 border-success opacity-70 cursor-not-allowed"
                    : isCurrent
                    ? "bg-primary/10 border-primary"
                    : isSkipped
                    ? "bg-warning/10 border-warning"
                    : "bg-base-200 hover:border-primary/40"
                }`}
                disabled={isDone}
                onClick={() => handleSelectPick(idx)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">
                      {pick.location || "TBD"} • {pick.item}
                    </div>
                    <div className="text-xs text-base-content/60">Qty: {pick.qty}</div>
                    {pick.allocationPolicy && (
                      <div className="text-xs text-base-content/60">Policy: {pick.allocationPolicy}</div>
                    )}
                  </div>
                  {isDone ? (
                    <span className="badge badge-success">Done</span>
                  ) : isCurrent ? (
                    <span className="badge badge-primary">Current</span>
                  ) : isSkipped ? (
                    <span className="badge badge-warning">Issue Raised</span>
                  ) : (
                    <span className="badge badge-ghost">Pending</span>
                  )}
                </div>
                {isSkipped && <div className="text-xs text-warning-content/80 mt-1">Reason: {pick.skipReason}</div>}
              </button>
            );
          })}
        </div>
      </div>

      <Modal isOpen={showLocationScanner} onClose={() => setShowLocationScanner(false)} title="Scan Pick Location">
        <QRScanner
          isOpen={showLocationScanner}
          onClose={() => setShowLocationScanner(false)}
          onScan={(result) => {
            verifyLocation(result);
            setShowLocationScanner(false);
            if (currentPick?.location && normalizeLocation(result) !== normalizeLocation(currentPick.location)) {
              showToast.error(`Location mismatch. Expected ${currentPick.location}`);
            }
          }}
        />
      </Modal>
    </div>
  );
}
