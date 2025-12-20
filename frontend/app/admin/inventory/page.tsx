"use client";

import { useState } from "react";
import clsx from "clsx";
import { DetailModal } from "@/components/DetailModal";
import { useAdmin } from "@/contexts/AdminContext";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";

const inventory = [
  { sku: "SKU-1001", name: "Wireless Earbuds", qty: 240, location: "A1", status: "Available", category: "Electronics", warehouseName: "Warehouse 1" },
  { sku: "SKU-1002", name: "Smart Projector", qty: 56, location: "B3", status: "Available", category: "Electronics", warehouseName: "Warehouse 1" },
  { sku: "SKU-1003", name: "Smart Mug", qty: 18, location: "C2", status: "Low", category: "Home", warehouseName: "Warehouse 1" },
  { sku: "SKU-1004", name: "Instant Pot", qty: 90, location: "D4", status: "Available", category: "Appliances", warehouseName: "Warehouse 1" },
  { sku: "SKU-1005", name: "Yoga Mat", qty: 5, location: "E1", status: "Out of Stock", category: "Sports", warehouseName: "Warehouse 2" },
  { sku: "SKU-1006", name: "Bluetooth Speaker", qty: 120, location: "A5", status: "Available", category: "Electronics", warehouseName: "Warehouse 2" },
];

const statusClass = (s: string) => {
  if (s === "Available") return "badge-success";
  if (s === "Low") return "badge-warning";
  if (s === "Out of Stock") return "badge-error";
  return "badge-outline";
};

const categories = ["All", "Electronics", "Home", "Appliances", "Sports"];

