"use client";

import { useEffect, useState, type FormEvent } from "react";
import clsx from "clsx";
import { DetailModal } from "@/components/DetailModal";
import { StatusChip, type StatusTone } from "@/components/StatusChip";
import { ordersApi } from "@/lib/api/orders";
import { suppliersApi, Supplier } from "@/lib/api/suppliers";
import { warehousesApi, Warehouse } from "@/lib/api/warehouses";
import { locationsApi, type Location } from "@/lib/api/locations";
import { materialsApi } from "@/lib/api/materials";
import { operationsApi } from "@/lib/api/operations";
import { materialDefaultLocationsApi } from "@/lib/api/materialDefaultLocations";
import {
  AISlottingService,
  type SlottingRecommendationItemResponse,
} from "@/lib/services/aiSlottingService";
import { showToast } from "@/lib/utils/toast";
import { logger } from "@/lib/utils/logger";
import { downloadHtmlDocument, escapeHtml } from "@/lib/utils/documents";
import { statusConfig, type InboundOrderDisplay } from "../types";
<<<<<<< HEAD


function getInboundStatusTone(status: string): StatusTone {
  if (status === "completed") return "success";
  if (status === "cancelled") return "danger";
  if (status === "arrived" || status === "receiving" || status === "putaway") return "info";
  return "warning";
}

export function InboundOrderDetailModal({
  isOpen,
  onClose,
  order,
}: {
  isOpen: boolean;
  onClose: () => void;
  order: InboundOrderDisplay;
}) {
  const status =
    statusConfig[order.status as keyof typeof statusConfig] || statusConfig.ordered;

  return (
    <DetailModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Inbound Order: ${order.orderNumber}`}
      size="lg"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-base-content/60">Order Number</label>
            <p className="font-semibold">{order.orderNumber}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Status</label>
            <p>
              <StatusChip label={status.label} tone={getInboundStatusTone(order.status)} showDot />
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Supplier</label>
            <p className="font-semibold">{order.supplierName}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Warehouse</label>
            <p className="font-semibold">{order.warehouseName}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Order Date</label>
            <p className="font-semibold">{order.orderDate}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Expected Delivery</label>
            <p className="font-semibold">{order.expectedDelivery}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Total Items</label>
            <p className="font-semibold">{order.totalItems}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Received Items</label>
            <p className="font-semibold">
              {order.receivedItems}/{order.totalItems}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          <button
            className="btn btn-primary"
            onClick={() =>
              downloadHtmlDocument(
                `inbound-order-${order.orderNumber}.html`,
                `Inbound Order ${order.orderNumber}`,
                `
                  <h1>Inbound Order ${escapeHtml(order.orderNumber)}</h1>
                  <p class="muted">Generated from OptiWMS</p>
                  <div class="grid section">
                    <div class="card"><strong>Status:</strong><br />${escapeHtml(order.status)}</div>
                    <div class="card"><strong>Supplier:</strong><br />${escapeHtml(order.supplierName)}</div>
                    <div class="card"><strong>Warehouse:</strong><br />${escapeHtml(order.warehouseName)}</div>
                    <div class="card"><strong>Order Date:</strong><br />${escapeHtml(order.orderDate)}</div>
                    <div class="card"><strong>Expected Delivery:</strong><br />${escapeHtml(order.expectedDelivery)}</div>
                    <div class="card"><strong>Items:</strong><br />${escapeHtml(String(order.totalItems))}</div>
                  </div>
                `
              )
            }
          >
            <span className="material-symbols-outlined">print</span>
            Download Order Sheet
          </button>
        </div>
      </div>
    </DetailModal>
  );
}

export function EditInboundOrderModal({
  isOpen,
  onClose,
  onSaved,
  order,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
  order: InboundOrderDisplay;
}) {
  const orderDateValue = order.orderDate || "";
  const [formData, setFormData] = useState({
    expectedDelivery: order.expectedDelivery,
    supplierName: order.supplierName,
    warehouseName: order.warehouseName,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (
      formData.expectedDelivery &&
      orderDateValue &&
      new Date(formData.expectedDelivery) < new Date(orderDateValue)
    ) {
      showToast.error("Expected delivery date cannot be before order date.");
      return;
    }

    try {
      setIsSubmitting(true);
      await ordersApi.update(order.id, {
        expectedDate: formData.expectedDelivery,
        notes: undefined,
        priority: undefined,
      });
      showToast.success("Order updated successfully!");
      await onSaved();
      onClose();
    } catch (error) {
      logger.error("Failed to update order:", error);
      showToast.error("Failed to update order. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DetailModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Order: ${order.orderNumber}`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Expected Delivery *</span>
          </label>
          <input
            type="date"
            className="input input-bordered w-full"
            value={formData.expectedDelivery}
            onChange={(e) =>
              setFormData({ ...formData, expectedDelivery: e.target.value })
            }
            min={orderDateValue || undefined}
            required
          />
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Supplier</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={formData.supplierName}
            disabled
          />
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Warehouse</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={formData.warehouseName}
            disabled
          />
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            Update Order
          </button>
        </div>
      </form>
    </DetailModal>
  );
}

=======
>>>>>>> dev
export function CreateInboundOrderModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
<<<<<<< HEAD
  const [materials, setMaterials] = useState<
    Array<{ id: string; description: string; preferredZone?: string }>
  >([]);
  const [capacityCheckLoading, setCapacityCheckLoading] = useState(false);
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
  const [recommendationView, setRecommendationView] = useState<"recommended" | "manual">("recommended");
