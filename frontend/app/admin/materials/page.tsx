"use client";

import React, { useState, useEffect } from "react";
import { DataTable } from "@/components/DataTable";
import { DetailModal } from "@/components/DetailModal";
import { Modal } from "@/components/Modal";
import { SummaryCards } from "@/components/SummaryCards";
import { useAdmin } from "@/contexts/AdminContext";
import { ADMIN_ROUTES } from "@/lib/admin-roles";
import { materialsApi, type Material } from "@/lib/api/materials";
import { materialDefaultLocationsApi } from "@/lib/api/materialDefaultLocations";
import { locationsApi } from "@/lib/api/locations";
import { warehousesApi } from "@/lib/api/warehouses";
import { useMaterials, useCreateMaterial, useUpdateMaterial, useDeleteMaterial } from "@/lib/hooks/useQuery";
import { showToast } from "@/lib/utils/toast";
import { logger } from "@/lib/utils/logger";
import { AssignBinLocationModal, BulkAssignBinLocationsModal } from "./AssignBinLocationModal";
import { MaterialDetailModal } from "./MaterialDetailModal";

// Material type options (industry standard)
const MATERIAL_TYPES = [
  { value: "all", label: "All Products" },
  { value: "raw_material", label: "Raw Materials" },
  { value: "product", label: "Products" },
  { value: "packaging_material", label: "Packaging" },
] as const;

type MaterialTypeFilter = typeof MATERIAL_TYPES[number]["value"];

