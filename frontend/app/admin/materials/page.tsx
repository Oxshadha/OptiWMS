"use client";

import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { DataTable } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { SummaryCards } from "@/components/SummaryCards";
import { StatusChip } from "@/components/StatusChip";
import { useAdmin } from "@/contexts/AdminContext";
import { ADMIN_ROUTES } from "@/lib/admin-roles";
import { type Material } from "@/lib/api/materials";
import { getMaterialTypeChip } from "@/lib/ui/material-type-chip";
import { materialDefaultLocationsApi } from "@/lib/api/materialDefaultLocations";
import { locationsApi } from "@/lib/api/locations";
import { warehousesApi } from "@/lib/api/warehouses";
import { useMaterials, useCreateMaterial, useUpdateMaterial, useDeleteMaterial } from "@/lib/hooks/useQuery";
import { AssignBinLocationModal, BulkAssignBinLocationsModal } from "./AssignBinLocationModal";
import { MaterialDetailModal } from "./MaterialDetailModal";
import { CreateMaterialModal, EditMaterialModal, ImportMaterialModal } from "./MaterialModals";
import { logger } from "@/lib/utils/logger";

// Material type options (industry standard)
const MATERIAL_TYPES = [
  { value: "all", label: "All Products" },
  { value: "raw_material", label: "Raw Materials" },
  { value: "product", label: "Products" },
  { value: "packaging_material", label: "Packaging" },
] as const;

type MaterialTypeFilter = typeof MATERIAL_TYPES[number]["value"];
type SortBy = "name" | "sku" | "type" | null;
type SortDirection = "asc" | "desc";

const cleanDisplayName = (description?: string) => {
  if (!description) return "—";
  // Legacy imports sometimes append metadata like: "Rice 5kg Bag,raw_material,kg,pallet"
  const first = description.split(",")[0]?.trim();
  return first || description;
};

const normalizeSearchText = (value?: string | null) =>
  (value || "").toLowerCase().replace(/[^a-z0-9]/g, "");

