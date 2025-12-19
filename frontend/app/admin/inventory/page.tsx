"use client";

import { useState, useEffect } from "react";
import clsx from "clsx";
import { DetailModal } from "@/components/DetailModal";
import { inventoryApi, InventoryItem as ApiInventoryItem } from "@/lib/api/inventory";
import { materialsApi, Material } from "@/lib/api/materials";
import { warehousesApi, Warehouse } from "@/lib/api/warehouses";

// Frontend inventory item structure
interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  qty: number;
  location: string;
  status: string;
  category: string;
  materialId: string;
  warehouseId: string;
  availableQuantity: number;
  reservedQuantity: number;
  reorderPoint?: number;
}

const statusClass = (s: string) => {
  if (s === "Available") return "badge-success";
  if (s === "Low") return "badge-warning";
  if (s === "Out of Stock") return "badge-error";
  return "badge-outline";
};

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "sku" | "qty" | "location" | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  // Load inventory from API
  useEffect(() => {
    loadInventory();
  }, []);

  const loadInventory = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch inventory and materials
      const [inventoryItems, materials] = await Promise.all([
        inventoryApi.getAll(),
        materialsApi.getAll(),
      ]);

      // Create a map of materialId -> Material for quick lookup
      const materialMap = new Map(materials.map(m => [m.id, m]));

      // Map inventory items to frontend structure
      const inventoryData: InventoryItem[] = inventoryItems.map((item) => {
        const material = materialMap.get(item.materialId);
        const qty = parseFloat(item.quantity || "0");
        const reorderPoint = parseFloat(item.reorderPoint || "0");
        
        // Determine status based on quantity
        let status = "Available";
        if (qty === 0) {
          status = "Out of Stock";
        } else if (qty <= reorderPoint) {
          status = "Low";
        }

        return {
          id: item.id,
          sku: material?.materialCode || "N/A",
          name: material?.description || "Unknown Material",
          qty: qty,
          location: item.locationCode || "N/A",
          status: status,
          category: material?.storageType || "General",
          materialId: item.materialId,
          warehouseId: item.warehouseId,
          availableQuantity: parseFloat(item.availableQuantity || "0"),
          reservedQuantity: parseFloat(item.reservedQuantity || "0"),
          reorderPoint: reorderPoint > 0 ? reorderPoint : undefined,
        };
      });

      setInventory(inventoryData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load inventory");
      console.error("Error loading inventory:", err);
    } finally {
      setLoading(false);
    }
  };

  // Get unique categories from inventory
  const categories = ["All", ...Array.from(new Set(inventory.map(item => item.category))).sort()];

  let filteredInventory = inventory.filter(item => {
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

  const totalItems = inventory.reduce((sum, item) => sum + item.qty, 0);
  const lowStockItems = inventory.filter(item => item.status === "Low" || item.status === "Out of Stock").length;
  const availableItems = inventory.filter(item => item.status === "Available").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <span>Error: {error}</span>
        <button className="btn btn-sm" onClick={loadInventory}>Retry</button>
      </div>
    );
  }

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
          item={selectedItem}
          onUpdate={loadInventory}
        />
      )}

      {/* Add Inventory Item Modal */}
      <AddInventoryItemModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          loadInventory(); // Refresh after add
        }}
      />
    </div>
  );
}

// Add Inventory Item Modal
function AddInventoryItemModal({ 
  isOpen, 
  onClose 
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
    status: "Available",
  });
  const [submitting, setSubmitting] = useState(false);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

  useEffect(() => {
    // Load materials and warehouses for dropdowns
    Promise.all([
      materialsApi.getAll(),
      warehousesApi.getAll(),
    ]).then(([mats, whs]) => {
      setMaterials(mats);
      setWarehouses(whs);
    }).catch(err => {
      console.error("Error loading materials/warehouses:", err);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // Find material by SKU
      const material = materials.find(m => m.materialCode === formData.sku);
      if (!material) {
        alert(`Material with SKU ${formData.sku} not found. Please create the material first.`);
        setSubmitting(false);
        return;
      }

      // Use first warehouse if available
      const warehouseId = warehouses.length > 0 ? warehouses[0].id : "";
      if (!warehouseId) {
        alert("No warehouses available. Please create a warehouse first.");
        setSubmitting(false);
        return;
      }

      // Create inventory item
      const quantity = parseFloat(formData.qty) || 0;
      await inventoryApi.create({
        materialId: material.id,
        warehouseId: warehouseId,
        locationCode: formData.location || undefined,
        quantity: quantity,
        availableQuantity: quantity,
        reservedQuantity: 0,
        status: formData.status.toLowerCase().replace(/\s+/g, '_'),
      });
      
      // Reset form
      setFormData({
        sku: "",
        name: "",
        category: "",
        qty: "",
        location: "",
        status: "Available",
      });
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add inventory item");
    } finally {
      setSubmitting(false);
    }
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
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? (
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

// Inventory Item Detail Modal
function InventoryItemDetailModal({
  isOpen,
  onClose,
  item,
  onEdit,
}: {
  isOpen: boolean;
  onClose: () => void;
  item: InventoryItem;
  onEdit?: () => void;
}) {
  return (
    <DetailModal isOpen={isOpen} onClose={onClose} title={`Inventory: ${item.sku}`} size="md">
      <div className="space-y-4">
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
                style={{ backgroundColor: "#EEEEEE", color: "#1F2937", border: "1px solid #E5E7EB" }}
              >
                {item.category}
              </span>
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Quantity</label>
            <p className="font-semibold">{item.qty}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Location</label>
            <p className="font-semibold">{item.location}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Status</label>
            <p>
              <span className={`badge ${statusClass(item.status)}`}>{item.status}</span>
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          <button className="btn btn-primary" onClick={onEdit}>
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
  onUpdate,
}: {
  isOpen: boolean;
  onClose: () => void;
  item: InventoryItem;
  onUpdate: () => void;
}) {
  const [formData, setFormData] = useState({
    qty: item.qty.toString(),
    location: item.location,
    status: item.status,
  });

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const newQuantity = parseFloat(formData.qty);
      const newAvailableQuantity = newQuantity - item.reservedQuantity;
      
      // Update inventory item using PUT endpoint
      await inventoryApi.update(item.id, {
        locationCode: formData.location,
        quantity: newQuantity,
        availableQuantity: newAvailableQuantity >= 0 ? newAvailableQuantity : 0,
        reservedQuantity: item.reservedQuantity,
        status: formData.status.toLowerCase().replace(/\s+/g, '_'),
      });
      
      onClose();
      onUpdate();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update inventory item");
    } finally {
      setSubmitting(false);
    }
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
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? (
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
