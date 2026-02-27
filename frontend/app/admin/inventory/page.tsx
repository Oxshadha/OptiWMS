"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { useAdmin } from "@/contexts/AdminContext";
import { Pagination } from "@/components/Pagination";
import { InventoryDisplayItem } from "./types";
import { useInventoryData } from "./hooks/useInventoryData";
import { ImportInventoryModal } from "./components/ImportInventoryModal";
import { AddInventoryItemModal } from "./components/AddInventoryItemModal";
import { EditInventoryItemModal } from "./components/EditInventoryItemModal";
import { InventoryItemDetailModal } from "./components/InventoryItemDetailModal";
import { InventoryColumnSelector } from "./components/InventoryColumnSelector";
import { InventoryTable } from "./components/InventoryTable";

const itemTypes = ["All", "Raw Material", "Packaging", "Product"];
const stockFilters: Array<"All" | "Low" | "Available"> = ["All", "Low", "Available"];

export default function InventoryPage() {
  const { admin, role } = useAdmin();
  const isWarehouseManager = role === "warehouse_manager";
  const assignedWarehouseId = admin?.warehouseId;

  const [activeItemType, setActiveItemType] = useState("All");
  const [activeStock, setActiveStock] = useState<"All" | "Low" | "Available">("All");
  const [activeWarehouse, setActiveWarehouse] = useState<string>(
    isWarehouseManager && assignedWarehouseId ? assignedWarehouseId : "All"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "sku" | "qty" | "location" | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [selectedItem, setSelectedItem] = useState<InventoryDisplayItem | null>(null);
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set([
      "sku",
      "name",
      "type",
      "warehouse",
      "quantity",
      "location",
      "status",
      "reorderPoint",
      "bufferStock",
      "moq",
      "leadTimeDays",
    ])
  );

  const {
    warehouses,
    filteredInventory,
    totalItems,
    lowStockItems,
    availableItems,
    isLoading,
    error,
    totalPages,
    totalElements,
    reload,
  } = useInventoryData({
    isWarehouseManager,
    assignedWarehouseId,
    activeItemType,
    activeStock,
    activeWarehouse,
    searchQuery,
    sortBy,
    sortDirection,
    currentPage,
    itemsPerPage,
  });

  useEffect(() => {
    if (isWarehouseManager && assignedWarehouseId) {
      setActiveWarehouse(assignedWarehouseId);
    }
  }, [isWarehouseManager, assignedWarehouseId]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="alert alert-error">
          <span className="material-symbols-outlined">error</span>
          <span>{error}</span>
          <button className="btn btn-sm" onClick={() => void reload()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
          <button className="btn btn-sm btn-ghost" onClick={() => void reload()} title="Refresh data">
            <span className="material-symbols-outlined">refresh</span>
          </button>

          <InventoryColumnSelector
            showColumnMenu={showColumnMenu}
            visibleColumns={visibleColumns}
            onToggleMenu={() => setShowColumnMenu((prev) => !prev)}
            onToggleColumn={(columnKey, checked) => {
              setVisibleColumns((prev) => {
                const next = new Set(prev);
                if (checked) {
                  next.add(columnKey);
                } else {
                  next.delete(columnKey);
                }
                return next;
              });
            }}
          />

          <div className="dropdown dropdown-end">
            <label tabIndex={0} className="btn btn-sm btn-ghost">
              <span className="material-symbols-outlined">sort</span>
              <span>Sort by</span>
            </label>
            <ul
              tabIndex={0}
              className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300 z-[80]"
            >
              <li>
                <button
                  onClick={() => {
                    setSortBy("name");
                    setSortDirection(sortBy === "name" && sortDirection === "asc" ? "desc" : "asc");
                  }}
                >
                  Name {sortBy === "name" && (sortDirection === "asc" ? "↑" : "↓")}
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    setSortBy("sku");
                    setSortDirection(sortBy === "sku" && sortDirection === "asc" ? "desc" : "asc");
                  }}
                >
                  SKU {sortBy === "sku" && (sortDirection === "asc" ? "↑" : "↓")}
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    setSortBy("qty");
                    setSortDirection(sortBy === "qty" && sortDirection === "asc" ? "desc" : "asc");
                  }}
                >
                  Quantity {sortBy === "qty" && (sortDirection === "asc" ? "↑" : "↓")}
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    setSortBy("location");
                    setSortDirection(sortBy === "location" && sortDirection === "asc" ? "desc" : "asc");
                  }}
                >
                  Location {sortBy === "location" && (sortDirection === "asc" ? "↑" : "↓")}
                </button>
              </li>
              <li>
                <button onClick={() => setSortBy(null)}>Clear Sort</button>
              </li>
            </ul>
          </div>

          <button className="btn btn-sm btn-primary" onClick={() => setShowAddModal(true)}>
            <span className="material-symbols-outlined">add</span>
            <span>Add Item</span>
          </button>
        </div>
      </div>

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
              <div className="text-sm text-base-content/60">Warehouses</div>
              <div className="text-2xl font-bold text-base-content">
                {isWarehouseManager ? 1 : warehouses.size}
              </div>
            </div>
            <span className="material-symbols-outlined text-3xl text-info">warehouse</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex gap-4 items-center">
          <div className="flex-1">
            <label className="input input-bordered flex items-center gap-2 w-full">
              <span className="material-symbols-outlined text-base-content/60">search</span>
              <input
                type="text"
                className="grow"
                placeholder="Search by SKU or name..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
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
                onClick={() => {
                  setActiveItemType(type);
                  setCurrentPage(1);
                }}
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
            <span className="px-2 py-2 text-xs text-base-content/60 font-medium">Stock:</span>
            {stockFilters.map((stock) => (
              <button
                key={stock}
                onClick={() => {
                  setActiveStock(stock);
                  setCurrentPage(1);
                }}
                className={clsx(
                  "px-4 py-2 rounded-lg text-sm transition-all",
                  activeStock === stock
                    ? "bg-neutral text-neutral-content font-medium"
                    : "text-base-content/60 hover:text-base-content"
                )}
              >
                {stock}
              </button>
            ))}
          </div>

          {!isWarehouseManager && (
            <div className="flex gap-2 bg-base-100 p-1 rounded-xl border border-base-300">
              <span className="px-2 py-2 text-xs text-base-content/60 font-medium">Warehouse:</span>
              <select
                className="select select-bordered select-sm"
                value={activeWarehouse}
                onChange={(e) => {
                  setActiveWarehouse(e.target.value);
                  setCurrentPage(1);
                }}
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

      <div className="card bg-base-100 border border-base-300 rounded-xl overflow-hidden">
        <InventoryTable
          items={filteredInventory}
          visibleColumns={visibleColumns}
          onViewItem={(item) => {
            setSelectedItem(item);
            setShowDetailModal(true);
          }}
          onEditItem={(item) => {
            setSelectedItem(item);
            setShowEditModal(true);
          }}
        />
      </div>
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        itemsPerPage={itemsPerPage}
        totalItems={totalElements}
        showItemsPerPage
        onItemsPerPageChange={(next) => {
          setItemsPerPage(next);
          setCurrentPage(1);
        }}
      />

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

      {selectedItem && (
        <EditInventoryItemModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedItem(null);
          }}
          onSaved={reload}
          item={selectedItem}
        />
      )}

      <AddInventoryItemModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} onSaved={reload} />

      {showImportModal && (
        <ImportInventoryModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onSuccess={async () => {
            setShowImportModal(false);
            await reload();
          }}
        />
      )}
    </div>
  );
}
