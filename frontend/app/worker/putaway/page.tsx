"use client";

import { useState, useRef, useEffect } from "react";
import { QRScanner } from "@/components/QRScanner";
import { Modal } from "@/components/Modal";
import { operationsApi } from "@/lib/api/operations";
import { tasksApi } from "@/lib/api/tasks-api";
import { locationsApi } from "@/lib/api/locations";
import { LocationPicker } from "@/components/LocationPicker";
import { useWorker } from "@/contexts/WorkerContext";
import { validateLocationCode, validateLPN, formatLocationCodeForDisplay } from "@/lib/utils/validation";
import { showToast } from "@/lib/utils/toast";

export default function PutawayPage() {
  const { worker } = useWorker();
  const [scannedLPN, setScannedLPN] = useState("");
  const [scannedLocation, setScannedLocation] = useState("");
  const [showLPNScanner, setShowLPNScanner] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [task, setTask] = useState<{
    id: string;
    lpn: string;
    fromLocation: string;
    toLocation: string;
    toLocationCode: string;
    item: string;
    itemId?: string;
    qty: number;
    materialId?: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [locationError, setLocationError] = useState<string>("");
  const [lpnError, setLpnError] = useState<string>("");
  const [validatingLocation, setValidatingLocation] = useState(false);

  // Load putaway tasks from API
  useEffect(() => {
    const loadPutawayTasks = async () => {
      try {
        setIsLoading(true);
        const tasks = await tasksApi.getAll("putaway", "pending");
        
        if (tasks.length > 0) {
          const firstTask = tasks[0];
          
          // Fetch full task details to get item information
          try {
            const taskDetails = await tasksApi.getById(firstTask.id);
            
            // Try to get item details from reference (order/GRN)
            let itemName = "Item";
            let itemId: string | undefined;
            let quantity = 0;
            let materialId: string | undefined;
            
            // If task has reference, try to fetch order items
            if (taskDetails.referenceType === "order" && taskDetails.referenceId) {
              try {
                const { orderItemsApi } = await import("@/lib/api/orderItems");
                const orderItems = await orderItemsApi.getByOrderId(taskDetails.referenceId);
                if (orderItems.length > 0) {
                  const firstItem = orderItems[0];
                  itemId = firstItem.materialId;
                  materialId = firstItem.materialId;
                  quantity = firstItem.quantity || 0;
                  // Try to get material name
                  try {
                    const { materialsApi } = await import("@/lib/api/materials");
                    const material = await materialsApi.getById(firstItem.materialId);
                    itemName = material.description || material.materialCode || "Item";
                  } catch (err) {
                    console.warn("Could not fetch material details:", err);
                  }
                }
              } catch (err) {
                console.warn("Could not fetch order items:", err);
              }
            }
            
            // Format location code for display
            const locationCode = taskDetails.locationCode || "";
            const toLocationDisplay = locationCode 
              ? formatLocationCodeForDisplay(locationCode)
              : "Not specified";
            
            setTask({
              id: firstTask.id,
              lpn: firstTask.referenceId || taskDetails.referenceId || "",
              fromLocation: "Stage Area", // Default staging area
              toLocation: toLocationDisplay,
              toLocationCode: locationCode,
              item: itemName,
              itemId,
              qty: quantity || 0,
              materialId,
            });
          } catch (err) {
            console.error("Failed to load task details:", err);
            // Use basic task info
            setTask({
              id: firstTask.id,
              lpn: firstTask.referenceId || "",
              fromLocation: "Stage Area",
              toLocation: firstTask.locationCode ? formatLocationCodeForDisplay(firstTask.locationCode) : "Not specified",
              toLocationCode: firstTask.locationCode || "",
              item: firstTask.notes || "Item",
              qty: 0,
            });
          }
        } else {
          setTask(null);
        }
      } catch (error) {
        console.error("Failed to load putaway tasks:", error);
        showToast.error("Failed to load putaway tasks");
        setTask(null);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadPutawayTasks();
  }, []);

  const handleScanLPN = () => {
    setShowLPNScanner(true);
  };

  const handleLPNScan = (result: string) => {
    const validation = validateLPN(result);
    if (!validation.valid) {
      setLpnError(validation.error || "Invalid LPN format");
      showToast.error(validation.error || "Invalid LPN format");
      return;
    }
    setScannedLPN(result.trim().toUpperCase());
    setLpnError("");
    setShowLPNScanner(false);
  };

  const handleLPNChange = (value: string) => {
    setScannedLPN(value);
    if (value.trim() !== "") {
      const validation = validateLPN(value);
      if (!validation.valid) {
        setLpnError(validation.error || "Invalid LPN format");
      } else {
        setLpnError("");
      }
    } else {
      setLpnError("");
    }
  };

  const handleLocationSelect = async (locationCode: string) => {
    setValidatingLocation(true);
    setLocationError("");
    
    // Validate format
    const validation = validateLocationCode(locationCode);
    if (!validation.valid) {
      setLocationError(validation.error || "Invalid location format");
      setValidatingLocation(false);
      showToast.error(validation.error || "Invalid location format");
      return;
    }
    
    // Check if location exists in database
    try {
      const location = await locationsApi.getByCode(locationCode);
      if (!location.isActive) {
        setLocationError("Location is not active");
        setValidatingLocation(false);
        showToast.error("Location is not active");
        return;
      }
      setScannedLocation(locationCode);
      setLocationError("");
      setShowLocationPicker(false);
    } catch (error) {
      setLocationError("Location not found in database");
      setValidatingLocation(false);
      showToast.error("Location not found. Please verify the location code.");
      return;
    } finally {
      setValidatingLocation(false);
    }
  };

  const handleLocationChange = async (value: string) => {
    setScannedLocation(value);
    if (value.trim() !== "") {
      setValidatingLocation(true);
      setLocationError("");
      
      // Validate format
      const validation = validateLocationCode(value);
      if (!validation.valid) {
        setLocationError(validation.error || "Invalid location format");
        setValidatingLocation(false);
        return;
      }
      
      // Check if location exists in database
      try {
        const location = await locationsApi.getByCode(value.trim().toUpperCase());
        if (!location.isActive) {
          setLocationError("Location is not active");
        } else {
          setLocationError("");
        }
      } catch (error) {
        setLocationError("Location not found in database");
      } finally {
        setValidatingLocation(false);
      }
    } else {
      setLocationError("");
      setValidatingLocation(false);
    }
  };

  const handleConfirm = async () => {
    // Validate LPN
    if (!scannedLPN || scannedLPN.trim() === "") {
      showToast.error("Please enter or scan LPN");
      return;
    }
    
    const lpnValidation = validateLPN(scannedLPN);
    if (!lpnValidation.valid) {
      showToast.error(lpnValidation.error || "Invalid LPN format");
      return;
    }
    
    // Validate location
    if (!scannedLocation || scannedLocation.trim() === "") {
      showToast.error("Please enter or select location");
      return;
    }
    
    const locationValidation = validateLocationCode(scannedLocation);
    if (!locationValidation.valid) {
      showToast.error(locationValidation.error || "Invalid location format");
      return;
    }
    
    if (locationError) {
      showToast.error(locationError);
      return;
    }

    if (!task) {
      showToast.error("No task available");
      return;
    }

    try {
      await operationsApi.completePutaway(task.id, {
        locationCode: scannedLocation.trim().toUpperCase(),
        lpn: scannedLPN.trim().toUpperCase(),
      });
      
      showToast.success("Putaway completed successfully!");
      
      // Reset form
      setScannedLPN("");
      setScannedLocation("");
      setNote("");
      setPhotos([]);
      setLocationError("");
      setLpnError("");
      
      // Reload tasks to get next one
      window.location.reload();
    } catch (error) {
      console.error("Error confirming putaway:", error);
      showToast.error("Failed to complete putaway. Please try again.");
    }
  };

  const handleTakePhoto = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotos((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveNote = () => {
    console.log("Note saved:", note);
    setShowNoteModal(false);
  };

  if (isLoading) {
    return (
      <div className="p-4 flex items-center justify-center h-64">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="p-4">
        <div className="alert alert-info">
          <span>No putaway tasks available</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Task Overview */}
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <div className="text-xs text-base-content/60 mb-1">Putaway Task</div>
        <div className="font-bold text-lg text-base-content mb-4">
          Move {task.lpn} to {task.toLocation}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-base-200 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base-content/60">inventory</span>
              <span className="text-sm text-base-content/60">Item</span>
            </div>
            <span className="font-semibold text-base-content">{task.item}</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-base-200 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base-content/60">numbers</span>
              <span className="text-sm text-base-content/60">Quantity</span>
            </div>
            <span className="font-semibold text-base-content">{task.qty}</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-base-200 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base-content/60">location_on</span>
              <span className="text-sm text-base-content/60">From</span>
            </div>
            <span className="font-semibold text-base-content">{task.fromLocation}</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg border border-primary/20">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">location_on</span>
              <span className="text-sm text-primary font-medium">To Location</span>
            </div>
            <span className="font-bold text-primary">{task.toLocation}</span>
          </div>
        </div>
      </div>

      {/* Scan LPN */}
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <div className="text-sm font-medium text-base-content mb-2">Scan LPN</div>
        <div className="flex gap-2">
          <input
            className={`input input-bordered flex-1 ${lpnError ? "input-error" : ""}`}
            placeholder="Scan or enter LPN (e.g., LPN-1234)"
            value={scannedLPN}
            onChange={(e) => handleLPNChange(e.target.value)}
            onBlur={() => {
              if (scannedLPN.trim() !== "") {
                const validation = validateLPN(scannedLPN);
                if (!validation.valid) {
                  setLpnError(validation.error || "Invalid LPN format");
                }
              }
            }}
          />
          <button
            onClick={handleScanLPN}
            className="btn btn-primary btn-square"
            title="Scan LPN"
          >
            <span className="material-symbols-outlined">qr_code_scanner</span>
          </button>
        </div>
        {lpnError && (
          <div className="mt-2 text-xs text-error flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">error</span>
            {lpnError}
          </div>
        )}
        {scannedLPN && !lpnError && (
          <div className="mt-2 text-xs text-success flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">check_circle</span>
            LPN: {scannedLPN}
          </div>
        )}
        <div className="mt-1 text-xs text-base-content/60">
          Format: LPN-XXXX (e.g., LPN-1234 or LPN-ABC123)
        </div>
      </div>

      {/* Scan Location */}
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <div className="text-sm font-medium text-base-content mb-2">Select Target Location</div>
        <div className="flex gap-2">
          <input
            className={`input input-bordered flex-1 ${locationError ? "input-error" : ""}`}
            placeholder="Scan or enter location (e.g., C-02-05-3-B)"
            value={scannedLocation}
            onChange={(e) => handleLocationChange(e.target.value)}
            onBlur={() => {
              if (scannedLocation.trim() !== "") {
                handleLocationChange(scannedLocation);
              }
            }}
            disabled={validatingLocation}
          />
          <button
            onClick={() => setShowLocationPicker(true)}
            className="btn btn-primary btn-square"
            title="Select Location"
          >
            <span className="material-symbols-outlined">location_on</span>
          </button>
        </div>
        {validatingLocation && (
          <div className="mt-2 text-xs text-info flex items-center gap-1">
            <span className="loading loading-spinner loading-xs"></span>
            Validating location...
          </div>
        )}
        {locationError && !validatingLocation && (
          <div className="mt-2 text-xs text-error flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">error</span>
            {locationError}
          </div>
        )}
        {scannedLocation && !locationError && !validatingLocation && (
          <div className="mt-2 text-xs text-success flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">check_circle</span>
            Location: {formatLocationCodeForDisplay(scannedLocation)}
          </div>
        )}
        <div className="mt-1 text-xs text-base-content/60">
          Format: AREA-ROW-BAY-LEVEL-POS (e.g., C-02-05-3-B)
        </div>
      </div>

      {/* Confirm Button */}
      <button
        onClick={handleConfirm}
        className="btn btn-primary w-full btn-lg"
        disabled={!scannedLPN || !scannedLocation}
      >
        <span className="material-symbols-outlined">check_circle</span>
        Confirm Putaway
      </button>

      {/* Quick Actions */}
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <h3 className="font-bold text-base-content mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-2">
          <button 
            onClick={handleTakePhoto}
            className="btn btn-outline btn-sm"
          >
            <span className="material-symbols-outlined">photo_camera</span>
            Take Photo {photos.length > 0 && `(${photos.length})`}
          </button>
          <button 
            onClick={() => setShowNoteModal(true)}
            className="btn btn-outline btn-sm"
          >
            <span className="material-symbols-outlined">note_add</span>
            Add Note {note && "✓"}
          </button>
        </div>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept="image/*"
          capture="environment"
        />
        {photos.length > 0 && (
          <div className="mt-3 flex gap-2 overflow-x-auto">
            {photos.map((photo, idx) => (
              <div key={idx} className="relative">
                <img src={photo} alt={`Photo ${idx + 1}`} className="w-20 h-20 object-cover rounded-lg" />
                <button
                  onClick={() => setPhotos(photos.filter((_, i) => i !== idx))}
                  className="absolute -top-2 -right-2 btn btn-circle btn-xs btn-error"
                >
                  <span className="material-symbols-outlined text-xs">close</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* QR Scanners */}
      <QRScanner
        isOpen={showLPNScanner}
        onClose={() => setShowLPNScanner(false)}
        onScan={handleLPNScan}
        title="Scan LPN QR Code"
        description="Point camera at LPN (License Plate Number) QR code"
      />

      {/* Location Picker Modal */}
      {showLocationPicker && (
        <LocationPicker
          onLocationSelect={handleLocationSelect}
          onClose={() => setShowLocationPicker(false)}
          title="Confirm Location"
          warehouseId={worker?.warehouse ? undefined : undefined}
        />
      )}

      {/* Note Modal */}
      <Modal isOpen={showNoteModal} onClose={() => setShowNoteModal(false)} title="Add Note">
        <div className="p-4 space-y-4">
          <textarea
            className="textarea textarea-bordered w-full"
            rows={4}
            placeholder="Enter note about this putaway..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <button className="btn btn-ghost" onClick={() => setShowNoteModal(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSaveNote}>
              Save Note
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
