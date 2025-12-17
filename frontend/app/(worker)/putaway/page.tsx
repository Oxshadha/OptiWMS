"use client";

import { useState } from "react";

export default function PutawayPage() {
  const [scannedLPN, setScannedLPN] = useState("");
  const [scannedLocation, setScannedLocation] = useState("");

  const task = {
    lpn: "LPN-123",
    fromLocation: "Stage Area",
    toLocation: "Aisle A / Bin A5",
    item: "Wireless Earbuds",
    qty: 50,
  };

  const handleScanLPN = () => {
    // Handle LPN scanning
    console.log("Scanning LPN...");
  };

  const handleScanLocation = () => {
    // Handle location scanning
    console.log("Scanning location...");
  };

  const handleConfirm = () => {
    if (scannedLPN && scannedLocation) {
      // Handle confirmation
      console.log("Putaway confirmed");
    }
  };

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
            className="input input-bordered flex-1"
            placeholder="Scan or enter LPN"
            value={scannedLPN}
            onChange={(e) => setScannedLPN(e.target.value)}
          />
          <button
            onClick={handleScanLPN}
            className="btn btn-primary btn-square"
            title="Scan LPN"
          >
            <span className="material-symbols-outlined">qr_code_scanner</span>
          </button>
        </div>
        {scannedLPN && (
          <div className="mt-2 text-xs text-success flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">check_circle</span>
            LPN scanned: {scannedLPN}
          </div>
        )}
      </div>

      {/* Scan Location */}
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <div className="text-sm font-medium text-base-content mb-2">Scan Target Location</div>
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
            title="Scan Location"
          >
            <span className="material-symbols-outlined">qr_code_scanner</span>
          </button>
        </div>
        {scannedLocation && (
          <div className="mt-2 text-xs text-success flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">check_circle</span>
            Location scanned: {scannedLocation}
          </div>
        )}
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
          <button className="btn btn-outline btn-sm">
            <span className="material-symbols-outlined">photo_camera</span>
            Take Photo
          </button>
          <button className="btn btn-outline btn-sm">
            <span className="material-symbols-outlined">note_add</span>
            Add Note
          </button>
        </div>
      </div>
    </div>
  );
}
