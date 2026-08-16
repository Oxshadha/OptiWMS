"use client";

import { useState, useEffect } from "react";
import { useOffline } from "@/hooks/useOffline";
import { QRScanner } from "@/components/QRScanner";
import { operationsApi, CycleCount } from "@/lib/api/operations";
import { materialsApi, Material } from "@/lib/api/materials";
import { locationsApi, Location } from "@/lib/api/locations";
import { inventoryApi, InventoryItem } from "@/lib/api/inventory";
import { addToSyncQueue } from "@/lib/indexeddb";
import { formatMaterialDisplay, isUUID } from "@/lib/utils/material-display";
import {
  QUANTITY_INPUT_PROPS,
  parseQuantityInput,
  quantityInputValue,
} from "@/lib/utils/quantity-input";
import { logger } from "@/lib/utils/logger";
import { useAuth } from "@/lib/auth/AuthContext";
import { showToast } from "@/lib/utils/toast";

interface CycleCountTask {
  id: string;
  countNumber: string;
  warehouseId: string;
  status: string;
  locationCode: string;
  materialId?: string;
  sku: string;
  item: string;
  hasMaterialDetails: boolean;
  expected: number;
  counted: number;
  totalLocations: number;
  countedLocations: number;
}

export default function CycleCountPage() {
  const { isOnline } = useOffline();
  const { user } = useAuth();
  const [scannedLocation, setScannedLocation] = useState("");
  const [scannedSKU, setScannedSKU] = useState("");
  const [countedQty, setCountedQty] = useState(0);
  const [activeTask, setActiveTask] = useState<CycleCountTask | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [showLocationScanner, setShowLocationScanner] = useState(false);
  const [showSKUScanner, setShowSKUScanner] = useState(false);
  const [cycleCountTasks, setCycleCountTasks] = useState<CycleCountTask[]>([]);
  const [materialsById, setMaterialsById] = useState<Map<string, Material>>(new Map());
  const [materialsByCode, setMaterialsByCode] = useState<Map<string, Material>>(new Map());
  const [warehouseLocations, setWarehouseLocations] = useState<Location[]>([]);
  const [warehouseInventory, setWarehouseInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isResolvingMaterial, setIsResolvingMaterial] = useState(false);

  const handleScanLocation = () => {
    setShowLocationScanner(true);
  };

  const handleScanSKU = () => {
    setShowSKUScanner(true);
  };

  const handleLocationScan = (result: string) => {
    setScannedLocation(result);
    setShowLocationScanner(false);
  };

  const handleSKUScan = (result: string) => {
    setScannedSKU(result);
    setShowSKUScanner(false);
  };

  const getLocalDateString = (): string => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const isAssignedToCurrentWorker = (count: CycleCount): boolean => {
    const assigned = count.assignedWorkers || [];
    const validAssignedIds = assigned.filter((id) => isUUID(id));
    if (validAssignedIds.length === 0) {
      return true;
    }
    if (!user) {
      return false;
    }
    return validAssignedIds.includes(user.userId) || validAssignedIds.includes(user.id);
  };

  const hasExplicitAssignment = (count: CycleCount): boolean => {
    const assigned = count.assignedWorkers || [];
    return assigned.filter((id) => isUUID(id)).length > 0;
  };

  const isDueByDate = (count: CycleCount): boolean => {
    if (!count.scheduledDate) return true;
    const today = getLocalDateString();
    const scheduledDate = count.scheduledDate.slice(0, 10);
    return scheduledDate <= today;
  };

  const locationMatchesScope = (locationCode: string, inputLocation: string): boolean => {
    if (!locationCode || locationCode === "ALL") {
      return true;
    }
    if (locationCode.startsWith("AREA:")) {
      const area = locationCode.replace("AREA:", "").trim().toUpperCase();
      return inputLocation.trim().toUpperCase().startsWith(`${area}-`);
    }
    return locationCode.trim().toUpperCase() === inputLocation.trim().toUpperCase();
  };

  const getScopedLocationCodes = (scope: string, warehouseId?: string): string[] => {
    const locations = warehouseId
      ? warehouseLocations.filter((loc) => loc.warehouseId === warehouseId)
      : warehouseLocations;
    if (!scope || scope === "ALL") {
      return locations.map((loc) => loc.locationCode);
    }
    if (scope.startsWith("AREA:")) {
      const area = scope.replace("AREA:", "").trim().toUpperCase();
      return locations
        .filter((loc) => (loc.locationCode || "").toUpperCase().startsWith(`${area}-`))
        .map((loc) => loc.locationCode);
    }
    return [scope];
  };

  const getLocationPreview = (scope: string, warehouseId?: string): string => {
    const codes = getScopedLocationCodes(scope, warehouseId);
    if (codes.length === 0) return "No locations found";
    if (codes.length <= 3) return codes.join(", ");
    return `${codes.slice(0, 3).join(", ")} +${codes.length - 3} more`;
  };

  const loadCycleCountTasks = async () => {
    if (!isOnline || !user?.userId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const counts = await operationsApi.getCycleCounts();

      const activeStatuses = new Set(["scheduled", "assigned", "pending", "in_progress", "recount_required"]);
      const visibleCounts = counts.filter(
        (count) => {
          const assignedToUser = isAssignedToCurrentWorker(count);
          if (!assignedToUser) return false;
          if (!activeStatuses.has((count.status || "").toLowerCase())) return false;
          if (!isDueByDate(count)) return false;
          // If specifically assigned, show even when warehouse mapping is inconsistent.
          if (hasExplicitAssignment(count)) return true;
          return !user.warehouseId || count.warehouseId === user.warehouseId;
        }
      );

      const warehouseIds = Array.from(new Set(visibleCounts.map((c) => c.warehouseId))).filter(Boolean);
      const [locationsList, inventoryList] = await Promise.all([
        Promise.all(warehouseIds.map((id) => locationsApi.getByWarehouse(id))),
        Promise.all(warehouseIds.map((id) => inventoryApi.getByWarehouse(id))),
      ]);
      const allLocations = locationsList.flat();
      const allInventory = inventoryList.flat();
      setWarehouseLocations(allLocations);
      setWarehouseInventory(allInventory);

      const tasksWithNames = visibleCounts.map((count) => {
        const material = count.materialId ? materialsById.get(count.materialId) : undefined;
        const display = material
          ? formatMaterialDisplay(material.materialCode, material.description, material.id)
          : null;
        const materialShort = count.materialId
          ? (isUUID(count.materialId) ? count.materialId.slice(0, 8).toUpperCase() : count.materialId)
          : "N/A";
        const warehouseLocationsForCount = allLocations.filter((loc) => loc.warehouseId === count.warehouseId);
        const totalLocations = count.locationCode === "ALL"
          ? Math.max(warehouseLocationsForCount.length, 1)
          : count.locationCode.startsWith("AREA:")
            ? Math.max(
                warehouseLocationsForCount.filter((loc) =>
                  (loc.locationCode || "").toUpperCase().startsWith(
                    `${count.locationCode.replace("AREA:", "").trim().toUpperCase()}-`
                  )
                ).length,
                1
              )
            : 1;
        return {
          id: count.id,
          countNumber: count.countNumber,
          warehouseId: count.warehouseId,
          status: count.status,
          locationCode: count.locationCode,
          materialId: count.materialId,
          sku: display?.sku || materialShort,
          item: display?.name || "Cycle Count Task",
          hasMaterialDetails: Boolean(display),
          expected: parseInt(count.expectedQuantity || "0", 10) || 0,
          counted: parseInt(count.countedQuantity || "0", 10) || 0,
          totalLocations,
          countedLocations: count.status === "completed" ? totalLocations : (count.countedAt ? 1 : 0),
        };
      });
      setCycleCountTasks(tasksWithNames);
    } catch (error) {
      logger.error("Error loading cycle count tasks:", error);
      setCycleCountTasks([]);
    } finally {
      setLoading(false);
    }
  };

  // Load cycle count tasks from API
  useEffect(() => {
    loadCycleCountTasks();
  }, [isOnline, user?.warehouseId, user?.id, user?.userId]);

  const handleConfirm = async () => {
    if (!activeTask || !user?.userId || !scannedLocation || countedQty === 0) {
      return;
    }
    if (!locationMatchesScope(activeTask.locationCode, scannedLocation)) {
      showToast.error("Scanned location is outside the selected cycle count section.");
      return;
    }

    setSaveStatus("saving");
    setIsResolvingMaterial(true);

    try {
      let materialId = activeTask.materialId;
      if (!materialId) {
        const normalizedSku = scannedSKU.trim().toUpperCase();
        if (!normalizedSku) {
          showToast.error("Scan or enter SKU for this cycle count.");
          setSaveStatus("idle");
          return;
        }
        const fromCache = materialsByCode.get(normalizedSku);
        if (fromCache) {
          materialId = fromCache.id;
        } else {
          if (!isOnline) {
            showToast.error("SKU must be loaded previously before recording this count offline.");
            setSaveStatus("idle");
            return;
          }
          const material = await materialsApi.getByCode(normalizedSku);
          materialId = material.id;
          setMaterialsByCode((prev) => new Map(prev).set(normalizedSku, material));
          setMaterialsById((prev) => new Map(prev).set(material.id, material));
        }
      }

      const recordPayload = {
        materialId,
        countedQuantity: String(countedQty),
        countedBy: user.userId,
      };

      if (isOnline) {
        await operationsApi.recordCycleCount(activeTask.id, recordPayload);
      } else {
        await addToSyncQueue({
          type: "operation",
          action: "create",
          data: {
            type: "cycle_count_record",
            cycleCountId: activeTask.id,
            payload: recordPayload,
          },
        });
      }

      setSaveStatus("saved");
      showToast.success(
        isOnline
          ? `Count recorded for ${activeTask.countNumber}`
          : `Count queued for sync for ${activeTask.countNumber}`
      );
      if (isOnline) {
        await loadCycleCountTasks();
      } else {
        setCycleCountTasks((prev) =>
          prev.map((task) =>
            task.id === activeTask.id
              ? {
                  ...task,
                  counted: countedQty,
                  status: "completed",
                  countedLocations: task.totalLocations,
                }
              : task
          )
        );
      }

      setTimeout(() => {
        setScannedLocation("");
        setScannedSKU("");
        setCountedQty(0);
        setActiveTask(null);
        setSaveStatus("idle");
      }, 1500);
    } catch (error) {
      logger.error("Error saving cycle count:", error);
      showToast.error(error instanceof Error ? error.message : "Failed to save cycle count");
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } finally {
      setIsResolvingMaterial(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-base-content">Cycle Count</h2>
            <p className="text-sm text-base-content/60">
              Count items at each location to verify inventory accuracy.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isOnline ? "bg-success" : "bg-warning animate-pulse"}`}></div>
            <span className={`text-xs font-medium ${isOnline ? "text-success" : "text-warning"}`}>
              {isOnline ? "Online" : "Offline"}
            </span>
          </div>
        </div>
        {!isOnline && (
          <div className="bg-warning/10 border border-warning rounded-lg p-2 text-xs text-warning-content">
            <span className="material-symbols-outlined text-sm align-middle">info</span>
            <span className="ml-1">Working offline. Data will sync when connection is restored.</span>
          </div>
        )}
      </div>

      {activeTask && (
        <div className="bg-base-100 rounded-xl p-4 border border-base-300 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-base-content/60">Selected Count</p>
              <p className="text-lg font-semibold">{activeTask.countNumber}</p>
              <p className="text-sm text-base-content/70">
                Scope: {activeTask.locationCode === "ALL" ? "Full warehouse" : activeTask.locationCode}
              </p>
              <p className="text-xs text-base-content/50 mt-1">
                Locations: {getLocationPreview(activeTask.locationCode, activeTask.warehouseId)}
              </p>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setActiveTask(null);
                setScannedLocation("");
                setScannedSKU("");
                setCountedQty(0);
              }}
            >
              Change
            </button>
          </div>

          <div className="text-sm font-medium text-base-content mb-2">Scan Location</div>
          {activeTask.locationCode === "ALL" || activeTask.locationCode.startsWith("AREA:") ? (
            <div className="space-y-2">
              <select
                className="select select-bordered w-full"
                value={scannedLocation}
                onChange={(e) => setScannedLocation(e.target.value)}
              >
                <option value="">Select location in scope</option>
                {getScopedLocationCodes(activeTask.locationCode, activeTask.warehouseId).map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <input
                  className="input input-bordered flex-1"
                  placeholder="Or scan location QR"
                  value={scannedLocation}
                  onChange={(e) => setScannedLocation(e.target.value)}
                />
                <button
                  onClick={handleScanLocation}
                  className="btn btn-primary btn-square"
                >
                  <span className="material-symbols-outlined">qr_code_scanner</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                className="input input-bordered flex-1"
                placeholder="Scan or enter location"
                value={scannedLocation}
                onChange={(e) => setScannedLocation(e.target.value)}
              />
              <button
                onClick={handleScanLocation}
                className="btn btn-primary btn-square"
              >
                <span className="material-symbols-outlined">qr_code_scanner</span>
              </button>
            </div>
          )}

          <div className="text-sm font-medium text-base-content mb-2">Scan SKU</div>
          <div className="flex gap-2">
            <input
              className="input input-bordered flex-1"
              placeholder={activeTask.materialId ? "Material pre-selected for this count" : "Scan or enter SKU"}
              value={scannedSKU}
              onChange={(e) => setScannedSKU(e.target.value)}
              disabled={Boolean(activeTask.materialId)}
            />
            <button
              onClick={handleScanSKU}
              className="btn btn-primary btn-square"
              disabled={Boolean(activeTask.materialId)}
            >
              <span className="material-symbols-outlined">qr_code_scanner</span>
            </button>
          </div>

          {scannedLocation && (
            <div className="text-xs text-base-content/60">
              Expected items at location: {warehouseInventory.filter((inv) => inv.locationCode === scannedLocation).length}
            </div>
          )}

          <div className="bg-base-200 rounded-lg p-4">
            <div className="text-sm text-base-content/60 mb-2">Counted Quantity</div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setCountedQty(Math.max(0, countedQty - 1))}
                className="btn btn-circle btn-outline btn-sm"
              >
                <span className="material-symbols-outlined">remove</span>
              </button>
              <input
                {...QUANTITY_INPUT_PROPS}
                className="input input-bordered flex-1 text-center text-xl font-bold"
                value={quantityInputValue(countedQty)}
                onChange={(e) => setCountedQty(parseQuantityInput(e.target.value))}
                placeholder="0"
              />
              <button
                onClick={() => setCountedQty(countedQty + 1)}
                className="btn btn-circle btn-outline btn-sm"
              >
                <span className="material-symbols-outlined">add</span>
              </button>
            </div>
          </div>

          <button
            onClick={handleConfirm}
            className="btn btn-primary w-full"
            disabled={!scannedLocation || countedQty === 0 || saveStatus === "saving" || isResolvingMaterial}
          >
            {saveStatus === "saving" ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Saving count...
              </>
            ) : saveStatus === "saved" ? (
              <>
                <span className="material-symbols-outlined">check_circle</span>
                Saved!
              </>
            ) : (
              <>
                <span className="material-symbols-outlined">check_circle</span>
                Confirm Count
              </>
            )}
          </button>
          {saveStatus === "error" && (
            <div className="text-xs text-error text-center">
              ✗ Error saving. Please try again.
            </div>
          )}
        </div>
      )}

      {/* Active Cycle Count Tasks */}
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <h3 className="font-bold text-base-content mb-3">Active Tasks</h3>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <span className="loading loading-spinner loading-md"></span>
          </div>
        ) : cycleCountTasks.length === 0 ? (
          <div className="text-center py-8 text-base-content/60">
            <span className="material-symbols-outlined text-4xl mb-2">inventory_2</span>
            <p>No active cycle count tasks</p>
          </div>
        ) : (
          <div className="space-y-2">
            {cycleCountTasks.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between p-3 bg-base-200 rounded-lg cursor-pointer hover:bg-base-300 transition-colors"
                onClick={() => {
                  setActiveTask(task);
                  if (task.locationCode !== "ALL" && !task.locationCode.startsWith("AREA:")) {
                    setScannedLocation(task.locationCode);
                  } else {
                    setScannedLocation("");
                  }
                  if (task.materialId) {
                    const material = materialsById.get(task.materialId);
                    setScannedSKU(material?.materialCode || "");
                  } else {
                    setScannedSKU("");
                  }
                  setCountedQty(0);
                }}
              >
                <div>
                  <div className="font-semibold text-sm text-base-content">
                    {task.countNumber}
                  </div>
                  {task.hasMaterialDetails && task.item !== "Cycle Count Task" && (
                    <div className="text-xs text-base-content/70">
                      {task.item}
                    </div>
                  )}
                  {task.hasMaterialDetails && task.sku && task.sku !== "N/A" && !isUUID(task.sku) && (
                    <div className="text-xs text-base-content/60">
                      <span className="font-mono font-semibold text-primary">SKU: {task.sku}</span>
                    </div>
                  )}
                  <div className="text-xs text-base-content/60">
                    Count: {task.countNumber} • Scope: {task.locationCode} • Expected: {task.expected}
                  </div>
                  <div className="mt-1">
                    <div className="w-36 bg-base-300 rounded-full h-1.5">
                      <div
                        className="bg-primary h-1.5 rounded-full"
                        style={{ width: `${Math.min(100, Math.round((task.countedLocations / task.totalLocations) * 100))}%` }}
                      />
                    </div>
                    <div className="text-[11px] text-base-content/60 mt-0.5">
                      {task.countedLocations}/{task.totalLocations} locations
                    </div>
                  </div>
                </div>
                <span className="material-symbols-outlined text-base-content/40">chevron_right</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* QR Scanners */}
      <QRScanner
        isOpen={showLocationScanner}
        onClose={() => setShowLocationScanner(false)}
        onScan={handleLocationScan}
        title="Scan Location QR Code"
        description="Point camera at location QR code or enter manually"
      />

      <QRScanner
        isOpen={showSKUScanner}
        onClose={() => setShowSKUScanner(false)}
        onScan={handleSKUScan}
        title="Scan SKU QR Code"
        description="Point camera at product SKU QR code or enter manually"
      />
    </div>
  );
}