export default function MaterialsPage() {
  const searchParams = useSearchParams();
  const supplierFilterId = searchParams.get("supplier")?.trim() || "";
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
  const [sortBy, setSortBy] = useState<SortBy>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(null);
  const [materialsWithLocations, setMaterialsWithLocations] = useState<Map<string, string>>(new Map()); // materialId -> locationCode

  const canEdit = hasPermission(ADMIN_ROUTES.MATERIALS, "edit");
  const canDelete = hasPermission(ADMIN_ROUTES.MATERIALS, "delete");

  // Use React Query for data fetching (centralized, cached)
  const {
    data: allMaterialsData,
    isLoading,
    error,
    refetch,
  } = useMaterials();
  const allMaterials: Material[] = Array.isArray(allMaterialsData)
    ? allMaterialsData
    : [];
  const createMutation = useCreateMaterial();
  const updateMutation = useUpdateMaterial();
  const deleteMutation = useDeleteMaterial();

  // Load materials with their bin locations
  const loadMaterialLocations = async () => {
    if (!allMaterials || allMaterials.length === 0) return;

    try {
      // Get all warehouses
      const warehouses = await warehousesApi.getAll();
      logger.debug("[MaterialsPage] ✅ Loaded warehouses for locations:", warehouses.length);
      if (warehouses.length === 0) return;

      // For each warehouse, get materials with locations
      const locationMap = new Map<string, string>();
      for (const warehouse of warehouses) {
        try {
          const materialsWithLocs = await materialDefaultLocationsApi.getMaterialsWithLocations(warehouse.id);
          logger.debug(`[MaterialsPage] 📍 Warehouse ${warehouse.name}: ${materialsWithLocs.length} materials with locations`);
          if (materialsWithLocs.length > 0) {
            logger.debug("[MaterialsPage] Sample location data:", materialsWithLocs[0]);
          }
          materialsWithLocs.forEach(m => {
            if (m.locationCode) {
              locationMap.set(m.materialId, m.locationCode);
            }
          });
        } catch (err) {
          logger.error(`Failed to load locations for warehouse ${warehouse.id}:`, err);
        }
      }
      logger.debug("[MaterialsPage] 🗺️ Final location map size:", locationMap.size);
      setMaterialsWithLocations(locationMap);
    } catch (err) {
      logger.error("Failed to load material locations:", err);
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
      const normalizedQuery = normalizeSearchText(searchQuery);
      filtered = filtered.filter(
        (m) => {
          const locationCode = materialsWithLocations.get(m.id) || "";
          return (
            m.materialCode?.toLowerCase().includes(query) ||
            m.description?.toLowerCase().includes(query) ||
            locationCode.toLowerCase().includes(query) ||
            normalizeSearchText(m.materialCode).includes(normalizedQuery) ||
            normalizeSearchText(m.description).includes(normalizedQuery) ||
            normalizeSearchText(locationCode).includes(normalizedQuery)
          );
        }
      );
    }

    if (sortBy) {
      filtered = [...filtered].sort((a, b) => {
        let aVal: string = "";
        let bVal: string = "";
        if (sortBy === "name") {
          aVal = (a.description || "").toLowerCase();
          bVal = (b.description || "").toLowerCase();
        } else if (sortBy === "sku") {
          aVal = (a.materialCode || "").toLowerCase();
          bVal = (b.materialCode || "").toLowerCase();
        } else if (sortBy === "type") {
          aVal = getMaterialTypeChip(a.materialType).label.toLowerCase();
          bVal = getMaterialTypeChip(b.materialType).label.toLowerCase();
        }

        if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
        if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [allMaterials, typeFilter, searchQuery, sortBy, sortDirection, materialsWithLocations]);

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
    logger.debug("[MaterialsPage] State:", {
      isLoading,
      hasData: !!allMaterials,
      dataLength: allMaterials?.length || 0,
      error: error ? String(error) : null,
      filteredLength: filteredMaterials.length,
    });
    if (allMaterials) {
      logger.debug(`[MaterialsPage] ✅ Loaded ${allMaterials.length} materials from API`);
      if (allMaterials.length > 0) {
        logger.debug("[MaterialsPage] First material sample:", allMaterials[0]);
      }
    }
    if (error) {
      logger.error("[MaterialsPage] ❌ Error loading materials:", error);
      logger.error("[Materials] Error loading materials:", error);
    }
    if (isLoading) {
      logger.debug("[MaterialsPage] ⏳ Loading materials...");
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
            label: "Total Products",
            value: summaryStats.total.toString(),
            icon: "inventory_2",
          },
          {
            label: "Raw Materials",
            value: summaryStats.rawMaterials.toString(),
            icon: "science",
          },
          {
            label: "Products",
            value: summaryStats.products.toString(),
            icon: "category",
          },
          {
            label: "Packaging",
            value: summaryStats.packaging.toString(),
            icon: "inventory",
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

          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Sort</span>
            </label>
            <div className="flex gap-2">
              <select
                className="select select-bordered"
                value={sortBy || ""}
                onChange={(e) => setSortBy((e.target.value || null) as SortBy)}
              >
                <option value="">No Sort</option>
                <option value="name">Name</option>
                <option value="sku">SKU</option>
                <option value="type">Type</option>
              </select>
              <button
                className="btn btn-outline"
                type="button"
                onClick={() => setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))}
                title={`Sort ${sortDirection === "asc" ? "Ascending" : "Descending"}`}
              >
                {sortDirection === "asc" ? "A-Z" : "Z-A"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {supplierFilterId && (
        <div className="alert alert-info">
          <span className="material-symbols-outlined">info</span>
          <span>
            Supplier filter was requested, but product-supplier mapping is not linked in the database yet.
            Showing all products.
          </span>
        </div>
      )}

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
                label: "SKU Code",
                render: (material: Material) => (
                  <span className="font-mono font-semibold text-primary">{material.materialCode}</span>
                ),
              },
              {
                key: "description",
                label: "Product Name",
                render: (material: Material) => (
                  <span className="text-base-content">{cleanDisplayName(material.description)}</span>
                ),
              },
              {
                key: "materialType",
                label: "Type",
                render: (material: Material) => {
                  const typeChip = getMaterialTypeChip(material.materialType);
                  return <StatusChip label={typeChip.label} tone={typeChip.tone} className={typeChip.className} />;
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
