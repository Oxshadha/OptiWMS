"use client";

import { useState } from "react";

export default function ReturnsPage() {
  const returns = [
    {
      id: "RET-1001",
      order: "SO-1001",
      item: "Wireless Earbuds",
      sku: "SKU-1001",
      reason: "Defective",
      qty: 2,
      status: "Pending",
    },
    {
      id: "RET-1002",
      order: "SO-1002",
      item: "Smart Projector",
      sku: "SKU-1002",
      reason: "Customer Request",
      qty: 1,
      status: "Pending",
    },
    {
      id: "RET-1003",
      order: "SO-1003",
      item: "Smart Mug",
      sku: "SKU-1003",
      reason: "Wrong Item",
      qty: 1,
      status: "Processing",
    },
  ];

  const handleProcessReturn = (returnId: string) => {
    console.log("Processing return:", returnId);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <h2 className="text-xl font-bold text-base-content mb-4">Returns</h2>
        <p className="text-sm text-base-content/60">
          Process returned items and update inventory.
        </p>
      </div>

      <div className="space-y-3">
        {returns.map((returnItem) => (
          <div
            key={returnItem.id}
            className="bg-base-100 rounded-xl p-4 border border-base-300"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="font-bold text-base-content">{returnItem.id}</div>
                <div className="text-sm text-base-content/60">Order: {returnItem.order}</div>
              </div>
              <span className={`badge ${
                returnItem.status === "Pending" ? "badge-warning" : "badge-info"
              }`}>
                {returnItem.status}
              </span>
            </div>
            <div className="space-y-2 mb-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="material-symbols-outlined text-base-content/60">inventory</span>
                <span className="text-base-content/70">{returnItem.item}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="material-symbols-outlined text-base-content/60">tag</span>
                <span className="text-base-content/70">SKU: {returnItem.sku}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="material-symbols-outlined text-base-content/60">info</span>
                <span className="text-base-content/70">Reason: {returnItem.reason}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="material-symbols-outlined text-base-content/60">numbers</span>
                <span className="text-base-content/70">Qty: {returnItem.qty}</span>
              </div>
            </div>
            <button
              onClick={() => handleProcessReturn(returnItem.id)}
              className="btn btn-primary btn-sm w-full"
            >
              <span className="material-symbols-outlined">check_circle</span>
              Process Return
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

