"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Pagination } from "@/components/Pagination";
import { StatusChip } from "@/components/StatusChip";
import { shipmentsApi } from "@/lib/api/shipments";
import { showToast } from "@/lib/utils/toast";
import { logger } from "@/lib/utils/logger";
import { CreateShipmentModal, ShipmentDetailModal } from "./components/ShipmentModals";
import { ShipmentDisplay, shipmentStatusTone, tabs } from "./types";

const displayToApiStatus: Record<string, string> = {
  "in transit": "in_transit",
  delivered: "delivered",
  "label created": "label_created",
  "ready to ship": "ready_to_ship",
  cancelled: "cancelled",
};

function toDisplayStatus(status?: string): string {
  if (!status) return "Label Created";
  if (status === "in_transit" || status === "shipped") return "In Transit";
  if (status === "label_created") return "Label Created";
  if (status === "ready_to_ship") return "Ready to Ship";
  if (status === "delivered") return "Delivered";
  if (status === "cancelled") return "Cancelled";
  return status;
}

function toApiSortField(sortBy: "id" | "carrier" | "destination" | "eta" | "status" | null): string {
  if (sortBy === "id") return "shipmentNumber";
  if (sortBy === "carrier") return "carrier";
  if (sortBy === "destination") return "destination";
  if (sortBy === "eta") return "eta";
  if (sortBy === "status") return "status";
  return "createdAt";
}

