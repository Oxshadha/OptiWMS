"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/DataTable";
import { SummaryCards } from "@/components/SummaryCards";
import { useAdmin } from "@/contexts/AdminContext";
import { ADMIN_ROUTES } from "@/lib/admin-roles";
import { deliveryPartnersApi, DeliveryPartner as ApiDeliveryPartner } from "@/lib/api/deliveryPartners";
import { showToast } from "@/lib/utils/toast";
import { logger } from "@/lib/utils/logger";
import { formatCurrency } from "./utils";
import type { DeliveryPartnerDisplay } from "./types";
import {
  CreateDeliveryPartnerModal,
  DeleteDeliveryPartnerModal,
  DeliveryPartnerDetailModal,
  EditDeliveryPartnerModal,
} from "./components/DeliveryPartnerModals";


export default function DeliveryPartnersPage() {
  const router = useRouter();
  const { hasPermission } = useAdmin();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedPartner, setSelectedPartner] = useState<DeliveryPartnerDisplay | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "local" | "foreign">("all");

  const canCreate = hasPermission(ADMIN_ROUTES.DELIVERY_PARTNERS, "create");
  const canEdit = hasPermission(ADMIN_ROUTES.DELIVERY_PARTNERS, "edit");
  const canDelete = hasPermission(ADMIN_ROUTES.DELIVERY_PARTNERS, "delete");

  // API state
  const [deliveryPartners, setDeliveryPartners] = useState<DeliveryPartnerDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Function to transform API data to display format
  const transformPartnerData = (p: ApiDeliveryPartner): DeliveryPartnerDisplay => {
    // Parse service areas from JSON string
    let serviceAreas: string[] = [];
    if (p.serviceAreas) {
      try {
        const parsed = typeof p.serviceAreas === 'string' ? JSON.parse(p.serviceAreas) : p.serviceAreas;
        
        // Handle different JSON structures
        if (Array.isArray(parsed)) {
          // Direct array: ["Colombo", "Kandy"]
          serviceAreas = parsed;
        } else if (parsed && typeof parsed === 'object') {
          // Object with keys: {"districts": [...]} or {"countries": [...]} or {"serviceAreas": [...]}
          if (parsed.districts && Array.isArray(parsed.districts)) {
            serviceAreas = parsed.districts;
          } else if (parsed.countries && Array.isArray(parsed.countries)) {
            serviceAreas = parsed.countries;
          } else if (parsed.serviceAreas && Array.isArray(parsed.serviceAreas)) {
            serviceAreas = parsed.serviceAreas;
          } else {
            // Try to extract any array value from the object
            const values = Object.values(parsed);
            const firstArray = values.find(v => Array.isArray(v)) as string[] | undefined;
            serviceAreas = firstArray || [];
          }
        } else {
          serviceAreas = [String(p.serviceAreas)];
        }
      } catch (e) {
        // If parsing fails, treat as string
        serviceAreas = typeof p.serviceAreas === 'string' ? [p.serviceAreas] : [];
      }
    }

    // Infer type from country or service areas
    const isForeign = p.country && p.country.toLowerCase() !== "usa" && p.country.toLowerCase() !== "united states";
    const type: "local" | "foreign" = isForeign || serviceAreas.some(area => 
      area.toLowerCase().includes("international") || 
      area.toLowerCase().includes("cross-border")
    ) ? "foreign" : "local";

    return {
      id: p.id,
      partnerCode: p.partnerCode,
      companyName: p.companyName,
      contactPerson: p.contactPerson || "N/A",
      email: p.email || "N/A",
      phone: p.phone || "N/A",
      serviceAreas,
      type,
      rating: p.rating ? parseFloat(p.rating) : 0,
      costPerDelivery: p.costPerDelivery ? parseFloat(p.costPerDelivery) : 0,
      currencyCode: p.currencyCode || "USD", // Default to USD if not specified
      status: p.status || "active",
    };
  };

  // Load data from API
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const partnersData = await deliveryPartnersApi.getAll();

      // Transform API data to display format
      const displayPartners: DeliveryPartnerDisplay[] = partnersData.map(transformPartnerData);

      setDeliveryPartners(displayPartners);
    } catch (err) {
      logger.error("Failed to load delivery partners:", err);
      setError(err instanceof Error ? err.message : "Failed to load delivery partners");
      // Don't fallback to mock data - show error instead
      setDeliveryPartners([]);
      showToast.error("Failed to load delivery partners. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (error && deliveryPartners.length === 0) {
    return (
      <div className="alert alert-error">
        <span className="material-symbols-outlined">error</span>
        <span>Error loading delivery partners: {error}</span>
        <button className="btn btn-sm" onClick={loadData}>
          Retry
        </button>
      </div>
    );
  }

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
      render: (partner: DeliveryPartnerDisplay) => (
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
      render: (partner: DeliveryPartnerDisplay) => (
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
      render: (partner: DeliveryPartnerDisplay) => (
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
      render: (partner: DeliveryPartnerDisplay) => (
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
      render: (partner: typeof deliveryPartners[0]) => (
        <div>
          <span className="font-semibold">{formatCurrency(partner.costPerDelivery, partner.currencyCode)}</span>
          {partner.currencyCode && (
            <span className="text-xs text-base-content/60 ml-2">({partner.currencyCode})</span>
          )}
        </div>
      ),
      sortable: true,
    },
    {
      key: "status",
      label: "Status",
      render: (partner: DeliveryPartnerDisplay) => (
        <span className={`badge ${partner.status === "active" ? "badge-success" : "badge-error"}`}>
          {partner.status === "active" ? "Active" : "Inactive"}
        </span>
      ),
    },
  ];

  const renderActions = (partner: DeliveryPartnerDisplay) => (
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
              router.push(`/admin/shipments?partner=${partner.id}`);
            }}
          >
            <span className="material-symbols-outlined text-sm">local_shipping</span>
            View Shipments
          </button>
        </li>
        <li>
          <button
            onClick={() => {
              showToast.warning("Performance metrics dashboard coming soon");
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
              onClick={(e) => {
                e.stopPropagation();
                setSelectedPartner(partner);
                setShowDeleteModal(true);
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
        onSuccess={loadData}
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
          onEdit={(partnerToEdit) => {
            setShowDetailModal(false);
            setSelectedPartner(partnerToEdit);
            setShowEditModal(true);
          }}
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
          onUpdated={loadData}
        />
      )}

      {/* Delete Delivery Partner Modal */}
      {selectedPartner && (
        <DeleteDeliveryPartnerModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedPartner(null);
          }}
          onConfirm={async () => {
            if (!selectedPartner) return;
            
            try {
              await deliveryPartnersApi.delete(selectedPartner.id);
              showToast.success("Delivery partner deleted successfully");
              setShowDeleteModal(false);
              setSelectedPartner(null);
              // Reload data
              await loadData();
            } catch (err) {
              logger.error("Failed to delete delivery partner:", err);
              showToast.error(err instanceof Error ? err.message : "Failed to delete delivery partner");
            }
          }}
          partner={selectedPartner}
        />
      )}
    </div>
  );
}
