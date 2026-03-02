"use client";

import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/DataTable";
import { Pagination } from "@/components/Pagination";
import { SummaryCards } from "@/components/SummaryCards";
import { StatusChip } from "@/components/StatusChip";
import { useAdmin } from "@/contexts/AdminContext";
import { ADMIN_ROUTES } from "@/lib/admin-roles";
import {
  deliveryPartnersApi,
  DeliveryPartner as ApiDeliveryPartner,
} from "@/lib/api/deliveryPartners";
import { useInvalidateAdminList, usePagedAdminQuery } from "@/lib/hooks/useQuery";
import { showToast } from "@/lib/utils/toast";
import { logger } from "@/lib/utils/logger";
import { formatCurrency } from "./utils";
import type { DeliveryPartnerDisplay } from "./types";
import {
  CreateDeliveryPartnerModal,
  DeleteDeliveryPartnerModal,
  DeliveryPartnerDetailModal,
  DeliveryPartnerMetricsModal,
  EditDeliveryPartnerModal,
} from "./components/DeliveryPartnerModals";

export default function DeliveryPartnersPage() {
  const router = useRouter();
  const { hasPermission } = useAdmin();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showMetricsModal, setShowMetricsModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedPartner, setSelectedPartner] =
    useState<DeliveryPartnerDisplay | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "local" | "foreign">(
    "all"
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const canCreate = hasPermission(ADMIN_ROUTES.DELIVERY_PARTNERS, "create");
  const canEdit = hasPermission(ADMIN_ROUTES.DELIVERY_PARTNERS, "edit");
  const canDelete = hasPermission(ADMIN_ROUTES.DELIVERY_PARTNERS, "delete");

  const transformPartnerData = (
    p: ApiDeliveryPartner
  ): DeliveryPartnerDisplay => {
    let serviceAreas: string[] = [];
    if (p.serviceAreas) {
      try {
        const parsed =
          typeof p.serviceAreas === "string"
            ? JSON.parse(p.serviceAreas)
            : p.serviceAreas;
        if (Array.isArray(parsed)) {
          serviceAreas = parsed;
        } else if (parsed && typeof parsed === "object") {
          if (parsed.districts && Array.isArray(parsed.districts)) {
            serviceAreas = parsed.districts;
          } else if (parsed.countries && Array.isArray(parsed.countries)) {
            serviceAreas = parsed.countries;
          } else if (parsed.serviceAreas && Array.isArray(parsed.serviceAreas)) {
            serviceAreas = parsed.serviceAreas;
          } else {
            const values = Object.values(parsed);
            const firstArray = values.find((v) => Array.isArray(v)) as
              | string[]
              | undefined;
            serviceAreas = firstArray || [];
          }
        } else {
          serviceAreas = [String(p.serviceAreas)];
        }
      } catch {
        serviceAreas = typeof p.serviceAreas === "string" ? [p.serviceAreas] : [];
      }
    }

    const isForeign =
      p.country &&
      p.country.toLowerCase() !== "usa" &&
      p.country.toLowerCase() !== "united states";
    const type: "local" | "foreign" =
      isForeign ||
      serviceAreas.some(
        (area) =>
          area.toLowerCase().includes("international") ||
          area.toLowerCase().includes("cross-border")
      )
        ? "foreign"
        : "local";

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
      currencyCode: p.currencyCode || "USD",
      status: p.status || "active",
      totalShipments: p.totalShipments ?? 0,
      onTimeDeliveryRate: p.onTimeDeliveryRate ? parseFloat(p.onTimeDeliveryRate) : 0,
    };
  };
  const partnersQuery = usePagedAdminQuery({
    queryKey: ["admin-delivery-partners", currentPage, itemsPerPage, statusFilter, searchQuery],
    queryFn: () =>
      deliveryPartnersApi.getPaged({
        page: currentPage - 1,
        size: itemsPerPage,
        sortBy: "createdAt",
        sortDir: "desc",
        status: statusFilter === "all" ? undefined : statusFilter,
        q: searchQuery.trim() || undefined,
      }),
  });
  const reload = useInvalidateAdminList(["admin-delivery-partners"]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const deliveryPartners = useMemo(
    () => (partnersQuery.data?.data || []).map(transformPartnerData),
    [partnersQuery.data]
  );
  const loading = partnersQuery.isPending && !partnersQuery.data;
  const isFetching = partnersQuery.isFetching;
  const error = partnersQuery.error
    ? partnersQuery.error instanceof Error
      ? partnersQuery.error.message
      : "Failed to load delivery partners"
    : null;
  const totalItems = partnersQuery.data?.totalElements ?? 0;
  const totalPages = Math.max(partnersQuery.data?.totalPages ?? 1, 1);

  const filteredPartners =
    typeFilter === "all"
      ? deliveryPartners
      : deliveryPartners.filter((partner) => partner.type === typeFilter);

  const summary = {
    totalPartners: totalItems,
    active: deliveryPartners.filter((p) => p.status === "active").length,
    local: deliveryPartners.filter((p) => p.type === "local").length,
    foreign: deliveryPartners.filter((p) => p.type === "foreign").length,
  };

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
        <button className="btn btn-sm" onClick={() => void reload()}>
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
        <StatusChip
          label={partner.type === "local" ? "Local" : "Foreign"}
          tone="neutral"
        />
      ),
      sortable: true,
    },
    {
      key: "serviceAreas",
      label: "Service Areas",
      render: (partner: DeliveryPartnerDisplay) => (
        <div className="flex flex-wrap gap-1">
          {partner.serviceAreas.slice(0, 2).map((area, idx) => (
            <StatusChip
              key={idx}
              label={area}
              tone="neutral"
              className="whitespace-nowrap"
            />
          ))}
          {partner.serviceAreas.length > 2 && (
            <StatusChip
              label={`+${partner.serviceAreas.length - 2}`}
              tone="neutral"
              className="whitespace-nowrap"
            />
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
          <span className="font-semibold">
            {formatCurrency(partner.costPerDelivery, partner.currencyCode)}
          </span>
          {partner.currencyCode && (
            <span className="text-xs text-base-content/60 ml-2">
              ({partner.currencyCode})
            </span>
          )}
        </div>
      ),
      sortable: true,
    },
    {
      key: "status",
      label: "Status",
      render: (partner: DeliveryPartnerDisplay) => (
        <StatusChip
          label={partner.status === "active" ? "Active" : "Inactive"}
          tone={partner.status === "active" ? "success" : "danger"}
          showDot
        />
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
            <span className="material-symbols-outlined text-sm">
              local_shipping
            </span>
            View Shipments
          </button>
        </li>
        <li>
          <button
            onClick={() => {
              setSelectedPartner(partner);
              setShowMetricsModal(true);
            }}
          >
            <span className="material-symbols-outlined text-sm">bar_chart</span>
            View Metrics
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-base-content">
            Delivery Partners
          </h1>
          <p className="text-sm text-base-content/60 mt-1">
            Manage delivery partner relationships
          </p>
        </div>
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
          <div className="form-control">
            <div className="relative">
              <input
                type="text"
                placeholder="Search by name, code, email, service areas..."
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
                <button
                  onClick={() => {
                    setStatusFilter("all");
                    setCurrentPage(1);
                  }}
                >
                  All Status
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    setStatusFilter("active");
                    setCurrentPage(1);
                  }}
                >
                  Active
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    setStatusFilter("inactive");
                    setCurrentPage(1);
                  }}
                >
                  Inactive
                </button>
              </li>
              <li className="menu-title">
                <span>Type</span>
              </li>
              <li>
                <button
                  onClick={() => {
                    setTypeFilter("all");
                    setCurrentPage(1);
                  }}
                >
                  All Types
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    setTypeFilter("local");
                    setCurrentPage(1);
                  }}
                >
                  Local
                </button>
              </li>
              <li>
                <button
                  onClick={() => {
                    setTypeFilter("foreign");
                    setCurrentPage(1);
                  }}
                >
                  Foreign
                </button>
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

      <SummaryCards cards={summaryCards} columns={3} />

      {searchQuery && (
        <div className="text-sm text-base-content/60 flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">search</span>
          <span>
            Showing {totalItems} partner{totalItems !== 1 ? "s" : ""} matching "
            {searchQuery}"
          </span>
        </div>
      )}

      <DataTable
        data={filteredPartners}
        columns={columns}
        keyExtractor={(partner) => partner.id}
        onRowClick={(partner) => {
          setSelectedPartner(partner);
          setShowDetailModal(true);
        }}
        actions={renderActions}
        emptyMessage={
          searchQuery
            ? `No delivery partners found matching "${searchQuery}"`
            : "No delivery partners found"
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

      <CreateDeliveryPartnerModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={reload}
      />

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

      {selectedPartner && (
        <DeliveryPartnerMetricsModal
          isOpen={showMetricsModal}
          onClose={() => setShowMetricsModal(false)}
          partner={selectedPartner}
        />
      )}

      {selectedPartner && (
        <EditDeliveryPartnerModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedPartner(null);
          }}
          partner={selectedPartner}
          onUpdated={reload}
        />
      )}

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
              await reload();
            } catch (err) {
              logger.error("Failed to delete delivery partner:", err);
              showToast.error(
                err instanceof Error
                  ? err.message
                  : "Failed to delete delivery partner"
              );
            }
          }}
          partner={selectedPartner}
        />
      )}
    </div>
  );
}