export default function InventoryPage() {
  const { admin, role } = useAdmin();
  const isWarehouseManager = role === "warehouse_manager";
  const assignedWarehouseName = admin?.warehouseName;
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "sku" | "qty" | "location" | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selectedItem, setSelectedItem] = useState<typeof inventory[0] | null>(null);

  // Filter inventory by warehouse for warehouse managers
  const inventoryForWarehouse = isWarehouseManager && assignedWarehouseName
    ? inventory.filter((item) => item.warehouseName === assignedWarehouseName)
    : inventory;

  let filteredInventory = inventoryForWarehouse.filter(item => {
    const matchesCategory = activeCategory === "All" || item.category === activeCategory;
    const query = searchQuery.trim().toLowerCase();
    if (!query) return matchesCategory;
    const matchesSearch = 
      item.name.toLowerCase().includes(query) ||
      item.sku.toLowerCase().includes(query) ||
      item.location.toLowerCase().includes(query) ||
      item.status.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query) ||
      item.qty.toString().includes(query);
    return matchesCategory && matchesSearch;
  });

  // Apply sorting
  if (sortBy) {
    filteredInventory = [...filteredInventory].sort((a, b) => {
      let aVal: any = a[sortBy];
      let bVal: any = b[sortBy];
      if (sortBy === "qty") {
        aVal = Number(aVal);
        bVal = Number(bVal);
      } else {
        aVal = String(aVal).toLowerCase();
        bVal = String(bVal).toLowerCase();
      }
      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }

  const totalItems = inventoryForWarehouse.reduce((sum, item) => sum + item.qty, 0);
  const lowStockItems = inventoryForWarehouse.filter(item => item.status === "Low" || item.status === "Out of Stock").length;
  const availableItems = inventoryForWarehouse.filter(item => item.status === "Available").length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-base-content">Inventory</h1>
        <div className="flex gap-3">
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
                  setSortBy("name");
                  setSortDirection(sortBy === "name" && sortDirection === "asc" ? "desc" : "asc");
                }}>Name {sortBy === "name" && (sortDirection === "asc" ? "↑" : "↓")}</button>
              </li>
              <li>
                <button onClick={() => {
                  setSortBy("sku");
                  setSortDirection(sortBy === "sku" && sortDirection === "asc" ? "desc" : "asc");
                }}>SKU {sortBy === "sku" && (sortDirection === "asc" ? "↑" : "↓")}</button>
              </li>
              <li>
                <button onClick={() => {
                  setSortBy("qty");
                  setSortDirection(sortBy === "qty" && sortDirection === "asc" ? "desc" : "asc");
                }}>Quantity {sortBy === "qty" && (sortDirection === "asc" ? "↑" : "↓")}</button>
              </li>
              <li>
                <button onClick={() => {
                  setSortBy("location");
                  setSortDirection(sortBy === "location" && sortDirection === "asc" ? "desc" : "asc");
                }}>Location {sortBy === "location" && (sortDirection === "asc" ? "↑" : "↓")}</button>
              </li>
              <li>
                <button onClick={() => setSortBy(null)}>Clear Sort</button>
              </li>
            </ul>
          </div>
          <button 
            className="btn btn-sm btn-primary"
            onClick={() => setShowAddModal(true)}
          >
            <span className="material-symbols-outlined">add</span>
            <span>Add Item</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card bg-base-100 border border-base-300 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-base-content/60">Total Items</div>
              <div className="text-2xl font-bold text-base-content">{totalItems.toLocaleString()}</div>
            </div>
            <span className="material-symbols-outlined text-3xl text-primary">inventory</span>
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-base-content/60">Available</div>
              <div className="text-2xl font-bold text-success">{availableItems}</div>
            </div>
            <span className="material-symbols-outlined text-3xl text-success">check_circle</span>
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-base-content/60">Low Stock</div>
              <div className="text-2xl font-bold text-warning">{lowStockItems}</div>
            </div>
            <span className="material-symbols-outlined text-3xl text-warning">warning</span>
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-base-content/60">Categories</div>
              <div className="text-2xl font-bold text-base-content">{categories.length - 1}</div>
            </div>
            <span className="material-symbols-outlined text-3xl text-info">category</span>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-4 items-center">
        <div className="flex-1">
          <label className="input input-bordered flex items-center gap-2 w-full">
            <span className="material-symbols-outlined text-base-content/60">search</span>
            <input
              type="text"
              className="grow"
              placeholder="Search by SKU or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </label>
        </div>
        <div className="flex gap-2 bg-base-100 p-1 rounded-xl border border-base-300">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={clsx(
                "px-4 py-2 rounded-lg text-sm transition-all",
                activeCategory === cat
                  ? "bg-neutral text-neutral-content font-medium"
                  : "text-base-content/60 hover:text-base-content"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Inventory Table */}
      <div className="card bg-base-100 border border-base-300 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead className="bg-base-200">
              <tr>
                <th className="font-semibold text-base-content">SKU</th>
                <th className="font-semibold text-base-content">Item Name</th>
                <th className="font-semibold text-base-content">Category</th>
                <th className="font-semibold text-base-content">Quantity</th>
                <th className="font-semibold text-base-content">Location</th>
                <th className="font-semibold text-base-content">Status</th>
                <th className="font-semibold text-base-content">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInventory.map((item) => (
                <tr key={item.sku} className="hover:bg-base-200/50">
                  <td>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedItem(item);
                        setShowDetailModal(true);
                      }}
                      className="font-semibold text-primary hover:underline text-left"
                    >
                      {item.sku}
                    </button>
                  </td>
                  <td>{item.name}</td>
                  <td>
                    <span 
                      className="badge text-xs whitespace-nowrap" 
                      style={{ backgroundColor: "#EEEEEE", color: "#1F2937", border: "1px solid #E5E7EB" }}
                    >
                      {item.category}
                    </span>
                  </td>
                  <td className="font-semibold">{item.qty}</td>
                  <td>
                    <span className="badge badge-ghost">{item.location}</span>
                  </td>
                  <td>
                    <span className={`badge ${statusClass(item.status)}`}>{item.status}</span>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button 
                        className="btn btn-ghost btn-xs" 
                        title="View"
                        onClick={() => {
                          setSelectedItem(item);
                          setShowDetailModal(true);
                        }}
                      >
                        <span className="material-symbols-outlined text-sm">visibility</span>
                      </button>
                      <button 
                        className="btn btn-ghost btn-xs" 
                        title="Edit"
                        onClick={() => {
                          setSelectedItem(item);
                          setShowEditModal(true);
                        }}
                      >
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredInventory.length === 0 && (
          <div className="p-12 text-center">
            <span className="material-symbols-outlined text-6xl text-base-content/30 mb-4">inventory_2</span>
            <h3 className="text-lg font-semibold text-base-content mb-2">No items found</h3>
            <p className="text-sm text-base-content/60">Try adjusting your search or filters</p>
          </div>
        )}
      </div>

      {/* Inventory Item Detail Modal */}
      {selectedItem && (
        <InventoryItemDetailModal
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedItem(null);
          }}
          item={selectedItem}
        />
      )}

      {/* Edit Inventory Item Modal */}
      {selectedItem && (
        <EditInventoryItemModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedItem(null);
          }}
          item={selectedItem}
        />
      )}

      {/* Add Inventory Item Modal */}
      <AddInventoryItemModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
      />
    </div>
  );
}

