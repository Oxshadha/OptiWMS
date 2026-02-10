"use client";

import { useState, useEffect, useMemo } from "react";
import clsx from "clsx";
import { useAdmin } from "@/contexts/AdminContext";
import { inventoryApi, InventoryItem } from "@/lib/api/inventory";
import { materialsApi } from "@/lib/api/materials";
import { warehousesApi } from "@/lib/api/warehouses";
import { InventoryDisplayItem, formatDecimal, statusClass } from "./types";
import { ImportInventoryModal } from "./components/ImportInventoryModal";
import { AddInventoryItemModal } from "./components/AddInventoryItemModal";
import { EditInventoryItemModal } from "./components/EditInventoryItemModal";
import { InventoryItemDetailModal } from "./components/InventoryItemDetailModal";

const itemTypes = ["All", "Raw Material", "Packaging", "Product"];

export default function InventoryPage() {
  const { admin, role } = useAdmin();
  const isWarehouseManager = role === "warehouse_manager";
  const assignedWarehouseId = admin?.warehouseId;
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeItemType, setActiveItemType] = useState("All");
  const [activeWarehouse, setActiveWarehouse] = useState<string>(
    isWarehouseManager && assignedWarehouseId ? assignedWarehouseId : "All"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [sortBy, setSortBy] = useState<
    "name" | "sku" | "qty" | "location" | null
  >(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selectedItem, setSelectedItem] = useState<InventoryDisplayItem | null>(null);
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set([
    "sku", "name", "type", "category", "warehouse", "quantity", "location", "status",
    "reorderPoint", "bufferStock", "moq", "leadTimeDays"
  ]));
  
  // API state
  const [inventoryItems, setInventoryItems] = useState<InventoryDisplayItem[]>([]);
  const [materials, setMaterials] = useState<Map<string, { materialCode: string; description: string; materialType?: string }>>(new Map());
  const [warehouses, setWarehouses] = useState<Map<string, string>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const categories = useMemo(() => {
    const uniqueCategories = Array.from(
      new Set(inventoryItems.map((item) => item.category).filter(Boolean))
    ).sort();
    return ["All", ...uniqueCategories];
  }, [inventoryItems]);

  useEffect(() => {
    if (isWarehouseManager && assignedWarehouseId) {
      setActiveWarehouse(assignedWarehouseId);
    }
  }, [isWarehouseManager, assignedWarehouseId]);

  useEffect(() => {
    if (!categories.includes(activeCategory)) {
      setActiveCategory("All");
    }
  }, [categories, activeCategory]);

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

  // Filter inventory by warehouse for warehouse managers
  const inventoryForWarehouse =
    isWarehouseManager && assignedWarehouseId
      ? inventoryItems.filter((item) => item.warehouseId === assignedWarehouseId)
      : inventoryItems;

  // Filter to only show in-stock items (quantity > 0) - real-time database connection
  const inStockItems = inventoryForWarehouse.filter((item) => item.qty > 0);

  let filteredInventory = inStockItems.filter((item) => {
    const matchesCategory =
      activeCategory === "All" || item.category === activeCategory;
    const matchesItemType =
      activeItemType === "All" || 
      (activeItemType === "Product" && item.itemType === "Product") ||
      (activeItemType === "Raw Material" && item.itemType === "Raw Material") ||
      (activeItemType === "Packaging" && item.itemType === "Packaging");
    const matchesWarehouse =
      activeWarehouse === "All" || item.warehouseId === activeWarehouse;
    const query = searchQuery.trim().toLowerCase();
    if (!query) return matchesCategory && matchesItemType && matchesWarehouse;
    const matchesSearch =
      item.name.toLowerCase().includes(query) ||
      item.sku.toLowerCase().includes(query) ||
      item.location.toLowerCase().includes(query) ||
      item.status.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query) ||
      item.warehouseName.toLowerCase().includes(query) ||
      item.qty.toString().includes(query);
    return matchesCategory && matchesItemType && matchesWarehouse && matchesSearch;
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

  const totalItems = Math.ceil(inStockItems.reduce(
    (sum, item) => sum + item.qty,
    0
  ));
  const lowStockItems = inStockItems.filter(
    (item) => item.status === "Low"
  ).length;
  const availableItems = inStockItems.filter(
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
          <button className="btn btn-sm" onClick={() => loadData()}>
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
            title="Import inventory from CSV (updates existing records)"
          >
            <span className="material-symbols-outlined">upload</span>
            Import CSV
          </button>
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => loadData()}
            title="Refresh data"
          >
            <span className="material-symbols-outlined">refresh</span>
          </button>
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
                  { key: "warehouse", label: "Warehouse" },
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
          {!isWarehouseManager && (
            <div className="flex gap-2 bg-base-100 p-1 rounded-xl border border-base-300">
              <span className="px-2 py-2 text-xs text-base-content/60 font-medium">Warehouse:</span>
              <select
                className="select select-bordered select-sm"
                value={activeWarehouse}
                onChange={(e) => setActiveWarehouse(e.target.value)}
              >
                <option value="All">All Warehouses</option>
                {Array.from(warehouses.entries()).map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          )}
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
                {visibleColumns.has("warehouse") && <th className="font-semibold text-base-content">Warehouse</th>}
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
                        className="font-mono font-semibold text-primary hover:underline text-left"
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
                  {visibleColumns.has("warehouse") && (
                    <td>
                      <span className="badge badge-info text-xs whitespace-nowrap">
                        {item.warehouseName}
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
          onEdit={() => {
            setShowDetailModal(false);
            setShowEditModal(true);
          }}
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
          onSaved={loadData}
          item={selectedItem}
        />
      )}

      {/* Add Inventory Item Modal */}
      <AddInventoryItemModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSaved={loadData}
      />

      {/* Import Inventory Modal */}
      {showImportModal && (
        <ImportInventoryModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onSuccess={async () => {
            setShowImportModal(false);
            await loadData();
          }}
        />
      )}
    </div>
  );
}

