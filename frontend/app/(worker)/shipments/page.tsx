"use client";

import { useState } from "react";

export default function ShipmentsPage() {
  const shipments = [
    {
      id: "SH-9001",
      order: "SO-1001",
      carrier: "DHL",
      status: "Ready to Ship",
      destination: "New York, NY",
    },
    {
      id: "SH-9002",
      order: "SO-1002",
      carrier: "FedEx",
      status: "In Transit",
      destination: "Los Angeles, CA",
    },
  ];

  return (
    <div className="p-4 space-y-4">
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <h2 className="text-xl font-bold text-base-content mb-4">Shipments</h2>
        <p className="text-sm text-base-content/60">
          View and manage shipment tasks.
        </p>
      </div>

      <div className="space-y-3">
        {shipments.map((shipment) => (
          <div
            key={shipment.id}
            className="bg-base-100 rounded-xl p-4 border border-base-300"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="font-bold text-base-content">{shipment.id}</div>
                <div className="text-sm text-base-content/60">Order: {shipment.order}</div>
              </div>
              <span className="badge badge-info">{shipment.status}</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="material-symbols-outlined text-base-content/60">local_shipping</span>
                <span className="text-base-content/70">{shipment.carrier}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="material-symbols-outlined text-base-content/60">location_on</span>
                <span className="text-base-content/70">{shipment.destination}</span>
              </div>
            </div>
            <button className="btn btn-primary btn-sm w-full mt-3">
              <span className="material-symbols-outlined">check_circle</span>
              Process Shipment
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

