"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { DataTable } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { SummaryCards } from "@/components/SummaryCards";
import { DetailModal } from "@/components/DetailModal";
import React from "react";
import { suppliersApi, Supplier } from "@/lib/api/suppliers";

// Extended supplier interface for display
interface SupplierDisplay extends Supplier {
  supplierCode?: string;
  productsSupplied?: number;
}
  {
    id: "supplier-1",
    supplierCode: "SUP-001",
    name: "Tech Supplies Inc",
    country: "United States",
    contactPerson: "John Smith",
    email: "john@techsupplies.com",
    phone: "+1-555-0101",
    productsSupplied: 45,
    leadTimeDays: 7,
    rating: 4.5,
    status: "active",
  },
  {
    id: "supplier-2",
    supplierCode: "SUP-002",
    name: "Global Electronics",
    country: "China",
    contactPerson: "Li Wei",
    email: "li@globalelec.com",
    phone: "+86-555-0102",
    productsSupplied: 32,
    leadTimeDays: 14,
    rating: 4.2,
    status: "active",
  },
  {
    id: "supplier-3",
    supplierCode: "SUP-003",
    name: "Quality Goods Co",
    country: "United Kingdom",
    contactPerson: "Emma Johnson",
    email: "emma@qualitygoods.co.uk",
    phone: "+44-555-0103",
    productsSupplied: 28,
    leadTimeDays: 10,
    rating: 4.8,
    status: "active",
  },
];

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<SupplierDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierDisplay | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Load suppliers from API
  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await suppliersApi.getAll();
      // Map API data to display format
      const displayData: SupplierDisplay[] = data.map(s => ({
        ...s,
        supplierCode: s.code,
        productsSupplied: 0, // TODO: Calculate from materials API
      }));
      setSuppliers(displayData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load suppliers");
      console.error("Error loading suppliers:", err);
    } finally {
      setLoading(false);
    }
  };

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
        <span>Error loading suppliers: {error}</span>
        <button className="btn btn-sm" onClick={loadSuppliers}>Retry</button>
      </div>
    );
  }

  const summary = {
    totalSuppliers: suppliers.length,
    active: suppliers.filter(s => s.status === "active" || s.status === "Active").length,
    byCountry: new Set(suppliers.map(s => s.country)).size,
  };

  const filteredSuppliers = suppliers.filter((supplier) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = query === "" || 
      supplier.name.toLowerCase().includes(query) ||
      supplier.supplierCode.toLowerCase().includes(query) ||
      supplier.email.toLowerCase().includes(query) ||
      supplier.contactPerson.toLowerCase().includes(query) ||
      supplier.country.toLowerCase().includes(query) ||
      supplier.phone.toLowerCase().includes(query) ||
      supplier.productsSupplied.toString().includes(query) ||
      supplier.leadTimeDays.toString().includes(query) ||
      supplier.rating.toString().includes(query) ||
      supplier.status.toLowerCase().includes(query);
    const matchesStatus = statusFilter === "all" || supplier.status === statusFilter;
    return matchesSearch && matchesStatus;
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
      label: "Countries",
      value: summary.byCountry,
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
      render: (supplier: typeof suppliers[0]) => (
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
      render: (supplier: typeof suppliers[0]) => `${supplier.leadTimeDays} days`,
      sortable: true,
    },
    {
      key: "rating",
      label: "Rating",
      render: (supplier: typeof suppliers[0]) => (
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
      render: (supplier: typeof suppliers[0]) => (
        <span className={`badge ${supplier.status === "active" ? "badge-success" : "badge-error"}`}>
          {supplier.status === "active" ? "Active" : "Inactive"}
        </span>
      ),
    },
  ];

  const renderActions = (supplier: typeof suppliers[0]) => (
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
              // Navigate to products page filtered by supplier
              window.location.href = `/admin/products?supplier=${supplier.id}`;
            }}
          >
            <span className="material-symbols-outlined text-sm">inventory</span>
            View Products
          </button>
        </li>
        <li>
          <button
            onClick={() => {
              // Navigate to inbound orders page filtered by supplier
              window.location.href = `/admin/orders/inbound?supplier=${supplier.id}`;
            }}
          >
            <span className="material-symbols-outlined text-sm">description</span>
            View Orders
          </button>
        </li>
        <li>
          <button 
            className="text-error"
            onClick={() => {
              if (confirm(`Are you sure you want to delete ${supplier.name}?`)) {
                // TODO: API call to delete supplier
                console.log("Deleting supplier:", supplier.id);
              }
            }}
          >
            <span className="material-symbols-outlined text-sm">delete</span>
            Delete Supplier
          </button>
        </li>
      </ul>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-base-content">Suppliers</h1>
          <p className="text-sm text-base-content/60 mt-1">Manage supplier relationships and information</p>
        </div>
        <div className="flex gap-3">
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
              <li>
                <button onClick={() => setStatusFilter("all")}>All Status</button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("active")}>Active</button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("inactive")}>Inactive</button>
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
          <span>Found {filteredSuppliers.length} supplier{filteredSuppliers.length !== 1 ? 's' : ''} matching "{searchQuery}"</span>
        </div>
      )}

      {/* Suppliers Table */}
      <DataTable
        data={filteredSuppliers}
        columns={columns}
        keyExtractor={(supplier) => supplier.id}
        onRowClick={(supplier) => {
          setSelectedSupplier(supplier);
          setShowDetailModal(true);
        }}
        actions={renderActions}
        emptyMessage={searchQuery ? `No suppliers found matching "${searchQuery}"` : "No suppliers found"}
      />

      {/* Create Supplier Modal */}
      <CreateSupplierModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />

      {/* Supplier Detail Modal */}
      {selectedSupplier && (
        <SupplierDetailModal
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedSupplier(null);
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
          supplier={selectedSupplier}
        />
      )}

      {/* Listen for edit event from detail modal */}
      {typeof window !== 'undefined' && (
        <EditSupplierListener
          onEdit={(supplier) => {
            setShowDetailModal(false);
            setSelectedSupplier(supplier);
            setShowEditModal(true);
          }}
        />
      )}
    </div>
  );
}

