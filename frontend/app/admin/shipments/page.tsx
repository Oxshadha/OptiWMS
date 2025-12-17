"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";

const shipments = [
  {
    id: "SH-9001",
    carrier: "DHL",
    status: "In Transit",
    eta: "2025-12-16",
    tracking: "DHL123456",
    destination: "New York, NY",
    weight: "15.5 kg",
  },
  {
    id: "SH-9002",
    carrier: "FedEx",
    status: "Label Created",
    eta: "2025-12-17",
    tracking: "FDX789012",
    destination: "Los Angeles, CA",
    weight: "8.2 kg",
  },
  {
    id: "SH-9003",
    carrier: "UPS",
    status: "Delivered",
    eta: "2025-12-13",
    tracking: "1Z999AA101",
    destination: "Chicago, IL",
    weight: "22.1 kg",
  },
  {
    id: "SH-9004",
    carrier: "DHL",
    status: "In Transit",
    eta: "2025-12-18",
    tracking: "DHL789456",
    destination: "Miami, FL",
    weight: "12.3 kg",
  },
  {
    id: "SH-9005",
    carrier: "USPS",
    status: "Delivered",
    eta: "2025-12-12",
    tracking: "940011189922",
    destination: "Seattle, WA",
    weight: "5.8 kg",
  },
];

const statusClass = (s: string) => {
  if (s === "Delivered") return "badge-success";
  if (s === "In Transit") return "badge-info";
  if (s === "Label Created") return "badge-warning";
  return "badge-outline";
};

const tabs = ["All", "In Transit", "Delivered", "Label Created"];

export default function ShipmentsPage() {
  const [activeTab, setActiveTab] = useState("All");

  const filteredShipments =
    activeTab === "All"
      ? shipments
      : shipments.filter((s) => s.status === activeTab);

  const totalShipments = shipments.length;
  const inTransit = shipments.filter((s) => s.status === "In Transit").length;
  const delivered = shipments.filter((s) => s.status === "Delivered").length;
  const labelCreated = shipments.filter(
    (s) => s.status === "Label Created"
  ).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-base-content">
          Shipments ({totalShipments})
        </h1>
        <div className="flex gap-3">
          <button className="btn btn-sm btn-ghost">
            <span className="material-symbols-outlined">swap_vert</span>
            <span>Sort by</span>
          </button>
          <button className="btn btn-sm btn-ghost">
            <span className="material-symbols-outlined">filter_list</span>
            <span>Filter</span>
          </button>
          <Link
            href="/admin/shipments/create"
            className="btn btn-sm btn-primary"
          >
            <span className="material-symbols-outlined">add</span>
            <span>Create Shipment</span>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card bg-base-100 border border-base-300 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-base-content/60">
                Total Shipments
              </div>
              <div className="text-2xl font-bold text-base-content">
                {totalShipments}
              </div>
            </div>
            <span className="material-symbols-outlined text-3xl text-primary">
              local_shipping
            </span>
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-base-content/60">In Transit</div>
              <div className="text-2xl font-bold text-info">{inTransit}</div>
            </div>
            <span className="material-symbols-outlined text-3xl text-info">
              sync
            </span>
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-base-content/60">Delivered</div>
              <div className="text-2xl font-bold text-success">{delivered}</div>
            </div>
            <span className="material-symbols-outlined text-3xl text-success">
              check_circle
            </span>
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-base-content/60">Label Created</div>
              <div className="text-2xl font-bold text-warning">
                {labelCreated}
              </div>
            </div>
            <span className="material-symbols-outlined text-3xl text-warning">
              label
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-base-100 p-1 rounded-xl border border-base-300">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(
              "px-6 py-2 rounded-lg text-sm transition-all",
              activeTab === tab
                ? "bg-neutral text-neutral-content font-medium"
                : "text-base-content/60 hover:text-base-content"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Shipments Table */}
      <div className="card bg-base-100 border border-base-300 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead className="bg-base-200">
              <tr>
                <th className="font-semibold text-base-content">Shipment ID</th>
                <th className="font-semibold text-base-content">Carrier</th>
                <th className="font-semibold text-base-content">Destination</th>
                <th className="font-semibold text-base-content">Weight</th>
                <th className="font-semibold text-base-content">Status</th>
                <th className="font-semibold text-base-content">ETA</th>
                <th className="font-semibold text-base-content">Tracking</th>
                <th className="font-semibold text-base-content">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredShipments.map((s) => (
                <tr key={s.id} className="hover:bg-base-200/50">
                  <td className="font-semibold text-primary">{s.id}</td>
                  <td>
                    <span className="badge badge-outline">{s.carrier}</span>
                  </td>
                  <td className="text-base-content/70">{s.destination}</td>
                  <td>{s.weight}</td>
                  <td>
                    <span className={`badge ${statusClass(s.status)}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="text-base-content/70">{s.eta}</td>
                  <td>
                    <a href="#" className="link link-primary text-sm">
                      {s.tracking}
                    </a>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn btn-ghost btn-xs" title="Track">
                        <span className="material-symbols-outlined text-sm">
                          location_on
                        </span>
                      </button>
                      <button className="btn btn-ghost btn-xs" title="View">
                        <span className="material-symbols-outlined text-sm">
                          visibility
                        </span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
