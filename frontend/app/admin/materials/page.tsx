"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { DataTable } from "@/components/DataTable";
import { Pagination } from "@/components/Pagination";
import { Modal } from "@/components/Modal";
import { SummaryCards } from "@/components/SummaryCards";
import { StatusChip } from "@/components/StatusChip";
import { useAdmin } from "@/contexts/AdminContext";
import { ADMIN_ROUTES } from "@/lib/admin-roles";
import { materialsApi, type Material } from "@/lib/api/materials";
import { getMaterialTypeChip } from "@/lib/ui/material-type-chip";
import { materialDefaultLocationsApi } from "@/lib/api/materialDefaultLocations";
import {
  useCreateMaterial,
  useUpdateMaterial,
  useDeleteMaterial,
  useInvalidateAdminList,
  usePagedAdminQuery,
  useReferenceWarehouses,
} from "@/lib/hooks/useQuery";
import {
  AssignBinLocationModal,
  BulkAssignBinLocationsModal,
} from "./AssignBinLocationModal";
import { MaterialDetailModal } from "./MaterialDetailModal";
import {
  CreateMaterialModal,
  EditMaterialModal,
  ImportMaterialModal,
} from "./MaterialModals";
import { logger } from "@/lib/utils/logger";

const MATERIAL_TYPES = [
  { value: "all", label: "All Products" },
  { value: "raw_material", label: "Raw Materials" },
  { value: "product", label: "Products" },
  { value: "packaging_material", label: "Packaging" },
] as const;

type MaterialTypeFilter = (typeof MATERIAL_TYPES)[number]["value"];
type SortBy = "name" | "sku" | "type" | null;
type SortDirection = "asc" | "desc";
type MaterialLocationSummary = {
  primary: string;
  all: string[];
};

const cleanDisplayName = (description?: string) => {
  if (!description) return "—";
  const first = description.split(",")[0]?.trim();
  return first || description;
};

function hasCompleteDimensions(material: Material): boolean {
  return (
    material.lengthCm != null &&
    material.widthCm != null &&
    material.heightCm != null &&
    material.weightKg != null &&
    material.weightKg > 0 &&
    material.volumeCm3 != null &&
    material.volumeCm3 > 0 &&
    material.palletSpaces != null &&
    material.palletSpaces > 0
  );
}

function dimCell(value: number | null | undefined, material: Material) {
  const incomplete = !hasCompleteDimensions(material);
  const missing = value == null || (incomplete && value <= 0);
  return (
    <span className={missing ? "text-warning font-semibold" : "text-base-content/60"}>
      {value != null ? value : "—"}
    </span>
  );
}

