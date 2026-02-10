"use client";

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { SummaryCards } from "@/components/SummaryCards";
import { DetailModal } from "@/components/DetailModal";
import { useAdmin } from "@/contexts/AdminContext";
import { ADMIN_ROUTES } from "@/lib/admin-roles";
import { suppliersApi, Supplier } from "@/lib/api/suppliers";
import { showToast } from "@/lib/utils/toast";
import { logger } from "@/lib/utils/logger";

// Display format for suppliers
interface SupplierDisplay {
  id: string;
  supplierCode: string;
  name: string;
  country: string;
  type: "local" | "foreign";
  contactPerson: string;
  email: string;
  phone: string;
  productsSupplied: number;
  leadTimeDays: number;
  rating: number;
  status: string;
}

export default function SuppliersPage() {
  const router = useRouter();
  const { hasPermission } = useAdmin();
  const canDelete = hasPermission(ADMIN_ROUTES.SUPPLIERS, "delete");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierDisplay | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "local" | "foreign">("all");
  
  // API state
  const [suppliers, setSuppliers] = useState<SupplierDisplay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Function to transform API data to display format
  const transformSupplierData = (s: Supplier): SupplierDisplay => {
    // Determine type from country
    const isLocal = s.country?.toLowerCase().includes("sri lanka") || 
                   s.country?.toLowerCase().includes("lka") ||
                   !s.country;
    const type: "local" | "foreign" = isLocal ? "local" : "foreign";
    
    return {
      id: s.id,
      supplierCode: s.code || `SUP-${s.id.slice(0, 8).toUpperCase()}`,
      name: s.name,
      country: s.country || "Sri Lanka",
      type,
      contactPerson: s.contactPerson || "N/A",
      email: s.email || "",
      phone: s.phone || "",
      productsSupplied: 0, // TODO: Get from material-supplier relationship
      leadTimeDays: s.leadTimeDays || 7,
      rating: parseFloat(s.rating || "4.0"),
      status: s.status,
    };
  };

  // Load data from API
  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const suppliersData = await suppliersApi.getAll();
      
      // Transform to display format
      const displaySuppliers: SupplierDisplay[] = suppliersData.map(transformSupplierData);
      
      setSuppliers(displaySuppliers);
    } catch (err) {
      logger.error("Failed to load suppliers:", err);
      setError(err instanceof Error ? err.message : "Failed to load suppliers");
      setSuppliers([]);
      showToast.error("Failed to load suppliers. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const canApprovePO = hasPermission(ADMIN_ROUTES.SUPPLIERS, "approve");

  const summary = {
    totalSuppliers: suppliers.length,
    active: suppliers.filter((s) => s.status === "active").length,
    local: suppliers.filter((s) => s.type === "local").length,
    foreign: suppliers.filter((s) => s.type === "foreign").length,
  };

  const filteredSuppliers = suppliers.filter((supplier) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      query === "" ||
      supplier.name.toLowerCase().includes(query) ||
      supplier.supplierCode.toLowerCase().includes(query) ||
      supplier.email.toLowerCase().includes(query) ||
      supplier.contactPerson.toLowerCase().includes(query) ||
      supplier.country.toLowerCase().includes(query) ||
      supplier.phone.toLowerCase().includes(query) ||
      supplier.productsSupplied.toString().includes(query) ||
      supplier.leadTimeDays.toString().includes(query) ||
      supplier.rating.toString().includes(query) ||
      supplier.status.toLowerCase().includes(query) ||
      supplier.type.toLowerCase().includes(query);
    const matchesStatus =
      statusFilter === "all" || supplier.status === statusFilter;
    const matchesType = typeFilter === "all" || supplier.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const summaryCards = [
    {
      label: "Total Suppliers",
      value: summary.totalSuppliers,
      icon: "business",
      color: "primary" as const,
    },
    {
      label: "Active",
      value: summary.active,
      icon: "check_circle",
      color: "success" as const,
    },
    {
      label: "Local Suppliers",
      value: summary.local,
      icon: "location_on",
      color: "success" as const,
    },
    {
      label: "Foreign Suppliers",
      value: summary.foreign,
      icon: "public",
      color: "info" as const,
    },
  ];

  const columns = [
    {
      key: "supplierCode",
      label: "Supplier Code",
      sortable: true,
    },
    {
      key: "name",
      label: "Supplier Name",
      render: (supplier: (typeof suppliers)[0]) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedSupplier(supplier);
            setShowDetailModal(true);
          }}
          className="font-semibold text-primary hover:underline text-left"
        >
          {supplier.name}
        </button>
      ),
      sortable: true,
    },
    {
      key: "country",
      label: "Country",
      sortable: true,
    },
    {
      key: "type",
      label: "Type",
      render: (supplier: (typeof suppliers)[0]) => (
        <span
          className={`badge ${
            supplier.type === "local" ? "badge-success" : "badge-info"
          }`}
        >
          {supplier.type === "local" ? "Local" : "Foreign"}
        </span>
      ),
      sortable: true,
    },
    {
      key: "contactPerson",
      label: "Contact Person",
      className: "text-base-content/70",
    },
    {
      key: "email",
      label: "Email",
      className: "text-base-content/70",
    },
    {
      key: "phone",
      label: "Phone",
      className: "text-base-content/70",
    },
    {
      key: "productsSupplied",
      label: "Products Supplied",
      sortable: true,
    },
    {
      key: "leadTimeDays",
      label: "Lead Time (days)",
      render: (supplier: (typeof suppliers)[0]) =>
        `${supplier.leadTimeDays} days`,
      sortable: true,
    },
    {
      key: "rating",
      label: "Rating",
      render: (supplier: (typeof suppliers)[0]) => (
        <div className="flex items-center gap-1">
          <span className="text-warning">★</span>
          <span>{supplier.rating.toFixed(1)}</span>
        </div>
      ),
      sortable: true,
    },
    {
      key: "status",
      label: "Status",
      render: (supplier: (typeof suppliers)[0]) => (
        <span
          className={`badge ${
            supplier.status === "active" ? "badge-success" : "badge-error"
          }`}
        >
          {supplier.status === "active" ? "Active" : "Inactive"}
        </span>
      ),
    },
  ];

  const renderActions = (supplier: (typeof suppliers)[0]) => (
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
              setSelectedSupplier(supplier);
              setShowDetailModal(true);
            }}
          >
            <span className="material-symbols-outlined text-sm">
              visibility
            </span>
            View Details
          </button>
        </li>
        <li>
          <button
            onClick={() => {
              setSelectedSupplier(supplier);
              setShowEditModal(true);
            }}
          >
            <span className="material-symbols-outlined text-sm">edit</span>
            Edit Supplier
          </button>
        </li>
        <li>
          <button
            onClick={() => {
              router.push(`/admin/products?supplier=${supplier.id}`);
            }}
          >
            <span className="material-symbols-outlined text-sm">inventory</span>
            View Products
          </button>
        </li>
        <li>
          <button
            onClick={() => {
              router.push(`/admin/orders/inbound?supplier=${supplier.id}`);
            }}
          >
            <span className="material-symbols-outlined text-sm">
              description
            </span>
            View Orders
          </button>
        </li>
        {canApprovePO && (
          <li>
            <button
              onClick={() => {
                showToast.warning("Purchase order approval workflow coming soon");
              }}
            >
              <span className="material-symbols-outlined text-sm">
                check_circle
              </span>
              Approve Purchase Order
            </button>
          </li>
        )}
        {canDelete && (
          <li>
            <button
              className="text-error"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedSupplier(supplier);
                setShowDeleteModal(true);
              }}
            >
              <span className="material-symbols-outlined text-sm">delete</span>
              Delete Supplier
            </button>
          </li>
        )}
      </ul>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-base-content">Suppliers</h1>
          <p className="text-sm text-base-content/60 mt-1">
            Manage supplier relationships and information
          </p>
        </div>
        <div className="flex gap-3">
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => loadData()}
            title="Refresh data"
          >
            <span className="material-symbols-outlined">refresh</span>
          </button>
          <div className="form-control">
            <div className="relative">
              <input
                type="text"
                placeholder="Search by name, code, email, country..."
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
                  <span className="material-symbols-outlined text-xs">
                    close
                  </span>
                </button>
              )}
            </div>
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
              <li className="menu-title">
                <span>Status</span>
              </li>
              <li>
                <button onClick={() => setStatusFilter("all")}>
                  All Status
                </button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("active")}>
                  Active
                </button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("inactive")}>
                  Inactive
                </button>
              </li>
              <li className="menu-title">
                <span>Type</span>
              </li>
              <li>
                <button onClick={() => setTypeFilter("all")}>All Types</button>
              </li>
              <li>
                <button onClick={() => setTypeFilter("local")}>Local</button>
              </li>
              <li>
                <button onClick={() => setTypeFilter("foreign")}>
                  Foreign
                </button>
              </li>
            </ul>
          </div>
          <button
            className="btn btn-sm btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            <span className="material-symbols-outlined">add</span>
            <span>Add Supplier</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <SummaryCards cards={summaryCards} columns={3} />

      {/* Search Results Info */}
      {searchQuery && (
        <div className="text-sm text-base-content/60 flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">search</span>
          <span>
            Found {filteredSuppliers.length} supplier
            {filteredSuppliers.length !== 1 ? "s" : ""} matching "{searchQuery}"
          </span>
        </div>
      )}

      {/* Suppliers Table */}
      {error && (
        <div className="alert alert-error">
          <span className="material-symbols-outlined">error</span>
          <span>{error}</span>
          <button className="btn btn-xs btn-ghost ml-auto" onClick={() => loadData()}>
            Retry
          </button>
        </div>
      )}
      {isLoading && (
        <div className="card bg-base-100 border border-base-300 rounded-xl p-6">
          <div className="flex items-center justify-center gap-3 text-base-content/70">
            <span className="loading loading-spinner loading-md" />
            <span>Loading suppliers...</span>
          </div>
        </div>
      )}
      {!isLoading && (
        <DataTable
          data={filteredSuppliers}
          columns={columns}
          keyExtractor={(supplier) => supplier.id}
          onRowClick={(supplier) => {
            setSelectedSupplier(supplier);
            setShowDetailModal(true);
          }}
          actions={renderActions}
          emptyMessage={
            searchQuery
              ? `No suppliers found matching "${searchQuery}"`
              : "No suppliers found"
          }
        />
      )}

      {/* Create Supplier Modal */}
      <CreateSupplierModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={loadData}
      />

      {/* Supplier Detail Modal */}
      {selectedSupplier && (
        <SupplierDetailModal
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedSupplier(null);
          }}
          onEdit={(supplier) => {
            setShowDetailModal(false);
            setSelectedSupplier(supplier);
            setShowEditModal(true);
          }}
          supplier={selectedSupplier}
        />
      )}

      {/* Edit Supplier Modal */}
      {selectedSupplier && (
        <EditSupplierModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedSupplier(null);
          }}
          onUpdated={loadData}
          supplier={selectedSupplier}
        />
      )}

      {/* Delete Supplier Modal */}
      {selectedSupplier && (
        <DeleteSupplierModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedSupplier(null);
          }}
          onConfirm={async () => {
            if (!selectedSupplier) return;
            
            try {
              await suppliersApi.delete(selectedSupplier.id);
              showToast.success("Supplier deleted successfully");
              setShowDeleteModal(false);
              setSelectedSupplier(null);
              await loadData();
            } catch (err) {
              logger.error("Failed to delete supplier:", err);
              showToast.error(err instanceof Error ? err.message : "Failed to delete supplier");
            }
          }}
          supplier={selectedSupplier}
        />
      )}

    </div>
  );
}

