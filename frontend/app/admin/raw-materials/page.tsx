"use client";

import React, { useState, useEffect } from "react";
import { DataTable } from "@/components/DataTable";
import { DetailModal } from "@/components/DetailModal";
import { Modal } from "@/components/Modal";
import { SummaryCards } from "@/components/SummaryCards";
import { useAdmin } from "@/contexts/AdminContext";
import { ADMIN_ROUTES } from "@/lib/admin-roles";
import { materialsApi, type Material } from "@/lib/api/materials";

export default function RawMaterialsPage() {
  const { hasPermission } = useAdmin();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const canEdit = hasPermission(ADMIN_ROUTES.RAW_MATERIALS, "edit");
  const canDelete = hasPermission(ADMIN_ROUTES.RAW_MATERIALS, "delete");

  // Load materials on mount
  useEffect(() => {
    loadMaterials();
  }, []);

  const loadMaterials = async () => {
    try {
      setIsLoading(true);
      // Fetch raw materials (materials with materialType='raw_material' or null)
      const allMaterials = await materialsApi.getAll();
      // Filter for raw materials (materialType is null, empty, or 'raw_material')
      const rawMaterials = allMaterials.filter(
        (m) => !m.materialType || m.materialType === "raw_material" || m.materialType === ""
      );
      setMaterials(rawMaterials);
    } catch (error) {
      console.error("Error loading materials:", error);
      setMaterials([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredMaterials = materials.filter((material) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return (
      material.materialCode.toLowerCase().includes(query) ||
      material.description.toLowerCase().includes(query) ||
      material.unitType?.toLowerCase().includes(query) ||
      material.storageType?.toLowerCase().includes(query)
    );
  });

  const summary = {
    totalMaterials: materials.length,
    byStorageType: {
      pallet: materials.filter((m) => m.storageType === "Pallet").length,
      bulk: materials.filter((m) => m.storageType === "Bulk").length,
      carton: materials.filter((m) => m.storageType === "Carton").length,
    },
  };

  const summaryCards = [
    {
      label: "Total Raw Materials",
      value: summary.totalMaterials,
      icon: "inventory_2",
      color: "primary" as const,
    },
    {
      label: "Pallet Storage",
      value: summary.byStorageType.pallet,
      icon: "pallet",
      color: "info" as const,
    },
    {
      label: "Bulk Storage",
      value: summary.byStorageType.bulk,
      icon: "warehouse",
      color: "success" as const,
    },
    {
      label: "Carton Storage",
      value: summary.byStorageType.carton,
      icon: "inventory",
      color: "warning" as const,
    },
  ];

  const columns = [
    {
      key: "materialCode",
      label: "Material Code",
      render: (material: Material) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedMaterial(material);
            setShowDetailModal(true);
          }}
          className="font-semibold text-primary hover:underline text-left"
        >
          {material.materialCode}
        </button>
      ),
      sortable: true,
    },
    {
      key: "description",
      label: "Description",
      sortable: true,
    },
    {
      key: "unitType",
      label: "Unit Type",
      render: (material: Material) => (
        <span className="badge badge-ghost">{material.unitType || "N/A"}</span>
      ),
    },
    {
      key: "storageType",
      label: "Storage Type",
      render: (material: Material) => (
        <span className="badge badge-outline">{material.storageType || "N/A"}</span>
      ),
    },
  ];

  const renderActions = (material: Material) => (
    <div className="dropdown dropdown-end">
      <label tabIndex={0} className="btn btn-ghost btn-xs">
        <span className="material-symbols-outlined">more_vert</span>
      </label>
      <ul
        tabIndex={0}
        className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300 z-10"
      >
        <li>
          <button
            onClick={() => {
              setSelectedMaterial(material);
              setShowDetailModal(true);
            }}
          >
            <span className="material-symbols-outlined text-sm">visibility</span>
            View Details
          </button>
        </li>
        {canEdit && (
          <li>
            <button
              onClick={() => {
                setEditingMaterial(material);
                setShowEditModal(true);
              }}
            >
              <span className="material-symbols-outlined text-sm">edit</span>
              Edit Material
            </button>
          </li>
        )}
        <li>
          <button
            onClick={() => {
              // Navigate to inventory page filtered by this material
              window.location.href = `/admin/inventory?materialCode=${material.materialCode}`;
            }}
          >
            <span className="material-symbols-outlined text-sm">inventory</span>
            View Inventory
          </button>
        </li>
        {canDelete && (
          <li>
            <button
              className="text-error"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedMaterial(material);
                setShowDeleteModal(true);
              }}
            >
              <span className="material-symbols-outlined text-sm">delete</span>
              Delete Material
            </button>
          </li>
        )}
      </ul>
    </div>
  );

  const handleDelete = async () => {
    if (!selectedMaterial) return;
    try {
      await materialsApi.delete(selectedMaterial.id);
      await loadMaterials();
      setShowDeleteModal(false);
      setSelectedMaterial(null);
    } catch (error) {
      console.error("Error deleting material:", error);
      alert("Failed to delete material. Please try again.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-base-content">Raw Materials</h1>
          <p className="text-sm text-base-content/60 mt-1">
            Manage raw materials catalog and inventory
          </p>
        </div>
        <div className="flex gap-3">
          <div className="form-control">
            <div className="relative">
              <input
                type="text"
                placeholder="Search by code, description..."
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
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => setShowImportModal(true)}
          >
            <span className="material-symbols-outlined">upload_file</span>
            <span>Import Materials</span>
          </button>
          <button
            className="btn btn-sm btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            <span className="material-symbols-outlined">add</span>
            <span>Add Material</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <SummaryCards cards={summaryCards} columns={4} />

      {/* Search Results Info */}
      {searchQuery && (
        <div className="text-sm text-base-content/60 flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">search</span>
          <span>
            Found {filteredMaterials.length} material
            {filteredMaterials.length !== 1 ? "s" : ""} matching "{searchQuery}"
          </span>
        </div>
      )}

      {/* Materials Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : (
        <DataTable
          data={filteredMaterials}
          columns={columns}
          keyExtractor={(material) => material.id}
          onRowClick={(material) => {
            setSelectedMaterial(material);
            setShowDetailModal(true);
          }}
          actions={renderActions}
          emptyMessage={
            searchQuery
              ? `No materials found matching "${searchQuery}"`
              : "No raw materials found"
          }
        />
      )}

      {/* Create Material Modal */}
      <CreateMaterialModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={loadMaterials}
      />

      {/* Edit Material Modal */}
      {editingMaterial && (
        <EditMaterialModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditingMaterial(null);
          }}
          material={editingMaterial}
          onSuccess={loadMaterials}
        />
      )}

      {/* Material Detail Modal */}
      {selectedMaterial && (
        <MaterialDetailModal
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedMaterial(null);
          }}
          material={selectedMaterial}
          onEdit={(material) => {
            setShowDetailModal(false);
            setSelectedMaterial(null);
            setEditingMaterial(material);
            setShowEditModal(true);
          }}
        />
      )}

      {/* Import Materials Modal */}
      {showImportModal && (
        <ImportMaterialsModal onClose={() => setShowImportModal(false)} onSuccess={loadMaterials} />
      )}

      {/* Delete Material Modal */}
      {selectedMaterial && (
        <DeleteMaterialModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedMaterial(null);
          }}
          onConfirm={handleDelete}
          material={selectedMaterial}
        />
      )}
    </div>
  );
}

