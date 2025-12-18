"use client";

import { useState } from "react";
import clsx from "clsx";
import { Modal } from "@/components/Modal";
import { DetailModal } from "@/components/DetailModal";
import Link from "next/link";

const shipments = [
  { 
    id: "SH-9001", 
    carrier: "DHL", 
    status: "In Transit", 
    eta: "2025-12-16", 
    tracking: "DHL123456", 
    destination: "New York, NY", 
    weight: "15.5 kg",
    driverName: "John Smith",
    driverPhone: "+1-555-0101",
    vehicleNumber: "ABC-1234",
    orders: ["SO-1001", "SO-1002"],
    shipmentDate: "2025-12-15",
  },
  { 
    id: "SH-9002", 
    carrier: "FedEx", 
    status: "Label Created", 
    eta: "2025-12-17", 
    tracking: "FDX789012", 
    destination: "Los Angeles, CA", 
    weight: "8.2 kg",
    driverName: "",
    driverPhone: "",
    vehicleNumber: "",
    orders: ["SO-1003"],
    shipmentDate: "2025-12-16",
  },
  { 
    id: "SH-9003", 
    carrier: "UPS", 
    status: "Delivered", 
    eta: "2025-12-13", 
    tracking: "1Z999AA101", 
    destination: "Chicago, IL", 
    weight: "22.1 kg",
    driverName: "Mike Johnson",
    driverPhone: "+1-555-0202",
    vehicleNumber: "XYZ-5678",
    orders: ["SO-1004"],
    shipmentDate: "2025-12-12",
  },
  { 
    id: "SH-9004", 
    carrier: "DHL", 
    status: "In Transit", 
    eta: "2025-12-18", 
    tracking: "DHL789456", 
    destination: "Miami, FL", 
    weight: "12.3 kg",
    driverName: "Sarah Williams",
    driverPhone: "+1-555-0303",
    vehicleNumber: "DEF-9012",
    orders: ["SO-1005"],
    shipmentDate: "2025-12-17",
  },
  { 
    id: "SH-9005", 
    carrier: "USPS", 
    status: "Delivered", 
    eta: "2025-12-12", 
    tracking: "940011189922", 
    destination: "Seattle, WA", 
    weight: "5.8 kg",
    driverName: "Tom Brown",
    driverPhone: "+1-555-0404",
    vehicleNumber: "GHI-3456",
    orders: ["SO-1006"],
    shipmentDate: "2025-12-11",
  },
];

const statusClass = (s: string) => {
  if (s === "Delivered") return "badge-success";
  if (s === "In Transit") return "badge-info";
  if (s === "Label Created") return "badge-warning";
  if (s === "Ready to Ship") return "badge-warning";
  return "badge-outline";
};

const tabs = ["All", "In Transit", "Delivered", "Label Created", "Ready to Ship"];

