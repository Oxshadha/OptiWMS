"use client";

import { useState, useEffect } from "react";
import clsx from "clsx";
import { DetailModal } from "@/components/DetailModal";
import { Modal } from "@/components/Modal";
import { useAdmin } from "@/contexts/AdminContext";
import { ADMIN_ROUTES } from "@/lib/admin-roles";
import { customersApi, Customer } from "@/lib/api/customers";
import { ordersApi } from "@/lib/api/orders";
import { showToast } from "@/lib/utils/toast";

// Display format for customers
interface CustomerDisplay {
  id: string;
  originalId?: string; // Original UUID for API calls
  name: string;
  contact: string;
  phone: string;
  orders: number;
  status: string;
  joinDate: string;
}

const mockCustomers: CustomerDisplay[] = [
  {
    id: "CUST-001",
    name: "Acme Corp",
    contact: "alice@acme.com",
    phone: "+1 234-567-8900",
    orders: 42,
    status: "Active",
    joinDate: "2023-01-15",
  },
  {
    id: "CUST-002",
    name: "Bright Retail",
    contact: "ops@bright.com",
    phone: "+1 234-567-8901",
    orders: 18,
    status: "Active",
    joinDate: "2023-03-22",
  },
  {
    id: "CUST-003",
    name: "Delta Mart",
    contact: "supply@delta.com",
    phone: "+1 234-567-8902",
    orders: 9,
    status: "On Hold",
    joinDate: "2023-06-10",
  },
  {
    id: "CUST-004",
    name: "Echo Stores",
    contact: "contact@echo.com",
    phone: "+1 234-567-8903",
    orders: 25,
    status: "Active",
    joinDate: "2023-02-08",
  },
];

const statusClass = (s: string) => {
  if (s === "Active") return "badge-success";
  if (s === "On Hold") return "badge-warning";
  return "badge-outline";
};