export default function ShipmentsPage() {
  const [activeTab, setActiveTab] = useState("All");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<ShipmentDisplay | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"id" | "carrier" | "destination" | "eta" | "status" | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // API state
  const [shipments, setShipments] = useState<ShipmentDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const requestedStatus =
    statusFilter !== "all"
      ? displayToApiStatus[statusFilter.toLowerCase()]
      : activeTab !== "All"
        ? displayToApiStatus[activeTab.toLowerCase()]
        : undefined;

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const shipmentsPage = await shipmentsApi.getPaged({
        page: currentPage - 1,
        size: itemsPerPage,
        sortBy: toApiSortField(sortBy),
        sortDir: sortDirection,
        status: requestedStatus,
        q: searchQuery.trim() || undefined,
      });

      const displayShipments: ShipmentDisplay[] = shipmentsPage.data.map((s) => ({
        shipmentId: s.id,
        id: s.shipmentNumber || s.id,
        carrier: s.carrier || "N/A",
        status: toDisplayStatus(s.status),
        eta: s.eta || "",
        tracking: s.trackingNumber || "",
        destination: s.destination || "",
        weight: s.weightKg ? `${s.weightKg} kg` : "N/A",
        driverName: s.driverName || "",
        driverPhone: s.driverPhone || "",
        vehicleNumber: s.vehicleNumber || "",
        orders: s.orderId ? [s.orderId] : [],
        shipmentDate: s.shippedAt ? new Date(s.shippedAt).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
      }));

      setShipments(displayShipments);
      setTotalItems(shipmentsPage.totalElements);
      setTotalPages(Math.max(shipmentsPage.totalPages, 1));
    } catch (err) {
      logger.error("Failed to load shipments:", err);
      setError(err instanceof Error ? err.message : "Failed to load shipments");
      setShipments([]);
      if (err instanceof Error && !err.message.includes("Not authenticated")) {
        showToast.error("Failed to load shipments. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [currentPage, itemsPerPage, searchQuery, sortBy, sortDirection, statusFilter, activeTab]);

  const totalShipments = totalItems;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (error && shipments.length === 0) {
    return (
      <div className="alert alert-error">
        <span className="material-symbols-outlined">error</span>
        <span>Error loading shipments: {error}</span>
      </div>
    );
  }
  const inTransit = shipments.filter((s) => s.status === "In Transit").length;
  const delivered = shipments.filter((s) => s.status === "Delivered").length;
  const labelCreated = shipments.filter((s) => s.status === "Label Created").length;
  const readyToShip = shipments.filter((s) => s.status === "Ready to Ship").length;

  const handleViewShipment = (shipment: ShipmentDisplay) => {
    setSelectedShipment(shipment);
    setShowDetailModal(true);
  };

  const handleTrackShipment = (tracking: string) => {
    window.open(`https://tracking.example.com/${tracking}`, "_blank");
  };

  const handleConfirmDelivery = async (shipment: ShipmentDisplay) => {
    try {
      await shipmentsApi.confirmDelivery(shipment.shipmentId);
      showToast.success(`Delivery confirmed for ${shipment.id}`);
      await loadData();
    } catch (err) {
      logger.error("Failed to confirm delivery:", err);
      showToast.error(err instanceof Error ? err.message : "Failed to confirm delivery");
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-base-content">Shipments ({totalShipments})</h1>
        <div className="flex gap-3">
          <div className="form-control">
            <div className="relative">
              <input
                type="text"
                placeholder="Search shipments..."
                className="input input-bordered input-sm w-64 pl-10 pr-10"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
              />
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 text-sm pointer-events-none">
                search
              </span>
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setCurrentPage(1);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs btn-circle"
                  type="button"
                >
                  <span className="material-symbols-outlined text-xs">close</span>
                </button>
              )}
            </div>
          </div>
          <div className="dropdown dropdown-end">
            <label tabIndex={0} className="btn btn-sm btn-ghost">
              <span className="material-symbols-outlined">swap_vert</span>
              <span>Sort by</span>
            </label>
            <ul
              tabIndex={0}
              className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300 z-10"
            >
              <li>
                <button onClick={() => {
                  setSortBy("id");
                  setSortDirection(sortBy === "id" && sortDirection === "asc" ? "desc" : "asc");
                }}>Shipment ID {sortBy === "id" && (sortDirection === "asc" ? "↑" : "↓")}</button>
              </li>
              <li>
                <button onClick={() => {
                  setSortBy("carrier");
                  setSortDirection(sortBy === "carrier" && sortDirection === "asc" ? "desc" : "asc");
                }}>Carrier {sortBy === "carrier" && (sortDirection === "asc" ? "↑" : "↓")}</button>
              </li>
              <li>
                <button onClick={() => {
                  setSortBy("destination");
                  setSortDirection(sortBy === "destination" && sortDirection === "asc" ? "desc" : "asc");
                }}>Destination {sortBy === "destination" && (sortDirection === "asc" ? "↑" : "↓")}</button>
              </li>
              <li>
                <button onClick={() => {
                  setSortBy("eta");
                  setSortDirection(sortBy === "eta" && sortDirection === "asc" ? "desc" : "asc");
                }}>ETA {sortBy === "eta" && (sortDirection === "asc" ? "↑" : "↓")}</button>
              </li>
              <li>
                <button onClick={() => {
                  setSortBy("status");
                  setSortDirection(sortBy === "status" && sortDirection === "asc" ? "desc" : "asc");
                }}>Status {sortBy === "status" && (sortDirection === "asc" ? "↑" : "↓")}</button>
              </li>
              <li>
                <button onClick={() => setSortBy(null)}>Clear Sort</button>
              </li>
            </ul>
          </div>
          <div className="dropdown dropdown-end">
            <label tabIndex={0} className="btn btn-sm btn-ghost">
              <span className="material-symbols-outlined">filter_list</span>
              <span>Filter</span>
            </label>
            <ul
              tabIndex={0}
              className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300 z-10"
            >
              <li>
                <button onClick={() => {
                  setStatusFilter("all");
                  setCurrentPage(1);
                }}>All Status</button>
              </li>
              <li>
                <button onClick={() => {
                  setStatusFilter("in transit");
                  setCurrentPage(1);
                }}>In Transit</button>
              </li>
              <li>
                <button onClick={() => {
                  setStatusFilter("delivered");
                  setCurrentPage(1);
                }}>Delivered</button>
              </li>
              <li>
                <button onClick={() => {
                  setStatusFilter("label created");
                  setCurrentPage(1);
                }}>Label Created</button>
              </li>
              <li>
                <button onClick={() => {
                  setStatusFilter("ready to ship");
                  setCurrentPage(1);
                }}>Ready to Ship</button>
              </li>
              <li>
                <button onClick={() => {
                  setStatusFilter("cancelled");
                  setCurrentPage(1);
                }}>Cancelled</button>
              </li>
            </ul>
          </div>
          <button
            className="btn btn-sm btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            <span className="material-symbols-outlined">add</span>
            <span>Create Shipment</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card bg-base-100 border border-base-300 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-base-content/60">Total Shipments</div>
              <div className="text-2xl font-bold text-base-content">{totalShipments}</div>
            </div>
            <span className="material-symbols-outlined text-3xl text-primary">local_shipping</span>
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-base-content/60">In Transit</div>
              <div className="text-2xl font-bold text-info">{inTransit}</div>
            </div>
            <span className="material-symbols-outlined text-3xl text-info">sync</span>
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-base-content/60">Delivered</div>
              <div className="text-2xl font-bold text-success">{delivered}</div>
            </div>
            <span className="material-symbols-outlined text-3xl text-success">check_circle</span>
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-base-content/60">Label Created</div>
              <div className="text-2xl font-bold text-warning">{labelCreated + readyToShip}</div>
            </div>
            <span className="material-symbols-outlined text-3xl text-warning">label</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-base-100 p-1 rounded-xl border border-base-300">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              setCurrentPage(1);
            }}
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
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)]">
          <table className="table w-full">
            <thead className="bg-base-200 [&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-base-200">
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
              {shipments.map((s) => (
                <tr key={s.shipmentId} className="hover:bg-base-200/50">
                  <td>
                    <button
                      onClick={() => handleViewShipment(s)}
                      className="font-semibold text-primary hover:underline text-left"
                    >
                      {s.id}
                    </button>
                  </td>
                  <td>
                    <StatusChip label={s.carrier} tone="neutral" className="whitespace-nowrap" />
                  </td>
                  <td className="text-base-content/70">{s.destination}</td>
                  <td>{s.weight}</td>
                  <td>
                    <StatusChip label={s.status} tone={shipmentStatusTone(s.status)} showDot />
                  </td>
                  <td className="text-base-content/70">{s.eta}</td>
                  <td>
                    <button
                      onClick={() => handleTrackShipment(s.tracking)}
                      className="link link-primary text-sm"
                    >
                      {s.tracking}
                    </button>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button
                        className="btn btn-ghost btn-xs"
                        title="Confirm Delivery"
                        disabled={s.status !== "In Transit"}
                        onClick={() => handleConfirmDelivery(s)}
                      >
                        <span className="material-symbols-outlined text-sm">task_alt</span>
                      </button>
                      <button
                        className="btn btn-ghost btn-xs"
                        title="Track"
                        onClick={() => handleTrackShipment(s.tracking)}
                      >
                        <span className="material-symbols-outlined text-sm">location_on</span>
                      </button>
                      <button
                        className="btn btn-ghost btn-xs"
                        title="View"
                        onClick={() => handleViewShipment(s)}
                      >
                        <span className="material-symbols-outlined text-sm">visibility</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        itemsPerPage={itemsPerPage}
        totalItems={totalItems}
        showItemsPerPage
        onItemsPerPageChange={(next) => {
          setItemsPerPage(next);
          setCurrentPage(1);
        }}
      />

      {/* Create Shipment Modal */}
      {showCreateModal && (
        <CreateShipmentModal onClose={() => setShowCreateModal(false)} />
      )}

      {/* Shipment Detail Modal */}
      {selectedShipment && (
        <ShipmentDetailModal
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedShipment(null);
          }}
          shipment={selectedShipment}
        />
      )}
    </div>
  );
}