=======
  const [warehouseLocations, setWarehouseLocations] = useState<Location[]>([]);
  const [materials, setMaterials] = useState<Array<{ id: string; description: string }>>([]);
  const [supplierHasMaterialLinks, setSupplierHasMaterialLinks] = useState(true);
  const [capacityCheckLoading, setCapacityCheckLoading] = useState(false);
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [recommendationError, setRecommendationError] = useState<string | null>(null);
>>>>>>> dev
  const [capacityPlansByItem, setCapacityPlansByItem] = useState<
    Map<number, {
      feasible: boolean;
      plannedQuantity: number;
      requestedQuantity: number;
      requiredPalletSlots?: number | null;
      availablePalletSlots?: number | null;
      unitsPerPallet?: string | null;
      notes: string[];
    }>
  >(new Map());
  const [recommendationsByItem, setRecommendationsByItem] = useState<
    Map<number, SlottingRecommendationItemResponse>
  >(new Map());
  const [formData, setFormData] = useState({
    supplierId: "",
    warehouseId: "",
    orderDate: new Date().toISOString().split("T")[0],
    expectedDeliveryDate: "",
    notes: "",
    items: [] as Array<{
      productId: string;
      quantityOrdered: number;
      locationCode: string;
      weightKg: number;
<<<<<<< HEAD
      lengthCm: number;
      widthCm: number;
      heightCm: number;
=======
      heightCm: number;
      lengthCm: number;
      widthCm: number;
>>>>>>> dev
      batchNumber: string;
      manufactureDate: string;
      expiryDate: string;
    }>,
  });

<<<<<<< HEAD
  const buildRecommendationRequestItems = () => {
    const materialMap = new Map(materials.map((material) => [material.id, material]));

    return formData.items
      .filter((item) => item.productId)
      .map((item) => {
        const material = materialMap.get(item.productId);
        const volumeCm3 =
          item.lengthCm > 0 && item.widthCm > 0 && item.heightCm > 0
            ? item.lengthCm * item.widthCm * item.heightCm
            : undefined;

        return {
          material_id: item.productId,
          quantity: item.quantityOrdered,
          weight_kg: item.weightKg > 0 ? item.weightKg : undefined,
          volume_cm3: volumeCm3,
          length_cm: item.lengthCm > 0 ? item.lengthCm : undefined,
          width_cm: item.widthCm > 0 ? item.widthCm : undefined,
          height_cm: item.heightCm > 0 ? item.heightCm : undefined,
          preferred_zone: material?.preferredZone || undefined,
          current_location_code: item.locationCode || undefined,
        };
      });
  };

  const hasIncompleteMeasurements = formData.items.some(
    (item) =>
      item.weightKg <= 0 ||
      item.lengthCm <= 0 ||
      item.widthCm <= 0 ||
      item.heightCm <= 0
  );
  const hasInfeasibleCapacity = formData.items.some((_, idx) => {
    const plan = capacityPlansByItem.get(idx);
    return !!plan && !plan.feasible;
  });
