"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { DataTable } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { SummaryCards } from "@/components/SummaryCards";
import { DetailModal } from "@/components/DetailModal";
import { useAdmin } from "@/contexts/AdminContext";
import { ADMIN_ROUTES } from "@/lib/admin-roles";
import React from "react";

// Mock data - will be replaced with API calls
const deliveryPartners = [
  {
    id: "partner-1",
    partnerCode: "DP-001",
    companyName: "FastShip Express",
    contactPerson: "Robert Brown",
    email: "robert@fastship.com",
    phone: "+1-555-0201",
    serviceAreas: ["New York", "New Jersey", "Connecticut"],
    type: "local" as const,
    rating: 4.7,
    costPerDelivery: 15.50,
    status: "active",
  },
  {
    id: "partner-2",
    partnerCode: "DP-002",
    companyName: "Global Logistics",
    contactPerson: "Maria Garcia",
    email: "maria@globallog.com",
    phone: "+1-555-0202",
    serviceAreas: ["California", "Nevada", "Arizona"],
    type: "local" as const,
    rating: 4.5,
    costPerDelivery: 18.00,
    status: "active",
  },
  {
    id: "partner-3",
    partnerCode: "DP-003",
    companyName: "International Courier Services",
    contactPerson: "David Lee",
    email: "david@intlcourier.com",
    phone: "+1-555-0203",
    serviceAreas: ["International", "Cross-border"],
    type: "foreign" as const,
    rating: 4.2,
    costPerDelivery: 45.75,
    status: "active",
  },
];

