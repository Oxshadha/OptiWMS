"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/DataTable";
import { Pagination } from "@/components/Pagination";
import { SummaryCards } from "@/components/SummaryCards";
import { StatusChip } from "@/components/StatusChip";
import { useAdmin } from "@/contexts/AdminContext";
import { ADMIN_ROUTES } from "@/lib/admin-roles";
import { suppliersApi, Supplier } from "@/lib/api/suppliers";
import { useInvalidateAdminList, usePagedAdminQuery } from "@/lib/hooks/useQuery";
import { showToast } from "@/lib/utils/toast";
import { logger } from "@/lib/utils/logger";
import type { SupplierDisplay } from "./types";
import {
  CreateSupplierModal,
  DeleteSupplierModal,
  EditSupplierModal,
  ManageSupplierMaterialsModal,
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
  const [showManageMaterialsModal, setShowManageMaterialsModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierDisplay | null>(
    null
  );
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "local" | "foreign">(
    "all"
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const transformSupplierData = (s: Supplier): SupplierDisplay => {
    const isLocal =
      s.country?.toLowerCase().includes("sri lanka") ||
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
      leadTimeDays: typeof s.leadTimeDays === "number" ? s.leadTimeDays : null,
      rating: s.rating != null ? parseFloat(s.rating) : null,
      status: s.status,
    };
  };

  const suppliersQuery = usePagedAdminQuery({
    queryKey: ["admin-suppliers", currentPage, itemsPerPage, statusFilter, searchQuery],
    queryFn: async () => {
      return suppliersApi.getPaged({
        page: currentPage - 1,
        size: itemsPerPage,
        sortBy: "createdAt",
        sortDir: "desc",
        status: statusFilter === "all" ? undefined : statusFilter,
        q: searchQuery.trim() || undefined,
      });
    },
  });
  const reload = useInvalidateAdminList(["admin-suppliers"]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const suppliers = useMemo(
    () => (suppliersQuery.data?.data || []).map(transformSupplierData),
    [suppliersQuery.data]
  );
  const filteredSuppliers = useMemo(
    () =>
      typeFilter === "all"
        ? suppliers
        : suppliers.filter((supplier) => supplier.type === typeFilter),
    [suppliers, typeFilter]
  );
  const isLoading = suppliersQuery.isPending && !suppliersQuery.data;
  const isFetching = suppliersQuery.isFetching;
  const error = suppliersQuery.error
    ? suppliersQuery.error instanceof Error
      ? suppliersQuery.error.message
      : "Failed to load suppliers"
    : null;
  const totalItems = suppliersQuery.data?.totalElements ?? 0;
  const totalPages = Math.max(suppliersQuery.data?.totalPages ?? 1, 1);

  const summary = {
    totalSuppliers: totalItems,
    active: suppliers.filter((s) => s.status === "active").length,
    local: suppliers.filter((s) => s.type === "local").length,
    foreign: suppliers.filter((s) => s.type === "foreign").length,
  };

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
      label: "Local",
      value: summary.local,
      icon: "location_on",
      color: "success" as const,
    },
    {
      label: "Foreign",
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
        <StatusChip
          label={supplier.type === "local" ? "Local" : "Foreign"}
          tone="neutral"
        />
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
      key: "leadTimeDays",
      label: "Lead Time (days)",
      render: (supplier: (typeof suppliers)[0]) =>
        supplier.leadTimeDays != null ? `${supplier.leadTimeDays} days` : "—",
      sortable: true,
    },
    {
      key: "rating",
      label: "Rating",
      render: (supplier: (typeof suppliers)[0]) =>
        supplier.rating != null ? (
          <div className="flex items-center gap-1">
            <span className="text-warning">★</span>
            <span>{supplier.rating.toFixed(1)}</span>
          </div>
        ) : (
          "—"
        ),
      sortable: true,
    },
    {
      key: "status",
      label: "Status",
      render: (supplier: (typeof suppliers)[0]) => (
        <StatusChip
          label={supplier.status === "active" ? "Active" : "Inactive"}
          tone={supplier.status === "active" ? "success" : "danger"}
          showDot
        />
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
            <span className="material-symbols-outlined text-sm">visibility</span>
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
              setSelectedSupplier(supplier);
              setShowManageMaterialsModal(true);
            }}
          >
            <span className="material-symbols-outlined text-sm">inventory_2</span>
            Manage Products
          </button>
        </li>
        <li>
          <button
            onClick={() => {
              router.push(`/admin/materials?supplier=${supplier.id}`);
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
            <span className="material-symbols-outlined text-sm">description</span>
            View Orders
          </button>
        </li>
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-base-content">Suppliers</h1>
          <p className="text-sm text-base-content/60 mt-1">
            Manage supplier relationships and information
          </p>
        </div>
        <div className="flex gap-3">
          {isFetching && (
            <div className="flex items-center text-sm text-base-content/60">
              <span className="loading loading-spinner loading-xs mr-2"></span>
              Updating...
            </div>
          )}
          <button className="btn btn-sm btn-ghost" onClick={() => void reload()} title="Refresh data">
            <span className="material-symbols-outlined">refresh</span>
          </button>
          <div className="form-control">
            <div className="relative">
              <input
                type="text"
                placeholder="Search by name, code, email, country..."
                className="input input-bordered input-sm w-64 pl-10 pr-10"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 text-sm pointer-events-none">
                search
              </span>
              {searchInput && (
                <button
                  onClick={() => setSearchInput("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs btn-circle"
                  type="button"
                >
                  <span className="material-symbols-outlined text-xs">close</span>
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
                <button onClick={() => { setStatusFilter("all"); setCurrentPage(1); }}>All Status</button>
              </li>
              <li>
                <button onClick={() => { setStatusFilter("active"); setCurrentPage(1); }}>Active</button>
              </li>
              <li>
                <button onClick={() => { setStatusFilter("inactive"); setCurrentPage(1); }}>Inactive</button>
              </li>
              <li className="menu-title">
                <span>Type</span>
              </li>
              <li>
                <button onClick={() => { setTypeFilter("all"); setCurrentPage(1); }}>All Types</button>
              </li>
              <li>
                <button onClick={() => { setTypeFilter("local"); setCurrentPage(1); }}>Local</button>
              </li>
              <li>
                <button onClick={() => { setTypeFilter("foreign"); setCurrentPage(1); }}>Foreign</button>
              </li>
            </ul>
          </div>
          <button className="btn btn-sm btn-primary" onClick={() => setShowCreateModal(true)}>
            <span className="material-symbols-outlined">add</span>
            <span>Add Supplier</span>
          </button>
        </div>
      </div>

      <SummaryCards cards={summaryCards} columns={3} />

      {searchQuery && (
        <div className="text-sm text-base-content/60 flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">search</span>
          <span>
            Showing {totalItems} supplier{totalItems !== 1 ? "s" : ""} matching "{searchQuery}"
          </span>
        </div>
      )}

      {error && (
        <div className="alert alert-error">
          <span className="material-symbols-outlined">error</span>
          <span>{error}</span>
          <button className="btn btn-xs btn-ghost ml-auto" onClick={() => void reload()}>
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
        <>
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
        </>
      )}

        <CreateSupplierModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={reload}
      />

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

      {selectedSupplier && (
        <EditSupplierModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedSupplier(null);
          }}
          onUpdated={reload}
          supplier={selectedSupplier}
        />
      )}

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
              await reload();
            } catch (err) {
              logger.error("Failed to delete supplier:", err);
              showToast.error(
                err instanceof Error ? err.message : "Failed to delete supplier"
              );
            }
          }}
          supplier={selectedSupplier}
        />
      )}

      {selectedSupplier && (
        <ManageSupplierMaterialsModal
          isOpen={showManageMaterialsModal}
          onClose={() => {
            setShowManageMaterialsModal(false);
            setSelectedSupplier(null);
          }}
          onSaved={reload}
          supplier={selectedSupplier}
        />
      )}
    </div>
  );
}