// Edit Supplier Event Listener Component
function EditSupplierListener({ onEdit }: { onEdit: (supplier: typeof suppliers[0]) => void }) {
  React.useEffect(() => {
    const handleEdit = (event: CustomEvent) => {
      onEdit(event.detail);
    };
    window.addEventListener('editSupplier' as any, handleEdit as EventListener);
    return () => {
      window.removeEventListener('editSupplier' as any, handleEdit as EventListener);
    };
  }, [onEdit]);
  return null;
}

// Supplier Detail Modal
function SupplierDetailModal({
  isOpen,
  onClose,
  supplier,
}: {
  isOpen: boolean;
  onClose: () => void;
  supplier: typeof suppliers[0];
}) {
  return (
    <DetailModal isOpen={isOpen} onClose={onClose} title={`Supplier: ${supplier.name}`} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-base-content/60">Supplier Code</label>
            <p className="font-semibold">{supplier.supplierCode}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Country</label>
            <p className="font-semibold">{supplier.country}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Contact Person</label>
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
            <label className="text-sm text-base-content/60">Products Supplied</label>
            <p className="font-semibold">{supplier.productsSupplied}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Lead Time</label>
            <p className="font-semibold">{supplier.leadTimeDays} days</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Rating</label>
            <p className="font-semibold">
              <span className="text-warning">★</span> {supplier.rating.toFixed(1)}
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Status</label>
            <p>
              <span className={`badge ${supplier.status === "active" ? "badge-success" : "badge-error"}`}>
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
              onClose();
              // Trigger edit modal - will be handled by parent
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('editSupplier', { detail: supplier }));
              }
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
  supplier,
}: {
  isOpen: boolean;
  onClose: () => void;
  supplier: typeof suppliers[0];
}) {
  const [formData, setFormData] = useState({
    supplierCode: supplier.supplierCode,
    name: supplier.name,
    contactPerson: supplier.contactPerson,
    email: supplier.email,
    phone: supplier.phone,
    country: supplier.country,
    leadTimeDays: supplier.leadTimeDays.toString(),
    rating: supplier.rating.toString(),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: API call to update supplier
    console.log("Updating supplier:", formData);
    onClose();
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
              onChange={(e) => setFormData({ ...formData, supplierCode: e.target.value })}
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
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
              onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
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
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Country *</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={formData.country}
            onChange={(e) => setFormData({ ...formData, country: e.target.value })}
            required
          >
            <option value="United States">United States</option>
            <option value="United Kingdom">United Kingdom</option>
            <option value="China">China</option>
            <option value="Canada">Canada</option>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Average Lead Time (days)</span>
            </label>
            <input
              type="number"
              className="input input-bordered w-full"
              value={formData.leadTimeDays}
              onChange={(e) => setFormData({ ...formData, leadTimeDays: e.target.value })}
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
              onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
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
function CreateSupplierModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [formData, setFormData] = useState({
    supplierCode: "",
    name: "",
    contactPerson: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    country: "",
    postalCode: "",
    paymentTerms: "",
    leadTimeDays: "",
    rating: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: API call to create supplier
    console.log("Creating supplier:", formData);
    onClose();
    setFormData({
      supplierCode: "",
      name: "",
      contactPerson: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      country: "",
      postalCode: "",
      paymentTerms: "",
      leadTimeDays: "",
      rating: "",
    });
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
              onChange={(e) => setFormData({ ...formData, supplierCode: e.target.value })}
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
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
              onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
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
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
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
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">City</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.city}
              onChange={(e) => setFormData({ ...formData, city: e.target.value })}
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">State/Province</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Country *</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={formData.country}
              onChange={(e) => setFormData({ ...formData, country: e.target.value })}
              required
            >
              <option value="">Select country</option>
              <option value="United States">United States</option>
              <option value="United Kingdom">United Kingdom</option>
              <option value="China">China</option>
              <option value="Canada">Canada</option>
            </select>
          </div>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Postal Code</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={formData.postalCode}
            onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
          />
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Payment Terms</span>
          </label>
          <textarea
            className="textarea textarea-bordered w-full"
            rows={2}
            value={formData.paymentTerms}
            onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
            placeholder="e.g., Net 30, COD, etc."
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Average Lead Time (days)</span>
            </label>
            <input
              type="number"
              className="input input-bordered w-full"
              value={formData.leadTimeDays}
              onChange={(e) => setFormData({ ...formData, leadTimeDays: e.target.value })}
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
              onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
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