// Create Material Modal
function CreateMaterialModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    materialCode: "",
    description: "",
    unitType: "",
    storageType: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await materialsApi.create(formData);
      alert("Raw material created successfully!");
      onSuccess();
      onClose();
      setFormData({
        materialCode: "",
        description: "",
        unitType: "",
        storageType: "",
      });
    } catch (error) {
      console.error("Error creating material:", error);
      alert("Failed to create material. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Raw Material" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Material Code *</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={formData.materialCode}
            onChange={(e) =>
              setFormData({ ...formData, materialCode: e.target.value })
            }
            required
            placeholder="e.g., RM-1001"
          />
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Description *</span>
          </label>
          <textarea
            className="textarea textarea-bordered w-full"
            rows={3}
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            required
            placeholder="Material description..."
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Unit Type</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={formData.unitType}
              onChange={(e) =>
                setFormData({ ...formData, unitType: e.target.value })
              }
            >
              <option value="">Select unit type</option>
              <option value="kg">Kilogram (kg)</option>
              <option value="g">Gram (g)</option>
              <option value="ton">Ton</option>
              <option value="roll">Roll</option>
              <option value="piece">Piece</option>
              <option value="meter">Meter (m)</option>
              <option value="liter">Liter (L)</option>
            </select>
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Storage Type</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={formData.storageType}
              onChange={(e) =>
                setFormData({ ...formData, storageType: e.target.value })
              }
            >
              <option value="">Select storage type</option>
              <option value="Pallet">Pallet</option>
              <option value="Bulk">Bulk</option>
              <option value="Carton">Carton</option>
              <option value="Shelf">Shelf</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Creating...
              </>
            ) : (
              "Create Material"
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Edit Material Modal
function EditMaterialModal({
  isOpen,
  onClose,
  material,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  material: Material;
  onSuccess: () => void;
}) {
  const [formData, setFormData] = useState({
    materialCode: material.materialCode,
    description: material.description,
    unitType: material.unitType || "",
    storageType: material.storageType || "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await materialsApi.update(material.id, formData);
      alert("Raw material updated successfully!");
      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error updating material:", error);
      alert("Failed to update material. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Raw Material" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Material Code *</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={formData.materialCode}
            onChange={(e) =>
              setFormData({ ...formData, materialCode: e.target.value })
            }
            required
          />
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Description *</span>
          </label>
          <textarea
            className="textarea textarea-bordered w-full"
            rows={3}
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Unit Type</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={formData.unitType}
              onChange={(e) =>
                setFormData({ ...formData, unitType: e.target.value })
              }
            >
              <option value="">Select unit type</option>
              <option value="kg">Kilogram (kg)</option>
              <option value="g">Gram (g)</option>
              <option value="ton">Ton</option>
              <option value="roll">Roll</option>
              <option value="piece">Piece</option>
              <option value="meter">Meter (m)</option>
              <option value="liter">Liter (L)</option>
            </select>
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Storage Type</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={formData.storageType}
              onChange={(e) =>
                setFormData({ ...formData, storageType: e.target.value })
              }
            >
              <option value="">Select storage type</option>
              <option value="Pallet">Pallet</option>
              <option value="Bulk">Bulk</option>
              <option value="Carton">Carton</option>
              <option value="Shelf">Shelf</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Updating...
              </>
            ) : (
              "Update Material"
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Material Detail Modal
function MaterialDetailModal({
  isOpen,
  onClose,
  material,
  onEdit,
}: {
  isOpen: boolean;
  onClose: () => void;
  material: Material;
  onEdit?: (material: Material) => void;
}) {
  return (
    <DetailModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Raw Material: ${material.materialCode}`}
      size="md"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-base-content/60">Material Code</label>
            <p className="font-semibold">{material.materialCode}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Unit Type</label>
            <p>
              <span className="badge badge-ghost">
                {material.unitType || "N/A"}
              </span>
            </p>
          </div>
          <div className="col-span-2">
            <label className="text-sm text-base-content/60">Description</label>
            <p className="font-semibold">{material.description}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Storage Type</label>
            <p>
              <span className="badge badge-outline">
                {material.storageType || "N/A"}
              </span>
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          {onEdit && (
            <button className="btn btn-primary" onClick={() => onEdit(material)}>
              Edit Material
            </button>
          )}
        </div>
      </div>
    </DetailModal>
  );
}

// Import Materials Modal
function ImportMaterialsModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const extension = file.name.split(".").pop()?.toLowerCase();
      if (extension === "csv" || extension === "xlsx" || extension === "xls") {
        setImportFile(file);
      } else {
        alert("Please select a CSV or Excel file");
      }
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      alert("Please select a file to import");
      return;
    }

    setImporting(true);
    try {
      const result = await materialsApi.importCsv(importFile);
      alert(
        `Import completed! ${result.successCount} materials imported, ${result.errorCount} errors.`
      );
      if (result.successCount > 0) {
        onSuccess();
      }
      setImportFile(null);
      onClose();
    } catch (error) {
      console.error("Error importing materials:", error);
      alert("Error importing materials. Please check the file format.");
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const template =
      "Material Code,Description,Unit Type,Storage Type\nRM-1001,Steel Sheet 2mm,kg,Pallet\nRM-1002,Aluminum Rod 10mm,kg,Pallet";
    const blob = new Blob([template], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "raw_materials_import_template.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Import Raw Materials" size="lg">
      <div className="p-6 space-y-4">
        <div className="bg-info/10 border border-info/20 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <span className="material-symbols-outlined text-info">info</span>
            <div className="text-sm text-base-content/70">
              <p className="font-medium mb-1">Import Instructions:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Download the template CSV file</li>
                <li>Fill in material details following the template format</li>
                <li>Upload the completed file</li>
                <li>Supported formats: CSV, Excel (.xlsx, .xls)</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Import File *</span>
          </label>
          <div className="flex gap-2">
            <input
              type="file"
              ref={fileInputRef}
              className="file-input file-input-bordered flex-1"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileSelect}
            />
            <button
              type="button"
              className="btn btn-outline"
              onClick={downloadTemplate}
            >
              <span className="material-symbols-outlined">download</span>
              Download Template
            </button>
          </div>
          {importFile && (
            <div className="mt-2 text-sm text-base-content/70">
              Selected: <span className="font-medium">{importFile.name}</span> (
              {(importFile.size / 1024).toFixed(2)} KB)
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <button
            className="btn btn-ghost"
            onClick={onClose}
            disabled={importing}
          >
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleImport}
            disabled={!importFile || importing}
          >
            {importing ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Importing...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined">upload_file</span>
                Import Materials
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// Delete Material Modal
function DeleteMaterialModal({
  isOpen,
  onClose,
  onConfirm,
  material,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  material: Material;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Raw Material" size="md">
      <div className="space-y-4">
        <div className="alert alert-warning">
          <span className="material-symbols-outlined">warning</span>
          <div>
            <h3 className="font-bold">Warning: This action cannot be undone!</h3>
            <div className="text-sm">
              You are about to delete <strong>{material.description}</strong> (Code:{" "}
              {material.materialCode}). This will permanently remove the material from the
              system.
            </div>
          </div>
        </div>
        <div className="bg-base-200 rounded-lg p-4">
          <p className="text-sm text-base-content/70">
            <strong>Material Code:</strong> {material.materialCode}
          </p>
          <p className="text-sm text-base-content/70">
            <strong>Description:</strong> {material.description}
          </p>
          <p className="text-sm text-base-content/70">
            <strong>Unit Type:</strong> {material.unitType || "N/A"}
          </p>
          <p className="text-sm text-base-content/70">
            <strong>Storage Type:</strong> {material.storageType || "N/A"}
          </p>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-error" onClick={onConfirm}>
            <span className="material-symbols-outlined">delete</span>
            Delete Material
          </button>
        </div>
      </div>
    </Modal>
  );
}