export default function DeliveryPartnersPage() {
  const { hasPermission } = useAdmin();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<typeof deliveryPartners[0] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "local" | "foreign">("all");

  const canCreate = hasPermission(ADMIN_ROUTES.DELIVERY_PARTNERS, "create");
  const canEdit = hasPermission(ADMIN_ROUTES.DELIVERY_PARTNERS, "edit");
  const canDelete = hasPermission(ADMIN_ROUTES.DELIVERY_PARTNERS, "delete");

  const summary = {
    totalPartners: deliveryPartners.length,
    active: deliveryPartners.filter((p) => p.status === "active").length,
    local: deliveryPartners.filter((p) => p.type === "local").length,
    foreign: deliveryPartners.filter((p) => p.type === "foreign").length,
  };

  const filteredPartners = deliveryPartners.filter((partner) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query || (
      partner.companyName.toLowerCase().includes(query) ||
      partner.partnerCode.toLowerCase().includes(query) ||
      partner.email.toLowerCase().includes(query) ||
      partner.contactPerson.toLowerCase().includes(query) ||
      partner.phone.toLowerCase().includes(query) ||
      partner.status.toLowerCase().includes(query) ||
      partner.type.toLowerCase().includes(query) ||
      partner.rating.toString().includes(query) ||
      partner.costPerDelivery.toString().includes(query) ||
      partner.serviceAreas.some(area => area.toLowerCase().includes(query))
    );
    const matchesStatus = statusFilter === "all" || partner.status === statusFilter;
    const matchesType = typeFilter === "all" || partner.type === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const summaryCards = [
    {
      label: "Total Partners",
      value: summary.totalPartners,
      icon: "local_shipping",
      color: "primary" as const,
    },
    {
      label: "Active",
      value: summary.active,
      icon: "check_circle",
      color: "success" as const,
    },
    {
      label: "Local Partners",
      value: summary.local,
      icon: "location_on",
      color: "success" as const,
    },
    {
      label: "Foreign Partners",
      value: summary.foreign,
      icon: "public",
      color: "info" as const,
    },
  ];

  const columns = [
    {
      key: "partnerCode",
      label: "Partner Code",
      sortable: true,
    },
    {
      key: "companyName",
      label: "Company Name",
      render: (partner: typeof deliveryPartners[0]) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelectedPartner(partner);
            setShowDetailModal(true);
          }}
          className="font-semibold text-primary hover:underline text-left"
        >
          {partner.companyName}
        </button>
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
      key: "type",
      label: "Type",
      render: (partner: typeof deliveryPartners[0]) => (
        <span
          className={`badge ${
            partner.type === "local" ? "badge-success" : "badge-info"
          }`}
        >
          {partner.type === "local" ? "Local" : "Foreign"}
        </span>
      ),
      sortable: true,
    },
    {
      key: "serviceAreas",
      label: "Service Areas",
      render: (partner: typeof deliveryPartners[0]) => (
        <div className="flex flex-wrap gap-1">
          {partner.serviceAreas.slice(0, 2).map((area, idx) => (
            <span key={idx} className="badge badge-primary badge-sm whitespace-nowrap">
              {area}
            </span>
          ))}
          {partner.serviceAreas.length > 2 && (
            <span className="badge badge-info badge-sm whitespace-nowrap">
              +{partner.serviceAreas.length - 2}
            </span>
          )}
        </div>
      ),
    },
    {
      key: "rating",
      label: "Rating",
      render: (partner: typeof deliveryPartners[0]) => (
        <div className="flex items-center gap-1">
          <span className="text-warning">★</span>
          <span>{partner.rating.toFixed(1)}</span>
        </div>
      ),
      sortable: true,
    },
    {
      key: "costPerDelivery",
      label: "Cost per Delivery",
      render: (partner: typeof deliveryPartners[0]) => `$${partner.costPerDelivery.toFixed(2)}`,
      sortable: true,
    },
    {
      key: "status",
      label: "Status",
      render: (partner: typeof deliveryPartners[0]) => (
        <span className={`badge ${partner.status === "active" ? "badge-success" : "badge-error"}`}>
          {partner.status === "active" ? "Active" : "Inactive"}
        </span>
      ),
    },
  ];

  const renderActions = (partner: typeof deliveryPartners[0]) => (
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
              setSelectedPartner(partner);
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
                setSelectedPartner(partner);
                setShowEditModal(true);
              }}
            >
              <span className="material-symbols-outlined text-sm">edit</span>
              Edit Partner
            </button>
          </li>
        )}
        <li>
          <button
            onClick={() => {
              // Navigate to shipments page filtered by this partner
              window.location.href = `/admin/shipments?partner=${partner.id}`;
            }}
          >
            <span className="material-symbols-outlined text-sm">local_shipping</span>
            View Shipments
          </button>
        </li>
        <li>
          <button
            onClick={() => {
              // TODO: Open performance metrics modal or navigate to metrics page
              console.log("Viewing performance metrics for:", partner.id);
              alert(`Performance metrics for ${partner.companyName}:\n\n- Total Shipments: 245\n- On-Time Delivery: 98.5%\n- Average Rating: ${partner.rating}\n- Cost Efficiency: High`);
            }}
          >
            <span className="material-symbols-outlined text-sm">bar_chart</span>
            Performance Metrics
          </button>
        </li>
        {canDelete && (
          <li>
            <button 
              className="text-error"
              onClick={() => {
                if (confirm(`Are you sure you want to delete ${partner.companyName}? This action cannot be undone.`)) {
                  // TODO: API call to delete partner
                  console.log("Deleting partner:", partner.id);
                  alert("Partner deleted successfully!");
                }
              }}
            >
              <span className="material-symbols-outlined text-sm">delete</span>
              Delete Partner
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
          <h1 className="text-3xl font-bold text-base-content">Delivery Partners</h1>
          <p className="text-sm text-base-content/60 mt-1">Manage delivery partner relationships</p>
        </div>
        <div className="flex gap-3">
          <div className="form-control">
            <div className="relative">
              <input
                type="text"
                placeholder="Search by name, code, email, service areas..."
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
              <li className="menu-title">
                <span>Status</span>
              </li>
              <li>
                <button onClick={() => setStatusFilter("all")}>All Status</button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("active")}>Active</button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("inactive")}>Inactive</button>
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
                <button onClick={() => setTypeFilter("foreign")}>Foreign</button>
              </li>
            </ul>
          </div>
          {canCreate && (
            <button
              className="btn btn-sm btn-primary"
              onClick={() => setShowCreateModal(true)}
            >
              <span className="material-symbols-outlined">add</span>
              <span>Add Delivery Partner</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <SummaryCards cards={summaryCards} columns={3} />

      {/* Search Results Info */}
      {searchQuery && (
        <div className="text-sm text-base-content/60 flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">search</span>
          <span>Found {filteredPartners.length} partner{filteredPartners.length !== 1 ? 's' : ''} matching "{searchQuery}"</span>
        </div>
      )}

      {/* Delivery Partners Table */}
      <DataTable
        data={filteredPartners}
        columns={columns}
        keyExtractor={(partner) => partner.id}
        onRowClick={(partner) => {
          setSelectedPartner(partner);
          setShowDetailModal(true);
        }}
        actions={renderActions}
        emptyMessage={searchQuery ? `No delivery partners found matching "${searchQuery}"` : "No delivery partners found"}
      />

      {/* Create Delivery Partner Modal */}
      <CreateDeliveryPartnerModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />

      {/* Delivery Partner Detail Modal */}
      {selectedPartner && (
        <DeliveryPartnerDetailModal
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedPartner(null);
          }}
          partner={selectedPartner}
        />
      )}

      {/* Edit Delivery Partner Modal */}
      {selectedPartner && (
        <EditDeliveryPartnerModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedPartner(null);
          }}
          partner={selectedPartner}
        />
      )}

      {/* Listen for edit event from detail modal */}
      {typeof window !== 'undefined' && (
        <EditDeliveryPartnerListener
          onEdit={(partner) => {
            setShowDetailModal(false);
            setSelectedPartner(partner);
            setShowEditModal(true);
          }}
        />
      )}
    </div>
  );
}

