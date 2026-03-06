"use client";

import { useMemo, useState, useEffect } from "react";
import { useAdmin } from "@/contexts/AdminContext";
import { ADMIN_ROUTES } from "@/lib/admin-roles";
import { customersApi } from "@/lib/api/customers";
import { ordersApi } from "@/lib/api/orders";
import { Pagination } from "@/components/Pagination";
import { StatusChip } from "@/components/StatusChip";
import { useInvalidateAdminList, usePagedAdminQuery } from "@/lib/hooks/useQuery";
import { showToast } from "@/lib/utils/toast";
import { logger } from "@/lib/utils/logger";
import { CustomerDisplay, customerStatusTone } from "./types";
import {
  AddCustomerModal,
  CustomerDetailModal,
  CustomerEditModal,
  DeleteCustomerModal,
} from "./components/CustomerModals";

export default function CustomersPage() {
  const { hasPermission } = useAdmin();
  const canCreate = hasPermission(ADMIN_ROUTES.CUSTOMERS, "create");
  const canDelete = hasPermission(ADMIN_ROUTES.CUSTOMERS, "delete");
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"name" | "orders" | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDisplay | null>(null);

  const customersQuery = usePagedAdminQuery({
    queryKey: [
      "admin-customers",
      currentPage,
      itemsPerPage,
      statusFilter,
      sortBy,
      sortDirection,
      searchQuery,
    ],
    queryFn: async () => {
      const customersPage = await customersApi.getPaged({
          page: currentPage - 1,
          size: itemsPerPage,
          sortBy: sortBy === "name" ? "name" : "createdAt",
          sortDir: sortDirection,
          status: statusFilter === "all" ? undefined : statusFilter,
          q: searchQuery.trim() || undefined,
        });

        const orderCounts = new Map<string, number>();
        await Promise.all(
          customersPage.data.map(async (customer) => {
            try {
              const out = await ordersApi.getPaged({
                page: 0,
                size: 1,
                orderType: "outbound",
                customerId: customer.id,
              });
              orderCounts.set(customer.id, out.totalElements);
            } catch {
              orderCounts.set(customer.id, 0);
            }
          })
        );
        
        // Transform to display format with shorter IDs
        const displayCustomers: CustomerDisplay[] = customersPage.data.map((c) => {
          // Create shorter, more intuitive ID using first 8 characters of UUID
          // Format: CUST-XXXXXXXX (e.g., CUST-d07b7d74)
          const shortId = `CUST-${c.id.substring(0, 8)}`;
          return {
            id: shortId, // Display short ID
            originalId: c.id, // Keep original ID for API calls
            name: c.name,
            contact: c.email || "",
            phone: c.phone || "",
            orders: orderCounts.get(c.id) || 0,
            status: c.status === "active" ? "Active" : "On Hold",
          };
        });
        
      const sortedCustomers =
        sortBy === "orders"
          ? [...displayCustomers].sort((a, b) =>
              sortDirection === "asc" ? a.orders - b.orders : b.orders - a.orders
            )
          : displayCustomers;

      return {
        data: sortedCustomers,
        totalElements: customersPage.totalElements,
        totalPages: customersPage.totalPages,
      };
    },
  });
  const reload = useInvalidateAdminList(["admin-customers"]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const customers = useMemo(
    () => customersQuery.data?.data || [],
    [customersQuery.data]
  );
  const isLoading = customersQuery.isPending && !customersQuery.data;
  const isFetching = customersQuery.isFetching;
  const error = customersQuery.error
    ? customersQuery.error instanceof Error
      ? customersQuery.error.message
      : "Failed to load customers"
    : null;
  const totalItems = customersQuery.data?.totalElements ?? 0;
  const totalPages = Math.max(customersQuery.data?.totalPages ?? 1, 1);
  const totalCustomers = totalItems;
  const activeCustomers = customers.filter((c) => c.status === "Active").length;
  const totalOrders = customers.reduce((sum, c) => sum + c.orders, 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-base-content">
          Customers ({totalCustomers})
        </h1>
        <div className="flex gap-3">
          {isFetching && (
            <div className="flex items-center text-sm text-base-content/60">
              <span className="loading loading-spinner loading-xs mr-2"></span>
              Updating...
            </div>
          )}
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => void reload()}
            title="Refresh data"
          >
            <span className="material-symbols-outlined">refresh</span>
          </button>
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
                <button
                  onClick={() => {
                    setSortBy("name");
                    setCurrentPage(1);
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
                    setSortBy("orders");
                    setCurrentPage(1);
                    setSortDirection(
                      sortBy === "orders" && sortDirection === "desc"
                        ? "asc"
                        : "desc"
                    );
                  }}
                >
                  Orders{" "}
                  {sortBy === "orders" &&
                    (sortDirection === "desc" ? "↓" : "↑")}
                </button>
              </li>
              <li>
                <button onClick={() => {
                  setSortBy(null);
                  setCurrentPage(1);
                }}>Clear Sort</button>
              </li>
            </ul>
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
              <li>
                <button onClick={() => {
                  setStatusFilter("all");
                  setCurrentPage(1);
                }}>
                  All Status
                </button>
              </li>
              <li>
                <button onClick={() => {
                  setStatusFilter("active");
                  setCurrentPage(1);
                }}>
                  Active
                </button>
              </li>
              <li>
                <button onClick={() => {
                  setStatusFilter("on hold");
                  setCurrentPage(1);
                }}>
                  On Hold
                </button>
              </li>
              <li>
                <button onClick={() => {
                  setStatusFilter("inactive");
                  setCurrentPage(1);
                }}>
                  Inactive
                </button>
              </li>
            </ul>
          </div>
          {canCreate && (
            <button
              className="btn btn-sm btn-primary"
              onClick={() => setShowAddModal(true)}
            >
              <span className="material-symbols-outlined">add</span>
              <span>Add Customer</span>
            </button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card bg-base-100 border border-base-300 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-base-content/60">
                Total Customers
              </div>
              <div className="text-2xl font-bold text-base-content">
                {totalCustomers}
              </div>
            </div>
            <span className="material-symbols-outlined text-3xl text-primary">
              group
            </span>
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-base-content/60">Active</div>
              <div className="text-2xl font-bold text-success">
                {activeCustomers}
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
              <div className="text-sm text-base-content/60">Total Orders</div>
              <div className="text-2xl font-bold text-base-content">
                {totalOrders}
              </div>
            </div>
            <span className="material-symbols-outlined text-3xl text-info">
              inventory_2
            </span>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-4 items-center">
        <div className="flex-1">
          <label className="input input-bordered flex items-center gap-2 w-full">
            <span className="material-symbols-outlined text-base-content/60">
              search
            </span>
            <input
              type="text"
              className="grow"
              placeholder="Search customers by name, email, or ID..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </label>
        </div>
      </div>

      {/* Customers Table */}
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
            <span>Loading customers...</span>
          </div>
        </div>
      )}
      <div className="card bg-base-100 border border-base-300 rounded-xl overflow-hidden">
        <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)]">
          <table className="table w-full">
            <thead className="bg-base-200 [&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-base-200">
              <tr>
                <th className="font-semibold text-base-content">Customer ID</th>
                <th className="font-semibold text-base-content">Name</th>
                <th className="font-semibold text-base-content">Contact</th>
                <th className="font-semibold text-base-content">Phone</th>
                <th className="font-semibold text-base-content">Orders</th>
                <th className="font-semibold text-base-content">Status</th>
                <th className="font-semibold text-base-content">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!isLoading &&
                customers.map((c) => (
                <tr key={c.id} className="hover:bg-base-200/50">
                  <td className="font-semibold text-primary">{c.id}</td>
                  <td className="font-medium">{c.name}</td>
                  <td className="text-base-content/70">{c.contact}</td>
                  <td className="text-base-content/70">{c.phone}</td>
                  <td>{c.orders}</td>
                  <td>
                    <StatusChip label={c.status} tone={customerStatusTone(c.status)} showDot />
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button
                        className="btn btn-ghost btn-xs"
                        title="View"
                        onClick={() => {
                          setSelectedCustomer(c);
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
                          setSelectedCustomer(c);
                          setShowEditModal(true);
                        }}
                      >
                        <span className="material-symbols-outlined text-sm">
                          edit
                        </span>
                      </button>
                      {canDelete && (
                        <button
                          className="btn btn-ghost btn-xs text-error"
                          title="Delete"
                          onClick={() => {
                            setSelectedCustomer(c);
                            setShowDeleteModal(true);
                          }}
                        >
                          <span className="material-symbols-outlined text-sm">
                            delete
                          </span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!isLoading && customers.length === 0 && (
          <div className="p-12 text-center">
            <span className="material-symbols-outlined text-6xl text-base-content/30 mb-4">
              group
            </span>
            <h3 className="text-lg font-semibold text-base-content mb-2">
              No customers found
            </h3>
            <p className="text-sm text-base-content/60">
              Try adjusting your search query
            </p>
          </div>
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

      {/* Customer Detail Modal */}
      {selectedCustomer && (
        <CustomerDetailModal
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedCustomer(null);
          }}
          onEdit={(customer) => {
            setShowDetailModal(false);
            setSelectedCustomer(customer);
            setShowEditModal(true);
          }}
          customer={selectedCustomer}
        />
      )}

      {/* Customer Edit Modal */}
      {selectedCustomer && (
        <CustomerEditModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedCustomer(null);
          }}
          onUpdated={reload}
          customer={selectedCustomer}
        />
      )}

      {/* Add Customer Modal */}
      <AddCustomerModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={reload}
      />

      {/* Delete Customer Modal */}
      {selectedCustomer && (
        <DeleteCustomerModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedCustomer(null);
          }}
          onConfirm={async () => {
            try {
              const customerId = selectedCustomer.originalId || selectedCustomer.id;
              await customersApi.delete(customerId);
              showToast.success("Customer deleted successfully");
              setShowDeleteModal(false);
              setSelectedCustomer(null);
              await reload();
            } catch (err) {
              logger.error("Failed to delete customer:", err);
              showToast.error(err instanceof Error ? err.message : "Failed to delete customer");
            }
          }}
          customer={selectedCustomer}
        />
      )}
    </div>
  );
}