export default function ShipmentsPage() {
  const [activeTab, setActiveTab] = useState("All");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<typeof shipments[0] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"id" | "carrier" | "destination" | "eta" | "status" | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [statusFilter, setStatusFilter] = useState("all");

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

// Create Shipment Modal Component
function CreateShipmentModal({ onClose }: { onClose: () => void }) {
  const [formData, setFormData] = useState({
    warehouse: "",
    deliveryPartner: "",
    driverName: "",
    driverPhone: "",
    vehicleNumber: "",
    estimatedDeliveryDate: "",
    selectedOrders: [] as string[],
    notes: "",
  });

  const availableOrders = [
    { id: "SO-1007", customer: "Customer A", items: 3, status: "ready_to_ship" },
    { id: "SO-1008", customer: "Customer B", items: 5, status: "ready_to_ship" },
    { id: "SO-1009", customer: "Customer C", items: 2, status: "ready_to_ship" },
  ];

  const handleSubmit = () => {
    if (!formData.warehouse || !formData.deliveryPartner || !formData.driverName) {
      alert("Please fill in all required fields");
      return;
    }
    console.log("Creating shipment:", formData);
    // TODO: API call to create shipment
    onClose();
  };

  const toggleOrder = (orderId: string) => {
    setFormData({
      ...formData,
      selectedOrders: formData.selectedOrders.includes(orderId)
        ? formData.selectedOrders.filter(id => id !== orderId)
        : [...formData.selectedOrders, orderId],
    });
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Create Shipment" size="lg">
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Warehouse *</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={formData.warehouse}
              onChange={(e) => setFormData({ ...formData, warehouse: e.target.value })}
              required
            >
              <option value="">Select Warehouse</option>
              <option value="warehouse-1">Warehouse 1</option>
              <option value="warehouse-2">Warehouse 2</option>
            </select>
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Delivery Partner *</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={formData.deliveryPartner}
              onChange={(e) => setFormData({ ...formData, deliveryPartner: e.target.value })}
              required
            >
              <option value="">Select Partner</option>
              <option value="dhl">DHL</option>
              <option value="fedex">FedEx</option>
              <option value="ups">UPS</option>
              <option value="usps">USPS</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Driver Name *</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.driverName}
              onChange={(e) => setFormData({ ...formData, driverName: e.target.value })}
              required
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Driver Phone *</span>
            </label>
            <input
              type="tel"
              className="input input-bordered w-full"
              value={formData.driverPhone}
              onChange={(e) => setFormData({ ...formData, driverPhone: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Vehicle Number *</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.vehicleNumber}
              onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value })}
              required
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Estimated Delivery Date *</span>
            </label>
            <input
              type="date"
              className="input input-bordered w-full"
              value={formData.estimatedDeliveryDate}
              onChange={(e) => setFormData({ ...formData, estimatedDeliveryDate: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Select Orders to Include *</span>
          </label>
          <div className="space-y-2 max-h-48 overflow-y-auto border border-base-300 rounded-lg p-3">
            {availableOrders.map((order) => (
              <label key={order.id} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-base-200 rounded">
                <input
                  type="checkbox"
                  className="checkbox"
                  checked={formData.selectedOrders.includes(order.id)}
                  onChange={() => toggleOrder(order.id)}
                />
                <div className="flex-1">
                  <div className="font-medium">{order.id}</div>
                  <div className="text-sm text-base-content/60">{order.customer} • {order.items} items</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Notes</span>
          </label>
          <textarea
            className="textarea textarea-bordered w-full"
            rows={3}
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSubmit}>
            Create Shipment
          </button>
        </div>
      </div>
    </Modal>
  );
}

// Shipment Detail Modal Component
function ShipmentDetailModal({
  isOpen,
  onClose,
  shipment,
}: {
  isOpen: boolean;
  onClose: () => void;
  shipment: typeof shipments[0];
}) {
  return (
    <DetailModal isOpen={isOpen} onClose={onClose} title={`Shipment: ${shipment.id}`} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-base-content/60">Shipment ID</label>
            <p className="font-semibold">{shipment.id}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Status</label>
            <p>
              <span className={`badge ${statusClass(shipment.status)}`}>{shipment.status}</span>
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Carrier</label>
            <p>
              <span 
                className="badge text-xs whitespace-nowrap" 
                style={{ backgroundColor: "#EEEEEE", color: "#1F2937", border: "1px solid #E5E7EB" }}
              >
                {shipment.carrier}
              </span>
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Destination</label>
            <p className="font-semibold">{shipment.destination}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Tracking Number</label>
            <p className="font-semibold">{shipment.tracking}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Weight</label>
            <p className="font-semibold">{shipment.weight}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">ETA</label>
            <p className="font-semibold">{shipment.eta}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Shipment Date</label>
            <p className="font-semibold">{shipment.shipmentDate}</p>
          </div>
        </div>

        {shipment.driverName && (
          <>
            <div className="divider">Delivery Details</div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-base-content/60">Driver Name</label>
                <p className="font-semibold">{shipment.driverName}</p>
              </div>
              <div>
                <label className="text-sm text-base-content/60">Driver Phone</label>
                <p className="font-semibold">{shipment.driverPhone}</p>
              </div>
              <div>
                <label className="text-sm text-base-content/60">Vehicle Number</label>
                <p className="font-semibold">{shipment.vehicleNumber}</p>
              </div>
            </div>
          </>
        )}

        <div className="divider">Orders</div>
        <div className="space-y-2">
          {shipment.orders.map((orderId) => (
            <Link
              key={orderId}
              href={`/admin/orders/outbound/${orderId}`}
              className="block p-3 bg-base-200 rounded-lg hover:bg-base-300 transition-colors"
            >
              <div className="font-semibold text-primary">{orderId}</div>
            </Link>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          <button 
            className="btn btn-primary"
            onClick={() => {
              // TODO: Print manifest - replace with actual print functionality
              console.log("Printing manifest for:", shipment.id);
              const printWindow = window.open('', '_blank');
              if (printWindow) {
                printWindow.document.write(`
                  <html>
                    <head><title>Shipment Manifest - ${shipment.id}</title></head>
                    <body>
                      <h1>Shipment Manifest</h1>
                      <p><strong>Shipment ID:</strong> ${shipment.id}</p>
                      <p><strong>Carrier:</strong> ${shipment.carrier}</p>
                      <p><strong>Tracking:</strong> ${shipment.tracking}</p>
                      <p><strong>Destination:</strong> ${shipment.destination}</p>
                      <p><strong>Weight:</strong> ${shipment.weight}</p>
                      <p><strong>ETA:</strong> ${shipment.eta}</p>
                      <h2>Orders:</h2>
                      <ul>
                        ${shipment.orders.map(order => `<li>${order}</li>`).join('')}
                      </ul>
                      ${shipment.driverName ? `
                        <h2>Delivery Details:</h2>
                        <p><strong>Driver:</strong> ${shipment.driverName}</p>
                        <p><strong>Phone:</strong> ${shipment.driverPhone}</p>
                        <p><strong>Vehicle:</strong> ${shipment.vehicleNumber}</p>
                      ` : ''}
                    </body>
                  </html>
                `);
                printWindow.document.close();
                printWindow.print();
              }
            }}
          >
            <span className="material-symbols-outlined">print</span>
            Print Manifest
          </button>
        </div>
      </div>
    </DetailModal>
  );
}
