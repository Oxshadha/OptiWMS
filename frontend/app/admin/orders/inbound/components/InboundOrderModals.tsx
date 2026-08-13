"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import clsx from "clsx";
import { DetailModal } from "@/components/DetailModal";
import { StatusChip, type StatusTone } from "@/components/StatusChip";
import { ordersApi } from "@/lib/api/orders";
import { orderItemsApi } from "@/lib/api/orderItems";
import { suppliersApi, type Supplier } from "@/lib/api/suppliers";
import { warehousesApi, type Warehouse } from "@/lib/api/warehouses";
import { locationsApi, type Location } from "@/lib/api/locations";
import {
  materialsApi,
  type Material,
  type MaterialOrderingProfile,
} from "@/lib/api/materials";
import { operationsApi } from "@/lib/api/operations";
import {
  AISlottingService,
  type SlottingRecommendationItemResponse,
} from "@/lib/services/aiSlottingService";
import { showToast } from "@/lib/utils/toast";
import { logger } from "@/lib/utils/logger";
import { downloadHtmlDocument, escapeHtml } from "@/lib/utils/documents";
import { statusConfig, type InboundOrderDisplay } from "../types";

type CapacityPlan = {
  feasible: boolean;
  plannedQuantity: number;
  requestedQuantity: number;
  requiredPalletSlots?: number | null;
  availablePalletSlots?: number | null;
  unitsPerPallet?: string | null;
  notes: string[];
};

type CapacityProgress = {
  total: number;
  completed: number;
  currentLabel: string;
};

type InboundItemForm = {
  productId: string;
  quantityOrdered: number;
  requestedQuantity: number;
  quantityMode: "units" | "handling";
  handlingUnitCount: number;
  locationCode: string;
  weightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  batchNumber: string;
  manufactureDate: string;
  expiryDate: string;
};

function getInboundStatusTone(status: string): StatusTone {
  if (status === "completed") return "success";
  if (status === "cancelled") return "danger";
  if (status === "arrived" || status === "receiving" || status === "putaway")
    return "info";
  return "warning";
}