export default function CustomersPage() {
  const { hasPermission } = useAdmin();
  const canCreate = hasPermission(ADMIN_ROUTES.CUSTOMERS, "create");
  const canDelete = hasPermission(ADMIN_ROUTES.CUSTOMERS, "delete");
  const [searchQuery, setSearchQuery] = useState("");
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"name" | "orders" | "joinDate" | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDisplay | null>(null);
  
  // API state
  const [customers, setCustomers] = useState<CustomerDisplay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load data from API
  const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const [customersData, ordersData] = await Promise.all([
          customersApi.getAll(),
          ordersApi.getAllOutbound(),
        ]);
        
        // Count orders per customer
        const orderCounts = new Map<string, number>();
        ordersData.forEach((order) => {
          if (order.customerId) {
            orderCounts.set(order.customerId, (orderCounts.get(order.customerId) || 0) + 1);
          }
        });
        
        // Transform to display format with shorter IDs
        const displayCustomers: CustomerDisplay[] = customersData.map((c) => {
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
            joinDate: new Date().toISOString().split("T")[0], // TODO: Get from customer data
          };
        });
        
        setCustomers(displayCustomers);
      } catch (err) {
        console.error("Failed to load customers:", err);
        setError(err instanceof Error ? err.message : "Failed to load customers");
        setCustomers([]);
        if (err instanceof Error && !err.message.includes("Not authenticated")) {
          showToast.error("Failed to load customers. Please try again.");
        }
      } finally {
        setIsLoading(false);
      }
    };

  useEffect(() => {
    loadData();
  }, []);

  // Listen for reload events
  useEffect(() => {
    const handleReload = () => {
      loadData();
    };
    window.addEventListener('reloadCustomers', handleReload);
    return () => {
      window.removeEventListener('reloadCustomers', handleReload);
    };
  }, []);

  let filteredCustomers = customers.filter((c) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      c.name.toLowerCase().includes(query) ||
      c.contact.toLowerCase().includes(query) ||
      c.id.toLowerCase().includes(query) ||
      c.phone.toLowerCase().includes(query) ||
      c.status.toLowerCase().includes(query) ||
      c.orders.toString().includes(query) ||
      c.joinDate.toLowerCase().includes(query);
    const matchesStatus =
      statusFilter === "all" ||
      c.status.toLowerCase() === statusFilter.toLowerCase();
    return matchesSearch && matchesStatus;
  });

  // Apply sorting
  if (sortBy) {
    filteredCustomers = [...filteredCustomers].sort((a, b) => {
      let aVal: any = a[sortBy];
      let bVal: any = b[sortBy];
      if (sortBy === "orders") {
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

  const totalCustomers = customers.length;
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
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => window.location.reload()}
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
                <button
                  onClick={() => {
                    setSortBy("joinDate");
                    setSortDirection(
                      sortBy === "joinDate" && sortDirection === "desc"
                        ? "asc"
                        : "desc"
                    );
                  }}
                >
                  Join Date{" "}
                  {sortBy === "joinDate" &&
                    (sortDirection === "desc" ? "↓" : "↑")}
                </button>
              </li>
              <li>
                <button onClick={() => setSortBy(null)}>Clear Sort</button>
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
                <button onClick={() => setStatusFilter("on hold")}>
                  On Hold
                </button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("inactive")}>
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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </label>
        </div>
      </div>

      {/* Customers Table */}
      <div className="card bg-base-100 border border-base-300 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead className="bg-base-200">
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
              {filteredCustomers.map((c) => (
                <tr key={c.id} className="hover:bg-base-200/50">
                  <td className="font-semibold text-primary">{c.id}</td>
                  <td className="font-medium">{c.name}</td>
                  <td className="text-base-content/70">{c.contact}</td>
                  <td className="text-base-content/70">{c.phone}</td>
                  <td>{c.orders}</td>
                  <td>
                    <span className={`badge ${statusClass(c.status)}`}>
                      {c.status}
                    </span>
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
        {filteredCustomers.length === 0 && (
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

      {/* Customer Detail Modal */}
      {selectedCustomer && (
        <CustomerDetailModal
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedCustomer(null);
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
          customer={selectedCustomer}
        />
      )}

      {/* Add Customer Modal */}
      <AddCustomerModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
      />

      {/* Delete Customer Modal */}
      {selectedCustomer && (
        <DeleteCustomerModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedCustomer(null);
          }}
          onConfirm={() => {
            try {
              const customerId = selectedCustomer.originalId || selectedCustomer.id;
              await customersApi.delete(customerId);
              showToast.success("Customer deleted successfully");
              setShowDeleteModal(false);
              setSelectedCustomer(null);
              // Reload data
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('reloadCustomers'));
              }
            } catch (err) {
              console.error("Failed to delete customer:", err);
              showToast.error(err instanceof Error ? err.message : "Failed to delete customer");
            }
          }}
          customer={selectedCustomer}
        />
      )}
    </div>
  );
}

// Add Customer Modal
function AddCustomerModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    name: "",
    contact: "",
    phone: "",
    status: "Active",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const createData: Omit<Customer, 'id'> = {
        name: formData.name,
        email: formData.contact || undefined,
        phone: formData.phone || undefined,
        status: formData.status.toLowerCase(),
      };

      await customersApi.create(createData);
      showToast.success("Customer added successfully");
      onClose();
      // Reset form
      setFormData({
        name: "",
        contact: "",
        phone: "",
        status: "Active",
      });
      // Reload data
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('reloadCustomers'));
      }
    } catch (err) {
      console.error("Failed to add customer:", err);
      showToast.error(err instanceof Error ? err.message : "Failed to add customer");
    }
  };

  return (
    <DetailModal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Customer"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Customer Name *</span>
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
            <span className="label-text font-medium">Contact Email *</span>
          </label>
          <input
            type="email"
            className="input input-bordered w-full"
            value={formData.contact}
            onChange={(e) =>
              setFormData({ ...formData, contact: e.target.value })
            }
            required
          />
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
            <span className="label-text font-medium">Status</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={formData.status}
            onChange={(e) =>
              setFormData({ ...formData, status: e.target.value })
            }
          >
            <option value="Active">Active</option>
            <option value="On Hold">On Hold</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Add Customer
          </button>
        </div>
      </form>
    </DetailModal>
  );
}