export default function MaterialsPage() {
  const { hasPermission } = useAdmin();
  // Support URL query parameter for type filter (for redirects from legacy pages)
  const [typeFilter, setTypeFilter] = useState<MaterialTypeFilter>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const type = params.get("type");
      if (type && MATERIAL_TYPES.some((t) => t.value === type)) {
        return type as MaterialTypeFilter;
      }
    }
    return "all";
  });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAssignLocationModal, setShowAssignLocationModal] = useState(false);
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null);
  const [materialsWithLocations, setMaterialsWithLocations] = useState<Map<string, string>>(new Map()); // materialId -> locationCode

  const canEdit = hasPermission(ADMIN_ROUTES.MATERIALS, "edit");
  const canDelete = hasPermission(ADMIN_ROUTES.MATERIALS, "delete");

  // Use React Query for data fetching (centralized, cached)
  const { data: allMaterials, isLoading, error, refetch } = useMaterials();
  const createMutation = useCreateMaterial();
  const updateMutation = useUpdateMaterial();
  const deleteMutation = useDeleteMaterial();

  // Load materials with their bin locations
  const loadMaterialLocations = async () => {
    if (!allMaterials || allMaterials.length === 0) return;

    try {
      // Get all warehouses
      const warehouses = await warehousesApi.getAll();
      console.log("[MaterialsPage] ✅ Loaded warehouses for locations:", warehouses.length);
      if (warehouses.length === 0) return;

      // For each warehouse, get materials with locations
      const locationMap = new Map<string, string>();
      for (const warehouse of warehouses) {
        try {
          const materialsWithLocs = await materialDefaultLocationsApi.getMaterialsWithLocations(warehouse.id);
          console.log(`[MaterialsPage] 📍 Warehouse ${warehouse.name}: ${materialsWithLocs.length} materials with locations`);
          if (materialsWithLocs.length > 0) {
            console.log("[MaterialsPage] Sample location data:", materialsWithLocs[0]);
          }
          materialsWithLocs.forEach(m => {
            if (m.locationCode) {
              locationMap.set(m.materialId, m.locationCode);
            }
          });
        } catch (err) {
          console.error(`Failed to load locations for warehouse ${warehouse.id}:`, err);
        }
      }
      console.log("[MaterialsPage] 🗺️ Final location map size:", locationMap.size);
      setMaterialsWithLocations(locationMap);
    } catch (err) {
      console.error("Failed to load material locations:", err);
    }
  };

  useEffect(() => {
    loadMaterialLocations();
  }, [allMaterials]);

  // Filter materials by type and search query
  const filteredMaterials = React.useMemo(() => {
    if (!allMaterials) return [];

    let filtered = allMaterials;

    // Filter by type
    if (typeFilter !== "all") {
      filtered = filtered.filter((m) => {
        // If materialType is null/undefined, default to raw_material for backward compatibility
        const actualType = m.materialType || "raw_material";
        return actualType === typeFilter;
      });
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (m) =>
          m.materialCode?.toLowerCase().includes(query) ||
          m.description?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [allMaterials, typeFilter, searchQuery]);

  // Summary statistics
  const summaryStats = React.useMemo(() => {
    if (!allMaterials) {
      return {
        total: 0,
        rawMaterials: 0,
        products: 0,
        packaging: 0,
      };
    }

    return {
      total: allMaterials.length,
      rawMaterials: allMaterials.filter(
        (m) => {
          const type = m.materialType || "raw_material"; // Default to raw_material if null
          return type === "raw_material";
        }
      ).length,
      products: allMaterials.filter((m) => m.materialType === "product").length,
      packaging: allMaterials.filter((m) => m.materialType === "packaging_material").length,
    };
  }, [allMaterials]);

  const handleCreate = async (materialData: Omit<Material, "id">) => {
    try {
      await createMutation.mutateAsync(materialData);
      setShowCreateModal(false);
      refetch();
    } catch (error) {
      logger.error("[Materials] Failed to create material:", error);
      // Error toast handled by mutation
    }
  };

  const handleUpdate = async (id: string, materialData: Partial<Material>) => {
    try {
      await updateMutation.mutateAsync({ id, data: materialData });
      setShowEditModal(false);
      setEditingMaterial(null);
      refetch();
    } catch (error) {
      logger.error("[Materials] Failed to update material:", error);
      // Error toast handled by mutation
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      setShowDeleteModal(false);
      setSelectedMaterial(null);
      refetch();
    } catch (error) {
      logger.error("[Materials] Failed to delete material:", error);
      // Error toast handled by mutation
    }
  };

  // Debug logging
  React.useEffect(() => {
    console.log("[MaterialsPage] State:", {
      isLoading,
      hasData: !!allMaterials,
      dataLength: allMaterials?.length || 0,
      error: error ? String(error) : null,
      filteredLength: filteredMaterials.length,
    });
    if (allMaterials) {
      console.log(`[MaterialsPage] ✅ Loaded ${allMaterials.length} materials from API`);
      if (allMaterials.length > 0) {
        console.log("[MaterialsPage] First material sample:", allMaterials[0]);
      }
    }
    if (error) {
      console.error("[MaterialsPage] ❌ Error loading materials:", error);
      logger.error("[Materials] Error loading materials:", error);
    }
    if (isLoading) {
      console.log("[MaterialsPage] ⏳ Loading materials...");
    }
  }, [allMaterials, error, isLoading, filteredMaterials.length]);

  if (error) {
    return (
      <div className="p-6">
        <div className="alert alert-error">
          <span>Failed to load products: {error instanceof Error ? error.message : "Unknown error"}</span>
          <button className="btn btn-sm btn-outline" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-base-content">Product Catalog</h1>
          <p className="text-sm text-base-content/60 mt-1">
            Manage all products, raw materials, and packaging materials
          </p>
        </div>
        <div className="flex gap-3">
          <button
            className="btn btn-outline"
            onClick={() => setShowImportModal(true)}
          >
            <span className="material-symbols-outlined">upload</span>
            Import CSV
          </button>
          {canEdit && (
            <>
              <button
                className="btn btn-outline btn-primary"
                onClick={() => setShowBulkAssignModal(true)}
                title="Assign bin locations to all materials in warehouse"
              >
                <span className="material-symbols-outlined">location_on</span>
                Assign Bin Locations (Bulk)
              </button>
              <button
                className="btn btn-primary"
                onClick={() => setShowCreateModal(true)}
              >
                <span className="material-symbols-outlined">add</span>
                Add Product
              </button>
            </>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <SummaryCards
        cards={[
          {
            title: "Total Products",
            value: summaryStats.total.toString(),
            icon: "inventory_2",
            trend: null,
          },
          {
            title: "Raw Materials",
            value: summaryStats.rawMaterials.toString(),
            icon: "science",
            trend: null,
          },
          {
            title: "Products",
            value: summaryStats.products.toString(),
            icon: "category",
            trend: null,
          },
          {
            title: "Packaging",
            value: summaryStats.packaging.toString(),
            icon: "inventory",
            trend: null,
          },
        ]}
      />

      {/* Filters */}
      <div className="card bg-base-100 border border-base-300 p-4">
        <div className="flex gap-4 items-center">
          {/* Type Filter */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Material Type</span>
            </label>
            <select
              className="select select-bordered"
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as MaterialTypeFilter)}
            >
              {MATERIAL_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Search */}
          <div className="form-control flex-1">
            <label className="label">
              <span className="label-text font-medium">Search</span>
            </label>
            <input
              type="text"
              placeholder="Search by code or description..."
              className="input input-bordered w-full"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Materials Table */}
      <div className="card bg-base-100 border border-base-300 p-6">
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : (
          <DataTable
            data={filteredMaterials}
            keyExtractor={(material) => material.id}
            columns={[
              {
                key: "materialCode",
                label: "Product Code",
                render: (material: Material) => (
                  <span className="font-mono font-semibold text-primary">{material.materialCode}</span>
                ),
              },
              {
                key: "description",
                label: "Description",
                render: (material: Material) => (
                  <span className="text-base-content">{material.description || "—"}</span>
                ),
              },
              {
                key: "materialType",
                label: "Type",
                render: (material: Material) => {
                  // Normalize material type (handle variations like "packing_material" without 'g')
                  let type = (material.materialType || "raw_material").toLowerCase().trim();

                  // Handle common variations
                  if (type === "packing_material" || type === "packaging") {
                    type = "packaging_material";
                  } else if (type === "raw" || type === "rawmaterial") {
                    type = "raw_material";
                  } else if (type === "finished_good" || type === "finished_goods" || type === "finished_product" || type === "products") {
                    type = "product";
                  }

                  const typeLabels: Record<string, string> = {
                    raw_material: "Raw Material",
                    product: "Product",
                    packaging_material: "Packaging",
                  };
                  const typeColors: Record<string, string> = {
                    raw_material: "badge-info",        // Blue - Raw Materials
                    product: "badge-success",          // Green - Finished Goods/Products
                    packaging_material: "badge-neutral", // Gray - Packaging Materials (not yellow to avoid conflict with low stock)
                  };

                  const label = typeLabels[type] || type;
                  const color = typeColors[type] || "badge-outline";

                  return (
                    <span className={`badge ${color}`}>
                      {label}
                    </span>
                  );
                },
              },
              {
                key: "unitType",
                label: "Unit",
                render: (material: Material) => (
                  <span className="text-base-content/60">{material.unitType || "—"}</span>
                ),
              },
              {
                key: "storageType",
                label: "Storage",
                render: (material: Material) => (
                  <span className="text-base-content/60 capitalize">
                    {material.storageType || "—"}
                  </span>
                ),
              },
              {
                key: "binLocation",
                label: "Bin Location",
                render: (material: Material) => {
                  const locationCode = materialsWithLocations.get(material.id);
                  return locationCode ? (
                    <span className="font-mono text-xs text-primary font-semibold">
                      {locationCode}
                    </span>
                  ) : (
                    <span className="text-base-content/40 text-xs">—</span>
                  );
                },
              },
            ]}
            onRowClick={(material) => {
              setSelectedMaterial(material);
              setShowDetailModal(true);
            }}
            actions={(material) => (
              <div className="flex gap-2">
                {canEdit && (
                  <>
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedMaterial(material);
                        setSelectedWarehouseId(null);
                        setShowAssignLocationModal(true);
                      }}
                      title="Assign bin location"
                    >
                      <span className="material-symbols-outlined">location_on</span>
                    </button>
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingMaterial(material);
                        setShowEditModal(true);
                      }}
                    >
                      <span className="material-symbols-outlined">edit</span>
                    </button>
                  </>
                )}
                {canDelete && (
                  <button
                    className="btn btn-sm btn-ghost text-error"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedMaterial(material);
                      setShowDeleteModal(true);
                    }}
                  >
                    <span className="material-symbols-outlined">delete</span>
                  </button>
                )}
              </div>
            )}
            emptyMessage="No products found. Create your first product to get started."
          />
        )}
      </div>

      {/* Create Material Modal */}
      {showCreateModal && (
        <CreateMaterialModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreate}
          isLoading={createMutation.isPending}
        />
      )}

      {/* Edit Material Modal */}
      {editingMaterial && (
        <EditMaterialModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditingMaterial(null);
          }}
          material={editingMaterial}
          onSubmit={handleUpdate}
          isLoading={updateMutation.isPending}
        />
      )}

      {/* Detail Modal */}
      {selectedMaterial && (
        <MaterialDetailModal
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedMaterial(null);
          }}
          material={selectedMaterial}
          canEdit={canEdit}
          canDelete={canDelete}
          onEdit={() => {
            setShowDetailModal(false);
            setEditingMaterial(selectedMaterial);
            setShowEditModal(true);
          }}
          onDelete={() => {
            setShowDetailModal(false);
            setShowDeleteModal(true);
          }}
          onAssignLocation={() => {
            setShowDetailModal(false);
            setSelectedWarehouseId(null);
            setShowAssignLocationModal(true);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {selectedMaterial && (
        <Modal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedMaterial(null);
          }}
          title="Delete Product"
        >
          <div className="space-y-4">
            <p className="text-base-content">
              Are you sure you want to delete material{" "}
              <strong>{selectedMaterial.materialCode}</strong>?
            </p>
            <p className="text-sm text-base-content/60">
              This action cannot be undone. All associated inventory records will also be affected.
            </p>
            <div className="flex justify-end gap-3">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedMaterial(null);
                }}
                disabled={deleteMutation.isPending}
              >
                Cancel
              </button>
              <button
                className="btn btn-error"
                onClick={() => handleDelete(selectedMaterial.id)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <ImportMaterialModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            setShowImportModal(false);
            refetch();
          }}
        />
      )}

      {/* Assign Bin Location Modal */}
      {selectedMaterial && (
        <AssignBinLocationModal
          isOpen={showAssignLocationModal}
          onClose={() => {
            setShowAssignLocationModal(false);
            setSelectedMaterial(null);
          }}
          material={selectedMaterial}
          warehouseId={selectedWarehouseId}
          onSuccess={() => {
            loadMaterialLocations(); // Refresh locations after assignment
          }}
        />
      )}

      {/* Bulk Assign Bin Locations Modal */}
      {showBulkAssignModal && (
        <BulkAssignBinLocationsModal
          isOpen={showBulkAssignModal}
          onClose={() => setShowBulkAssignModal(false)}
          onSuccess={() => {
            loadMaterialLocations(); // Refresh locations after bulk assignment
          }}
        />
      )}
    </div>
  );
}

