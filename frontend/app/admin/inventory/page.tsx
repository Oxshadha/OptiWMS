"use client";

import { useState, useEffect } from "react";
import clsx from "clsx";
import { DetailModal } from "@/components/DetailModal";
import { useAdmin } from "@/contexts/AdminContext";
import { inventoryApi, InventoryItem } from "@/lib/api/inventory";
import { materialsApi, Material } from "@/lib/api/materials";
import { warehousesApi, Warehouse } from "@/lib/api/warehouses";
import { showToast } from "@/lib/utils/toast";
import { Modal } from "@/components/Modal";
import { logger } from "@/lib/utils/logger";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// Display format for inventory items
interface InventoryDisplayItem {
  id: string;
  sku: string;
  name: string;
  qty: number;
  location: string;
  status: "Available" | "Low" | "Out of Stock";
  category: string;
  warehouseName: string;
  itemType: "Product" | "Raw Material" | "Packaging";
  materialId: string;
  warehouseId: string;
  // Planning fields
  reorderPoint?: string;
  bufferStock?: string;
  maxStock?: string;
  minStock?: string;
  moq?: string;
  leadTimeDays?: number;
  stackingQuantity?: number;
  // Additional planning fields
  bufferDays?: number;
  leadTimeMonths?: string;
  ropInDays?: string;
  varianceDemand?: string;
  varianceLeadTimeDemand?: string;
  difference?: string;
  orderDeliveryDays?: number;
  orderQuantity?: string;
  palletRequirement?: string;
}

const statusClass = (s: string) => {
  if (s === "Available") return "badge-success";
  if (s === "Low") return "badge-warning";
  if (s === "Out of Stock") return "badge-error";
  return "badge-outline";
};