// Supplier Detail Modal
function SupplierDetailModal({
  isOpen,
  onClose,
  onEdit,
  supplier,
}: {
  isOpen: boolean;
  onClose: () => void;
  onEdit: (supplier: SupplierDisplay) => void;
  supplier: SupplierDisplay;
}) {
  return (
    <DetailModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Supplier: ${supplier.name}`}
      size="lg"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-base-content/60">
              Supplier Code
            </label>
            <p className="font-semibold">{supplier.supplierCode}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Country</label>
            <p className="font-semibold">{supplier.country}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Type</label>
            <p>
              <span
                className={`badge ${
                  supplier.type === "local" ? "badge-success" : "badge-info"
                }`}
              >
                {supplier.type === "local" ? "Local" : "Foreign"}
              </span>
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">
              Contact Person
            </label>
            <p className="font-semibold">{supplier.contactPerson}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Email</label>
            <p className="font-semibold">{supplier.email}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Phone</label>
            <p className="font-semibold">{supplier.phone}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">
              Products Supplied
            </label>
            <p className="font-semibold">{supplier.productsSupplied}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Lead Time</label>
            <p className="font-semibold">{supplier.leadTimeDays} days</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Rating</label>
            <p className="font-semibold">
              <span className="text-warning">★</span>{" "}
              {supplier.rating.toFixed(1)}
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Status</label>
            <p>
              <span
                className={`badge ${
                  supplier.status === "active" ? "badge-success" : "badge-error"
                }`}
              >
                {supplier.status === "active" ? "Active" : "Inactive"}
              </span>
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              onEdit(supplier);
            }}
          >
            Edit Supplier
          </button>
        </div>
      </div>
    </DetailModal>
  );
}

// Edit Supplier Modal
function EditSupplierModal({
  isOpen,
  onClose,
  onUpdated,
  supplier,
}: {
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => Promise<void>;
  supplier: SupplierDisplay;
}) {
  const [formData, setFormData] = useState({
    supplierCode: supplier.supplierCode,
    name: supplier.name,
    contactPerson: supplier.contactPerson,
    email: supplier.email,
    phone: supplier.phone,
    country: supplier.country,
    type: supplier.type,
    leadTimeDays: supplier.leadTimeDays.toString(),
    rating: supplier.rating.toString(),
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    try {
      const updateData: Partial<Supplier> = {
        code: formData.supplierCode,
        name: formData.name,
        contactPerson: formData.contactPerson || undefined,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        country: formData.country,
        leadTimeDays: formData.leadTimeDays ? parseInt(formData.leadTimeDays) : undefined,
        rating: formData.rating || undefined,
      };

      await suppliersApi.update(supplier.id, updateData);
      showToast.success("Supplier updated successfully");
      await onUpdated();
      onClose();
    } catch (err) {
      logger.error("Failed to update supplier:", err);
      showToast.error(err instanceof Error ? err.message : "Failed to update supplier");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Supplier" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Supplier Code *</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.supplierCode}
              onChange={(e) =>
                setFormData({ ...formData, supplierCode: e.target.value })
              }
              required
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Supplier Name *</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Contact Person</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.contactPerson}
              onChange={(e) =>
                setFormData({ ...formData, contactPerson: e.target.value })
              }
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Email</span>
            </label>
            <input
              type="email"
              className="input input-bordered w-full"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
            />
          </div>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Phone</span>
          </label>
          <input
            type="tel"
            className="input input-bordered w-full"
            value={formData.phone}
            onChange={(e) =>
              setFormData({ ...formData, phone: e.target.value })
            }
          />
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Country *</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={formData.country}
            onChange={(e) =>
              setFormData({ ...formData, country: e.target.value })
            }
            required
          >
            <option value="United States">United States</option>
            <option value="United Kingdom">United Kingdom</option>
            <option value="China">China</option>
            <option value="Canada">Canada</option>
          </select>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Supplier Type *</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={formData.type}
            onChange={(e) =>
              setFormData({
                ...formData,
                type: e.target.value as "local" | "foreign",
              })
            }
            required
          >
            <option value="">Select type...</option>
            <option value="local">Local</option>
            <option value="foreign">Foreign</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">
                Average Lead Time (days)
              </span>
            </label>
            <input
              type="number"
              className="input input-bordered w-full"
              value={formData.leadTimeDays}
              onChange={(e) =>
                setFormData({ ...formData, leadTimeDays: e.target.value })
              }
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Rating (0-5)</span>
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="5"
              className="input input-bordered w-full"
              value={formData.rating}
              onChange={(e) =>
                setFormData({ ...formData, rating: e.target.value })
              }
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Update Supplier
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Create Supplier Modal
function CreateSupplierModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}) {
  const [formData, setFormData] = useState({
    supplierCode: "",
    name: "",
    contactPerson: "",
    email: "",
    phone: "",
    address: "",
    country: "",
    type: "" as "local" | "foreign" | "",
    leadTimeDays: "",
    rating: "",
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    try {
      const createData: Omit<Supplier, 'id'> = {
        code: formData.supplierCode,
        name: formData.name,
        contactPerson: formData.contactPerson || undefined,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        address: formData.address || undefined,
        country: formData.country,
        leadTimeDays: formData.leadTimeDays ? parseInt(formData.leadTimeDays) : undefined,
        rating: formData.rating || undefined,
        status: "active",
      };

      await suppliersApi.create(createData);
      showToast.success("Supplier created successfully");
      await onSuccess();
      onClose();
      // Reset form
      setFormData({
        supplierCode: "",
        name: "",
        contactPerson: "",
        email: "",
        phone: "",
        address: "",
        country: "",
        type: "" as "local" | "foreign" | "",
        leadTimeDays: "",
        rating: "",
      });
    } catch (err) {
      logger.error("Failed to create supplier:", err);
      showToast.error(err instanceof Error ? err.message : "Failed to create supplier");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Supplier" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Supplier Code *</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.supplierCode}
              onChange={(e) =>
                setFormData({ ...formData, supplierCode: e.target.value })
              }
              required
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Supplier Name *</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Contact Person</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.contactPerson}
              onChange={(e) =>
                setFormData({ ...formData, contactPerson: e.target.value })
              }
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Email</span>
            </label>
            <input
              type="email"
              className="input input-bordered w-full"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
            />
          </div>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Phone</span>
          </label>
          <input
            type="tel"
            className="input input-bordered w-full"
            value={formData.phone}
            onChange={(e) =>
              setFormData({ ...formData, phone: e.target.value })
            }
          />
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Address</span>
          </label>
          <textarea
            className="textarea textarea-bordered w-full"
            rows={2}
            value={formData.address}
            onChange={(e) =>
              setFormData({ ...formData, address: e.target.value })
            }
          />
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Country *</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={formData.country}
            onChange={(e) =>
              setFormData({ ...formData, country: e.target.value })
            }
            required
          >
            <option value="">Select country</option>
            <option value="United States">United States</option>
            <option value="United Kingdom">United Kingdom</option>
            <option value="China">China</option>
            <option value="Canada">Canada</option>
          </select>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Supplier Type *</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={formData.type}
            onChange={(e) =>
              setFormData({
                ...formData,
                type: e.target.value as "local" | "foreign",
              })
            }
            required
          >
            <option value="">Select type...</option>
            <option value="local">Local</option>
            <option value="foreign">Foreign</option>
          </select>
        </div>


        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">
                Average Lead Time (days)
              </span>
            </label>
            <input
              type="number"
              className="input input-bordered w-full"
              value={formData.leadTimeDays}
              onChange={(e) =>
                setFormData({ ...formData, leadTimeDays: e.target.value })
              }
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Rating (0-5)</span>
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="5"
              className="input input-bordered w-full"
              value={formData.rating}
              onChange={(e) =>
                setFormData({ ...formData, rating: e.target.value })
              }
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Create Supplier
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Delete Supplier Modal
function DeleteSupplierModal({
  isOpen,
  onClose,
  onConfirm,
  supplier,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  supplier: SupplierDisplay;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Supplier" size="md">
      <div className="space-y-4">
        <div className="alert alert-warning">
          <span className="material-symbols-outlined">warning</span>
          <div>
            <h3 className="font-bold">
              Warning: This action cannot be undone!
            </h3>
            <div className="text-sm">
              You are about to delete <strong>{supplier.name}</strong> (Supplier
              Code: {supplier.supplierCode}). This will permanently remove the
              supplier from the system and all associated data.
            </div>
          </div>
        </div>
        <div className="bg-base-200 rounded-lg p-4">
          <p className="text-sm text-base-content/70">
            <strong>Supplier Name:</strong> {supplier.name}
          </p>
          <p className="text-sm text-base-content/70">
            <strong>Supplier Code:</strong> {supplier.supplierCode}
          </p>
          <p className="text-sm text-base-content/70">
            <strong>Country:</strong> {supplier.country}
          </p>
          <p className="text-sm text-base-content/70">
            <strong>Products Supplied:</strong> {supplier.productsSupplied}
          </p>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-error" onClick={onConfirm}>
            <span className="material-symbols-outlined">delete</span>
            Delete Supplier
          </button>
        </div>
      </div>
    </Modal>
  );
}