// Create Material Modal Component
function CreateMaterialModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (material: Omit<Material, "id">) => Promise<void>;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    materialCode: "",
    description: "",
    materialType: "raw_material" as string,
    unitType: "",
    storageType: "pallet",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.materialCode.trim() || !formData.description.trim()) {
      showToast.error("Product code and description are required");
      return;
    }

    await onSubmit({
      materialCode: formData.materialCode.trim(),
      description: formData.description.trim(),
      materialType: formData.materialType || undefined,
      unitType: formData.unitType || undefined,
      storageType: formData.storageType || undefined,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Product to Catalog">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Product Code *</span>
          </label>
          <input
            type="text"
            className="input input-bordered"
            value={formData.materialCode}
            onChange={(e) => setFormData({ ...formData, materialCode: e.target.value })}
            required
            disabled={isLoading}
          />
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Description *</span>
          </label>
          <textarea
            className="textarea textarea-bordered"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            required
            disabled={isLoading}
            rows={3}
          />
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Material Type</span>
          </label>
          <select
            className="select select-bordered"
            value={formData.materialType}
            onChange={(e) => setFormData({ ...formData, materialType: e.target.value })}
            disabled={isLoading}
          >
            <option value="raw_material">Raw Material</option>
            <option value="product">Product</option>
            <option value="packaging_material">Packaging</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Unit Type</span>
            </label>
            <input
              type="text"
              className="input input-bordered"
              placeholder="e.g., kg, pcs, pallet"
              value={formData.unitType}
              onChange={(e) => setFormData({ ...formData, unitType: e.target.value })}
              disabled={isLoading}
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Storage Type</span>
            </label>
            <select
              className="select select-bordered"
              value={formData.storageType}
              onChange={(e) => setFormData({ ...formData, storageType: e.target.value })}
              disabled={isLoading}
            >
              <option value="pallet">Pallet</option>
              <option value="bulk">Bulk</option>
              <option value="loose">Loose</option>
              <option value="cold">Cold Storage</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={isLoading}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isLoading}>
            {isLoading ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              "Create Material"
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Edit Material Modal Component
function EditMaterialModal({
  isOpen,
  onClose,
  material,
  onSubmit,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  material: Material;
  onSubmit: (id: string, material: Partial<Material>) => Promise<void>;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState({
    materialCode: material.materialCode,
    description: material.description || "",
    materialType: material.materialType || "raw_material",
    unitType: material.unitType || "",
    storageType: material.storageType || "pallet",
  });

  useEffect(() => {
    setFormData({
      materialCode: material.materialCode,
      description: material.description || "",
      materialType: material.materialType || "raw_material",
      unitType: material.unitType || "",
      storageType: material.storageType || "pallet",
    });
  }, [material]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(material.id, {
      materialCode: formData.materialCode.trim(),
      description: formData.description.trim(),
      materialType: formData.materialType || undefined,
      unitType: formData.unitType || undefined,
      storageType: formData.storageType || undefined,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Product">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Product Code *</span>
          </label>
          <input
            type="text"
            className="input input-bordered"
            value={formData.materialCode}
            onChange={(e) => setFormData({ ...formData, materialCode: e.target.value })}
            required
            disabled={isLoading}
          />
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Description *</span>
          </label>
          <textarea
            className="textarea textarea-bordered"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            required
            disabled={isLoading}
            rows={3}
          />
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Material Type</span>
          </label>
          <select
            className="select select-bordered"
            value={formData.materialType}
            onChange={(e) => setFormData({ ...formData, materialType: e.target.value })}
            disabled={isLoading}
          >
            <option value="raw_material">Raw Material</option>
            <option value="product">Product</option>
            <option value="packaging_material">Packaging</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Unit Type</span>
            </label>
            <input
              type="text"
              className="input input-bordered"
              value={formData.unitType}
              onChange={(e) => setFormData({ ...formData, unitType: e.target.value })}
              disabled={isLoading}
            />
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Storage Type</span>
            </label>
            <select
              className="select select-bordered"
              value={formData.storageType}
              onChange={(e) => setFormData({ ...formData, storageType: e.target.value })}
              disabled={isLoading}
            >
              <option value="pallet">Pallet</option>
              <option value="bulk">Bulk</option>
              <option value="loose">Loose</option>
              <option value="cold">Cold Storage</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={isLoading}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isLoading}>
            {isLoading ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              "Update Material"
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Import Material Modal Component
function ImportMaterialModal({
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
      const result = await materialsApi.importCsv(file);
      if (result.successCount > 0) {
        showToast.success(`Successfully imported ${result.successCount} materials`);
        onSuccess();
      }
      if (result.errorCount > 0) {
        showToast.error(`${result.errorCount} materials failed to import`);
      }
    } catch (error: any) {
      logger.error("[Materials] Import failed:", error);
      showToast.error(error.message || "Failed to import materials");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import Products from CSV">
      <div className="space-y-4">
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
              CSV should contain: material_code, description, material_type, unit_type, storage_type
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
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              "Import"
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