=======
  const hasInfeasibleCapacity = formData.items.some((_, idx) => !!capacityPlansByItem.get(idx) && !capacityPlansByItem.get(idx)?.feasible);

  const buildRecommendationRequestItems = () =>
    formData.items.map((item) => ({
      material_id: item.productId,
      quantity: item.quantityOrdered,
      weight_kg: item.weightKg > 0 ? item.weightKg : undefined,
      volume_cm3:
        item.lengthCm > 0 && item.widthCm > 0 && item.heightCm > 0
          ? item.lengthCm * item.widthCm * item.heightCm
          : undefined,
      length_cm: item.lengthCm > 0 ? item.lengthCm : undefined,
      width_cm: item.widthCm > 0 ? item.widthCm : undefined,
      height_cm: item.heightCm > 0 ? item.heightCm : undefined,
      current_location_code: item.locationCode || undefined,
    }));

  const submitInboundOrder = async (
    itemsOverride: typeof formData.items = formData.items
  ) => {
    try {
      setIsSubmitting(true);
      setError(null);

      if (!formData.supplierId || !formData.warehouseId || !formData.expectedDeliveryDate) {
        setError("Please fill in all required fields.");
        return;
      }

      if (new Date(formData.expectedDeliveryDate) < new Date(formData.orderDate)) {
        setError("Expected delivery date cannot be before order date.");
        return;
      }

      if (itemsOverride.length === 0) {
        setError("Please add at least one item to the order.");
        return;
      }

      const invalidItems = itemsOverride.filter((item) => !item.productId || item.quantityOrdered <= 0);
      if (invalidItems.length > 0) {
        setError("Please ensure all items have a product selected and quantity greater than 0.");
        return;
      }

      const incompletePackageItems = itemsOverride.filter(
        (item) =>
          item.weightKg <= 0 ||
          item.heightCm <= 0 ||
          item.lengthCm <= 0 ||
          item.widthCm <= 0
      );
      if (incompletePackageItems.length > 0) {
        setError(
          "Please enter positive weight, height, length, and width for every item."
        );
        return;
      }

      const invalidDates = itemsOverride.filter(
        (item) =>
          item.manufactureDate &&
          item.expiryDate &&
          new Date(item.expiryDate) <= new Date(item.manufactureDate)
      );
      if (invalidDates.length > 0) {
        setError("Expiry date must be after manufacture date for all items. Please correct the dates.");
        return;
      }

      const invalidManufactureDates = itemsOverride.filter(
        (item) => item.manufactureDate && new Date(item.manufactureDate) > new Date(formData.orderDate)
      );
      if (invalidManufactureDates.length > 0) {
        setError("Manufacture date cannot be later than order date.");
        return;
      }

      const infeasibleItems = itemsOverride.filter((_, idx) => {
        const plan = capacityPlansByItem.get(idx);
        return !!plan && !plan.feasible;
      });
      if (infeasibleItems.length > 0) {
        setError(
          "One or more items do not have enough storage capacity. Adjust quantities or locations before creating this order."
        );
        return;
      }

      const orderNumber = `PO-${Date.now()}`;
      const createdOrder = await ordersApi.create({
        orderNumber,
        orderType: "inbound",
        supplierId: formData.supplierId,
        warehouseId: formData.warehouseId,
        orderDate: formData.orderDate,
        expectedDate: formData.expectedDeliveryDate,
        notes: formData.notes || undefined,
        status: "pending",
        priority: "normal",
      });

      if (!supplierHasMaterialLinks) {
        const uniqueMaterialIds = Array.from(new Set(itemsOverride.map((item) => item.productId).filter(Boolean)));
        if (uniqueMaterialIds.length > 0) {
          await suppliersApi.replaceMaterials(formData.supplierId, uniqueMaterialIds);
        }
      }

      const { orderItemsApi } = await import("@/lib/api/orderItems");
      try {
        await Promise.all(
          itemsOverride.map((item) =>
            orderItemsApi.create(createdOrder.id, {
              materialId: item.productId,
              quantity: item.quantityOrdered,
              locationCode: item.locationCode || undefined,
              weightKg: item.weightKg || undefined,
              heightCm: item.heightCm || undefined,
              lengthCm: item.lengthCm || undefined,
              widthCm: item.widthCm || undefined,
              batchNumber: item.batchNumber || undefined,
              manufactureDate: item.manufactureDate || undefined,
              expiryDate: item.expiryDate || undefined,
            })
          )
        );
      } catch (itemError) {
        logger.error("Failed to create order items:", itemError);
        setError("Order created but failed to add items. Please edit the order to add items.");
      }

      showToast.success(`Inbound order created successfully with ${itemsOverride.length} item(s)!`);
      await onSaved();
      onClose();
    } catch (err) {
      logger.error("Failed to create inbound order:", err);
      setError(err instanceof Error ? err.message : "Failed to create order. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmRecommendedLocations = async () => {
    const confirmedItems = formData.items.map((item, idx) => {
      const recommendation = recommendationsByItem.get(idx);
      return {
        ...item,
        locationCode: recommendation?.recommended_location_code || item.locationCode,
      };
    });

    await submitInboundOrder(confirmedItems);
  };
>>>>>>> dev

  useEffect(() => {
    const loadData = async () => {
      try {
        const [suppliersData, warehousesData] = await Promise.all([
          suppliersApi.getAll(),
          warehousesApi.getAll(),
        ]);
        setSuppliers(suppliersData);
        setWarehouses(warehousesData);
      } catch (err) {
        logger.error("Failed to load suppliers/warehouses:", err);
      }
    };
    void loadData();
  }, []);

  useEffect(() => {
    const loadWarehouseLocations = async () => {
      if (!formData.warehouseId) {
        setWarehouseLocations([]);
        return;
      }

      try {
<<<<<<< HEAD
        const storageLocations = await locationsApi.getStorageLocationsByWarehouse(formData.warehouseId);
        setWarehouseLocations(storageLocations);
=======
        const locations = await locationsApi.getStorageLocationsByWarehouse(formData.warehouseId);
        setWarehouseLocations(locations);
>>>>>>> dev
      } catch (err) {
        logger.error("Failed to load warehouse locations:", err);
        setWarehouseLocations([]);
      }
    };

    void loadWarehouseLocations();
  }, [formData.warehouseId]);

  useEffect(() => {
    const loadSupplierMaterials = async () => {
      if (!formData.supplierId) {
        setMaterials([]);
        setSupplierHasMaterialLinks(true);
        return;
      }

      try {
        const supplierMaterials = await materialsApi.getAll(undefined, formData.supplierId);
        if (supplierMaterials.length > 0) {
          setSupplierHasMaterialLinks(true);
          setMaterials(supplierMaterials);
          setFormData((prev) => ({
            ...prev,
            items: prev.items.filter((item) => supplierMaterials.some((m) => m.id === item.productId)),
          }));
        } else {
          setSupplierHasMaterialLinks(false);
          const allMaterials = await materialsApi.getAll();
          setMaterials(allMaterials);
        }
      } catch (err) {
        logger.error("Failed to load supplier materials:", err);
        setSupplierHasMaterialLinks(true);
        setMaterials([]);
      }
    };

    void loadSupplierMaterials();
  }, [formData.supplierId]);

  useEffect(() => {
    const runCapacityCheck = async () => {
      if (step !== 4 || !formData.warehouseId || formData.items.length === 0) {
        setCapacityPlansByItem(new Map());
        setCapacityCheckLoading(false);
        return;
      }

      setCapacityCheckLoading(true);
      const resultMap = new Map<number, {
        feasible: boolean;
        plannedQuantity: number;
        requestedQuantity: number;
        requiredPalletSlots?: number | null;
        availablePalletSlots?: number | null;
        unitsPerPallet?: string | null;
        notes: string[];
      }>();

      for (let idx = 0; idx < formData.items.length; idx += 1) {
        const item = formData.items[idx];
        if (!item.productId || !item.quantityOrdered || item.quantityOrdered <= 0) {
          continue;
        }

        try {
          let preferredLocationCode: string | undefined;
          try {
            const defaults = await materialDefaultLocationsApi.getDefaultLocations(item.productId, formData.warehouseId);
            const primary = defaults.find((d) => d.priority === 1) || defaults[0];
            preferredLocationCode = item.locationCode || primary?.locationCode || undefined;
          } catch {
            preferredLocationCode = item.locationCode || undefined;
          }

          const plan = await operationsApi.planPutawaySplit({
            warehouseId: formData.warehouseId,
            materialId: item.productId,
            quantity: item.quantityOrdered,
            preferredLocationCode,
          });

          resultMap.set(idx, {
            feasible: !!plan.feasible,
            plannedQuantity: plan.plannedQuantity,
            requestedQuantity: plan.requestedQuantity,
            requiredPalletSlots: plan.requiredPalletSlots,
            availablePalletSlots: plan.availablePalletSlots,
            unitsPerPallet: plan.unitsPerPallet,
            notes: plan.notes || [],
          });
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Capacity check failed";
          resultMap.set(idx, {
            feasible: false,
            plannedQuantity: 0,
            requestedQuantity: item.quantityOrdered,
            requiredPalletSlots: null,
            availablePalletSlots: null,
            unitsPerPallet: null,
            notes: [msg],
          });
        }
      }

      setCapacityPlansByItem(resultMap);
      setCapacityCheckLoading(false);
    };

    void runCapacityCheck();
  }, [step, formData.warehouseId, formData.items]);

  useEffect(() => {
    const loadRecommendations = async () => {
<<<<<<< HEAD
      if (step !== 5 || !formData.warehouseId || formData.items.length === 0 || hasIncompleteMeasurements) {
        setRecommendationLoading(false);
        setRecommendationError(null);
        setRecommendationsByItem(new Map());
        return;
      }

      setRecommendationLoading(true);
      setRecommendationError(null);

      try {
        const response = await AISlottingService.recommendPlacement({
          warehouse_id: formData.warehouseId,
          items: buildRecommendationRequestItems(),
          population_size: 20,
          generations: 50,
          mutation_rate: 0.05,
          top_k_alternatives: 3,
        });

        const recommendationMap = new Map<number, SlottingRecommendationItemResponse>();
        response.recommendations.forEach((recommendation, index) => {
          recommendationMap.set(index, recommendation);
        });
        setRecommendationsByItem(recommendationMap);
      } catch (err) {
        logger.error("Failed to load GA recommendations:", err);
        setRecommendationError(err instanceof Error ? err.message : "Failed to generate recommendations.");
        setRecommendationsByItem(new Map());
      } finally {
        setRecommendationLoading(false);
      }
    };

    void loadRecommendations();
  }, [step, formData.warehouseId, formData.items, hasIncompleteMeasurements]);

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setError(null);

      if (!formData.supplierId || !formData.warehouseId || !formData.expectedDeliveryDate) {
        setError("Please fill in all required fields.");
=======
      if (step !== 5 || !formData.warehouseId || formData.items.length === 0) {
        setRecommendationLoading(false);
        setRecommendationError(null);
        setRecommendationsByItem(new Map());
>>>>>>> dev
        return;
      }

      setRecommendationLoading(true);
      setRecommendationError(null);

      try {
<<<<<<< HEAD
        await Promise.all(
          formData.items.map((item, idx) =>
            orderItemsApi.create(createdOrder.id, {
              materialId: item.productId,
              quantity: item.quantityOrdered,
              locationCode:
                item.locationCode ||
                recommendationsByItem.get(idx)?.recommended_location_code.split(" ")[0] ||
                undefined,
              batchNumber: item.batchNumber || undefined,
              manufactureDate: item.manufactureDate || undefined,
              expiryDate: item.expiryDate || undefined,
            })
          )
        );
      } catch (itemError) {
        logger.error("Failed to create order items:", itemError);
        setError("Order created but failed to add items. Please edit the order to add items.");
      }
=======
        const response = await AISlottingService.recommendPlacement({
          warehouse_id: formData.warehouseId,
          items: buildRecommendationRequestItems(),
          population_size: 20,
          generations: 50,
          mutation_rate: 0.05,
          top_k_alternatives: 3,
        });
>>>>>>> dev

        const recommendationMap = new Map<number, SlottingRecommendationItemResponse>();
        response.recommendations.forEach((recommendation, index) => {
          recommendationMap.set(index, recommendation);
        });
        setRecommendationsByItem(recommendationMap);
      } catch (err) {
        logger.error("Failed to load slotting recommendations:", err);
        setRecommendationError(err instanceof Error ? err.message : "Failed to generate AI location recommendations.");
        setRecommendationsByItem(new Map());
      } finally {
        setRecommendationLoading(false);
      }
    };

    void loadRecommendations();
  }, [step, formData.warehouseId, formData.items]);

  const currentStepCount = 5;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-base-100 rounded-xl border border-base-300 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-base-300">
          <h2 className="text-2xl font-bold text-base-content">Create Inbound Order</h2>
          <button onClick={onClose} className="btn btn-ghost btn-sm btn-circle">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex items-center justify-center p-4 border-b border-base-300">
          <div className="flex items-center gap-2">
