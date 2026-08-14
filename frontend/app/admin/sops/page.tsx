"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DataTable } from "@/components/DataTable";
import { SummaryCards } from "@/components/SummaryCards";
import { StatusChip } from "@/components/StatusChip";
import { useAdmin } from "@/contexts/AdminContext";
import { ADMIN_ROUTES } from "@/lib/admin-roles";
import { sopsApi } from "@/lib/api/sops";
import { showToast } from "@/lib/utils/toast";
import {
  CreateSOPModal,
  DeleteSOPModal,
  EditSOPModal,
  SOPDetailModal,
} from "./components/SOPModals";
import { SOP, SOP_CATEGORIES, SOPCategory, statusConfig } from "./types";
import { downloadSOPAsMarkdown } from "./utils";

export default function SOPsPage() {
  const { hasPermission, admin } = useAdmin();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedSOP, setSelectedSOP] = useState<SOP | null>(null);
  const [editingSOP, setEditingSOP] = useState<SOP | null>(null);
  const [sops, setSops] = useState<SOP[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<SOPCategory | "all">(
    "all"
  );
  const [statusFilter, setStatusFilter] = useState<"all" | SOP["status"]>(
    "all"
  );

  const canCreate = hasPermission(ADMIN_ROUTES.SOPS, "create");
  const canEdit = hasPermission(ADMIN_ROUTES.SOPS, "edit");
  const canDelete = hasPermission(ADMIN_ROUTES.SOPS, "delete");

  const searchParams = useSearchParams();

  useEffect(() => {
    const loadSops = async () => {
      try {
        setLoading(true);
        const dbSops = await sopsApi.getAll();
        setSops(dbSops.map((s: any) => ({ ...s, isSystem: false })) as SOP[]);
      } catch {
        showToast.error("Failed to load SOPs");
        setSops([]);
      } finally {
        setLoading(false);
      }
    };

    void loadSops();
  }, []);

  useEffect(() => {
    const search = searchParams.get("search");
    if (search) {
      setSearchQuery(search);
    }
  }, [searchParams]);

  const summary = {
    totalSOPs: sops.length,
    activeSOPs: sops.filter((s) => s.status === "active").length,
    draftSOPs: sops.filter((s) => s.status === "draft").length,
    archivedSOPs: sops.filter((s) => s.status === "archived").length,
  };

  const filteredSOPs = sops.filter((sop) => {
    let query = searchQuery.trim().toLowerCase();
    if (query.endsWith(".txt")) {
      query = query.slice(0, -4);
    }
    const matchesSearch =
      !query ||
      sop.title.toLowerCase().includes(query) ||
      sop.content.toLowerCase().includes(query) ||
      sop.category.toLowerCase().includes(query) ||
      sop.id.toLowerCase().includes(query.replace(/\s+/g, "-"));
    const matchesCategory =
      categoryFilter === "all" || sop.category === categoryFilter;
    const matchesStatus = statusFilter === "all" || sop.status === statusFilter;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const summaryCards = [
    {
      label: "Total SOPs",
      value: summary.totalSOPs,
      icon: "description",
      color: "primary" as const,
    },
    {
      label: "Active SOPs",
      value: summary.activeSOPs,
      icon: "check_circle",
      color: "success" as const,
    },
    {
      label: "Draft SOPs",
      value: summary.draftSOPs,
      icon: "edit",
      color: "warning" as const,
    },
    {
      label: "Archived SOPs",
      value: summary.archivedSOPs,
      icon: "archive",
      color: "error" as const,
    },
  ];

  const columns = [
    {
      key: "title",
      label: "Title",
      render: (sop: SOP) => (
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedSOP(sop);
              setShowDetailModal(true);
            }}
            className="font-semibold text-primary hover:underline text-left"
          >
            {sop.title}
          </button>
          {sop.isSystem && (
            <span className="badge badge-sm badge-info gap-1 py-1.5 px-2">
              <span className="material-symbols-outlined text-[12px]">smart_toy</span>
              Reference
            </span>
          )}
        </div>
      ),
      sortable: true,
    },
    {
      key: "category",
      label: "Category",
      render: (sop: SOP) => (
        <StatusChip label={SOP_CATEGORIES[sop.category]} tone="neutral" />
      ),
      sortable: true,
    },
    {
      key: "version",
      label: "Version",
      sortable: true,
    },
    {
      key: "status",
      label: "Status",
      render: (sop: SOP) => {
        const status = statusConfig[sop.status];
        return <StatusChip label={status.label} tone={status.tone} showDot />;
      },
      sortable: true,
    },
    {
      key: "updatedAt",
      label: "Last Updated",
      className: "text-base-content/70",
      sortable: true,
    },
    {
      key: "createdBy",
      label: "Created By",
      className: "text-base-content/70",
    },
  ];

  const renderActions = (sop: SOP) => (
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
            onClick={(e) => {
              e.stopPropagation();
              setSelectedSOP(sop);
              setShowDetailModal(true);
            }}
          >
            <span className="material-symbols-outlined text-sm">visibility</span>
            View Details
          </button>
        </li>
        <li>
          <button
            onClick={(e) => {
              e.stopPropagation();
              downloadSOPAsMarkdown(sop);
            }}
          >
            <span className="material-symbols-outlined text-sm">download</span>
            Download SOP
          </button>
        </li>
        {canEdit && !sop.isSystem && (
          <li>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setEditingSOP(sop);
                setShowEditModal(true);
              }}
            >
              <span className="material-symbols-outlined text-sm">edit</span>
              Edit SOP
            </button>
          </li>
        )}
        {canDelete && !sop.isSystem && (
          <li>
            <button
              className="text-error"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedSOP(sop);
                setShowDeleteModal(true);
              }}
            >
              <span className="material-symbols-outlined text-sm">delete</span>
              Delete SOP
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
            Standard Operating Procedures
          </h1>
          <p className="text-sm text-base-content/60 mt-1">
            Manage and maintain Standard Operating Procedures for warehouse operations
          </p>
        </div>
        <div className="flex gap-3">
          <div className="form-control">
            <input
              type="text"
              placeholder="Search SOPs..."
              className="input input-bordered input-sm w-64"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
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
                <button onClick={() => setCategoryFilter("all")}>All Categories</button>
              </li>
              {Object.entries(SOP_CATEGORIES).map(([key, label]) => (
                <li key={key}>
                  <button onClick={() => setCategoryFilter(key as SOPCategory)}>{label}</button>
                </li>
              ))}
            </ul>
          </div>
          <div className="dropdown dropdown-end">
            <label tabIndex={0} className="btn btn-sm btn-ghost">
              <span className="material-symbols-outlined">filter_alt</span>
              <span>Status</span>
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
                <button onClick={() => setStatusFilter("draft")}>Draft</button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("archived")}>Archived</button>
              </li>
            </ul>
          </div>
          {canCreate && (
            <button className="btn btn-sm btn-primary" onClick={() => setShowCreateModal(true)}>
              <span className="material-symbols-outlined">add</span>
              <span>Add SOP</span>
            </button>
          )}
        </div>
      </div>

      <SummaryCards cards={summaryCards} />

      {loading && (
        <div className="flex items-center justify-center py-6">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      )}
      <DataTable
        data={filteredSOPs}
        columns={columns}
        keyExtractor={(sop) => sop.id}
        onRowClick={(sop) => {
          setSelectedSOP(sop);
          setShowDetailModal(true);
        }}
        actions={renderActions}
        emptyMessage="No SOPs found"
      />

      <CreateSOPModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        currentAdminName={admin?.name ?? "System Admin"}
        onCreated={(created) => {
          setSops((prev) => [created, ...prev]);
        }}
      />

      {editingSOP && (
        <EditSOPModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setEditingSOP(null);
          }}
          sop={editingSOP}
          onUpdated={(updated) => {
            setSops((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
            setEditingSOP(null);
            setShowEditModal(false);
          }}
        />
      )}

      {selectedSOP && (
        <SOPDetailModal
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedSOP(null);
          }}
          sop={selectedSOP}
          onEdit={(sop) => {
            setShowDetailModal(false);
            setSelectedSOP(null);
            setEditingSOP(sop);
            setShowEditModal(true);
          }}
          canEdit={canEdit}
        />
      )}

      {selectedSOP && (
        <DeleteSOPModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedSOP(null);
          }}
          onConfirm={() => {
            void (async () => {
              try {
                await sopsApi.delete(selectedSOP.id);
                setSops((prev) => prev.filter((item) => item.id !== selectedSOP.id));
                showToast.success("SOP deleted successfully");
              } catch {
                showToast.error("Failed to delete SOP");
              } finally {
                setShowDeleteModal(false);
                setSelectedSOP(null);
              }
            })();
          }}
          sop={selectedSOP}
        />
      )}
    </div>
  );
}
