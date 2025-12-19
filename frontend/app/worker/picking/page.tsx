"use client";

import { useState, useEffect } from "react";
import { useOffline } from "@/hooks/useOffline";
import { saveScanRecord, getScanRecordsByTask, addToSyncQueue } from "@/lib/indexeddb";
import { QRScanner } from "@/components/QRScanner";

const picks = [
  {
    id: 1,
    order: "#56281",
    location: "B3",
    item: "Smart Projector",
    sku: "SKU-1002",
    qty: 2,
    status: "current",
  },
  {
    id: 2,
    location: "B4",
    item: "Remote Control",
    sku: "SKU-2001",
    qty: 4,
    status: "upcoming",
  },
  {
    id: 3,
    location: "C2",
    item: "Smart Mug",
    sku: "SKU-1003",
    qty: 6,
    status: "upcoming",
  },
  {
    id: 4,
    location: "D1",
    item: "Wireless Earbuds",
    sku: "SKU-1001",
    qty: 3,
    status: "upcoming",
  },
];

export default function PickingPage() {
  const { isOnline, dbReady } = useOffline();
  const [pickedQty, setPickedQty] = useState(0);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [savedPicks, setSavedPicks] = useState<any[]>([]);
  const [showLocationScanner, setShowLocationScanner] = useState(false);
  const currentPick = picks.find((p) => p.status === "current");
  const upcomingPicks = picks.filter((p) => p.status === "upcoming");

  // Load saved picks on mount
  useEffect(() => {
    if (dbReady) {
      loadSavedPicks();
    }
  }, [dbReady]);

  const loadSavedPicks = async () => {
    try {
      const records = await getScanRecordsByTask("picking");
      setSavedPicks(records);
    } catch (error) {
      console.error("Error loading saved picks:", error);
    }
  };

  const handleConfirmPick = async () => {
    if (!currentPick || pickedQty === 0 || pickedQty > currentPick.qty) return;

    setSaveStatus("saving");

    try {
      // Save pick record to IndexedDB (works offline)
      const recordId = await saveScanRecord({
        taskId: "picking",
        location: currentPick.location,
        sku: currentPick.sku,
        item: currentPick.item,
        qty: pickedQty,
      });

      // Add to sync queue (will sync when online)
      await addToSyncQueue({
        type: "scan",
        action: "create",
        data: {
          taskId: "picking",
          order: currentPick.order,
          location: currentPick.location,
          sku: currentPick.sku,
          item: currentPick.item,
          qty: pickedQty,
          timestamp: Date.now(),
        },
      });

      setSaveStatus("saved");
      
      // Reload saved picks
      await loadSavedPicks();

      // Reset form
      setTimeout(() => {
        setPickedQty(0);
        setSaveStatus("idle");
      }, 1500);
    } catch (error) {
      console.error("Error saving pick:", error);
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 2000);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Network Status */}
      <div className="bg-base-100 rounded-xl p-3 border border-base-300">
        <div className="flex items-center justify-between">
          <span className="text-sm text-base-content/60">Network Status</span>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isOnline ? "bg-success" : "bg-warning animate-pulse"}`}></div>
            <span className={`text-sm font-medium ${isOnline ? "text-success" : "text-warning"}`}>
              {isOnline ? "Online" : "Offline"}
            </span>
          </div>
        </div>
        {!isOnline && (
          <div className="mt-2 text-xs text-warning-content bg-warning/10 rounded p-2">
            <span className="material-symbols-outlined text-xs align-middle">info</span>
            <span className="ml-1">Working offline. Picks will sync when connection is restored.</span>
          </div>
        )}
      </div>

      {/* Current Pick */}
      {currentPick && (
        <div className="bg-primary/10 border-2 border-primary rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs text-primary font-medium">Current Pick</div>
            <div className="badge badge-primary">Active</div>
          </div>
          <div className="space-y-3">
            <div>
              <div className="text-sm text-base-content/60">Order</div>
              <div className="font-bold text-lg text-base-content">{currentPick.order}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-base-content/60">Location</div>
                <div className="font-semibold text-base-content">{currentPick.location}</div>
              </div>
              <div>
                <div className="text-xs text-base-content/60">Quantity</div>
                <div className="font-semibold text-base-content">{currentPick.qty}</div>
              </div>
            </div>
            <div>
              <div className="text-xs text-base-content/60">Item</div>
              <div className="font-semibold text-base-content">{currentPick.item}</div>
              <div className="text-xs text-base-content/60">SKU: {currentPick.sku}</div>
            </div>

            {/* Quantity Picker */}
            <div className="bg-base-100 rounded-lg p-3">
              <div className="text-xs text-base-content/60 mb-2">Picked Quantity</div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setPickedQty(Math.max(0, pickedQty - 1))}
                  className="btn btn-circle btn-outline btn-sm"
                >
                  <span className="material-symbols-outlined">remove</span>
                </button>
                <input
                  type="number"
                  className="input input-bordered flex-1 text-center text-xl font-bold"
                  value={pickedQty}
                  onChange={(e) => setPickedQty(Math.max(0, parseInt(e.target.value) || 0))}
                  min="0"
                  max={currentPick.qty}
                />
                <button
                  onClick={() => setPickedQty(Math.min(currentPick.qty, pickedQty + 1))}
                  className="btn btn-circle btn-outline btn-sm"
                >
                  <span className="material-symbols-outlined">add</span>
                </button>
              </div>
            </div>

            <button
              onClick={handleConfirmPick}
              className="btn btn-primary w-full"
              disabled={pickedQty === 0 || pickedQty > currentPick.qty || saveStatus === "saving" || !dbReady}
            >
              {saveStatus === "saving" ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  Saving...
                </>
              ) : saveStatus === "saved" ? (
                <>
                  <span className="material-symbols-outlined">check_circle</span>
                  Saved!
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined">check_circle</span>
                  Confirm Pick
                </>
              )}
            </button>
            {saveStatus === "saved" && (
              <div className="text-xs text-success text-center">
                ✓ Saved to local storage {!isOnline && "(will sync when online)"}
              </div>
            )}
            {saveStatus === "error" && (
              <div className="text-xs text-error text-center">
                ✗ Error saving. Please try again.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upcoming Picks */}
      {upcomingPicks.length > 0 && (
        <div className="bg-base-100 rounded-xl p-4 border border-base-300">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-base-content">Upcoming Picks</h3>
            <span className="badge badge-outline">{upcomingPicks.length}</span>
          </div>
          <div className="space-y-2">
            {upcomingPicks.map((pick) => (
              <div
                key={pick.id}
                className="flex items-center justify-between p-3 bg-base-200 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-info/10 rounded-lg flex items-center justify-center">
                    <span className="material-symbols-outlined text-info">location_on</span>
                  </div>
                  <div>
                    <div className="font-semibold text-sm text-base-content">
                      {pick.location} • {pick.item}
                    </div>
                    <div className="text-xs text-base-content/60">Qty: {pick.qty}</div>
                  </div>
                </div>
                <span className="material-symbols-outlined text-base-content/40">chevron_right</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Saved Picks (from IndexedDB) */}
      {savedPicks.length > 0 && (
        <div className="bg-base-100 rounded-xl p-4 border border-base-300">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-base-content">Saved Picks</h3>
            <span className="badge badge-outline">{savedPicks.length}</span>
          </div>
          <div className="space-y-2">
            {savedPicks.slice(-5).reverse().map((record, idx) => (
              <div
                key={record.id || idx}
                className="flex items-center justify-between p-3 bg-base-200 rounded-lg"
              >
                <div>
                  <div className="font-semibold text-sm text-base-content">
                    {record.location} • {record.item || record.sku}
                  </div>
                  <div className="text-xs text-base-content/60">
                    Qty: {record.qty} • {new Date(record.timestamp).toLocaleTimeString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!record.synced && (
                    <span className="badge badge-warning badge-sm">Pending Sync</span>
                  )}
                  {record.synced && (
                    <span className="badge badge-success badge-sm">Synced</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <h3 className="font-bold text-base-content mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-2">
          <button 
            className="btn btn-outline btn-sm"
            onClick={() => setShowLocationScanner(true)}
          >
            <span className="material-symbols-outlined">qr_code_scanner</span>
            Scan Location
          </button>
          <button 
            className="btn btn-outline btn-sm"
            onClick={loadSavedPicks}
          >
            <span className="material-symbols-outlined">refresh</span>
            Refresh List
          </button>
        </div>
      </div>

      {/* QR Scanner */}
      <QRScanner
        isOpen={showLocationScanner}
        onClose={() => setShowLocationScanner(false)}
        onScan={(result) => {
          // Handle scanned location
          console.log("Scanned location:", result);
          // You can use this to validate against current pick location
          if (currentPick && result === currentPick.location) {
            // Location matches, could auto-confirm or highlight
            alert(`Location ${result} matches current pick!`);
          }
          setShowLocationScanner(false);
        }}
        title="Scan Location QR Code"
        description="Point camera at location QR code to verify"
      />
    </div>
  );
}
