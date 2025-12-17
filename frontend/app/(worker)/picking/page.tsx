"use client";

import { useState } from "react";

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
  const [pickedQty, setPickedQty] = useState(0);
  const currentPick = picks.find((p) => p.status === "current");
  const upcomingPicks = picks.filter((p) => p.status === "upcoming");

  const handleConfirmPick = () => {
    // Handle pick confirmation
    console.log("Pick confirmed:", pickedQty);
  };

  return (
    <div className="p-4 space-y-4">
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
              disabled={pickedQty === 0 || pickedQty > currentPick.qty}
            >
              <span className="material-symbols-outlined">check_circle</span>
              Confirm Pick
            </button>
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

      {/* Quick Actions */}
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <h3 className="font-bold text-base-content mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn btn-outline btn-sm">
            <span className="material-symbols-outlined">qr_code_scanner</span>
            Scan Location
          </button>
          <button className="btn btn-outline btn-sm">
            <span className="material-symbols-outlined">refresh</span>
            Refresh List
          </button>
        </div>
      </div>
    </div>
  );
}
