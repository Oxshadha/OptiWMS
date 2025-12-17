"use client";

import { useState } from "react";

export default function CycleCountPage() {
  const [scannedLocation, setScannedLocation] = useState("");
  const [scannedSKU, setScannedSKU] = useState("");
  const [countedQty, setCountedQty] = useState(0);

  const cycleCountTasks = [
    {
      id: 1,
      location: "A1",
      sku: "SKU-1001",
      item: "Wireless Earbuds",
      expected: 50,
      counted: 0,
    },
    {
      id: 2,
      location: "B3",
      sku: "SKU-1002",
      item: "Smart Projector",
      expected: 56,
      counted: 0,
    },
  ];

  const handleScanLocation = () => {
    console.log("Scanning location...");
  };

  const handleScanSKU = () => {
    console.log("Scanning SKU...");
  };

  const handleConfirm = () => {
    console.log("Cycle count confirmed");
  };

  return (
    <div className="p-4 space-y-4">
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <h2 className="text-xl font-bold text-base-content mb-4">Cycle Count</h2>
        <p className="text-sm text-base-content/60">
          Count items at each location to verify inventory accuracy.
        </p>
      </div>

      {/* Scan Location */}
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <div className="text-sm font-medium text-base-content mb-2">Scan Location</div>
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
      </div>

      {/* Count Items */}
      {scannedLocation && (
        <div className="bg-base-100 rounded-xl p-4 border border-base-300 space-y-4">
          <div className="text-sm font-medium text-base-content mb-2">Scan SKU</div>
          <div className="flex gap-2">
            <input
              className="input input-bordered flex-1"
              placeholder="Scan or enter SKU"
              value={scannedSKU}
              onChange={(e) => setScannedSKU(e.target.value)}
            />
            <button
              onClick={handleScanSKU}
              className="btn btn-primary btn-square"
            >
              <span className="material-symbols-outlined">qr_code_scanner</span>
            </button>
          </div>

          {scannedSKU && (
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
                  type="number"
                  className="input input-bordered flex-1 text-center text-xl font-bold"
                  value={countedQty}
                  onChange={(e) => setCountedQty(Math.max(0, parseInt(e.target.value) || 0))}
                  min="0"
                />
                <button
                  onClick={() => setCountedQty(countedQty + 1)}
                  className="btn btn-circle btn-outline btn-sm"
                >
                  <span className="material-symbols-outlined">add</span>
                </button>
              </div>
            </div>
          )}

          <button
            onClick={handleConfirm}
            className="btn btn-primary w-full"
            disabled={!scannedLocation || !scannedSKU || countedQty === 0}
          >
            <span className="material-symbols-outlined">check_circle</span>
            Confirm Count
          </button>
        </div>
      )}

      {/* Active Cycle Count Tasks */}
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <h3 className="font-bold text-base-content mb-3">Active Tasks</h3>
        <div className="space-y-2">
          {cycleCountTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center justify-between p-3 bg-base-200 rounded-lg"
            >
              <div>
                <div className="font-semibold text-sm text-base-content">
                  {task.location} • {task.item}
                </div>
                <div className="text-xs text-base-content/60">Expected: {task.expected}</div>
              </div>
              <span className="material-symbols-outlined text-base-content/40">chevron_right</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