// Add Inventory Item Modal
function AddInventoryItemModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [formData, setFormData] = useState({
    sku: "",
    name: "",
    category: "",
    qty: "",
    location: "",
    status: "Available",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: API call to add inventory item
    console.log("Adding inventory item:", formData);
    alert("Inventory item added successfully!");
    onClose();
    setFormData({
      sku: "",
      name: "",
      category: "",
      qty: "",
      location: "",
      status: "Available",
    });
  };

  return (
    <DetailModal isOpen={isOpen} onClose={onClose} title="Add Inventory Item" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">SKU *</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={formData.sku}
            onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
            required
          />
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Item Name *</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Category *</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            required
          >
            <option value="">Select category</option>
            <option value="Electronics">Electronics</option>
            <option value="Home">Home</option>
            <option value="Appliances">Appliances</option>
            <option value="Sports">Sports</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Quantity *</span>
            </label>
            <input
              type="number"
              className="input input-bordered w-full"
              value={formData.qty}
              onChange={(e) => setFormData({ ...formData, qty: e.target.value })}
              required
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Location</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            />
          </div>
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Status</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
          >
            <option value="Available">Available</option>
            <option value="Low">Low</option>
            <option value="Out of Stock">Out of Stock</option>
          </select>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Add Item
          </button>
        </div>
      </form>
    </DetailModal>
  );
}

// Generate mock historical inventory data for an item
function generateInventoryHistory(currentQty: number, days: number = 30) {
  const data = [];
  const today = new Date();
  let qty = currentQty;

  // Generate data going backwards from today
  for (let i = days; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    // Simulate realistic inventory fluctuations
    // Add some randomness but keep it trending around current quantity
    const variation = Math.floor(Math.random() * 20) - 10; // -10 to +10 variation
    qty = Math.max(0, currentQty + variation + Math.floor(Math.random() * 15) - 7);
    
    data.push({
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      quantity: qty,
      fullDate: date.toISOString().split("T")[0],
    });
  }

  return data;
}