<<<<<<< HEAD
            {[1, 2, 3, 4, 5].map((s) => (
=======
            {Array.from({ length: currentStepCount }, (_, index) => index + 1).map((s) => (
>>>>>>> dev
              <div key={s} className="flex items-center">
                <div
                  className={clsx(
                    "w-8 h-8 rounded-full flex items-center justify-center font-semibold",
                    step >= s ? "bg-primary text-primary-content" : "bg-base-300 text-base-content/60"
                  )}
                >
                  {s}
                </div>
<<<<<<< HEAD
                {s < 5 && (
                  <div
                    className={clsx("w-16 h-1 mx-2", step > s ? "bg-primary" : "bg-base-300")}
                  />
=======
                {s < currentStepCount && (
                  <div className={clsx("w-16 h-1 mx-2", step > s ? "bg-primary" : "bg-base-300")} />
>>>>>>> dev
                )}
              </div>
            ))}
          </div>
        </div>

        {step === 1 && (
          <div className="p-6 space-y-4">
            <h3 className="text-lg font-semibold text-base-content mb-4">Order Details</h3>
            <div className="form-control">
              <label className="label"><span className="label-text font-medium">Supplier *</span></label>
              <select className="select select-bordered w-full" value={formData.supplierId} onChange={(e) => setFormData({ ...formData, supplierId: e.target.value, items: [] })} required>
                <option value="">Select supplier</option>
                {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text font-medium">Warehouse *</span></label>
              <select className="select select-bordered w-full" value={formData.warehouseId} onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value, items: formData.items.map((item) => ({ ...item, locationCode: "" })) })} required>
                <option value="">Select warehouse</option>
                {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text font-medium">Order Date *</span></label>
              <input type="date" className="input input-bordered w-full" value={formData.orderDate} onChange={(e) => setFormData({ ...formData, orderDate: e.target.value })} required />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text font-medium">Expected Delivery Date *</span></label>
              <input type="date" className="input input-bordered w-full" value={formData.expectedDeliveryDate} onChange={(e) => setFormData({ ...formData, expectedDeliveryDate: e.target.value })} min={formData.orderDate || undefined} required />
            </div>
            <div className="form-control">
              <label className="label"><span className="label-text font-medium">Notes</span></label>
              <textarea className="textarea textarea-bordered w-full" rows={3} value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Additional notes..." />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={() => setStep(2)}>Next</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="p-6 space-y-4">
            <h3 className="text-lg font-semibold text-base-content mb-4">Add Items</h3>
            {!formData.supplierId && <div className="alert alert-warning"><span>Select a supplier first to load available materials.</span></div>}
            {formData.supplierId && materials.length === 0 && <div className="alert alert-info"><span>No materials are linked to this supplier yet. Add supplier-material links before creating the inbound order.</span></div>}
            {formData.supplierId && materials.length > 0 && !supplierHasMaterialLinks && <div className="alert alert-info"><span>No supplier-material links exist yet. Selected items will initialize the supplier mapping.</span></div>}
            <div className="space-y-4">
              {formData.items.map((item, idx) => (
                <div key={idx} className="card bg-base-200 p-4 rounded-lg">
                  <div className="flex justify-between items-start mb-3">
                    <span className="font-semibold">Item {idx + 1}</span>
                    <button className="btn btn-ghost btn-xs" onClick={() => setFormData({ ...formData, items: formData.items.filter((_, i) => i !== idx) })}><span className="material-symbols-outlined text-sm">close</span></button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
<<<<<<< HEAD
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text text-xs">Product *</span>
                      </label>
                      <select
                        className="select select-bordered select-sm"
                        value={item.productId}
                        onChange={(e) => {
                          const newItems = [...formData.items];
                          newItems[idx].productId = e.target.value;
                          setFormData({ ...formData, items: newItems });
                        }}
                        required
                      >
                        <option value="">Select material</option>
                        {materials.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.description}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text text-xs">Quantity *</span>
                      </label>
                      <input
                        type="number"
                        className="input input-bordered input-sm"
                        value={item.quantityOrdered}
                        onChange={(e) => {
                          const newItems = [...formData.items];
                          newItems[idx].quantityOrdered = parseInt(e.target.value) || 0;
                          setFormData({ ...formData, items: newItems });
                        }}
                        required
                        min="1"
                      />
                    </div>
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text text-xs">Batch Number</span>
                      </label>
                      <input
                        type="text"
                        className="input input-bordered input-sm"
                        value={item.batchNumber}
                        onChange={(e) => {
                          const newItems = [...formData.items];
                          newItems[idx].batchNumber = e.target.value;
                          setFormData({ ...formData, items: newItems });
                        }}
                      />
                    </div>
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text text-xs">Manufacture Date</span>
                      </label>
                      <input
                        type="date"
                        className={`input input-bordered input-sm ${item.manufactureDate &&
                          item.expiryDate &&
                          new Date(item.expiryDate) <= new Date(item.manufactureDate)
                          ? "input-error"
                          : ""
                          }`}
                        value={item.manufactureDate}
                        onChange={(e) => {
                          const newItems = [...formData.items];
                          newItems[idx].manufactureDate = e.target.value;
                          setFormData({ ...formData, items: newItems });
                        }}
                        max={formData.orderDate || item.expiryDate || undefined}
                      />
                      {item.manufactureDate &&
                        item.expiryDate &&
                        new Date(item.expiryDate) <= new Date(item.manufactureDate) && (
                          <label className="label">
                            <span className="label-text-alt text-error">
                              Expiry date must be after manufacture date
                            </span>
                          </label>
                        )}
                    </div>
                    <div className="form-control col-span-2">
                      <label className="label">
                        <span className="label-text text-xs">Expiry Date</span>
                      </label>
                      <input
                        type="date"
                        className={`input input-bordered input-sm ${item.manufactureDate &&
                          item.expiryDate &&
                          new Date(item.expiryDate) <= new Date(item.manufactureDate)
                          ? "input-error"
                          : ""
                          }`}
                        value={item.expiryDate}
                        onChange={(e) => {
                          const newItems = [...formData.items];
                          newItems[idx].expiryDate = e.target.value;
                          setFormData({ ...formData, items: newItems });
                        }}
                        min={item.manufactureDate || undefined}
                      />
                      {item.manufactureDate &&
                        item.expiryDate &&
                        new Date(item.expiryDate) <= new Date(item.manufactureDate) && (
                          <label className="label">
                            <span className="label-text-alt text-error">
                              Expiry date must be after manufacture date
                            </span>
                          </label>
                        )}
                    </div>
                  </div>
                </div>
              ))}
              <button
                className="btn btn-outline btn-sm w-full"
                disabled={!formData.supplierId || materials.length === 0}
                onClick={() => {
                  setFormData({
                    ...formData,
                    items: [
                      ...formData.items,
                      {
                        productId: "",
                        quantityOrdered: 0,
                        locationCode: "",
                        weightKg: 0,
                        lengthCm: 0,
                        widthCm: 0,
                        heightCm: 0,
                        batchNumber: "",
                        manufactureDate: "",
                        expiryDate: "",
                      },
                    ],
                  });
                }}
              >
                <span className="material-symbols-outlined">add</span>
                Add Another Item
              </button>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button className="btn btn-ghost" onClick={() => setStep(1)}>
                Back
              </button>
              <button className="btn btn-primary" onClick={() => setStep(3)}>
                Next
              </button>
=======
                    <div className="form-control"><label className="label"><span className="label-text text-xs">Product *</span></label><select className="select select-bordered select-sm" value={item.productId} onChange={(e) => { const next = [...formData.items]; next[idx].productId = e.target.value; setFormData({ ...formData, items: next }); }} required><option value="">Select material</option>{materials.map((m) => <option key={m.id} value={m.id}>{m.description}</option>)}</select></div>
                    <div className="form-control"><label className="label"><span className="label-text text-xs">Quantity *</span></label><input type="number" className="input input-bordered input-sm" value={item.quantityOrdered} onChange={(e) => { const next = [...formData.items]; next[idx].quantityOrdered = parseInt(e.target.value) || 0; setFormData({ ...formData, items: next }); }} required min="1" /></div>
                    <div className="form-control"><label className="label"><span className="label-text text-xs">Batch Number</span></label><input type="text" className="input input-bordered input-sm" value={item.batchNumber} onChange={(e) => { const next = [...formData.items]; next[idx].batchNumber = e.target.value; setFormData({ ...formData, items: next }); }} /></div>
                    <div className="form-control"><label className="label"><span className="label-text text-xs">Manufacture Date</span></label><input type="date" className="input input-bordered input-sm" value={item.manufactureDate} onChange={(e) => { const next = [...formData.items]; next[idx].manufactureDate = e.target.value; setFormData({ ...formData, items: next }); }} max={formData.orderDate || item.expiryDate || undefined} /></div>
                    <div className="form-control col-span-2"><label className="label"><span className="label-text text-xs">Expiry Date</span></label><input type="date" className="input input-bordered input-sm" value={item.expiryDate} onChange={(e) => { const next = [...formData.items]; next[idx].expiryDate = e.target.value; setFormData({ ...formData, items: next }); }} min={item.manufactureDate || undefined} /></div>
                  </div>
                </div>
              ))}
              <button className="btn btn-outline btn-sm w-full" disabled={!formData.supplierId || materials.length === 0} onClick={() => setFormData({ ...formData, items: [...formData.items, { productId: "", quantityOrdered: 0, locationCode: "", weightKg: 0, heightCm: 0, lengthCm: 0, widthCm: 0, batchNumber: "", manufactureDate: "", expiryDate: "" }] })}><span className="material-symbols-outlined">add</span>Add Another Item</button>
>>>>>>> dev
            </div>
            <div className="flex justify-end gap-3 pt-4"><button className="btn btn-ghost" onClick={() => setStep(1)}>Back</button><button className="btn btn-primary" onClick={() => setStep(3)}>Next</button></div>
          </div>
        )}

        {step === 3 && (
          <div className="p-6 space-y-4">
            <h3 className="text-lg font-semibold text-base-content mb-4">Warehouse Location & Package Details</h3>
            {formData.warehouseId && warehouseLocations.length === 0 && <div className="alert alert-warning"><span>No storage locations found for this warehouse.</span></div>}
            <div className="space-y-4">
              {formData.items.map((item, idx) => {
                return (
                  <div key={idx} className="card bg-base-200 p-4 rounded-lg space-y-4">
                    <div className="flex items-center justify-between"><span className="font-semibold">Item {idx + 1}</span><span className="text-xs text-base-content/60">{materials.find((m) => m.id === item.productId)?.description || "Select product"}</span></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="form-control"><label className="label"><span className="label-text font-medium">Weight (kg)</span></label><input type="number" step="0.01" min="0.01" className="input input-bordered w-full" value={item.weightKg} onChange={(e) => { const next = [...formData.items]; next[idx].weightKg = Number(e.target.value) || 0; setFormData({ ...formData, items: next }); }} /></div>
                      <div className="form-control"><label className="label"><span className="label-text font-medium">Height (cm)</span></label><input type="number" step="0.01" min="0.01" className="input input-bordered w-full" value={item.heightCm} onChange={(e) => { const next = [...formData.items]; next[idx].heightCm = Number(e.target.value) || 0; setFormData({ ...formData, items: next }); }} /></div>
                      <div className="form-control"><label className="label"><span className="label-text font-medium">Length (cm)</span></label><input type="number" step="0.01" min="0.01" className="input input-bordered w-full" value={item.lengthCm} onChange={(e) => { const next = [...formData.items]; next[idx].lengthCm = Number(e.target.value) || 0; setFormData({ ...formData, items: next }); }} /></div>
                      <div className="form-control"><label className="label"><span className="label-text font-medium">Width (cm)</span></label><input type="number" step="0.01" min="0.01" className="input input-bordered w-full" value={item.widthCm} onChange={(e) => { const next = [...formData.items]; next[idx].widthCm = Number(e.target.value) || 0; setFormData({ ...formData, items: next }); }} /></div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end gap-3 pt-4"><button className="btn btn-ghost" onClick={() => setStep(2)}>Back</button><button className="btn btn-primary" onClick={() => setStep(4)}>Next</button></div>
          </div>
        )}

        {step === 4 && (
          <div className="p-6 space-y-4">
            <h3 className="text-lg font-semibold text-base-content mb-4">Review & Confirm</h3>
            <div className="card bg-base-200 p-4 rounded-lg space-y-2">
              <div className="flex justify-between"><span className="text-base-content/60">Supplier:</span><span className="font-semibold">{suppliers.find((s) => s.id === formData.supplierId)?.name || "—"}</span></div>
              <div className="flex justify-between"><span className="text-base-content/60">Warehouse:</span><span className="font-semibold">{warehouses.find((w) => w.id === formData.warehouseId)?.name || "—"}</span></div>
              <div className="flex justify-between"><span className="text-base-content/60">Order Date:</span><span className="font-semibold">{formData.orderDate}</span></div>
              <div className="flex justify-between"><span className="text-base-content/60">Expected Delivery:</span><span className="font-semibold">{formData.expectedDeliveryDate}</span></div>
              <div className="flex justify-between"><span className="text-base-content/60">Total Items:</span><span className="font-semibold">{formData.items.length}</span></div>
            </div>
            <div className="divider"></div>
            <div className="space-y-2">
              <h4 className="font-semibold">Items:</h4>
              {formData.items.map((item, idx) => (
                <div key={idx} className="rounded-lg border border-base-300 bg-base-200 px-3 py-2 text-sm space-y-1">
                  <div className="flex justify-between"><span>Item {idx + 1}</span><span>Qty: {item.quantityOrdered}</span></div>
                  <div className="text-base-content/70">Location: {item.locationCode || "Not selected"} | Weight: {item.weightKg} kg | Size: {item.lengthCm} x {item.widthCm} x {item.heightCm} cm</div>
                  {capacityPlansByItem.get(idx) && (
                    <div className="text-xs">
                      {capacityPlansByItem.get(idx)?.feasible ? <span className="text-success">Capacity OK ({capacityPlansByItem.get(idx)?.plannedQuantity}/{capacityPlansByItem.get(idx)?.requestedQuantity})</span> : <span className="text-error">Capacity insufficient ({capacityPlansByItem.get(idx)?.plannedQuantity}/{capacityPlansByItem.get(idx)?.requestedQuantity}){capacityPlansByItem.get(idx)?.notes?.[0] ? ` - ${capacityPlansByItem.get(idx)?.notes?.[0]}` : ""}</span>}
                      {capacityPlansByItem.get(idx)?.requiredPalletSlots != null && <div className="text-base-content/70 mt-1">Required pallet slots: {capacityPlansByItem.get(idx)?.requiredPalletSlots} | Available: {capacityPlansByItem.get(idx)?.availablePalletSlots ?? 0}{capacityPlansByItem.get(idx)?.unitsPerPallet ? ` | Units/Pallet: ${capacityPlansByItem.get(idx)?.unitsPerPallet}` : ""}</div>}
                    </div>
                  )}
                </div>
              ))}
              {capacityCheckLoading && <div className="text-xs text-base-content/60 flex items-center gap-2"><span className="loading loading-spinner loading-xs"></span>Checking storage capacity...</div>}
            </div>
            <div className="flex justify-end gap-3 pt-4"><button className="btn btn-ghost" onClick={() => setStep(3)} disabled={isSubmitting}>Back</button><button className="btn btn-primary" onClick={() => setStep(5)} disabled={isSubmitting || capacityCheckLoading || hasInfeasibleCapacity}>Next</button></div>
          </div>
        )}

        {step === 5 && (
          <div className="p-6 space-y-4">
            <h3 className="text-lg font-semibold text-base-content mb-4">AI Recommended Locations</h3>
            {recommendationError && <div className="alert alert-warning"><span>{recommendationError}</span></div>}
            <div className="space-y-4">
              {formData.items.map((item, idx) => {
                const recommendation = recommendationsByItem.get(idx);
                const recommendedLocation = recommendation ? warehouseLocations.find((location) => location.locationCode === recommendation.recommended_location_code) : undefined;
                return (
                  <div key={idx} className="card bg-base-200 p-4 rounded-lg space-y-3 border border-base-300">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold">Item {idx + 1}</div>
                        <div className="text-xs text-base-content/60">{materials.find((m) => m.id === item.productId)?.description || item.productId}</div>
                      </div>
                      <span className="badge badge-outline">Qty {item.quantityOrdered}</span>
                    </div>
                    {recommendationLoading && <div className="flex items-center gap-2 text-sm text-base-content/60"><span className="loading loading-spinner loading-xs"></span>Generating recommendation...</div>}
                    {!recommendationLoading && recommendation && (
                      <>
                        <div className="rounded-xl bg-base-100 border border-primary/20 p-4 space-y-2">
                          <div className="text-xs uppercase tracking-wide text-base-content/60">Recommended Warehouse Location</div>
                          <div className="text-2xl font-bold text-primary">{recommendation.recommended_location_code}</div>
                          {recommendedLocation && (
                            <div className="text-sm text-base-content/70 space-y-1">
                              <div>Area: {recommendedLocation.area || "-"} | Row: {recommendedLocation.rowNumber || "-"} | Bay: {recommendedLocation.bayNumber || "-"}</div>
                              <div>Level: {recommendedLocation.levelNumber || "-"} | Bin: {recommendedLocation.binPosition || "-"}</div>
                              <div>Zone: {recommendedLocation.zoneType || recommendedLocation.locationType || "storage"}</div>
                            </div>
                          )}
                          <div className="text-sm text-base-content/70">Reason: {recommendation.reason}</div>
                        </div>
                        <div className="space-y-2">
                          <div className="text-sm font-semibold">Alternatives</div>
                          <div className="flex flex-wrap gap-2">
                            {recommendation.alternatives.map((alternative) => (
                              <span key={alternative.location_id} className="badge badge-ghost">{alternative.location_code}</span>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                    {!recommendationLoading && !recommendation && (
                      <div className="alert alert-info"><span>No AI recommendation available yet. Use manual selection or try again.</span></div>
                    )}
                    <div className="text-xs text-base-content/70">Current manual location: {item.locationCode || "Not selected"}</div>

                    <div className="form-control">
                      <label className="label"><span className="label-text text-xs">Manual Location (optional)</span></label>
                      {warehouseLocations.length > 0 ? (
                        <select
                          className="select select-bordered select-sm"
                          value={item.locationCode}
                          onChange={(e) => {
                            const next = [...formData.items];
                            next[idx].locationCode = e.target.value;
                            setFormData({ ...formData, items: next });
                          }}
                        >
                          <option value="">Use recommended / none</option>
                          {warehouseLocations.map((location) => (
                            <option key={location.id} value={location.locationCode}>{location.locationCode}</option>
                          ))}
                        </select>
                      ) : (
                        <div className="text-xs text-base-content/60">No storage locations available for the selected warehouse.</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {error && <div className="alert alert-error"><span>{error}</span></div>}
            <div className="flex justify-end gap-3 pt-4">
<<<<<<< HEAD
              <button
                className="btn btn-ghost"
                onClick={() => setStep(2)}
                disabled={isSubmitting}
              >
                Back
              </button>
              <button className="btn btn-primary" onClick={() => setStep(4)} disabled={isSubmitting || capacityCheckLoading || hasInfeasibleCapacity || formData.items.some((item) => !item.productId || item.quantityOrdered <= 0)}>
                Next
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="p-6 space-y-4">
            <h3 className="text-lg font-semibold text-base-content mb-4">Package Details</h3>
            <div className="alert alert-info">
              <span>Enter the carton weight and dimensions for each item before generating GA recommendations.</span>
            </div>
            <div className="space-y-4">
              {formData.items.map((item, idx) => (
                <div key={idx} className="card bg-base-200 p-4 rounded-lg space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold">Item {idx + 1}</div>
                      <div className="text-xs text-base-content/60">
                        {materials.find((m) => m.id === item.productId)?.description || item.productId}
                      </div>
                    </div>
                    <span className="badge badge-outline">Qty {item.quantityOrdered}</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="form-control">
                      <label className="label"><span className="label-text font-medium">Weight (kg) *</span></label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        className="input input-bordered w-full"
                        value={item.weightKg}
                        onChange={(e) => {
                          const next = [...formData.items];
                          next[idx].weightKg = Number(e.target.value) || 0;
                          setFormData({ ...formData, items: next });
                        }}
                        required
                      />
                    </div>
                    <div className="form-control">
                      <label className="label"><span className="label-text font-medium">Length (cm) *</span></label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        className="input input-bordered w-full"
                        value={item.lengthCm}
                        onChange={(e) => {
                          const next = [...formData.items];
                          next[idx].lengthCm = Number(e.target.value) || 0;
                          setFormData({ ...formData, items: next });
                        }}
                        required
                      />
                    </div>
                    <div className="form-control">
                      <label className="label"><span className="label-text font-medium">Width (cm) *</span></label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        className="input input-bordered w-full"
                        value={item.widthCm}
                        onChange={(e) => {
                          const next = [...formData.items];
                          next[idx].widthCm = Number(e.target.value) || 0;
                          setFormData({ ...formData, items: next });
                        }}
                        required
                      />
                    </div>
                    <div className="form-control">
                      <label className="label"><span className="label-text font-medium">Height (cm) *</span></label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        className="input input-bordered w-full"
                        value={item.heightCm}
                        onChange={(e) => {
                          const next = [...formData.items];
                          next[idx].heightCm = Number(e.target.value) || 0;
                          setFormData({ ...formData, items: next });
                        }}
                        required
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button className="btn btn-ghost" onClick={() => setStep(3)} disabled={isSubmitting}>
                Back
              </button>
              <button className="btn btn-primary" onClick={() => setStep(5)} disabled={isSubmitting || hasIncompleteMeasurements}>
                Next
              </button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-lg font-semibold text-base-content">GA Recommended Locations</h3>
              <div className="join">
                <button
                  className={clsx("btn btn-sm join-item", recommendationView === "recommended" ? "btn-primary" : "btn-ghost")}
                  onClick={() => setRecommendationView("recommended")}
                >
                  Recommended
                </button>
                <button
                  className={clsx("btn btn-sm join-item", recommendationView === "manual" ? "btn-primary" : "btn-ghost")}
                  onClick={() => setRecommendationView("manual")}
                >
                  Manual
                </button>
              </div>
            </div>

            {recommendationError && (
              <div className="alert alert-warning">
                <span>{recommendationError}</span>
              </div>
            )}

            {recommendationView === "recommended" && (
              <div className="space-y-4">
                {recommendationLoading && (
                  <div className="flex items-center gap-2 text-sm text-base-content/60">
                    <span className="loading loading-spinner loading-xs"></span>
                    Generating GA recommendations...
                  </div>
                )}
                {!recommendationLoading && formData.items.map((item, idx) => {
                  const recommendation = recommendationsByItem.get(idx);
                  const selectedLocation = recommendation ? warehouseLocations.find((location) => location.locationCode === recommendation.recommended_location_code) : undefined;
                  return (
                    <div key={idx} className="card bg-base-200 p-4 rounded-lg space-y-3 border border-base-300">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold">Item {idx + 1}</div>
                          <div className="text-xs text-base-content/60">{materials.find((m) => m.id === item.productId)?.description || item.productId}</div>
                        </div>
                        <span className="badge badge-outline">Qty {item.quantityOrdered}</span>
                      </div>

                      {recommendation ? (
                        <>
                          <div className="rounded-xl bg-base-100 border border-primary/20 p-4 space-y-2">
                            <div className="text-xs uppercase tracking-wide text-base-content/60">Recommended Location</div>
                            <div className="text-2xl font-bold text-primary">{recommendation.recommended_location_code}</div>
                            {selectedLocation && (
                              <div className="text-sm text-base-content/70 space-y-1">
                                <div>Area: {selectedLocation.area || "-"} | Row: {selectedLocation.rowNumber || "-"} | Bay: {selectedLocation.bayNumber || "-"}</div>
                                <div>Level: {selectedLocation.levelNumber || "-"} | Bin: {selectedLocation.binPosition || "-"}</div>
                                <div>Zone: {selectedLocation.zoneType || selectedLocation.locationType || "storage"}</div>
                              </div>
                            )}
                            <div className="text-sm text-base-content/70">Reason: {recommendation.reason}</div>
                          </div>
                          <div className="space-y-2">
                            <div className="text-sm font-semibold">Alternatives</div>
                            <div className="flex flex-wrap gap-2">
                              {recommendation.alternatives.map((alternative) => (
                                <span key={alternative.location_id} className="badge badge-ghost">{alternative.location_code}</span>
                              ))}
                            </div>
                          </div>
                          <div className="flex justify-end">
                            <button
                              onClick={() => {
                                const next = [...formData.items];
                                const pureCode = recommendation.recommended_location_code.split(" ")[0];
                                next[idx].locationCode = pureCode;
                                setFormData({ ...formData, items: next });
                              }}
                            >
                              Use this location
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="alert alert-info">
                          <span>No GA recommendation available for this item. Use the manual tab to choose a location.</span>
                        </div>
                      )}

                      <div className="text-xs text-base-content/70">Current selected location: {item.locationCode || "Not selected"}</div>
                    </div>
                  );
                })}
              </div>
            )}

            {recommendationView === "manual" && (
              <div className="space-y-4">
                <div className="alert alert-info">
                  <span>Select locations manually for any item. You can still keep the GA recommendation if you want.</span>
                </div>
                {formData.items.map((item, idx) => (
                  <div key={idx} className="card bg-base-200 p-4 rounded-lg space-y-3 border border-base-300">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold">Item {idx + 1}</div>
                        <div className="text-xs text-base-content/60">{materials.find((m) => m.id === item.productId)?.description || item.productId}</div>
                      </div>
                      <span className="badge badge-outline">Qty {item.quantityOrdered}</span>
                    </div>
                    <div className="form-control">
                      <label className="label"><span className="label-text text-xs">Manual Location</span></label>
                      <select
                        className="select select-bordered select-sm"
                        value={item.locationCode}
                        onChange={(e) => {
                          const next = [...formData.items];
                          next[idx].locationCode = e.target.value;
                          setFormData({ ...formData, items: next });
                        }}
                      >
                        <option value="">Use GA recommendation / none</option>
                        {warehouseLocations.map((location) => (
                          <option key={location.id} value={location.locationCode}>{location.locationCode}</option>
                        ))}
                      </select>
                    </div>
                    <div className="text-xs text-base-content/70">Current selected location: {item.locationCode || "Not selected"}</div>
                  </div>
                ))}
                {warehouseLocations.length === 0 && (
                  <div className="alert alert-warning">
                    <span>No storage locations were found for the selected warehouse.</span>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="alert alert-error">
                <span>{error}</span>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <button className="btn btn-ghost" onClick={() => setStep(4)} disabled={isSubmitting || recommendationLoading}>
                Back
              </button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={isSubmitting || recommendationLoading}>
                {isSubmitting ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    Creating...
                  </>
                ) : (
                  "Create Order"
                )}
=======
              <button className="btn btn-ghost" onClick={() => setStep(4)} disabled={isSubmitting || recommendationLoading}>Back</button>
              <button className="btn btn-outline" onClick={() => setStep(3)} disabled={isSubmitting || recommendationLoading}>Select Another Location</button>
              <button className="btn btn-primary" onClick={() => void handleConfirmRecommendedLocations()} disabled={isSubmitting || recommendationLoading || recommendationsByItem.size === 0}>
                {isSubmitting ? <><span className="loading loading-spinner loading-sm"></span>Creating...</> : "Confirm Location"}
>>>>>>> dev
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