// Customer Detail Modal
function CustomerDetailModal({
  isOpen,
  onClose,
  customer,
}: {
  isOpen: boolean;
  onClose: () => void;
  customer: CustomerDisplay;
}) {
  return (
    <DetailModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Customer: ${customer.name}`}
      size="lg"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-base-content/60">Customer ID</label>
            <p className="font-semibold">{customer.id}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Status</label>
            <p>
              <span className={`badge ${statusClass(customer.status)}`}>
                {customer.status}
              </span>
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">
              Contact Email
            </label>
            <p className="font-semibold">{customer.contact}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Phone</label>
            <p className="font-semibold">{customer.phone}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Total Orders</label>
            <p className="font-semibold">{customer.orders}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Join Date</label>
            <p className="font-semibold">{customer.joinDate}</p>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          <button className="btn btn-primary">Edit Customer</button>
        </div>
      </div>
    </DetailModal>
  );
}

// Customer Edit Modal
function CustomerEditModal({
  isOpen,
  onClose,
  customer,
}: {
  isOpen: boolean;
  onClose: () => void;
  customer: CustomerDisplay;
}) {
  const [formData, setFormData] = useState({
    name: customer.name,
    contact: customer.contact,
    phone: customer.phone,
    status: customer.status,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const customerId = customer.originalId || customer.id;
      const updateData: Partial<Customer> = {
        name: formData.name,
        email: formData.contact || undefined,
        phone: formData.phone || undefined,
        status: formData.status.toLowerCase(),
      };

      await customersApi.update(customerId, updateData);
      showToast.success("Customer updated successfully");
      onClose();
      // Reload data
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('reloadCustomers'));
      }
    } catch (err) {
      console.error("Failed to update customer:", err);
      showToast.error(err instanceof Error ? err.message : "Failed to update customer");
    }
  };

  return (
    <DetailModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Customer: ${customer.name}`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Customer Name *</span>
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
            <span className="label-text font-medium">Contact Email *</span>
          </label>
          <input
            type="email"
            className="input input-bordered w-full"
            value={formData.contact}
            onChange={(e) =>
              setFormData({ ...formData, contact: e.target.value })
            }
            required
          />
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
            <span className="label-text font-medium">Status</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={formData.status}
            onChange={(e) =>
              setFormData({ ...formData, status: e.target.value })
            }
          >
            <option value="Active">Active</option>
            <option value="On Hold">On Hold</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Save Changes
          </button>
        </div>
      </form>
    </DetailModal>
  );
}

// Delete Customer Modal
function DeleteCustomerModal({
  isOpen,
  onClose,
  onConfirm,
  customer,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  customer: CustomerDisplay;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Customer" size="md">
      <div className="space-y-4">
        <div className="alert alert-warning">
          <span className="material-symbols-outlined">warning</span>
          <div>
            <h3 className="font-bold">
              Warning: This action cannot be undone!
            </h3>
            <div className="text-sm">
              You are about to delete <strong>{customer.name}</strong> (Customer
              ID: {customer.id}). This will permanently remove the customer from
              the system and all associated data.
            </div>
          </div>
        </div>
        <div className="bg-base-200 rounded-lg p-4">
          <p className="text-sm text-base-content/70">
            <strong>Customer Name:</strong> {customer.name}
          </p>
          <p className="text-sm text-base-content/70">
            <strong>Customer ID:</strong> {customer.id}
          </p>
          <p className="text-sm text-base-content/70">
            <strong>Contact:</strong> {customer.contact}
          </p>
          <p className="text-sm text-base-content/70">
            <strong>Total Orders:</strong> {customer.orders}
          </p>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-error" onClick={onConfirm}>
            <span className="material-symbols-outlined">delete</span>
            Delete Customer
          </button>
        </div>
      </div>
    </Modal>
  );
}