// Format decimal numbers for display (WMS standard: show 2 decimal places or whole numbers)
const formatDecimal = (value: number): string => {
  if (value === 0) return "0";
  // If it's a whole number, show without decimals
  if (value % 1 === 0) {
    return value.toLocaleString();
  }
  // Otherwise, show 2 decimal places
  return value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

const categories = ["All", "Electronics", "Home", "Appliances", "Sports"];
const itemTypes = ["All", "Raw Material", "Packaging", "Product"];

export default function InventoryPage() {
  const { admin, role } = useAdmin();
  const isWarehouseManager = role === "warehouse_manager";
  const assignedWarehouseId = admin?.warehouseId;
  const assignedWarehouseName = admin?.warehouseName;
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeItemType, setActiveItemType] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [sortBy, setSortBy] = useState<
    "name" | "sku" | "qty" | "location" | null
  >(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selectedItem, setSelectedItem] = useState<InventoryDisplayItem | null>(null);
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set([
    "sku", "name", "type", "category", "quantity", "location", "status",
    "reorderPoint", "bufferStock", "moq", "leadTimeDays"
  ]));
  
  // API state
  const [inventoryItems, setInventoryItems] = useState<InventoryDisplayItem[]>([]);
  const [materials, setMaterials] = useState<Map<string, { materialCode: string; description: string; materialType?: string }>>(new Map());
  const [warehouses, setWarehouses] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load data from API
  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Determine materialType filter for API call
      let materialTypeFilter: string | undefined = undefined;
      if (activeItemType === "Raw Material") {
        materialTypeFilter = "raw_material";
      } else if (activeItemType === "Packaging") {
        materialTypeFilter = "packaging_material";
      } else if (activeItemType === "Product") {
        materialTypeFilter = "product";
      }
      // If "All" is selected, materialTypeFilter remains undefined (no filter)

      // Load inventory, materials, and warehouses in parallel
      const [inventoryData, materialsData, warehousesData] = await Promise.all([
        inventoryApi.getAll(materialTypeFilter),
        materialsApi.getAll(),
        warehousesApi.getAll(),
      ]);

        // Create lookup maps
        const materialsMap = new Map();
        materialsData.forEach((m) => {
          materialsMap.set(m.id, {
            materialCode: m.materialCode,
            description: m.description,
            materialType: m.materialType,
          });
        });

        const warehousesMap = new Map();
        warehousesData.forEach((w) => {
          warehousesMap.set(w.id, w.name);
        });

        setMaterials(materialsMap);
        setWarehouses(warehousesMap);

        // Transform inventory items to display format
        const displayItems: InventoryDisplayItem[] = inventoryData.map((item) => {
          const material = materialsMap.get(item.materialId);
          const warehouseName = warehousesMap.get(item.warehouseId) || "Unknown";
          // Convert to integer (quantities are integers in the backend)
          const qty = Math.ceil(parseFloat(item.quantity) || 0);
          const availableQty = Math.ceil(parseFloat(item.availableQuantity) || 0);
          
          // Determine status based on ROP, buffer stock, and quantity (WMS best practice)
          let status: "Available" | "Low" | "Out of Stock" = "Available";
          const reorderPoint = item.reorderPoint ? parseFloat(item.reorderPoint) : null;
          const bufferStock = item.bufferStock ? parseFloat(item.bufferStock) : null;
          
          if (item.status === "non_moving") {
            status = "Out of Stock"; // Non-moving items shown as out of stock
          } else if (qty === 0) {
            status = "Out of Stock";
          } else if (reorderPoint != null && qty <= reorderPoint) {
            // If quantity is at or below reorder point, it's low stock
            status = "Low";
          } else if (bufferStock != null && qty <= bufferStock) {
            // If quantity is at or below buffer stock, it's low stock
            status = "Low";
          } else if (qty < 10 || availableQty < 10) {
            // Fallback: if no ROP/buffer stock set, use simple threshold
            status = "Low";
          }

          // Determine item type from material
          // Use materialType from inventory item (denormalized) or material
          const materialType = item.materialType || material?.materialType || "raw_material";
          let itemType: "Product" | "Raw Material" | "Packaging";
          if (materialType.toLowerCase().includes("packaging")) {
            itemType = "Packaging";
          } else if (materialType.toLowerCase().includes("product")) {
            itemType = "Product";
          } else {
            itemType = "Raw Material"; // Default
          }

          return {
            id: item.id,
            sku: material?.materialCode || item.materialId,
            name: material?.description || "Unknown Material",
            qty,
            location: item.locationCode || "N/A",
            status,
            category: "General", // Category not in MaterialDto, using default
            warehouseName,
            itemType,
            materialId: item.materialId,
            warehouseId: item.warehouseId,
            // Planning fields from API
            reorderPoint: item.reorderPoint,
            bufferStock: item.bufferStock,
            maxStock: item.maxStock,
            minStock: item.minStock,
            moq: item.moq,
            leadTimeDays: item.leadTimeDays,
            stackingQuantity: item.stackingQuantity,
            // Additional planning fields
            bufferDays: item.bufferDays,
            leadTimeMonths: item.leadTimeMonths,
            ropInDays: item.ropInDays,
            varianceDemand: item.varianceDemand,
            varianceLeadTimeDemand: item.varianceLeadTimeDemand,
            difference: item.difference,
            orderDeliveryDays: item.orderDeliveryDays,
            orderQuantity: item.orderQuantity,
            palletRequirement: item.palletRequirement,
          };
        });

        setInventoryItems(displayItems);
      } catch (err) {
        console.error("Failed to load inventory:", err);
        setError("Failed to load inventory data. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

  useEffect(() => {
    loadData();
  }, [assignedWarehouseId, activeItemType]); // Reload when filter changes

  // Listen for import success event
  useEffect(() => {
    const handleImportSuccess = () => {
      loadData();
    };
    window.addEventListener('inventoryImported', handleImportSuccess);
    return () => window.removeEventListener('inventoryImported', handleImportSuccess);
  }, []);

  // Filter inventory by warehouse for warehouse managers
  const inventoryForWarehouse =
    isWarehouseManager && assignedWarehouseId
      ? inventoryItems.filter((item) => item.warehouseId === assignedWarehouseId)
      : inventoryItems;

  let filteredInventory = inventoryForWarehouse.filter((item) => {
    const matchesCategory =
      activeCategory === "All" || item.category === activeCategory;
    const matchesItemType =
      activeItemType === "All" || 
      (activeItemType === "Product" && item.itemType === "Product") ||
      (activeItemType === "Raw Material" && item.itemType === "Raw Material") ||
      (activeItemType === "Packaging" && item.itemType === "Packaging");
    const query = searchQuery.trim().toLowerCase();
    if (!query) return matchesCategory && matchesItemType;
    const matchesSearch =
      item.name.toLowerCase().includes(query) ||
      item.sku.toLowerCase().includes(query) ||
      item.location.toLowerCase().includes(query) ||
      item.status.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query) ||
      item.qty.toString().includes(query);
    return matchesCategory && matchesItemType && matchesSearch;
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

  const totalItems = Math.ceil(inventoryForWarehouse.reduce(
    (sum, item) => sum + item.qty,
    0
  ));
  const lowStockItems = inventoryForWarehouse.filter(
    (item) => item.status === "Low" || item.status === "Out of Stock"
  ).length;
  const availableItems = inventoryForWarehouse.filter(
    (item) => item.status === "Available"
  ).length;

  // Show loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="alert alert-error">
          <span className="material-symbols-outlined">error</span>
          <span>{error}</span>
          <button className="btn btn-sm" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-base-content">Inventory</h1>
        <div className="flex gap-3">
          <button
            className="btn btn-outline"
            onClick={() => setShowImportModal(true)}
            title="Import inventory from CSV"
          >
            <span className="material-symbols-outlined">upload</span>
            Import CSV
          </button>
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => window.location.reload()}
            title="Refresh data"
          >
            <span className="material-symbols-outlined">refresh</span>
          </button>
          <div className="dropdown dropdown-end">
            <label tabIndex={0} className="btn btn-sm btn-ghost">
              <span className="material-symbols-outlined">swap_vert</span>
              <span>Sort by</span>
            </label>
          </div>
          <div className="dropdown dropdown-end">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setShowColumnMenu(!showColumnMenu)}
            >
              <span className="material-symbols-outlined">view_column</span>
              <span>Columns</span>
            </button>
            {showColumnMenu && (
              <ul className="dropdown-content menu bg-base-100 border border-base-300 rounded-box shadow-lg z-50 p-2 w-64 max-h-96 overflow-y-auto">
                {[
                  { key: "sku", label: "SKU" },
                  { key: "name", label: "Item Name" },
                  { key: "type", label: "Type" },
                  { key: "category", label: "Category" },
                  { key: "quantity", label: "Quantity" },
                  { key: "location", label: "Location" },
                  { key: "status", label: "Status" },
                  { key: "reorderPoint", label: "ROP" },
                  { key: "ropInDays", label: "ROP (Days)" },
                  { key: "bufferStock", label: "Buffer Stock" },
                  { key: "bufferDays", label: "Buffer Days" },
                  { key: "maxStock", label: "Max Stock" },
                  { key: "minStock", label: "Min Stock" },
                  { key: "moq", label: "MOQ" },
                  { key: "leadTimeDays", label: "Lead Time (Days)" },
                  { key: "leadTimeMonths", label: "Lead Time (Months)" },
                  { key: "stackingQuantity", label: "Stacking Qty" },
                  { key: "varianceDemand", label: "Variance Demand" },
                  { key: "varianceLeadTimeDemand", label: "Variance Lead Time" },
                  { key: "difference", label: "Difference" },
                  { key: "orderDeliveryDays", label: "Order Delivery" },
                  { key: "orderQuantity", label: "Order Quantity" },
                  { key: "palletRequirement", label: "Pallet Requirement" },
                ].map((col) => (
                  <li key={col.key}>
                    <label className="label cursor-pointer">
                      <span className="label-text">{col.label}</span>
                      <input
                        type="checkbox"
                        className="checkbox checkbox-sm"
                        checked={visibleColumns.has(col.key)}
                        onChange={(e) => {
                          const newVisible = new Set(visibleColumns);
                          if (e.target.checked) {
                            newVisible.add(col.key);
                          } else {
                            newVisible.delete(col.key);
                          }
                          setVisibleColumns(newVisible);
                        }}
                      />
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="dropdown dropdown-end">
            <label tabIndex={0} className="btn btn-sm btn-ghost">
              <span className="material-symbols-outlined">sort</span>
              <span>Sort by</span>
            </label>
            <ul
              tabIndex={0}
              className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300 z-10"
            >
              <li>
                <button
                  onClick={() => {
                    setSortBy("name");
                    setSortDirection(
                      sortBy === "name" && sortDirection === "asc"
                        ? "desc"
                        : "asc"
                    );
                  }}
                >
                  Name{" "}
                  {sortBy === "name" && (sortDirection === "asc" ? "↑" : "↓")}
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    setSortBy("sku");
                    setSortDirection(
                      sortBy === "sku" && sortDirection === "asc"
                        ? "desc"
                        : "asc"
                    );
                  }}
                >
                  SKU{" "}
                  {sortBy === "sku" && (sortDirection === "asc" ? "↑" : "↓")}
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    setSortBy("qty");
                    setSortDirection(
                      sortBy === "qty" && sortDirection === "asc"
                        ? "desc"
                        : "asc"
                    );
                  }}
                >
                  Quantity{" "}
                  {sortBy === "qty" && (sortDirection === "asc" ? "↑" : "↓")}
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    setSortBy("location");
                    setSortDirection(
                      sortBy === "location" && sortDirection === "asc"
                        ? "desc"
                        : "asc"
                    );
                  }}
                >
                  Location{" "}
                  {sortBy === "location" &&
                    (sortDirection === "asc" ? "↑" : "↓")}
                </button>
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
              <div className="text-2xl font-bold text-base-content">
                {totalItems.toLocaleString()}
              </div>
            </div>
            <span className="material-symbols-outlined text-3xl text-primary">
              inventory
            </span>
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-base-content/60">Available</div>
              <div className="text-2xl font-bold text-success">
                {availableItems}
              </div>
            </div>
            <span className="material-symbols-outlined text-3xl text-success">
              check_circle
            </span>
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-base-content/60">Low Stock</div>
              <div className="text-2xl font-bold text-warning">
                {lowStockItems}
              </div>
            </div>
            <span className="material-symbols-outlined text-3xl text-warning">
              warning
            </span>
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-base-content/60">Categories</div>
              <div className="text-2xl font-bold text-base-content">
                {categories.length - 1}
              </div>
            </div>
            <span className="material-symbols-outlined text-3xl text-info">
              category
            </span>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex gap-4 items-center">
          <div className="flex-1">
            <label className="input input-bordered flex items-center gap-2 w-full">
              <span className="material-symbols-outlined text-base-content/60">
                search
              </span>
              <input
                type="text"
                className="grow"
                placeholder="Search by SKU or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </label>
          </div>
        </div>
        <div className="flex gap-4 items-center">
          <div className="flex gap-2 bg-base-100 p-1 rounded-xl border border-base-300">
            <span className="px-2 py-2 text-xs text-base-content/60 font-medium">Type:</span>
            {itemTypes.map((type) => (
              <button
                key={type}
                onClick={() => setActiveItemType(type)}
                className={clsx(
                  "px-4 py-2 rounded-lg text-sm transition-all",
                  activeItemType === type
                    ? "bg-neutral text-neutral-content font-medium"
                    : "text-base-content/60 hover:text-base-content"
                )}
              >
                {type}
              </button>
            ))}
          </div>
          <div className="flex gap-2 bg-base-100 p-1 rounded-xl border border-base-300">
            <span className="px-2 py-2 text-xs text-base-content/60 font-medium">Category:</span>
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
      </div>

      {/* Inventory Table - Scrollable Container */}
      <div className="card bg-base-100 border border-base-300 rounded-xl overflow-hidden">
        <div 
          className="w-full" 
          style={{ 
            height: 'calc(100vh - 450px)',
            minHeight: '500px',
            overflow: 'auto',
            position: 'relative'
          }}
        >
          <table className="table w-full" style={{ minWidth: '1400px', width: 'max-content' }}>
            <thead className="bg-base-200">
              <tr>
                {visibleColumns.has("sku") && <th className="font-semibold text-base-content">SKU</th>}
                {visibleColumns.has("name") && <th className="font-semibold text-base-content">Item Name</th>}
                {visibleColumns.has("type") && <th className="font-semibold text-base-content">Type</th>}
                {visibleColumns.has("category") && <th className="font-semibold text-base-content">Category</th>}
                {visibleColumns.has("quantity") && <th className="font-semibold text-base-content">Quantity</th>}
                {visibleColumns.has("location") && <th className="font-semibold text-base-content">Location</th>}
                {visibleColumns.has("status") && <th className="font-semibold text-base-content">Status</th>}
                {visibleColumns.has("reorderPoint") && <th className="font-semibold text-base-content">ROP</th>}
                {visibleColumns.has("ropInDays") && <th className="font-semibold text-base-content">ROP (Days)</th>}
                {visibleColumns.has("bufferStock") && <th className="font-semibold text-base-content">Buffer Stock</th>}
                {visibleColumns.has("bufferDays") && <th className="font-semibold text-base-content">Buffer Days</th>}
                {visibleColumns.has("maxStock") && <th className="font-semibold text-base-content">Max Stock</th>}
                {visibleColumns.has("minStock") && <th className="font-semibold text-base-content">Min Stock</th>}
                {visibleColumns.has("moq") && <th className="font-semibold text-base-content">MOQ</th>}
                {visibleColumns.has("leadTimeDays") && <th className="font-semibold text-base-content">Lead Time (Days)</th>}
                {visibleColumns.has("leadTimeMonths") && <th className="font-semibold text-base-content">Lead Time (Months)</th>}
                {visibleColumns.has("stackingQuantity") && <th className="font-semibold text-base-content">Stacking Qty</th>}
                {visibleColumns.has("varianceDemand") && <th className="font-semibold text-base-content">Variance Demand</th>}
                {visibleColumns.has("varianceLeadTimeDemand") && <th className="font-semibold text-base-content">Variance Lead Time</th>}
                {visibleColumns.has("difference") && <th className="font-semibold text-base-content">Difference</th>}
                {visibleColumns.has("orderDeliveryDays") && <th className="font-semibold text-base-content">Order Delivery</th>}
                {visibleColumns.has("orderQuantity") && <th className="font-semibold text-base-content">Order Quantity</th>}
                {visibleColumns.has("palletRequirement") && <th className="font-semibold text-base-content">Pallet Requirement</th>}
                <th className="font-semibold text-base-content">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInventory.map((item) => (
                <tr key={item.id} className="hover:bg-base-200/50">
                  {visibleColumns.has("sku") && (
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
                  )}
                  {visibleColumns.has("name") && <td>{item.name}</td>}
                  {visibleColumns.has("type") && (
                    <td>
                      <span
                        className={`badge text-xs whitespace-nowrap ${
                          item.itemType === "Raw Material"
                            ? "badge-info"
                            : item.itemType === "Product"
                            ? "badge-success"
                            : "badge-neutral"
                        }`}
                      >
                        {item.itemType}
                      </span>
                    </td>
                  )}
                  {visibleColumns.has("category") && (
                    <td>
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
                    </td>
                  )}
                  {visibleColumns.has("quantity") && (
                    <td className="font-semibold">{Math.ceil(item.qty)}</td>
                  )}
                  {visibleColumns.has("location") && (
                    <td>
                      <span className="badge badge-ghost">{item.location}</span>
                    </td>
                  )}
                  {visibleColumns.has("status") && (
                    <td>
                      <span className={`badge ${statusClass(item.status)} whitespace-nowrap text-xs`}>
                        {item.status}
                      </span>
                    </td>
                  )}
                  {visibleColumns.has("reorderPoint") && (
                    <td>
                      <span className="text-sm font-mono">
                        {item.reorderPoint ? formatDecimal(parseFloat(item.reorderPoint)) : "—"}
                      </span>
                    </td>
                  )}
                  {visibleColumns.has("ropInDays") && (
                    <td>
                      <span className="text-sm font-mono">
                        {item.ropInDays ? formatDecimal(parseFloat(item.ropInDays)) : "—"}
                      </span>
                    </td>
                  )}
                  {visibleColumns.has("bufferStock") && (
                    <td>
                      <span className="text-sm font-mono">
                        {item.bufferStock ? formatDecimal(parseFloat(item.bufferStock)) : "—"}
                      </span>
                    </td>
                  )}
                  {visibleColumns.has("bufferDays") && (
                    <td>
                      <span className="text-sm">
                        {item.bufferDays ? `${item.bufferDays} days` : "—"}
                      </span>
                    </td>
                  )}
                  {visibleColumns.has("maxStock") && (
                    <td>
                      <span className="text-sm font-mono">
                        {item.maxStock ? formatDecimal(parseFloat(item.maxStock)) : "—"}
                      </span>
                    </td>
                  )}
                  {visibleColumns.has("minStock") && (
                    <td>
                      <span className="text-sm font-mono">
                        {item.minStock ? formatDecimal(parseFloat(item.minStock)) : "—"}
                      </span>
                    </td>
                  )}
                  {visibleColumns.has("moq") && (
                    <td>
                      <span className="text-sm font-mono">
                        {item.moq ? formatDecimal(parseFloat(item.moq)) : "—"}
                      </span>
                    </td>
                  )}
                  {visibleColumns.has("leadTimeDays") && (
                    <td>
                      <span className="text-sm">
                        {item.leadTimeDays ? `${item.leadTimeDays} days` : "—"}
                      </span>
                    </td>
                  )}
                  {visibleColumns.has("leadTimeMonths") && (
                    <td>
                      <span className="text-sm font-mono">
                        {item.leadTimeMonths ? formatDecimal(parseFloat(item.leadTimeMonths)) : "—"}
                      </span>
                    </td>
                  )}
                  {visibleColumns.has("stackingQuantity") && (
                    <td>
                      <span className="text-sm">
                        {item.stackingQuantity ? item.stackingQuantity.toLocaleString() : "—"}
                      </span>
                    </td>
                  )}
                  {visibleColumns.has("varianceDemand") && (
                    <td>
                      <span className="text-sm font-mono">
                        {item.varianceDemand ? formatDecimal(parseFloat(item.varianceDemand)) : "—"}
                      </span>
                    </td>
                  )}
                  {visibleColumns.has("varianceLeadTimeDemand") && (
                    <td>
                      <span className="text-sm font-mono">
                        {item.varianceLeadTimeDemand ? formatDecimal(parseFloat(item.varianceLeadTimeDemand)) : "—"}
                      </span>
                    </td>
                  )}
                  {visibleColumns.has("difference") && (
                    <td>
                      <span className="text-sm font-mono">
                        {item.difference ? formatDecimal(parseFloat(item.difference)) : "—"}
                      </span>
                    </td>
                  )}
                  {visibleColumns.has("orderDeliveryDays") && (
                    <td>
                      <span className="text-sm">
                        {item.orderDeliveryDays ? `${item.orderDeliveryDays} days` : "—"}
                      </span>
                    </td>
                  )}
                  {visibleColumns.has("orderQuantity") && (
                    <td>
                      <span className="text-sm font-mono">
                        {item.orderQuantity ? formatDecimal(parseFloat(item.orderQuantity)) : "—"}
                      </span>
                    </td>
                  )}
                  {visibleColumns.has("palletRequirement") && (
                    <td>
                      <span className="text-sm font-mono">
                        {item.palletRequirement ? formatDecimal(parseFloat(item.palletRequirement)) : "—"}
                      </span>
                    </td>
                  )}
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
                        <span className="material-symbols-outlined text-sm">
                          visibility
                        </span>
                      </button>
                      <button
                        className="btn btn-ghost btn-xs"
                        title="Edit"
                        onClick={() => {
                          setSelectedItem(item);
                          setShowEditModal(true);
                        }}
                      >
                        <span className="material-symbols-outlined text-sm">
                          edit
                        </span>
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
            <span className="material-symbols-outlined text-6xl text-base-content/30 mb-4">
              inventory_2
            </span>
            <h3 className="text-lg font-semibold text-base-content mb-2">
              No items found
            </h3>
            <p className="text-sm text-base-content/60">
              Try adjusting your search or filters
            </p>
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

      {/* Import Inventory Modal */}
      {showImportModal && (
        <ImportInventoryModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onSuccess={async () => {
            setShowImportModal(false);
            await loadData();
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('inventoryImported'));
            }
          }}
        />
      )}
    </div>
  );
}

