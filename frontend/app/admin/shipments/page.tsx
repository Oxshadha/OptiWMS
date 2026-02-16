"use client";

import { useState, useEffect } from "react";
import clsx from "clsx";
import { shipmentsApi } from "@/lib/api/shipments";
import { ordersApi } from "@/lib/api/orders";
import { showToast } from "@/lib/utils/toast";
import { logger } from "@/lib/utils/logger";
import { CreateShipmentModal, ShipmentDetailModal } from "./components/ShipmentModals";
import { ShipmentDisplay, statusClass, tabs } from "./types";

export default function ShipmentsPage() {
  const [activeTab, setActiveTab] = useState("All");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<ShipmentDisplay | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"id" | "carrier" | "destination" | "eta" | "status" | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [statusFilter, setStatusFilter] = useState("all");

  // API state
  const [shipments, setShipments] = useState<ShipmentDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load data from API
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [shipmentsData, outboundOrders] = await Promise.all([
          shipmentsApi.getAll(),
          ordersApi.getAllOutbound(),
        ]);
        
        // Transform API data to display format
        const displayShipments: ShipmentDisplay[] = shipmentsData.map((s) => {
          // Map status from API format to display format
          let displayStatus = s.status || "Label Created";
          if (displayStatus === "in_transit") displayStatus = "In Transit";
          else if (displayStatus === "shipped") displayStatus = "In Transit";
          else if (displayStatus === "label_created") displayStatus = "Label Created";
          else if (displayStatus === "ready_to_ship") displayStatus = "Ready to Ship";
          else if (displayStatus === "delivered") displayStatus = "Delivered";
          
          return {
            shipmentId: s.id,
            id: s.shipmentNumber || s.id,
            carrier: s.carrier || "N/A",
            status: displayStatus,
            eta: s.eta || "",
            tracking: s.trackingNumber || "",
            destination: s.destination || "",
            weight: s.weightKg ? `${s.weightKg} kg` : "N/A",
            driverName: s.driverName || "",
            driverPhone: s.driverPhone || "",
            vehicleNumber: s.vehicleNumber || "",
            orders: s.orderId ? [s.orderId] : [],
            shipmentDate: s.shippedAt ? new Date(s.shippedAt).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
          };
        });
        
        const shipmentOrderIds = new Set(
          shipmentsData
            .map((shipment) => shipment.orderId)
            .filter((orderId): orderId is string => !!orderId)
        );

        const fallbackReadyToShip: ShipmentDisplay[] = outboundOrders
          .filter((order) => (order.status || "").toLowerCase() === "ready_to_ship")
          .filter((order) => !shipmentOrderIds.has(order.id))
          .map((order) => ({
            shipmentId: `fallback-${order.id}`,
            id: `SH-${order.orderNumber}`,
            carrier: "Not Assigned",
            status: "Ready to Ship",
            eta: order.expectedDate || "",
            tracking: `PACK-${order.orderNumber.replace(/^OUT-?/i, "")}`,
            destination: "N/A",
            weight: "N/A",
            driverName: "",
            driverPhone: "",
            vehicleNumber: "",
            orders: [order.orderNumber],
            shipmentDate: order.orderDate || new Date().toISOString().split("T")[0],
          }));
        
        setShipments([...displayShipments, ...fallbackReadyToShip]);
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

    loadData();
  }, []);

  let filteredShipments = shipments.filter(s => {
    const matchesTab = activeTab === "All" || s.status === activeTab;
    const matchesStatus = statusFilter === "all" || s.status.toLowerCase() === statusFilter.toLowerCase();
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query || (
      s.id.toLowerCase().includes(query) ||
      s.carrier.toLowerCase().includes(query) ||
      s.destination.toLowerCase().includes(query) ||
      s.tracking.toLowerCase().includes(query) ||
      s.status.toLowerCase().includes(query) ||
      s.eta.toLowerCase().includes(query) ||
      s.weight.toLowerCase().includes(query) ||
      (s.driverName && s.driverName.toLowerCase().includes(query)) ||
      (s.driverPhone && s.driverPhone.toLowerCase().includes(query)) ||
      (s.vehicleNumber && s.vehicleNumber.toLowerCase().includes(query))
    );
    return matchesTab && matchesStatus && matchesSearch;
  });

  // Apply sorting
  if (sortBy) {
    filteredShipments = [...filteredShipments].sort((a, b) => {
      let aVal: any = a[sortBy];
      let bVal: any = b[sortBy];
      if (sortBy === "eta") {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      } else {
        aVal = String(aVal).toLowerCase();
        bVal = String(bVal).toLowerCase();
      }
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }

  const totalShipments = shipments.length;

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
  const inTransit = shipments.filter(s => s.status === "In Transit").length;
  const delivered = shipments.filter(s => s.status === "Delivered").length;
  const labelCreated = shipments.filter(s => s.status === "Label Created").length;
  const readyToShip = shipments.filter(s => s.status === "Ready to Ship").length;

  const handleViewShipment = (shipment: typeof shipments[0]) => {
    setSelectedShipment(shipment);
    setShowDetailModal(true);
  };

  const handleTrackShipment = (tracking: string) => {
    // Open tracking in new window (would link to carrier tracking page)
    window.open(`https://tracking.example.com/${tracking}`, '_blank');
  };

  const handleConfirmDelivery = async (shipment: ShipmentDisplay) => {
    try {
      await shipmentsApi.confirmDelivery(shipment.shipmentId);
      showToast.success(`Delivery confirmed for ${shipment.id}`);
      setShipments((current) =>
        current.map((s) =>
          s.shipmentId === shipment.shipmentId
            ? { ...s, status: "Delivered", shipmentDate: new Date().toISOString().split("T")[0] }
            : s
        )
      );
    } catch (error) {
      logger.error("Failed to confirm delivery:", error);
      showToast.error(error instanceof Error ? error.message : "Failed to confirm delivery");
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
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 text-sm pointer-events-none">
                search
              </span>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
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
                <button onClick={() => setStatusFilter("all")}>All Status</button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("in transit")}>In Transit</button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("delivered")}>Delivered</button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("label created")}>Label Created</button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("ready to ship")}>Ready to Ship</button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("cancelled")}>Cancelled</button>
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
              <div className="text-sm text-base-content/60">Ready to Ship</div>
              <div className="text-2xl font-bold text-warning">{readyToShip}</div>
            </div>
            <span className="material-symbols-outlined text-3xl text-warning">label</span>
          </div>
        </div>
      </div>

      {/* Search Results Info */}
      {searchQuery && (
        <div className="text-sm text-base-content/60 flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">search</span>
          <span>Found {filteredShipments.length} shipment{filteredShipments.length !== 1 ? 's' : ''} matching "{searchQuery}"</span>
        </div>
      )}

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
              {filteredShipments.map((s) => (
                <tr key={s.id} className="hover:bg-base-200/50">
                  <td>
                    <button
                      onClick={() => handleViewShipment(s)}
                      className="font-semibold text-primary hover:underline text-left"
                    >
                      {s.id}
                    </button>
                  </td>
                  <td>
                    <span 
                      className="badge text-xs whitespace-nowrap" 
                      style={{ backgroundColor: "#EEEEEE", color: "#1F2937", border: "1px solid #E5E7EB" }}
                    >
                      {s.carrier}
                    </span>
                  </td>
                  <td className="text-base-content/70">{s.destination}</td>
                  <td>{s.weight}</td>
                  <td>
                    <span className={`badge ${statusClass(s.status)}`}>{s.status}</span>
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
                        disabled={!(s.status === "In Transit")}
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