// Inventory Item Detail Modal
function InventoryItemDetailModal({
  isOpen,
  onClose,
  item,
}: {
  isOpen: boolean;
  onClose: () => void;
  item: typeof inventory[0];
}) {
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d");
  
  const daysMap = {
    "7d": 7,
    "30d": 30,
    "90d": 90,
  };

  const inventoryHistory = generateInventoryHistory(item.qty, daysMap[timeRange]);
  
  // Calculate statistics
  const minQty = Math.min(...inventoryHistory.map((d) => d.quantity));
  const maxQty = Math.max(...inventoryHistory.map((d) => d.quantity));
  const avgQty = Math.round(
    inventoryHistory.reduce((sum, d) => sum + d.quantity, 0) /
      inventoryHistory.length
  );
  const trend =
    inventoryHistory[inventoryHistory.length - 1].quantity >
    inventoryHistory[0].quantity
      ? "up"
      : inventoryHistory[inventoryHistory.length - 1].quantity <
        inventoryHistory[0].quantity
      ? "down"
      : "stable";

  return (
    <DetailModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Inventory: ${item.sku}`}
      size="xl"
    >
      <div className="space-y-6">
        {/* Basic Information */}
        <div>
          <h3 className="text-lg font-semibold text-base-content mb-4">
            Item Information
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-base-content/60">SKU</label>
              <p className="font-semibold">{item.sku}</p>
            </div>
            <div>
              <label className="text-sm text-base-content/60">Item Name</label>
              <p className="font-semibold">{item.name}</p>
            </div>
            <div>
              <label className="text-sm text-base-content/60">Category</label>
              <p>
                <span
                  className="badge text-xs whitespace-nowrap"
                  style={{
                    backgroundColor: "#EEEEEE",
                    color: "#1F2937",
                    border: "1px solid #E5E7EB",
                  }}
                >
                  {item.category}
                </span>
              </p>
            </div>
            <div>
              <label className="text-sm text-base-content/60">Current Quantity</label>
              <p className="font-semibold text-lg">{item.qty} units</p>
            </div>
            <div>
              <label className="text-sm text-base-content/60">Location</label>
              <p className="font-semibold">{item.location}</p>
            </div>
            <div>
              <label className="text-sm text-base-content/60">Status</label>
              <p>
                <span className={`badge ${statusClass(item.status)}`}>
                  {item.status}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Inventory History Chart */}
        <div className="border-t pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-base-content">
                Inventory Levels Over Time
              </h3>
              <p className="text-sm text-base-content/60 mt-1">
                Track inventory changes and trends
              </p>
            </div>
            <div className="flex gap-2">
              {(["7d", "30d", "90d"] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={clsx(
                    "btn btn-sm",
                    timeRange === range
                      ? "btn-primary"
                      : "btn-ghost"
                  )}
                >
                  {range === "7d" ? "7 Days" : range === "30d" ? "30 Days" : "90 Days"}
                </button>
              ))}
            </div>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="bg-base-200 rounded-lg p-3">
              <div className="text-xs text-base-content/60 mb-1">Current</div>
              <div className="text-lg font-bold text-base-content">
                {item.qty}
              </div>
            </div>
            <div className="bg-base-200 rounded-lg p-3">
              <div className="text-xs text-base-content/60 mb-1">Average</div>
              <div className="text-lg font-bold text-base-content">{avgQty}</div>
            </div>
            <div className="bg-base-200 rounded-lg p-3">
              <div className="text-xs text-base-content/60 mb-1">Minimum</div>
              <div className="text-lg font-bold text-warning">{minQty}</div>
            </div>
            <div className="bg-base-200 rounded-lg p-3">
              <div className="text-xs text-base-content/60 mb-1">Maximum</div>
              <div className="text-lg font-bold text-success">{maxQty}</div>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-base-200 rounded-lg p-4">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={inventoryHistory}>
                  <defs>
                    <linearGradient id="colorQuantity" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#CF0F47" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#CF0F47" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#E5E7EB"
                    opacity={0.5}
                  />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "#6B7280" }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "#6B7280" }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#fff",
                      border: "1px solid #E5E7EB",
                      borderRadius: "8px",
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                    }}
                    labelFormatter={(label) => `Date: ${label}`}
                    formatter={(value: number) => [`${value} units`, "Quantity"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="quantity"
                    stroke="#CF0F47"
                    strokeWidth={2}
                    fill="url(#colorQuantity)"
                    dot={{ r: 3, fill: "#CF0F47" }}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Trend Indicator */}
          <div className="mt-4 flex items-center gap-2 text-sm">
            <span className="text-base-content/60">Trend:</span>
            {trend === "up" && (
              <>
                <span className="material-symbols-outlined text-success text-sm">
                  trending_up
                </span>
                <span className="text-success font-medium">Increasing</span>
              </>
            )}
            {trend === "down" && (
              <>
                <span className="material-symbols-outlined text-error text-sm">
                  trending_down
                </span>
                <span className="text-error font-medium">Decreasing</span>
              </>
            )}
            {trend === "stable" && (
              <>
                <span className="material-symbols-outlined text-base-content/60 text-sm">
                  remove
                </span>
                <span className="text-base-content/60 font-medium">Stable</span>
              </>
            )}
            <span className="text-base-content/60 ml-4">
              Change:{" "}
              {inventoryHistory[inventoryHistory.length - 1].quantity -
                inventoryHistory[0].quantity >
              0
                ? "+"
                : ""}
              {inventoryHistory[inventoryHistory.length - 1].quantity -
                inventoryHistory[0].quantity}{" "}
              units
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          <button className="btn btn-primary">
            Edit Item
          </button>
        </div>
      </div>
    </DetailModal>
  );
}

// Edit Inventory Item Modal
function EditInventoryItemModal({
  isOpen,
  onClose,
  item,
}: {
  isOpen: boolean;
  onClose: () => void;
  item: typeof inventory[0];
}) {
  const [formData, setFormData] = useState({
    qty: item.qty.toString(),
    location: item.location,
    status: item.status,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: API call to update inventory
    console.log("Updating inventory item:", formData);
    onClose();
  };

  return (
    <DetailModal isOpen={isOpen} onClose={onClose} title={`Edit Inventory: ${item.sku}`} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">SKU</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={item.sku}
            disabled
          />
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Item Name</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={item.name}
            disabled
          />
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Quantity *</span>
          </label>
          <input
            type="number"
            className="input input-bordered w-full"
            value={formData.qty}
            onChange={(e) => setFormData({ ...formData, qty: e.target.value })}
            required
          />
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Location</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
          />
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Status</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
          >
            <option value="Available">Available</option>
            <option value="Low">Low</option>
            <option value="Out of Stock">Out of Stock</option>
          </select>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Update Inventory
          </button>
        </div>
      </form>
    </DetailModal>
  );
}