// Import Inventory Modal Component
function ImportInventoryModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const handleImport = async () => {
    if (!file) {
      showToast.error("Please select a file");
      return;
    }

    try {
      setImporting(true);
      const result = await materialsApi.importInventoryCsv(file);
      if (result.successCount > 0) {
        showToast.success(`Successfully imported ${result.successCount} inventory items`);
        onSuccess();
      }
      if (result.errorCount > 0) {
        showToast.error(`${result.errorCount} items failed to import`);
      }
    } catch (error: any) {
      logger.error("[Inventory] Import failed:", error);
      showToast.error(error.message || "Failed to import inventory");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import Inventory from CSV">
      <div className="space-y-4">
        <div className="alert alert-info">
          <span className="material-symbols-outlined">info</span>
          <div>
            <div className="font-semibold">Import Active stock.csv</div>
            <div className="text-sm">
              This will import stock levels for materials. Materials will be auto-created if they don't exist.
              <br />
              <strong>Note:</strong> Quantity is extracted from "Future Average" column (Column 9).
            </div>
          </div>
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">CSV File</span>
          </label>
          <input
            type="file"
            accept=".csv"
            className="file-input file-input-bordered w-full"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            disabled={importing}
          />
          <label className="label">
            <span className="label-text-alt">
              Expected format: Material Code, Unit Type, Description, Supply Plan, ..., Future Average (Column 9 = Quantity), ...
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button className="btn btn-ghost" onClick={onClose} disabled={importing}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleImport}
            disabled={!file || importing}
          >
            {importing ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Importing...
              </>
            ) : (
              "Import"
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// Add Inventory Item Modal
function AddInventoryItemModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    sku: "",
    name: "",
    category: "",
    qty: "",
    location: "",
    status: "Available" as "Available" | "Low" | "Out of Stock",
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [materialsData, warehousesData] = await Promise.all([
          materialsApi.getAll(),
          warehousesApi.getAll(),
        ]);
        setMaterials(materialsData);
        setWarehouses(warehousesData);
      } catch (err) {
        console.error("Failed to load materials/warehouses:", err);
      }
    };
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      setError(null);

      // Find material by description (name)
      const material = materials.find((m) => m.description === formData.name);
      if (!material) {
        setError("Material not found. Please select a valid material.");
        return;
      }

      // Get warehouse ID (use first warehouse for now, or get from context)
      const warehouse = warehouses[0];
      if (!warehouse) {
        setError("No warehouse available.");
        return;
      }

      await inventoryApi.create({
        materialId: material.id,
        warehouseId: warehouse.id,
        locationCode: formData.location || undefined,
        quantity: formData.qty || "0",
        availableQuantity: formData.qty || "0",
        status: "active",
      });

      showToast.success("Inventory item added successfully!");
      onClose();
      setFormData({
        sku: "",
        name: "",
        category: "",
        qty: "",
        location: "",
        status: "Available",
      });
      // Reload page to refresh inventory list
      window.location.reload();
    } catch (err) {
      console.error("Failed to add inventory item:", err);
      setError("Failed to add inventory item. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DetailModal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Inventory Item"
      size="md"
    >
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
              <span className="label-text font-medium">Material *</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            >
              <option value="">Select material</option>
              {materials.map((m) => (
                <option key={m.id} value={m.description}>
                  {m.description}
                </option>
              ))}
            </select>
          </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Category *</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={formData.category}
            onChange={(e) =>
              setFormData({ ...formData, category: e.target.value })
            }
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
              onChange={(e) =>
                setFormData({ ...formData, qty: e.target.value })
              }
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
              onChange={(e) =>
                setFormData({ ...formData, location: e.target.value })
              }
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
            onChange={(e) =>
              setFormData({ ...formData, status: e.target.value as "Available" | "Low" | "Out of Stock" })
            }
          >
            <option value="Available">Available</option>
            <option value="Low">Low</option>
            <option value="Out of Stock">Out of Stock</option>
          </select>
        </div>
        {error && (
          <div className="alert alert-error">
            <span>{error}</span>
          </div>
        )}
        <div className="flex justify-end gap-3 pt-4">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Adding...
              </>
            ) : (
              "Add Item"
            )}
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
    qty = Math.max(
      0,
      currentQty + variation + Math.floor(Math.random() * 15) - 7
    );

    data.push({
      date: date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
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
  item: InventoryDisplayItem;
}) {
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d">("30d");

  const daysMap = {
    "7d": 7,
    "30d": 30,
    "90d": 90,
  };

  const inventoryHistory = generateInventoryHistory(
    item.qty,
    daysMap[timeRange]
  );

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
  const change =
    inventoryHistory[inventoryHistory.length - 1].quantity -
    inventoryHistory[0].quantity;

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
              <label className="text-sm text-base-content/60">
                Current Quantity
              </label>
              <p className="font-semibold text-lg">{Math.ceil(item.qty)} units</p>
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

        {/* Planning Information */}
        <div>
          <h3 className="text-lg font-semibold text-base-content mb-4">
            Planning & Reorder Information
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-base-content/60">Reorder Point (ROP)</label>
              <p className="font-semibold font-mono">
                {item.reorderPoint ? formatDecimal(parseFloat(item.reorderPoint)) : "Not Set"}
              </p>
            </div>
            <div>
              <label className="text-sm text-base-content/60">Buffer Stock</label>
              <p className="font-semibold font-mono">
                {item.bufferStock ? formatDecimal(parseFloat(item.bufferStock)) : "Not Set"}
              </p>
            </div>
            <div>
              <label className="text-sm text-base-content/60">Maximum Stock</label>
              <p className="font-semibold font-mono">
                {item.maxStock ? formatDecimal(parseFloat(item.maxStock)) : "Not Set"}
              </p>
            </div>
            <div>
              <label className="text-sm text-base-content/60">Minimum Stock</label>
              <p className="font-semibold font-mono">
                {item.minStock ? formatDecimal(parseFloat(item.minStock)) : "Not Set"}
              </p>
            </div>
            <div>
              <label className="text-sm text-base-content/60">Minimum Order Quantity (MOQ)</label>
              <p className="font-semibold font-mono">
                {item.moq ? formatDecimal(parseFloat(item.moq)) : "Not Set"}
              </p>
            </div>
            <div>
              <label className="text-sm text-base-content/60">Lead Time</label>
              <p className="font-semibold">
                {item.leadTimeDays ? `${item.leadTimeDays} days` : "Not Set"}
              </p>
            </div>
            <div>
              <label className="text-sm text-base-content/60">Stacking Quantity</label>
              <p className="font-semibold">
                {item.stackingQuantity ? item.stackingQuantity.toLocaleString() : "Not Set"}
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
                    timeRange === range ? "btn-primary" : "btn-ghost"
                  )}
                >
                  {range === "7d"
                    ? "7 Days"
                    : range === "30d"
                    ? "30 Days"
                    : "90 Days"}
                </button>
              ))}
            </div>
          </div>

          {/* Statistics Dashboard */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            <div className="bg-base-200 rounded-lg p-3">
              <div className="text-xs text-base-content/60 mb-1">Current</div>
              <div className="text-lg font-bold text-base-content">
                {item.qty}
              </div>
            </div>
            <div className="bg-base-200 rounded-lg p-3">
              <div className="text-xs text-base-content/60 mb-1">Average</div>
              <div className="text-lg font-bold text-base-content">
                {avgQty}
              </div>
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

          {/* Time-Based Inventory Chart */}
          <div className="bg-base-200 rounded-lg p-4">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={inventoryHistory}>
                  <defs>
                    <linearGradient
                      id="colorQuantity"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
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
                    formatter={(value: number) => [
                      `${value} units`,
                      "Quantity",
                    ]}
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

          {/* Trend Analysis */}
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
              Change: {change > 0 ? "+" : ""}
              {change} units
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          <button className="btn btn-primary">Edit Item</button>
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
  item: InventoryDisplayItem;
}) {
  const [formData, setFormData] = useState({
    qty: item.qty.toString(),
    location: item.location,
    status: item.status,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      // Calculate quantity change
      const currentQty = item.qty;
      const newQty = parseFloat(formData.qty) || 0;
      const quantityChange = newQty - currentQty;

      if (quantityChange !== 0) {
        await inventoryApi.updateQuantity(item.id, quantityChange);
      }

      showToast.success("Inventory updated successfully!");
      // Reload page to refresh data
      window.location.reload();
    } catch (error) {
      console.error("Failed to update inventory:", error);
      showToast.error("Failed to update inventory. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DetailModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Inventory: ${item.sku}`}
      size="md"
    >
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
            onChange={(e) =>
              setFormData({ ...formData, location: e.target.value })
            }
          />
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Status</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={formData.status}
            onChange={(e) =>
              setFormData({ ...formData, status: e.target.value as "Available" | "Low" | "Out of Stock" })
            }
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
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Updating...
              </>
            ) : (
              "Update Inventory"
            )}
          </button>
        </div>
      </form>
    </DetailModal>
  );
}
