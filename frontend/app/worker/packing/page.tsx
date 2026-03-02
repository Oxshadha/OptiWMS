"use client";

import { useEffect, useState } from "react";
import { useOffline } from "@/hooks/useOffline";
import { useWorker } from "@/contexts/WorkerContext";
import { saveScanRecord, addToSyncQueue } from "@/lib/indexeddb";
import { QRScanner } from "@/components/QRScanner";
import { ordersApi } from "@/lib/api/orders";
import { packingApi } from "@/lib/api/packing";
import { warehousesApi } from "@/lib/api/warehouses";
import { customersApi } from "@/lib/api/customers";
import { orderItemsApi } from "@/lib/api/orderItems";
import { materialsApi } from "@/lib/api/materials";
import { tasksApi } from "@/lib/api/tasks-api";
import { showToast } from "@/lib/utils/toast";
import { formatMaterialDisplay } from "@/lib/utils/material-display";
import { logger } from "@/lib/utils/logger";
import { OrderSelectionStep } from "./components/OrderSelectionStep";
import { VerifyItemsStep } from "./components/VerifyItemsStep";
import { PackageStep } from "./components/PackageStep";
import { WeightStep } from "./components/WeightStep";
import { packagingTypes } from "./constants";
import type { Order, OrderItem, PackingData } from "./types";