function emptyInboundItem(): InboundItemForm {
  return {
    productId: "",
    quantityOrdered: 0,
    requestedQuantity: 0,
    quantityMode: "units",
    handlingUnitCount: 0,
    locationCode: "",
    weightKg: 0,
    lengthCm: 0,
    widthCm: 0,
    heightCm: 0,
    batchNumber: "",
    manufactureDate: "",
    expiryDate: "",
  };
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
    statusConfig[order.status as keyof typeof statusConfig] ||
    statusConfig.ordered;

  return (
    <DetailModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Inbound Order: ${order.orderNumber}`}
      size="lg"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Order Number" value={order.orderNumber} />
          <div>
            <label className="text-sm text-base-content/60">Status</label>
            <p>
              <StatusChip
                label={status.label}
                tone={getInboundStatusTone(order.status)}
                showDot
              />
            </p>
          </div>
          <Field label="Supplier" value={order.supplierName} />
          <Field label="Warehouse" value={order.warehouseName} />
          <Field label="Order Date" value={order.orderDate} />
          <Field label="Expected Delivery" value={order.expectedDelivery} />
          <Field label="Total Items" value={String(order.totalItems)} />
          <Field
            label="Received Items"
            value={`${order.receivedItems}/${order.totalItems}`}
          />
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
                `,
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
  const [expectedDelivery, setExpectedDelivery] = useState(
    order.expectedDelivery,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (
      expectedDelivery &&
      order.orderDate &&
      new Date(expectedDelivery) < new Date(order.orderDate)
    ) {
      showToast.error("Expected delivery date cannot be before order date.");
      return;
    }

    try {
      setIsSubmitting(true);
      await ordersApi.update(order.id, { expectedDate: expectedDelivery });
      showToast.success("Order updated successfully.");
      await onSaved();
      onClose();
    } catch (error) {
      logger.error("Failed to update order:", error);
      showToast.error("Failed to update order.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <DetailModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Order: ${order.orderNumber}`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="form-control">
          <span className="label-text font-medium mb-1">
            Expected Delivery *
          </span>
          <input
            type="date"
            className="input input-bordered w-full"
            value={expectedDelivery}
            onChange={(e) => setExpectedDelivery(e.target.value)}
            min={order.orderDate || undefined}
            required
          />
        </label>
        <ReadOnlyInput label="Supplier" value={order.supplierName} />
        <ReadOnlyInput label="Warehouse" value={order.warehouseName} />
        <div className="flex justify-end gap-3 pt-4">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isSubmitting}
          >
            Update Order
          </button>
        </div>
      </form>
    </DetailModal>
  );
}

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
  const [warehouseLocations, setWarehouseLocations] = useState<Location[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [supplierHasMaterialLinks, setSupplierHasMaterialLinks] =
    useState(true);
  const [capacityCheckLoading, setCapacityCheckLoading] = useState(false);
  const [capacityProgress, setCapacityProgress] =
    useState<CapacityProgress | null>(null);
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [recommendationError, setRecommendationError] = useState<string | null>(
    null,
  );
  const [capacityPlansByItem, setCapacityPlansByItem] = useState<
    Map<number, CapacityPlan>
  >(new Map());
  const [recommendationsByItem, setRecommendationsByItem] = useState<
    Map<number, SlottingRecommendationItemResponse>
  >(new Map());
  const [profilesByMaterialId, setProfilesByMaterialId] = useState<
    Map<string, MaterialOrderingProfile>
  >(new Map());
  const [capacityError, setCapacityError] = useState<string | null>(null);
  const [lastCapacityCheckKey, setLastCapacityCheckKey] = useState("");
  const [formData, setFormData] = useState({
    supplierId: "",
    warehouseId: "",
    orderDate: new Date().toISOString().split("T")[0],
    expectedDeliveryDate: "",
    notes: "",
    items: [] as InboundItemForm[],
  });
  const [materialSearch, setMaterialSearch] = useState("");

  const materialById = useMemo(
    () => new Map(materials.map((material) => [material.id, material])),
    [materials],
  );
  const materialProfileKey = useMemo(
    () =>
      Array.from(
        new Set(formData.items.map((item) => item.productId).filter(Boolean)),
      )
        .sort()
        .join("|"),
    [formData.items],
  );
  const capacityCheckKey = useMemo(
    () =>
      formData.items
        .map((item, index) =>
          [index, item.productId, item.quantityOrdered, item.locationCode].join(
            ":",
          ),
        )
        .join("|"),
    [formData.items],
  );
  const hasInfeasibleCapacity = formData.items.some((_, idx) => {
    const plan = capacityPlansByItem.get(idx);
    return Boolean(plan && !plan.feasible);
  });
  const capacityCheckCurrent =
    lastCapacityCheckKey === capacityCheckKey && capacityPlansByItem.size > 0;
  const hasIncompleteMeasurements = false;
  const filteredMaterials = useMemo(() => {
    const query = materialSearch.trim().toLowerCase();
    if (!query) return materials.slice(0, 80);
    return materials
      .filter(
        (material) =>
          (material.materialCode || "").toLowerCase().includes(query) ||
          (material.description || "").toLowerCase().includes(query),
      )
      .slice(0, 80);
  }, [materials, materialSearch]);

  useEffect(() => {
    async function loadData() {
      try {
        const [supplierData, warehouseData] = await Promise.all([
          suppliersApi.getAll(),
          warehousesApi.getAll(),
        ]);
        setSuppliers(supplierData);
        setWarehouses(warehouseData);
      } catch (err) {
        logger.error("Failed to load suppliers/warehouses:", err);
      }
    }
    void loadData();
  }, []);

  useEffect(() => {
    async function loadWarehouseLocations() {
      if (!formData.warehouseId) {
        setWarehouseLocations([]);
        return;
      }
      try {
        setWarehouseLocations(
          await locationsApi.getStorageLocationsByWarehouse(
            formData.warehouseId,
          ),
        );
      } catch (err) {
        logger.error("Failed to load warehouse locations:", err);
        setWarehouseLocations([]);
      }
    }
    void loadWarehouseLocations();
  }, [formData.warehouseId]);

  useEffect(() => {
    async function loadSupplierMaterials() {
      if (!formData.supplierId) {
        setMaterials([]);
        setSupplierHasMaterialLinks(true);
        return;
      }
      try {
        const supplierMaterials = await materialsApi.getAll(
          undefined,
          formData.supplierId,
        );
        if (supplierMaterials.length > 0) {
          setSupplierHasMaterialLinks(true);
          setMaterials(supplierMaterials);
          setFormData((prev) => ({
            ...prev,
            items: prev.items.filter((item) =>
              supplierMaterials.some((m) => m.id === item.productId),
            ),
          }));
        } else {
          setSupplierHasMaterialLinks(false);
          setMaterials(await materialsApi.getAll());
        }
      } catch (err) {
        logger.error("Failed to load supplier materials:", err);
        setSupplierHasMaterialLinks(true);
        setMaterials([]);
      }
    }
    void loadSupplierMaterials();
  }, [formData.supplierId]);

  useEffect(() => {
    setCapacityPlansByItem(new Map());
    setCapacityError(null);
    setLastCapacityCheckKey("");
    setCapacityProgress(null);
  }, [capacityCheckKey, formData.warehouseId]);

  useEffect(() => {
    async function loadProfiles() {
      const materialIds = materialProfileKey
        ? materialProfileKey.split("|").filter(Boolean)
        : [];
      if (materialIds.length === 0) {
        setProfilesByMaterialId(new Map());
        return;
      }
      const entries = await Promise.all(
        materialIds.map(async (materialId) => {
          try {
            const profile = await materialsApi.getOrderingProfile(materialId, {
              supplierId: formData.supplierId || undefined,
              warehouseId: formData.warehouseId || undefined,
            });
            return [materialId, profile] as const;
          } catch {
            return null;
          }
        }),
      );
      setProfilesByMaterialId(
        new Map(
          entries.filter(
            (entry): entry is readonly [string, MaterialOrderingProfile] =>
              !!entry,
          ),
        ),
      );
    }
    void loadProfiles();
  }, [materialProfileKey, formData.supplierId, formData.warehouseId]);

  useEffect(() => {
    if (profilesByMaterialId.size === 0 || formData.items.length === 0) return;
    const nextItems = formData.items.map((item) => ({
      ...item,
      quantityOrdered: roundInboundQuantity(
        item,
        profilesByMaterialId.get(item.productId),
      ),
    }));
    const changed = nextItems.some(
      (item, idx) =>
        item.quantityOrdered !== formData.items[idx].quantityOrdered,
    );
    if (changed) {
      setFormData((prev) => ({ ...prev, items: nextItems }));
    }
  }, [profilesByMaterialId, formData.items]);

  useEffect(() => {
    async function loadRecommendations() {
      if (
        step !== 4 ||
        !formData.warehouseId ||
        formData.items.length === 0 ||
        hasIncompleteMeasurements
      ) {
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
          items: formData.items.map((item) => {
            const material = materialById.get(item.productId);
            return {
              material_id: item.productId,
              quantity: item.quantityOrdered,
              weight_kg: item.weightKg > 0 ? item.weightKg : undefined,
              volume_cm3:
                item.lengthCm * item.widthCm * item.heightCm || undefined,
              length_cm: item.lengthCm > 0 ? item.lengthCm : undefined,
              width_cm: item.widthCm > 0 ? item.widthCm : undefined,
              height_cm: item.heightCm > 0 ? item.heightCm : undefined,
              preferred_zone: material?.preferredZone,
              current_location_code: item.locationCode || undefined,
            };
          }),
          population_size: 20,
          generations: 50,
          mutation_rate: 0.05,
          top_k_alternatives: 3,
        });
        const recommendationMap = new Map<
          number,
          SlottingRecommendationItemResponse
        >();
        response.recommendations.forEach((recommendation, index) =>
          recommendationMap.set(index, recommendation),
        );
        setRecommendationsByItem(recommendationMap);
      } catch (err) {
        logger.error("Failed to load slotting recommendations:", err);
        setRecommendationError(
          err instanceof Error
            ? err.message
            : "Location recommendations are unavailable.",
        );
        setRecommendationsByItem(new Map());
      } finally {
        setRecommendationLoading(false);
      }
    }
    void loadRecommendations();
  }, [
    step,
    formData.warehouseId,
    formData.items,
    hasIncompleteMeasurements,
    materialById,
  ]);

  function updateItem(index: number, patch: Partial<InboundItemForm>) {
    const next = [...formData.items];
    const merged = { ...next[index], ...patch };
    const profile = profilesByMaterialId.get(merged.productId);
    if (patch.productId) {
      const material = materialById.get(patch.productId);
      merged.weightKg = material?.weightKg || 0;
      merged.lengthCm = material?.lengthCm || 0;
      merged.widthCm = material?.widthCm || 0;
      merged.heightCm = material?.heightCm || 0;
    }
    if (
      patch.requestedQuantity !== undefined ||
      patch.handlingUnitCount !== undefined ||
      patch.quantityMode !== undefined ||
      patch.productId
    ) {
      merged.quantityOrdered = roundInboundQuantity(merged, profile);
    }
    next[index] = merged;
    setFormData({ ...formData, items: next });
  }

  async function runCapacityCheck() {
    if (!formData.warehouseId) {
      setCapacityError("Select a warehouse before checking storage capacity.");
      return;
    }
    const eligibleItems = formData.items
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => item.productId && item.quantityOrdered > 0);
    if (eligibleItems.length === 0) {
      setCapacityError(
        "Add at least one material with a positive rounded purchasing quantity.",
      );
      return;
    }

    setCapacityCheckLoading(true);
    setCapacityError(null);
    setCapacityPlansByItem(new Map());
    setCapacityProgress({
      total: eligibleItems.length,
      completed: 0,
      currentLabel: "Checking storage capacity for selected inbound items...",
    });

    try {
      const response = await operationsApi.planPutawaySplitBatch({
        warehouseId: formData.warehouseId,
        items: eligibleItems.map(({ item, idx }) => ({
          itemIndex: idx,
          materialId: item.productId,
          quantity: item.quantityOrdered,
          preferredLocationCode: item.locationCode || undefined,
        })),
      });
      const resultMap = new Map<number, CapacityPlan>();
      response.items.forEach((line) => {
        const plan = line.plan;
        resultMap.set(line.itemIndex, {
          feasible: Boolean(plan?.feasible),
          plannedQuantity: plan?.plannedQuantity ?? 0,
          requestedQuantity: plan?.requestedQuantity ?? 0,
          requiredPalletSlots: plan?.requiredPalletSlots,
          availablePalletSlots: plan?.availablePalletSlots,
          unitsPerPallet: plan?.unitsPerPallet,
          notes: line.error
            ? [line.error, ...(plan?.notes || [])]
            : plan?.notes || [],
        });
      });
      setCapacityPlansByItem(resultMap);
      setLastCapacityCheckKey(capacityCheckKey);
      setCapacityProgress({
        total: eligibleItems.length,
        completed: eligibleItems.length,
        currentLabel: "Capacity check complete.",
      });
    } catch (err) {
      logger.error("Failed to run batch capacity check:", err);
      setCapacityError(
        err instanceof Error
          ? err.message
          : "Capacity check failed. Try again.",
      );
      setCapacityProgress(null);
    } finally {
      setCapacityCheckLoading(false);
    }
  }

  function validateBeforeSubmit(items: InboundItemForm[]) {
    if (
      !formData.supplierId ||
      !formData.warehouseId ||
      !formData.expectedDeliveryDate
    )
      return "Please fill in all required fields.";
    if (new Date(formData.expectedDeliveryDate) < new Date(formData.orderDate))
      return "Expected delivery date cannot be before order date.";
    if (items.length === 0) return "Please add at least one item.";
    if (items.some((item) => !item.productId || item.quantityOrdered <= 0))
      return "Please select a material and positive quantity for every item.";
    if (
      items.some(
        (item) =>
          item.manufactureDate &&
          item.expiryDate &&
          new Date(item.expiryDate) <= new Date(item.manufactureDate),
      )
    ) {
      return "Expiry date must be after manufacture date for all items.";
    }
    if (
      items.some(
        (item) =>
          item.manufactureDate &&
          new Date(item.manufactureDate) > new Date(formData.orderDate),
      )
    ) {
      return "Manufacture date cannot be later than order date.";
    }
    if (
      items.some(
        (_, idx) =>
          capacityPlansByItem.get(idx) &&
          !capacityPlansByItem.get(idx)?.feasible,
      )
    ) {
      return "One or more items do not have enough storage capacity. Adjust quantities or locations before creating this order.";
    }
    return null;
  }

  async function submitInboundOrder(
    itemsOverride: InboundItemForm[] = formData.items,
  ) {
    const validationError = validateBeforeSubmit(itemsOverride);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const createdOrder = await ordersApi.create({
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
        const materialIds = Array.from(
          new Set(itemsOverride.map((item) => item.productId).filter(Boolean)),
        );
        if (materialIds.length > 0)
          await suppliersApi.replaceMaterials(formData.supplierId, materialIds);
      }

      await Promise.all(
        itemsOverride.map((item) =>
          orderItemsApi.create(createdOrder.id, {
            materialId: item.productId,
            quantity: item.quantityOrdered,
            locationCode: item.locationCode || undefined,
            batchNumber: item.batchNumber || undefined,
            manufactureDate: item.manufactureDate || undefined,
            expiryDate: item.expiryDate || undefined,
          }),
        ),
      );

      showToast.success(
        `Inbound order created with ${itemsOverride.length} item(s).`,
      );
      await onSaved();
      onClose();
    } catch (err) {
      logger.error("Failed to create inbound order:", err);
      setError(err instanceof Error ? err.message : "Failed to create order.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleConfirmRecommendedLocations() {
    const confirmedItems = formData.items.map((item, idx) => ({
      ...item,
      locationCode:
        item.locationCode ||
        recommendationsByItem.get(idx)?.recommended_location_code ||
        "",
    }));
    await submitInboundOrder(confirmedItems);
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-base-100 rounded-lg border border-base-300 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-base-300">
          <h2 className="text-2xl font-bold text-base-content">
            Create Inbound Order
          </h2>
          <button onClick={onClose} className="btn btn-ghost btn-sm btn-circle">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <StepIndicator step={step} count={4} />

        {step === 1 && (
          <div className="p-6 space-y-4">
            <h3 className="text-lg font-semibold text-base-content">
              Order Details
            </h3>
            <SelectControl
              label="Supplier *"
              value={formData.supplierId}
              onChange={(value) =>
                setFormData({ ...formData, supplierId: value, items: [] })
              }
            >
              <option value="">Select supplier</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </SelectControl>
            <SelectControl
              label="Warehouse *"
              value={formData.warehouseId}
              onChange={(value) =>
                setFormData({
                  ...formData,
                  warehouseId: value,
                  items: formData.items.map((item) => ({
                    ...item,
                    locationCode: "",
                  })),
                })
              }
            >
              <option value="">Select warehouse</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </SelectControl>
            <DateControl
              label="Order Date *"
              value={formData.orderDate}
              min={new Date().toISOString().split("T")[0]}
              onChange={(value) =>
                setFormData({ ...formData, orderDate: value })
              }
            />
            <DateControl
              label="Expected Delivery Date *"
              value={formData.expectedDeliveryDate}
              min={formData.orderDate || undefined}
              onChange={(value) =>
                setFormData({ ...formData, expectedDeliveryDate: value })
              }
            />
            <label className="form-control">
              <span className="label-text font-medium mb-1">Notes</span>
              <textarea
                className="textarea textarea-bordered w-full"
                rows={3}
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
              />
            </label>
            <ModalActions
              onBack={onClose}
              backLabel="Cancel"
              onNext={() => setStep(2)}
            />
          </div>
        )}

        {step === 2 && (
          <div className="p-6 space-y-4">
            <h3 className="text-lg font-semibold text-base-content">
              Add Items
            </h3>
            {!formData.supplierId && (
              <div className="alert alert-warning">
                <span>Select a supplier first.</span>
              </div>
            )}
            {formData.supplierId && materials.length === 0 && (
              <div className="alert alert-info">
                <span>No materials are linked to this supplier.</span>
              </div>
            )}
            {formData.supplierId &&
              materials.length > 0 &&
              !supplierHasMaterialLinks && (
                <div className="alert alert-info">
                  <span>
                    Selected items will initialize the supplier-material
                    mapping.
                  </span>
                </div>
              )}
            <TextControl
              label="Filter by SKU or name"
              value={materialSearch}
              onChange={setMaterialSearch}
            />

            <div className="space-y-4">
              {formData.items.map((item, idx) => {
                const profile = profilesByMaterialId.get(item.productId);
                const material = materialById.get(item.productId);
                const unitsPerHandlingUnit =
                  positive(profile?.effectiveUnitsPerHandlingUnit) ||
                  material?.unitsPerHandlingUnit ||
                  material?.palletSpaces ||
                  1;
                const handlingLabel =
                  material?.handlingUnitType || material?.unitType || "unit";
                return (
                  <div
                    key={idx}
                    className="bg-base-200 border border-base-300 p-4 rounded-lg"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <span className="font-semibold">Item {idx + 1}</span>
                      <button
                        className="btn btn-ghost btn-xs"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            items: formData.items.filter((_, i) => i !== idx),
                          })
                        }
                      >
                        <span className="material-symbols-outlined text-sm">
                          close
                        </span>
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <SelectControl
                        label="Material *"
                        value={item.productId}
                        onChange={(value) =>
                          updateItem(idx, { productId: value })
                        }
                      >
                        <option value="">Select material</option>
                        {filteredMaterials.map((material) => (
                          <option key={material.id} value={material.id}>
                            {material.materialCode} - {material.description}
                          </option>
                        ))}
                      </SelectControl>
                      <SelectControl
                        label="Quantity Mode"
                        value={item.quantityMode}
                        onChange={(value) =>
                          updateItem(idx, {
                            quantityMode: value as "units" | "handling",
                          })
                        }
                      >
                        <option value="units">Required units</option>
                        <option value="handling">{handlingLabel} count</option>
                      </SelectControl>
                      {item.quantityMode === "handling" ? (
                        <NumberControl
                          label={`${handlingLabel} count`}
                          value={item.handlingUnitCount}
                          min={1}
                          onChange={(value) =>
                            updateItem(idx, { handlingUnitCount: value })
                          }
                        />
                      ) : (
                        <NumberControl
                          label="Required units"
                          value={item.requestedQuantity}
                          min={1}
                          onChange={(value) =>
                            updateItem(idx, { requestedQuantity: value })
                          }
                        />
                      )}
                      <ReadOnlyInput
                        label="Rounded purchasing quantity"
                        value={
                          item.quantityOrdered > 0
                            ? `${item.quantityOrdered} units`
                            : "Select quantity"
                        }
                      />
                      {material && (
                        <div className="md:col-span-2 rounded-lg border border-base-300 bg-base-100 p-3 text-xs text-base-content/70">
                          <div className="font-semibold text-base-content mb-1">
                            {material.materialCode} packaging
                          </div>
                          <div>
                            Requested units:{" "}
                            {item.quantityMode === "handling"
                              ? item.handlingUnitCount * unitsPerHandlingUnit
                              : item.requestedQuantity}
                          </div>
                          <div>
                            Rounded purchasing quantity:{" "}
                            {item.quantityOrdered || "-"}
                          </div>
                          <div>
                            Rounded by minimum order, order multiple, and units
                            per handling unit.
                          </div>
                          <div>
                            Handling unit: {handlingLabel} | Units/
                            {handlingLabel}: {unitsPerHandlingUnit}
                          </div>
                          <div>
                            Minimum order:{" "}
                            {profile?.effectiveMinimumOrderQuantity ??
                              material.minOrderQuantity ??
                              1}{" "}
                            | Order multiple:{" "}
                            {profile?.effectiveOrderMultiple ??
                              material.orderMultiple ??
                              unitsPerHandlingUnit}
                          </div>
                          <div>
                            Weight: {material.weightKg ?? "-"} kg | Size:{" "}
                            {material.lengthCm ?? "-"} x{" "}
                            {material.widthCm ?? "-"} x{" "}
                            {material.heightCm ?? "-"} cm
                          </div>
                        </div>
                      )}
                      <TextControl
                        label="Batch Number"
                        value={item.batchNumber}
                        onChange={(value) =>
                          updateItem(idx, { batchNumber: value })
                        }
                      />
                      <DateControl
                        label="Manufacture Date"
                        value={item.manufactureDate}
                        max={formData.orderDate || item.expiryDate || undefined}
                        onChange={(value) =>
                          updateItem(idx, { manufactureDate: value })
                        }
                      />
                      <div className="md:col-span-2">
                        <DateControl
                          label="Expiry Date"
                          value={item.expiryDate}
                          min={item.manufactureDate || undefined}
                          onChange={(value) =>
                            updateItem(idx, { expiryDate: value })
                          }
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
              <button
                className="btn btn-outline btn-sm w-full"
                disabled={!formData.supplierId || materials.length === 0}
                onClick={() =>
                  setFormData({
                    ...formData,
                    items: [...formData.items, emptyInboundItem()],
                  })
                }
              >
                <span className="material-symbols-outlined">add</span>
                Add Item
              </button>
            </div>
            <ModalActions onBack={() => setStep(1)} onNext={() => setStep(3)} />
          </div>
        )}

        {step === 3 && (
          <div className="p-6 space-y-4">
            <h3 className="text-lg font-semibold text-base-content">
              Capacity Review
            </h3>
            <div className="rounded-lg border border-base-300 bg-base-200 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <div className="font-semibold text-base-content">
                  Storage capacity check
                </div>
                <div className="text-sm text-base-content/70">
                  Run this after quantities are final. If you change material,
                  quantity, or location, run it again.
                </div>
              </div>
              <button
                className="btn btn-primary"
                onClick={() => void runCapacityCheck()}
                disabled={capacityCheckLoading}
              >
                {capacityCheckLoading ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    Checking...
                  </>
                ) : capacityCheckCurrent ? (
                  "Recheck capacity"
                ) : (
                  "Check capacity"
                )}
              </button>
            </div>
            {capacityError && (
              <div className="alert alert-error">
                <span>{capacityError}</span>
              </div>
            )}
            {!capacityCheckCurrent && !capacityCheckLoading && (
              <div className="alert alert-info">
                <span>
                  Capacity has not been checked for the current item list.
                </span>
              </div>
            )}
            {capacityCheckLoading && capacityProgress && (
              <div className="rounded-lg border border-info/30 bg-info/10 p-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex items-center gap-2 text-info">
                    <span className="loading loading-spinner loading-sm"></span>
                    <span>{capacityProgress.currentLabel}</span>
                  </div>
                  <span className="font-semibold">
                    {capacityProgress.completed}/{capacityProgress.total}
                  </span>
                </div>
                <progress
                  className="progress progress-info w-full mt-2"
                  value={capacityProgress.completed}
                  max={capacityProgress.total}
                />
              </div>
            )}
            <div className="space-y-2">
              {formData.items.map((item, idx) => {
                const plan = capacityPlansByItem.get(idx);
                const isPending =
                  capacityCheckLoading &&
                  item.productId &&
                  item.quantityOrdered > 0 &&
                  !plan;
                return (
                  <div
                    key={idx}
                    className="rounded-lg border border-base-300 bg-base-200 px-3 py-2 text-sm space-y-1"
                  >
                    <div className="flex justify-between">
                      <span>
                        {materialById.get(item.productId)?.description ||
                          `Item ${idx + 1}`}
                      </span>
                      <span>Qty: {item.quantityOrdered}</span>
                    </div>
                    <div className="text-base-content/70">
                      Requested:{" "}
                      {item.quantityMode === "handling"
                        ? `${item.handlingUnitCount} handling units`
                        : `${item.requestedQuantity} units`}{" "}
                      | Rounded: {item.quantityOrdered} units
                    </div>
                    <CapacityPlanText
                      plan={plan}
                      pending={Boolean(isPending)}
                    />
                  </div>
                );
              })}
            </div>
            <ModalActions
              onBack={() => setStep(2)}
              onNext={() => setStep(4)}
              nextDisabled={
                capacityCheckLoading ||
                !capacityCheckCurrent ||
                hasInfeasibleCapacity
              }
            />
          </div>
        )}

        {step === 4 && (
          <div className="p-6 space-y-4">
            <h3 className="text-lg font-semibold text-base-content">
              Location Selection
            </h3>
            {recommendationError && (
              <div className="alert alert-warning">
                <span>{recommendationError}</span>
              </div>
            )}
            {warehouseLocations.length === 0 && (
              <div className="alert alert-warning">
                <span>No storage locations found for this warehouse.</span>
              </div>
            )}
            <div className="space-y-4">
              {formData.items.map((item, idx) => {
                const recommendation = recommendationsByItem.get(idx);
                const selectedCode =
                  item.locationCode ||
                  recommendation?.recommended_location_code ||
                  "";
                return (
                  <div
                    key={idx}
                    className="bg-base-200 border border-base-300 p-4 rounded-lg space-y-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold">Item {idx + 1}</div>
                        <div className="text-xs text-base-content/60">
                          {materialById.get(item.productId)?.description ||
                            item.productId}
                        </div>
                      </div>
                      <span className="badge badge-outline">
                        Qty {item.quantityOrdered}
                      </span>
                    </div>
                    {recommendationLoading && (
                      <div className="flex items-center gap-2 text-sm text-base-content/60">
                        <span className="loading loading-spinner loading-xs"></span>
                        Generating recommendation...
                      </div>
                    )}
                    {!recommendationLoading && recommendation && (
                      <div className="rounded-lg bg-base-100 border border-primary/20 p-4 space-y-2">
                        <div className="text-xs uppercase text-base-content/60">
                          Recommended Location
                        </div>
                        <div className="text-2xl font-bold text-primary">
                          {recommendation.recommended_location_code}
                        </div>
                        <div className="text-sm text-base-content/70">
                          {recommendation.reason}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {recommendation.alternatives.map((alternative) => (
                            <span
                              key={alternative.location_id}
                              className="badge badge-ghost"
                            >
                              {alternative.location_code}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <SelectControl
                      label="Final Location"
                      value={selectedCode}
                      onChange={(value) =>
                        updateItem(idx, { locationCode: value })
                      }
                    >
                      <option value="">
                        Use recommendation / assign during putaway
                      </option>
                      {recommendation && (
                        <option
                          value={recommendation.recommended_location_code}
                        >
                          {recommendation.recommended_location_code} -
                          recommended
                        </option>
                      )}
                      {warehouseLocations.map((location) => (
                        <option key={location.id} value={location.locationCode}>
                          {location.locationCode}
                        </option>
                      ))}
                    </SelectControl>
                  </div>
                );
              })}
            </div>
            {error && (
              <div className="alert alert-error">
                <span>{error}</span>
              </div>
            )}
            <div className="flex justify-end gap-3 pt-4">
              <button
                className="btn btn-ghost"
                onClick={() => setStep(3)}
                disabled={isSubmitting || recommendationLoading}
              >
                Back
              </button>
              <button
                className="btn btn-primary"
                onClick={() => void handleConfirmRecommendedLocations()}
                disabled={isSubmitting || recommendationLoading}
              >
                {isSubmitting ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    Creating...
                  </>
                ) : (
                  "Create Order"
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="text-sm text-base-content/60">{label}</label>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function ReadOnlyInput({ label, value }: { label: string; value: string }) {
  return (
    <label className="form-control">
      <span className="label-text font-medium mb-1">{label}</span>
      <input
        type="text"
        className="input input-bordered w-full"
        value={value}
        disabled
      />
    </label>
  );
}

function StepIndicator({ step, count }: { step: number; count: number }) {
  return (
    <div className="flex items-center justify-center p-4 border-b border-base-300">
      <div className="flex items-center gap-2">
        {Array.from({ length: count }, (_, index) => index + 1).map((s) => (
          <div key={s} className="flex items-center">
            <div
              className={clsx(
                "w-8 h-8 rounded-full flex items-center justify-center font-semibold",
                step >= s
                  ? "bg-primary text-primary-content"
                  : "bg-base-300 text-base-content/60",
              )}
            >
              {s}
            </div>
            {s < count && (
              <div
                className={clsx(
                  "w-12 h-1 mx-2",
                  step > s ? "bg-primary" : "bg-base-300",
                )}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ModalActions({
  onBack,
  onNext,
  backLabel = "Back",
  nextDisabled = false,
}: {
  onBack: () => void;
  onNext: () => void;
  backLabel?: string;
  nextDisabled?: boolean;
}) {
  return (
    <div className="flex justify-end gap-3 pt-4">
      <button className="btn btn-ghost" onClick={onBack}>
        {backLabel}
      </button>
      <button
        className="btn btn-primary"
        onClick={onNext}
        disabled={nextDisabled}
      >
        Next
      </button>
    </div>
  );
}

function SelectControl({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="form-control">
      <span className="label-text font-medium mb-1">{label}</span>
      <select
        className="select select-bordered w-full"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
    </label>
  );
}

function TextControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="form-control">
      <span className="label-text font-medium mb-1">{label}</span>
      <input
        type="text"
        className="input input-bordered w-full"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function DateControl({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
}) {
  return (
    <label className="form-control">
      <span className="label-text font-medium mb-1">{label}</span>
      <input
        type="date"
        className="input input-bordered w-full"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function NumberControl({
  label,
  value,
  onChange,
  min = 0,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  step?: number;
}) {
  return (
    <label className="form-control">
      <span className="label-text font-medium mb-1">{label}</span>
      <input
        type="number"
        className="input input-bordered w-full"
        value={value}
        min={min}
        step={step}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </label>
  );
}

function roundInboundQuantity(
  item: InboundItemForm,
  profile?: MaterialOrderingProfile,
): number {
  const unitsPerHandlingUnit =
    positive(profile?.effectiveUnitsPerHandlingUnit) || 1;
  const orderMultiple =
    positive(profile?.effectiveOrderMultiple) || unitsPerHandlingUnit || 1;
  const moq = positive(profile?.effectiveMinimumOrderQuantity) || 1;
  const rawRequested =
    item.quantityMode === "handling"
      ? item.handlingUnitCount * unitsPerHandlingUnit
      : item.requestedQuantity;
  const requested = Math.max(0, Math.ceil(rawRequested || 0));
  if (requested <= 0) return 0;
  const base = Math.max(requested, moq);
  return Math.ceil(base / orderMultiple) * orderMultiple;
}

function positive(value?: number | null): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function CapacityPlanText({
  plan,
  pending = false,
}: {
  plan?: CapacityPlan;
  pending?: boolean;
}) {
  if (!plan) {
    return (
      <div className="text-xs text-base-content/60 flex items-center gap-2">
        {pending && (
          <span className="loading loading-spinner loading-xs"></span>
        )}
        <span>
          {pending
            ? "Queued for storage capacity check..."
            : "Capacity check pending."}
        </span>
      </div>
    );
  }
  return (
    <div className="text-xs">
      {plan.feasible ? (
        <span className="text-success">
          Capacity OK ({plan.plannedQuantity}/{plan.requestedQuantity})
        </span>
      ) : (
        <span className="text-error">
          Capacity insufficient ({plan.plannedQuantity}/{plan.requestedQuantity}
          ){plan.notes[0] ? ` - ${plan.notes[0]}` : ""}
        </span>
      )}
      {plan.requiredPalletSlots != null && (
        <div className="text-base-content/70 mt-1">
          Required pallet slots: {plan.requiredPalletSlots} | Available:{" "}
          {plan.availablePalletSlots ?? 0}
          {plan.unitsPerPallet ? ` | Units/Pallet: ${plan.unitsPerPallet}` : ""}
        </div>
      )}
    </div>
  );
}