// Edit Delivery Partner Event Listener Component
function EditDeliveryPartnerListener({ onEdit }: { onEdit: (partner: typeof deliveryPartners[0]) => void }) {
  React.useEffect(() => {
    const handleEdit = (event: CustomEvent) => {
      onEdit(event.detail);
    };
    window.addEventListener('editDeliveryPartner' as any, handleEdit as EventListener);
    return () => {
      window.removeEventListener('editDeliveryPartner' as any, handleEdit as EventListener);
    };
  }, [onEdit]);
  return null;
}

// Delivery Partner Detail Modal
function DeliveryPartnerDetailModal({
  isOpen,
  onClose,
  partner,
}: {
  isOpen: boolean;
  onClose: () => void;
  partner: typeof deliveryPartners[0];
}) {
  const { hasPermission } = useAdmin();
  const canEdit = hasPermission(ADMIN_ROUTES.DELIVERY_PARTNERS, "edit");
  
  return (
    <DetailModal isOpen={isOpen} onClose={onClose} title={`Delivery Partner: ${partner.companyName}`} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-base-content/60">Partner Code</label>
            <p className="font-semibold">{partner.partnerCode}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Contact Person</label>
            <p className="font-semibold">{partner.contactPerson}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Email</label>
            <p className="font-semibold">{partner.email}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Phone</label>
            <p className="font-semibold">{partner.phone}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Type</label>
            <p>
              <span
                className={`badge ${
                  partner.type === "local" ? "badge-success" : "badge-info"
                }`}
              >
                {partner.type === "local" ? "Local" : "Foreign"}
              </span>
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Rating</label>
            <p className="font-semibold">
              <span className="text-warning">★</span> {partner.rating.toFixed(1)}
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Cost per Delivery</label>
            <p className="font-semibold">${partner.costPerDelivery.toFixed(2)}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Status</label>
            <p>
              <span className={`badge ${partner.status === "active" ? "badge-success" : "badge-error"}`}>
                {partner.status === "active" ? "Active" : "Inactive"}
              </span>
            </p>
          </div>
        </div>
        <div>
          <label className="text-sm text-base-content/60">Service Areas</label>
          <div className="flex flex-wrap gap-2 mt-2">
            {partner.serviceAreas.map((area, idx) => (
              <span key={idx} className="badge badge-primary badge-sm whitespace-nowrap">{area}</span>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          {canEdit && (
            <button 
              className="btn btn-primary"
              onClick={() => {
                onClose();
                // Trigger edit modal - will be handled by parent
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('editDeliveryPartner', { detail: partner }));
                }
              }}
            >
              Edit Partner
            </button>
          )}
        </div>
      </div>
    </DetailModal>
  );
}

// Edit Delivery Partner Modal
function EditDeliveryPartnerModal({
  isOpen,
  onClose,
  partner,
}: {
  isOpen: boolean;
  onClose: () => void;
  partner: typeof deliveryPartners[0];
}) {
  const [formData, setFormData] = useState({
    partnerCode: partner.partnerCode,
    companyName: partner.companyName,
    contactPerson: partner.contactPerson,
    email: partner.email,
    phone: partner.phone,
    country: "", // Will be populated from partner data if available
    type: partner.type,
    serviceAreas: [...partner.serviceAreas],
    costPerDelivery: partner.costPerDelivery.toString(),
    rating: partner.rating.toString(),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: API call to update delivery partner
    console.log("Updating delivery partner:", formData);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Delivery Partner" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Partner Code *</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.partnerCode}
              onChange={(e) => setFormData({ ...formData, partnerCode: e.target.value })}
              required
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Company Name *</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
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
            onChange={(e) =>
              setFormData({ ...formData, country: e.target.value })
            }
            required
          >
            <option value="">Select country...</option>
            <option value="United States">United States</option>
            <option value="United Kingdom">United Kingdom</option>
            <option value="Canada">Canada</option>
            <option value="Australia">Australia</option>
            <option value="Germany">Germany</option>
            <option value="France">France</option>
            <option value="China">China</option>
            <option value="Japan">Japan</option>
            <option value="India">India</option>
            <option value="Sri Lanka">Sri Lanka</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Partner Type *</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={formData.type}
            onChange={(e) =>
              setFormData({ ...formData, type: e.target.value as "local" | "foreign" })
            }
            required
          >
            <option value="">Select type...</option>
            <option value="local">Local</option>
            <option value="foreign">Foreign</option>
          </select>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Service Areas *</span>
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {formData.serviceAreas.map((area, idx) => (
              <span key={idx} className="badge badge-primary gap-2">
                {area}
                <button
                  type="button"
                  onClick={() => {
                    setFormData({
                      ...formData,
                      serviceAreas: formData.serviceAreas.filter((_, i) => i !== idx),
                    });
                  }}
                  className="text-primary-content hover:text-error"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              className="input input-bordered flex-1"
              placeholder="Enter service area and press Enter"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const input = e.currentTarget;
                  if (input.value.trim()) {
                    setFormData({
                      ...formData,
                      serviceAreas: [...formData.serviceAreas, input.value.trim()],
                    });
                    input.value = "";
                  }
                }
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Cost per Delivery</span>
            </label>
            <div className="input-group">
              <span>$</span>
              <input
                type="number"
                step="0.01"
                className="input input-bordered w-full"
                value={formData.costPerDelivery}
                onChange={(e) => setFormData({ ...formData, costPerDelivery: e.target.value })}
              />
            </div>
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
            Update Partner
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Create Delivery Partner Modal
function CreateDeliveryPartnerModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [formData, setFormData] = useState({
    partnerCode: "",
    companyName: "",
    contactPerson: "",
    email: "",
    phone: "",
    address: "",
    country: "",
    type: "" as "local" | "foreign" | "",
    serviceAreas: [] as string[],
    costPerDelivery: "",
    rating: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: API call to create delivery partner
    console.log("Creating delivery partner:", formData);
    onClose();
    setFormData({
      partnerCode: "",
      companyName: "",
      contactPerson: "",
      email: "",
      phone: "",
      address: "",
      country: "",
      type: "" as "local" | "foreign" | "",
      serviceAreas: [],
      costPerDelivery: "",
      rating: "",
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Delivery Partner" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Partner Code *</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.partnerCode}
              onChange={(e) => setFormData({ ...formData, partnerCode: e.target.value })}
              required
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Company Name *</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
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
            onChange={(e) =>
              setFormData({ ...formData, country: e.target.value })
            }
            required
          >
            <option value="">Select country...</option>
            <option value="United States">United States</option>
            <option value="United Kingdom">United Kingdom</option>
            <option value="Canada">Canada</option>
            <option value="Australia">Australia</option>
            <option value="Germany">Germany</option>
            <option value="France">France</option>
            <option value="China">China</option>
            <option value="Japan">Japan</option>
            <option value="India">India</option>
            <option value="Sri Lanka">Sri Lanka</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Partner Type *</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={formData.type}
            onChange={(e) =>
              setFormData({ ...formData, type: e.target.value as "local" | "foreign" })
            }
            required
          >
            <option value="">Select type...</option>
            <option value="local">Local</option>
            <option value="foreign">Foreign</option>
          </select>
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

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Service Areas *</span>
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {formData.serviceAreas.map((area, idx) => (
              <span key={idx} className="badge badge-primary gap-2">
                {area}
                <button
                  type="button"
                  onClick={() => {
                    setFormData({
                      ...formData,
                      serviceAreas: formData.serviceAreas.filter((_, i) => i !== idx),
                    });
                  }}
                  className="text-primary-content hover:text-error"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              className="input input-bordered flex-1"
              placeholder="Enter service area and press Enter"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const input = e.currentTarget;
                  if (input.value.trim()) {
                    setFormData({
                      ...formData,
                      serviceAreas: [...formData.serviceAreas, input.value.trim()],
                    });
                    input.value = "";
                  }
                }
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Cost per Delivery</span>
            </label>
            <div className="input-group">
              <span>$</span>
              <input
                type="number"
                step="0.01"
                className="input input-bordered w-full"
                value={formData.costPerDelivery}
                onChange={(e) => setFormData({ ...formData, costPerDelivery: e.target.value })}
              />
            </div>
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
            Create Partner
          </button>
        </div>
      </form>
    </Modal>
  );
}