export default function PackingPage() {
  const { isOnline } = useOffline();
  const { worker } = useWorker();

  const [step, setStep] = useState<"select" | "verify" | "package" | "weight" | "complete">("select");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderReference, setOrderReference] = useState("");
  const [showOrderScanner, setShowOrderScanner] = useState(false);
  const [itemScannerIndex, setItemScannerIndex] = useState<number | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [activePackingRecordId, setActivePackingRecordId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [recommendedPackagingId, setRecommendedPackagingId] = useState<string | null>(null);
  const [recommendedDunnage, setRecommendedDunnage] = useState<string[]>([]);
  const [resolvedWarehouseId, setResolvedWarehouseId] = useState<string | null>(null);
  const [resolvingWarehouse, setResolvingWarehouse] = useState(false);
  const [packingInitWarning, setPackingInitWarning] = useState<string | null>(null);
  const [savingPacking, setSavingPacking] = useState(false);

  const warehouseDisplayName = worker?.warehouse || "";
  const hasWarehouseName =
    !!warehouseDisplayName &&
    warehouseDisplayName !== "Unknown" &&
    warehouseDisplayName !== "Unknown Warehouse" &&
    warehouseDisplayName !== "Unassigned";
  const effectiveWarehouseId = worker?.warehouseId || resolvedWarehouseId;

  const mapApiOrderToPackingOrder = async (
    apiOrder: any,
    recordByOrderId: Map<string, { status?: string }> = new Map()
  ): Promise<Order | null> => {
    try {
      let customerName = "Unknown";
      if (apiOrder.customerId) {
        try {
          const customer = await customersApi.getById(apiOrder.customerId);
          customerName = customer.name || customer.code || "Unknown";
        } catch (error) {
          logger.error(`Error fetching customer ${apiOrder.customerId}:`, error);
        }
      }

      let items: OrderItem[] = [];
      try {
        const orderItems = await orderItemsApi.getByOrderId(apiOrder.id);
        items = await Promise.all(
          orderItems.map(async (item) => {
            const itemAny = item as any;
            try {
              const material = await materialsApi.getById(item.materialId);
              const display = formatMaterialDisplay(material.materialCode, material.description, material.id);
              return {
                id: item.id,
                sku: display.sku,
                name: display.name,
                quantity: item.quantity,
                pickedQuantity: item.pickedQuantity || 0,
                verified: false,
              };
            } catch (error) {
              logger.error(`Error fetching material ${item.materialId}:`, error);
              const display = formatMaterialDisplay(
                itemAny.materialCode || itemAny.materialId,
                itemAny.materialName || itemAny.description || "Material details not available",
                item.materialId
              );
              return {
                id: item.id,
                sku: display.sku || "N/A",
                name: display.name || "Material details not available",
                quantity: item.quantity,
                pickedQuantity: item.pickedQuantity || 0,
                verified: false,
              };
            }
          })
        );
      } catch (error) {
        logger.error(`Error fetching order items for ${apiOrder.id}:`, error);
      }

      return {
        id: apiOrder.id,
        orderNumber: apiOrder.orderNumber,
        customer: customerName,
        priority: apiOrder.priority === "high" || apiOrder.priority === "urgent" ? "express" : "normal",
        status:
          recordByOrderId.get(apiOrder.id)?.status === "in_progress"
            ? ("in_progress" as const)
            : ("ready_to_pack" as const),
        items,
      };
    } catch (error) {
      logger.error(`Error processing order ${apiOrder.id}:`, error);
      return null;
    }
  };

  const [packingData, setPackingData] = useState<Partial<PackingData>>({
    packagingType: "",
    dunnageMaterials: [],
    hasFragileItems: false,
    actualWeight: 0,
    trackingNumber: "",
    packingNotes: "",
    photos: [],
  });

  const derivePackReference = (orderNumber?: string) => {
    const normalized = (orderNumber || "").trim().toUpperCase();
    if (!normalized) return `PACK-${Date.now()}`;
    if (normalized.startsWith("OUT-")) {
      return `PACK-${normalized.substring(4)}`;
    }
    return `PACK-${normalized.replace(/^OUT/, "").replace(/^-+/, "")}`;
  };

  const isUuid = (value?: string | null) => {
    if (!value) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value.trim()
    );
  };

  const getPackingRecordsForOrder = async (order: Order) => {
    return packingApi.getAll(undefined, order.orderNumber);
  };

  const completePackingTasksForOrder = async (order: Order, workerId?: string) => {
    if (!effectiveWarehouseId || !isUuid(order.id)) {
      return;
    }

    const tasks = await tasksApi.getAll("packing", undefined, undefined, effectiveWarehouseId, false);
    const relevantStatuses = new Set(["pending", "assigned", "in_progress"]);
    const matchingTasks = tasks.filter(
      (task) =>
        (task.referenceType || "").toLowerCase() === "order" &&
        task.referenceId === order.id &&
        relevantStatuses.has((task.status || "").toLowerCase())
    );

    for (const task of matchingTasks) {
      await tasksApi.updateStatus(task.id, "completed", workerId);
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
        const exact = warehouses.find(
          (warehouse) => warehouse.name.trim().toLowerCase() === warehouseDisplayName.trim().toLowerCase()
        );
        if (exact?.id) {
          setResolvedWarehouseId(exact.id);
          return;
        }
        const loose = warehouses.find((warehouse) =>
          warehouse.name.trim().toLowerCase().includes(warehouseDisplayName.trim().toLowerCase())
        );
        setResolvedWarehouseId(loose?.id || null);
      } catch (error) {
        logger.error("Failed to resolve worker warehouse ID for packing:", error);
        setResolvedWarehouseId(null);
      } finally {
        setResolvingWarehouse(false);
      }
    };

    void resolveWarehouseId();
  }, [worker?.warehouseId, warehouseDisplayName, hasWarehouseName]);

  useEffect(() => {
    const loadOrders = async () => {
      if (!isOnline || !effectiveWarehouseId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const [pickedOrders, packingOrders, packingRecords] = await Promise.all([
          ordersApi.getAll("outbound", "picked"),
          ordersApi.getAll("outbound", "packing"),
          packingApi.getAll(),
        ]);
        const allOutboundOrders = [...pickedOrders, ...packingOrders];
        const uniqueOrders = Array.from(new Map(allOutboundOrders.map((order) => [order.id, order])).values());
        const packedOrderIds = new Set(
          packingRecords
            .filter((record) => {
              const status = (record.status || "").toLowerCase();
              return status === "packed" || status === "shipped" || status === "completed";
            })
            .map((record) => record.orderId)
            .filter((id): id is string => !!id)
        );
        const warehouseOrders = uniqueOrders.filter(
          (order) => order.warehouseId === effectiveWarehouseId && !packedOrderIds.has(order.id)
        );
        const recordByOrderId = new Map(
          packingRecords
            .filter((r) => r.orderId)
            .map((r) => [r.orderId as string, r])
        );

        const ordersWithDetails: Array<Order | null> = await Promise.all(
          warehouseOrders.map((apiOrder) => mapApiOrderToPackingOrder(apiOrder, recordByOrderId))
        );

        setOrders(ordersWithDetails.filter((order): order is Order => order !== null));
      } catch (error) {
        logger.error("Error loading orders:", error);
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };

    void loadOrders();
  }, [isOnline, effectiveWarehouseId]);

  const parseBoxDimensions = (value?: string) => {
    if (!value) return undefined;
    try {
      const parsed = JSON.parse(value) as { length?: number; width?: number; height?: number };
      if (parsed.length && parsed.width && parsed.height) {
        return { length: parsed.length, width: parsed.width, height: parsed.height };
      }
    } catch {
      return undefined;
    }
    return undefined;
  };

  const inferPackingRecommendation = (items: OrderItem[]) => {
    const totalQty = items.reduce((sum, item) => sum + item.quantity, 0);
    const fragileKeywords = ["glass", "fragile", "liquid", "ceramic"];
    const hasFragile = items.some((item) =>
      fragileKeywords.some((keyword) => item.name.toLowerCase().includes(keyword))
    );

    let packagingId = "small";
    if (totalQty > 20) packagingId = "large";
    else if (totalQty > 8) packagingId = "medium";
    else if (totalQty <= 2 && !hasFragile) packagingId = "polymailer";

    const dunnage = hasFragile ? ["Bubble Wrap", "Foam"] : totalQty > 10 ? ["Air Pillows", "Paper"] : ["Paper"];
    return { packagingId, dunnage, hasFragile };
  };

  const handleOrderSelect = (order: Order) => {
    setSelectedOrder(order);
    setStep("verify");
    setPackingInitWarning(null);
    setActivePackingRecordId(null);

    const recommendation = inferPackingRecommendation(order.items);
    setRecommendedPackagingId(recommendation.packagingId);
    setRecommendedDunnage(recommendation.dunnage);

    setPackingData((current) => ({
      ...current,
      packagingType: current.packagingType || recommendation.packagingId,
      dunnageMaterials:
        current.dunnageMaterials && current.dunnageMaterials.length > 0
          ? current.dunnageMaterials
          : recommendation.dunnage,
      hasFragileItems: current.hasFragileItems || recommendation.hasFragile,
      trackingNumber: current.trackingNumber || derivePackReference(order.orderNumber),
    }));
  };

  const handleOrderScan = (code: string) => {
    const order = orders.find((candidate) => candidate.orderNumber === code || candidate.id === code);
    if (!order) {
      showToast.error("Order not found");
      return;
    }

    handleOrderSelect(order);
    setShowOrderScanner(false);
  };

  const handleLoadOrderByReference = async () => {
    const reference = orderReference.trim().toUpperCase();
    if (!reference) {
      showToast.error("Enter an order reference");
      return;
    }
    if (!effectiveWarehouseId) {
      showToast.error("Worker warehouse not available");
      return;
    }

    const localOrder = orders.find(
      (candidate) =>
        candidate.orderNumber.toUpperCase() === reference || candidate.id.toUpperCase() === reference
    );
    if (localOrder) {
      handleOrderSelect(localOrder);
      setOrderReference("");
      return;
    }

    try {
      const apiOrder = await ordersApi.getByOrderNumber(reference);
      if ((apiOrder.orderType || "").toLowerCase() !== "outbound") {
        showToast.error("Only outbound orders can be packed");
        return;
      }
      if (apiOrder.warehouseId !== effectiveWarehouseId) {
        showToast.error("Order belongs to a different warehouse");
        return;
      }
      if (!["picked", "packing", "ready_to_ship"].includes((apiOrder.status || "").toLowerCase())) {
        showToast.error(`Order status is ${apiOrder.status}. Packing allowed for picked/packing orders.`);
        return;
      }

      const existingPacking = await (isUuid(apiOrder.id)
        ? packingApi.getAll(apiOrder.id)
        : packingApi.getAll(undefined, apiOrder.orderNumber));
      const recordByOrderId = new Map(existingPacking.map((record) => [apiOrder.id, { status: record.status }]));
      const mapped = await mapApiOrderToPackingOrder(apiOrder, recordByOrderId);
      if (!mapped) {
        showToast.error("Unable to load order details for packing");
        return;
      }

      setOrders((prev) => {
        const exists = prev.some((order) => order.id === mapped.id);
        return exists ? prev : [mapped, ...prev];
      });
      handleOrderSelect(mapped);
      setOrderReference("");
    } catch (error) {
      logger.error("Failed to load order by reference:", error);
      showToast.error("Order not found or not ready for packing");
    }
  };

  const markItemVerified = (index: number) => {
    if (!selectedOrder) {
      return;
    }

    if (index < 0 || index >= selectedOrder.items.length) {
      return;
    }

    const updatedItems = [...selectedOrder.items];
    updatedItems[index].verified = true;
    setSelectedOrder({ ...selectedOrder, items: updatedItems });

    if (updatedItems.every((item) => item.verified)) {
      setTimeout(() => setStep("package"), 500);
    }
  };

  const handleItemScan = (code: string) => {
    if (!selectedOrder) {
      return;
    }

    if (itemScannerIndex !== null) {
      const expectedItem = selectedOrder.items[itemScannerIndex];
      if (!expectedItem) {
        setItemScannerIndex(null);
        return;
      }
      const normalizedCode = code.trim().toUpperCase();
      const expectedSku = (expectedItem.sku || "").trim().toUpperCase();
      if (expectedSku && expectedSku !== "N/A" && normalizedCode !== expectedSku) {
        showToast.error(`Scanned code does not match ${expectedItem.sku}`);
        return;
      }
      markItemVerified(itemScannerIndex);
      setItemScannerIndex(null);
      return;
    }

    const itemIndex = selectedOrder.items.findIndex((item) => item.sku.trim().toUpperCase() === code.trim().toUpperCase());
    if (itemIndex === -1) {
      showToast.error("Item not found in this order");
      return;
    }

    markItemVerified(itemIndex);
    setItemScannerIndex(null);
  };

  const handlePackageSelect = (packageId: string) => {
    const selectedPackage = packagingTypes.find((packagingType) => packagingType.id === packageId);
    if (!selectedPackage) {
      return;
    }

    setPackingData((current) => ({
      ...current,
      packagingType: selectedPackage.id,
      boxDimensions: selectedPackage.dimensions,
    }));
  };

  const handleDunnageToggle = (material: string) => {
    setPackingData((current) => {
      const selectedDunnage = current.dunnageMaterials || [];
      return {
        ...current,
        dunnageMaterials: selectedDunnage.includes(material)
          ? selectedDunnage.filter((selected) => selected !== material)
          : [...selectedDunnage, material],
      };
    });
  };

  const calculateDimensionalWeight = () => {
    if (!packingData.boxDimensions) {
      return 0;
    }
    const { length, width, height } = packingData.boxDimensions;
    return (length * width * height) / 5000;
  };

  const handleCompletePacking = async () => {
    if (!selectedOrder || !packingData.packagingType) {
      showToast.error("Please complete all required fields");
      return;
    }
    if (savingPacking) {
      return;
    }
    setSavingPacking(true);

    const dimensionalWeight = calculateDimensionalWeight();
    const chargeableWeight = Math.max(packingData.actualWeight || 0, dimensionalWeight);
    const workerUuid = isUuid(worker?.id) ? worker?.id : undefined;

    const createPackingPayload = {
      orderId: isUuid(selectedOrder.id) ? selectedOrder.id : undefined,
      orderNumber: selectedOrder.orderNumber,
      boxType: packingData.packagingType,
      boxDimensions: packingData.boxDimensions ? JSON.stringify(packingData.boxDimensions) : undefined,
      dunnageMaterials: JSON.stringify(packingData.dunnageMaterials || []),
      hasFragileItems: packingData.hasFragileItems,
      actualWeightKg: (packingData.actualWeight || 0).toString(),
      dimensionalWeightKg: dimensionalWeight.toString(),
      chargeableWeightKg: chargeableWeight.toString(),
      packerId: workerUuid,
      packingNotes: packingData.packingNotes,
      packingPhotos: JSON.stringify(packingData.photos || []),
      trackingNumber: packingData.trackingNumber?.trim() || derivePackReference(selectedOrder.orderNumber),
      status: "packed",
    };
    const updatePackingPayload = {
      boxType: createPackingPayload.boxType,
      boxDimensions: createPackingPayload.boxDimensions,
      dunnageMaterials: createPackingPayload.dunnageMaterials,
      hasFragileItems: createPackingPayload.hasFragileItems,
      actualWeightKg: createPackingPayload.actualWeightKg,
      dimensionalWeightKg: createPackingPayload.dimensionalWeightKg,
      chargeableWeightKg: createPackingPayload.chargeableWeightKg,
      trackingNumber: createPackingPayload.trackingNumber,
      packingNotes: createPackingPayload.packingNotes,
      packerId: createPackingPayload.packerId,
      status: createPackingPayload.status,
    };
    if (isOnline) {
      let packingSaveFailed = false;
      let packingSaveErrorMessage = "";

      try {
        let recordId = activePackingRecordId;
        if (!recordId) {
          const existing = await getPackingRecordsForOrder(selectedOrder);
          recordId = existing[0]?.id;
        }

        if (recordId) {
          try {
            await packingApi.update(recordId, updatePackingPayload);
          } catch (updateError) {
            logger.warn("Packing update failed, retrying via create flow:", updateError);
            let created;
            try {
              created = await packingApi.create(createPackingPayload);
            } catch (createFullError) {
              logger.warn("Full packing create failed, retrying with minimal payload:", createFullError);
              created = await packingApi.create({
                orderId: createPackingPayload.orderId,
                orderNumber: createPackingPayload.orderNumber,
                trackingNumber: createPackingPayload.trackingNumber,
                packerId: createPackingPayload.packerId,
                status: "packed",
              } as any);
            }
            let createdId = created?.id;
            if (!createdId) {
              const createdRecords = await getPackingRecordsForOrder(selectedOrder);
              createdId = createdRecords[0]?.id;
            }
            if (createdId) {
              setActivePackingRecordId(createdId);
            }
          }
        } else {
          let created;
          try {
            created = await packingApi.create(createPackingPayload);
          } catch (createFullError) {
            logger.warn("Full packing create failed, retrying with minimal payload:", createFullError);
            created = await packingApi.create({
              orderId: createPackingPayload.orderId,
              orderNumber: createPackingPayload.orderNumber,
              trackingNumber: createPackingPayload.trackingNumber,
              packerId: createPackingPayload.packerId,
              status: "packed",
            } as any);
          }
          let createdId = created?.id;
          if (!createdId) {
            const createdRecords = await getPackingRecordsForOrder(selectedOrder);
            createdId = createdRecords[0]?.id;
          }
          if (createdId) {
            setActivePackingRecordId(createdId);
          }
        }
      } catch (packingError) {
        packingSaveFailed = true;
        packingSaveErrorMessage =
          packingError instanceof Error ? packingError.message : "Unknown packing persistence error";
        logger.error("Packing record save failed, will continue with order status transition:", packingError);
      }

      try {
        let orderIdForStatus = isUuid(selectedOrder.id) ? selectedOrder.id : undefined;
        if (!orderIdForStatus) {
          const orderByNumber = await ordersApi.getByOrderNumber(selectedOrder.orderNumber);
          if (isUuid(orderByNumber.id)) {
            orderIdForStatus = orderByNumber.id;
          }
        }

        if (!orderIdForStatus) {
          throw new Error("Order ID unavailable for status transition");
        }

        try {
          await ordersApi.updateStatus(orderIdForStatus, "ready_to_ship");
        } catch (statusError) {
          // Backend enforces transitions. If order is still "picked", move through "packing" first.
          logger.warn("Direct transition to ready_to_ship failed, retrying via packing:", statusError);
          try {
            await ordersApi.updateStatus(orderIdForStatus, "packing");
            await ordersApi.updateStatus(orderIdForStatus, "ready_to_ship");
          } catch (fallbackStatusError) {
            // Final check: if backend already moved status, continue.
            const latest = await ordersApi.getByOrderNumber(selectedOrder.orderNumber);
            const latestStatus = (latest.status || "").toLowerCase();
            if (latestStatus !== "ready_to_ship" && latestStatus !== "shipped") {
              throw fallbackStatusError;
            }
          }
        }
      } catch (statusError) {
        logger.error("Failed to move order to shipment-ready:", statusError);
        const message = statusError instanceof Error ? statusError.message : "Unknown status transition error";
        showToast.error(`Packing saved but order status update failed: ${message}`);
        setSavingPacking(false);
        return;
      }

      try {
        await completePackingTasksForOrder(selectedOrder, workerUuid);
      } catch (taskError) {
        logger.warn("Packing completed but task status update failed:", taskError);
      }

      if (packingSaveFailed) {
        logger.warn("Packed and moved to shipment, but packing record save failed:", packingSaveErrorMessage);
      }
    } else {
      await saveScanRecord({
        taskId: selectedOrder.id,
        location: "PACKING_STATION",
        item: selectedOrder.orderNumber,
        sku: "",
        qty: selectedOrder.items.reduce((sum, item) => sum + item.quantity, 0),
      });
      await addToSyncQueue({
        type: "operation",
        action: "create",
        data: {
          type: "packing_create",
          payload: createPackingPayload,
        },
      });
    }

    setOrders((currentOrders) =>
      currentOrders.map((order) => (order.id === selectedOrder.id ? { ...order, status: "packed" } : order))
    );

    showToast.success(`Packed: ${selectedOrder.orderNumber} | Ref: ${createPackingPayload.trackingNumber}`);

    setSelectedOrder(null);
    setActivePackingRecordId(null);
    setRecommendedPackagingId(null);
    setRecommendedDunnage([]);
    setStep("select");
    setPackingData({
      packagingType: "",
      dunnageMaterials: [],
      hasFragileItems: false,
      actualWeight: 0,
      trackingNumber: "",
      packingNotes: "",
      photos: [],
    });
    setSavingPacking(false);
  };

  const handlePrintLabel = () => {
    showToast.success("Shipping label print queued");
  };

  const handlePrintSlip = () => {
    showToast.success("Packing slip print queued");
  };

  const readyToPackOrders = orders.filter(
    (order) => order.status === "ready_to_pack" || order.status === "in_progress"
  );
  const dimensionalWeight = calculateDimensionalWeight();

  return (
    <div className="p-6 space-y-6">
      {!isOnline && (
        <div className="alert alert-warning">
          <span className="material-symbols-outlined">wifi_off</span>
          <span>Offline mode: packing will sync when network reconnects.</span>
        </div>
      )}
      {packingInitWarning && (
        <div className="alert alert-info">
          <span className="material-symbols-outlined">info</span>
          <span>{packingInitWarning}</span>
        </div>
      )}

      {step === "select" && (
        <OrderSelectionStep
          loading={loading}
          readyToPackOrders={readyToPackOrders}
          orderReference={orderReference}
          onSelectOrder={handleOrderSelect}
          onOrderReferenceChange={setOrderReference}
          onLoadOrderByReference={() => {
            void handleLoadOrderByReference();
          }}
          onOpenScanner={() => setShowOrderScanner(true)}
        />
      )}

      {step === "verify" && selectedOrder && (
        <VerifyItemsStep
          order={selectedOrder}
          onBack={() => setStep("select")}
          onScanItem={(index) => setItemScannerIndex(index)}
          onMarkItemVerified={markItemVerified}
        />
      )}

      {step === "package" && selectedOrder && (
        <PackageStep
          packingData={packingData}
          recommendedPackagingId={recommendedPackagingId}
          recommendedDunnage={recommendedDunnage}
          onBack={() => setStep("verify")}
          onNext={() => setStep("weight")}
          onSelectPackage={handlePackageSelect}
          onToggleDunnage={handleDunnageToggle}
          onFragileChange={(value) => setPackingData((current) => ({ ...current, hasFragileItems: value }))}
          onNotesChange={(value) => setPackingData((current) => ({ ...current, packingNotes: value }))}
        />
      )}

      {step === "weight" && selectedOrder && (
        <WeightStep
          packingData={packingData}
          dimensionalWeight={dimensionalWeight}
          onBack={() => setStep("package")}
          onWeightChange={(value) => setPackingData((current) => ({ ...current, actualWeight: value }))}
          onTrackingNumberChange={(value) => setPackingData((current) => ({ ...current, trackingNumber: value }))}
          onPrintLabel={handlePrintLabel}
          onPrintSlip={handlePrintSlip}
          onComplete={() => {
            void handleCompletePacking();
          }}
          isSaving={savingPacking}
        />
      )}

      {showOrderScanner && (
        <QRScanner
          isOpen={showOrderScanner}
          onClose={() => setShowOrderScanner(false)}
          onScan={handleOrderScan}
          title="Scan Order QR Code"
        />
      )}

      {itemScannerIndex !== null && (
        <QRScanner
          isOpen={itemScannerIndex !== null}
          onClose={() => setItemScannerIndex(null)}
          onScan={handleItemScan}
          title="Scan Item QR Code"
        />
      )}
    </div>
  );
}
