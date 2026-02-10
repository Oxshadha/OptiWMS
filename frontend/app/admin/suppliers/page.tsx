"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/DataTable";
import { SummaryCards } from "@/components/SummaryCards";
import { useAdmin } from "@/contexts/AdminContext";
import { ADMIN_ROUTES } from "@/lib/admin-roles";
import { suppliersApi, Supplier } from "@/lib/api/suppliers";
import { showToast } from "@/lib/utils/toast";
import { logger } from "@/lib/utils/logger";
import type { SupplierDisplay } from "./types";
import {
  CreateSupplierModal,
  DeleteSupplierModal,
  EditSupplierModal,
  SupplierDetailModal,
} from "./components/SupplierModals";


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