export default function MaterialsPage() {
  const searchParams = useSearchParams();
  const supplierFilterId = searchParams.get("supplier")?.trim() || "";
  const { hasPermission } = useAdmin();

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
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string | null>(
    null
  );
  const [materialsWithLocations, setMaterialsWithLocations] = useState<
    Map<string, MaterialLocationSummary>
  >(new Map());

  const canEdit = hasPermission(ADMIN_ROUTES.MATERIALS, "edit");
  const canDelete = hasPermission(ADMIN_ROUTES.MATERIALS, "delete");

  const createMutation = useCreateMaterial();
  const updateMutation = useUpdateMaterial();
  const deleteMutation = useDeleteMaterial();
  const materialsQuery = usePagedAdminQuery({
    queryKey: [
      "admin-materials",
      currentPage,
      itemsPerPage,
      typeFilter,
      searchQuery,
      sortBy,
      sortDirection,
      supplierFilterId,
    ],
    queryFn: () => {
      const backendSortBy =
        sortBy === "name"
          ? "description"
          : sortBy === "sku"
            ? "materialCode"
            : sortBy === "type"
              ? "materialType"
              : "createdAt";

      return materialsApi.getPaged({
        page: currentPage - 1,
        size: itemsPerPage,
        sortBy: backendSortBy,
        sortDir: sortDirection,
        materialType: typeFilter === "all" ? undefined : typeFilter,
        supplierId: supplierFilterId || undefined,
        q: searchQuery.trim() || undefined,
      });
    },
  });
  const warehousesQuery = useReferenceWarehouses();
  const reload = useInvalidateAdminList(["admin-materials"]);

  const loadMaterialLocations = async () => {
    const materials = materialsQuery.data?.data || [];
    const warehouses = warehousesQuery.data || [];
    if (materials.length === 0 || warehouses.length === 0) {
      setMaterialsWithLocations(new Map());
      return;
    }
    try {
      const byMaterial = new Map<
        string,
        Array<{ locationCode: string; priority: number }>
      >();
      for (const warehouse of warehouses) {
        try {
          const materialsWithLocs =
            await materialDefaultLocationsApi.getMaterialsWithLocations(
              warehouse.id
            );
          materialsWithLocs.forEach((m) => {
            if (!m.locationCode) return;
            const list = byMaterial.get(m.materialId) || [];
            list.push({ locationCode: m.locationCode, priority: m.priority || 999 });
            byMaterial.set(m.materialId, list);
          });
        } catch (err) {
          logger.error(`Failed to load locations for warehouse ${warehouse.id}:`, err);
        }
      }

      const locationMap = new Map<string, MaterialLocationSummary>();
      byMaterial.forEach((list, materialId) => {
        const uniqueSorted = list
          .sort((a, b) => a.priority - b.priority)
          .map((entry) => entry.locationCode)
          .filter((code, index, arr) => arr.indexOf(code) === index);
        if (uniqueSorted.length > 0) {
          locationMap.set(materialId, {
            primary: uniqueSorted[0],
            all: uniqueSorted,
          });
        }
      });
      setMaterialsWithLocations(locationMap);
    } catch (err) {
      logger.error("Failed to load material locations:", err);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    void loadMaterialLocations();
  }, [materialsQuery.data, warehousesQuery.data]);

  const materials = useMemo(() => materialsQuery.data?.data || [], [materialsQuery.data]);
  const isLoading =
    (materialsQuery.isPending && !materialsQuery.data) ||
    (warehousesQuery.isPending && !warehousesQuery.data);
  const isFetching = materialsQuery.isFetching;
  const error = materialsQuery.error
    ? materialsQuery.error instanceof Error
      ? materialsQuery.error.message
      : "Unknown error"
    : null;
  const totalItems = materialsQuery.data?.totalElements ?? 0;
  const totalPages = Math.max(materialsQuery.data?.totalPages ?? 1, 1);

  const summaryStats = {
    total: totalItems,
    dimensioned: materials.filter(hasCompleteDimensions).length,
    rawMaterials: materials.filter((m) => (m.materialType || "raw_material") === "raw_material")
      .length,
    products: materials.filter((m) => m.materialType === "product").length,
    packaging: materials.filter((m) => m.materialType === "packaging_material").length,
  };

  const handleImportDimensions = async (file: File) => {
    try {
      const result = await materialsApi.importDimensionsCsv(file);
      alert(result.message);
      await reload();
    } catch (err) {
      logger.error("[Materials] Dimension import failed:", err);
      alert(err instanceof Error ? err.message : "Dimension import failed");
    }
  };

  const handleCreate = async (materialData: Omit<Material, "id">) => {
    try {
      await createMutation.mutateAsync(materialData);
      setShowCreateModal(false);
      await reload();
    } catch (error) {
      logger.error("[Materials] Failed to create material:", error);
    }
  };

  const handleUpdate = async (id: string, materialData: Partial<Material>) => {
    try {
      await updateMutation.mutateAsync({ id, data: materialData });
      setShowEditModal(false);
      setEditingMaterial(null);
      await reload();
    } catch (error) {
      logger.error("[Materials] Failed to update material:", error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      setShowDeleteModal(false);
      setSelectedMaterial(null);
      await reload();
    } catch (error) {
      logger.error("[Materials] Failed to delete material:", error);
    }
  };

  if (error) {
    return (
      <div className="p-6">
        <div className="alert alert-error">
          <span>Failed to load products: {error}</span>
          <button className="btn btn-sm btn-outline" onClick={() => void reload()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-base-content">Product Catalog</h1>
          <p className="text-sm text-base-content/60 mt-1">
            Manage all products, raw materials, and packaging materials
          </p>
        </div>
        <div className="flex gap-3">
          {isFetching && (
            <div className="flex items-center text-sm text-base-content/60">
              <span className="loading loading-spinner loading-xs mr-2"></span>
              Updating...
            </div>
          )}
          <button className="btn btn-outline" onClick={() => setShowImportModal(true)}>
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
                className="btn btn-outline"
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = ".csv";
                  input.onchange = () => {
                    const file = input.files?.[0];
                    if (file) void handleImportDimensions(file);
                  };
                  input.click();
                }}
                title="CSV: material_code,length_cm,width_cm,height_cm,weight_kg,pallet_spaces"
              >
                <span className="material-symbols-outlined">straighten</span>
                Import Dimensions
              </button>
              <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                <span className="material-symbols-outlined">add</span>
                Add Product
              </button>
            </>
          )}
        </div>
      </div>

      <SummaryCards
        cards={[
          {
            label: "Total Products",
            value: summaryStats.total.toString(),
            icon: "inventory_2",
          },
          {
            label: "Dimensioned SKUs",
            value: `${summaryStats.dimensioned}/${materials.length}`,
            icon: "straighten",
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

      <div className="card bg-base-100 border border-base-300 p-4">
        <div className="flex gap-4 items-center">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Material Type</span>
            </label>
            <select
              className="select select-bordered"
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value as MaterialTypeFilter);
                setCurrentPage(1);
              }}
            >
              {MATERIAL_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-control flex-1">
            <label className="label">
              <span className="label-text font-medium">Search</span>
            </label>
            <input
              type="text"
              placeholder="Search by code or description..."
              className="input input-bordered w-full"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
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
                onChange={(e) => {
                  setSortBy((e.target.value || null) as SortBy);
                  setCurrentPage(1);
                }}
              >
                <option value="">No Sort</option>
                <option value="name">Name</option>
                <option value="sku">SKU</option>
                <option value="type">Type</option>
              </select>
              <button
                className="btn btn-outline"
                type="button"
                onClick={() => {
                  setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
                  setCurrentPage(1);
                }}
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
          <span>Showing products linked to the selected supplier.</span>
        </div>
      )}

      <div className="card bg-base-100 border border-base-300 p-6">
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : (
          <DataTable
            data={materials}
            keyExtractor={(material) => material.id}
            columns={[
              {
                key: "materialCode",
                label: "SKU Code",
                render: (material: Material) => (
                  <span className="font-mono font-semibold text-primary">
                    {material.materialCode}
                  </span>
                ),
              },
              {
                key: "description",
                label: "Product Name",
                render: (material: Material) => (
                  <span className="text-base-content">
                    {cleanDisplayName(material.description)}
                  </span>
                ),
              },
              {
                key: "materialType",
                label: "Category",
                render: (material: Material) => {
                  const typeChip = getMaterialTypeChip(material.materialType);
                  return (
                    <StatusChip
                      label={typeChip.label}
                      tone={typeChip.tone}
                      className={typeChip.className}
                    />
                  );
                },
              },
              {
                key: "unitType",
                label: "Typical Unit Size",
                render: (material: Material) => (
                  <span className="text-base-content/60 uppercase">
                    {material.unitType || "—"}
                  </span>
                ),
              },
              {
                key: "palletSpaces",
                label: "Units Per Carton",
                render: (material: Material) => (
                  <span className="text-base-content/60">
                    {material.palletSpaces != null ? material.palletSpaces : "—"}
                  </span>
                ),
              },
              {
                key: "weightKg",
                label: "Carton Weight (kg)",
                render: (material: Material) => dimCell(material.weightKg, material),
              },
              {
                key: "volumeCm3",
                label: "Volume (cm³)",
                render: (material: Material) => dimCell(material.volumeCm3, material),
              },
              {
                key: "maxPalletWeightKg",
                label: "Max Carton Wt (kg)",
                render: (material: Material) => (
                  <span className="text-base-content/60">
                    {material.maxPalletWeightKg != null ? material.maxPalletWeightKg : "—"}
                  </span>
                ),
              },
              {
                key: "lengthCm",
                label: "Length (cm)",
                render: (material: Material) => dimCell(material.lengthCm, material),
              },
              {
                key: "widthCm",
                label: "Width (cm)",
                render: (material: Material) => dimCell(material.widthCm, material),
              },
              {
                key: "heightCm",
                label: "Height (cm)",
                render: (material: Material) => dimCell(material.heightCm, material),
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
                  const summary = materialsWithLocations.get(material.id);
                  if (!summary)
                    return <span className="text-base-content/40 text-xs">—</span>;
                  return (
                    <div className="flex flex-col leading-tight">
                      <span className="font-mono text-xs text-primary font-semibold">
                        {summary.primary}
                      </span>
                      {summary.all.length > 1 && (
                        <span className="text-[11px] text-base-content/60">
                          +{summary.all.length - 1} fallback
                        </span>
                      )}
                    </div>
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

      {showCreateModal && (
        <CreateMaterialModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreate}
          isLoading={createMutation.isPending}
        />
      )}

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
              This action cannot be undone. All associated inventory records will also
              be affected.
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
                onClick={() => void handleDelete(selectedMaterial.id)}
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

      {showImportModal && (
        <ImportMaterialModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onSuccess={() => {
            setShowImportModal(false);
            void reload();
          }}
        />
      )}

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
            void loadMaterialLocations();
          }}
        />
      )}

      {showBulkAssignModal && (
        <BulkAssignBinLocationsModal
          isOpen={showBulkAssignModal}
          onClose={() => setShowBulkAssignModal(false)}
          onSuccess={() => {
            void loadMaterialLocations();
          }}
        />
      )}
    </div>
  );
}
