"use client";

import { useEffect, useState } from "react";
import { DataTable } from "@/components/DataTable";
import { Modal } from "@/components/Modal";
import { SummaryCards } from "@/components/SummaryCards";
import { DetailModal } from "@/components/DetailModal";
import { useAdmin } from "@/contexts/AdminContext";
import { ADMIN_ROUTES } from "@/lib/admin-roles";
import { sopsApi } from "@/lib/api/sops";
import { showToast } from "@/lib/utils/toast";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// SOP Categories based on your existing SOPs
export type SOPCategory =
  | "equipment_operation"
  | "cycle_count"
  | "warehouse_operations"
  | "safety"
  | "inspection"
  | "general";

const SOP_CATEGORIES: Record<SOPCategory, string> = {
  equipment_operation: "Equipment Operation",
  cycle_count: "Cycle Count",
  warehouse_operations: "Warehouse Operations",
  safety: "Safety",
  inspection: "Inspection",
  general: "General",
};

// SOP data structure
type SOP = {
  id: string;
  title: string;
  category: SOPCategory;
  content: string;
  version: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  applicableRoles?: string[]; // Worker roles this SOP applies to
  status: "active" | "draft" | "archived";
};

const statusConfig = {
  active: { label: "Active", class: "badge-success" },
  draft: { label: "Draft", class: "badge-warning" },
  archived: { label: "Archived", class: "badge-error" },
};

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

  useEffect(() => {
    const loadSops = async () => {
      try {
        setLoading(true);
        const data = await sopsApi.getAll();
        setSops(data as SOP[]);
      } catch (error) {
        showToast.error("Failed to load SOPs");
        setSops([]);
      } finally {
        setLoading(false);
      }
    };

    loadSops();
  }, []);

  const summary = {
    totalSOPs: sops.length,
    activeSOPs: sops.filter((s) => s.status === "active").length,
    draftSOPs: sops.filter((s) => s.status === "draft").length,
    archivedSOPs: sops.filter((s) => s.status === "archived").length,
  };

  const filteredSOPs = sops.filter((sop) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      sop.title.toLowerCase().includes(query) ||
      sop.content.toLowerCase().includes(query) ||
      sop.category.toLowerCase().includes(query);
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
      ),
      sortable: true,
    },
    {
      key: "category",
      label: "Category",
      render: (sop: SOP) => (
        <span className="badge badge-outline">
          {SOP_CATEGORIES[sop.category]}
        </span>
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
        return <span className={`badge ${status.class}`}>{status.label}</span>;
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

  // Function to download SOP as markdown file
  const downloadSOP = (sop: SOP) => {
    const content = `# ${sop.title}

**Category:** ${SOP_CATEGORIES[sop.category]}  
**Version:** ${sop.version}  
**Status:** ${sop.status}  
**Last Updated:** ${sop.updatedAt}  
**Created:** ${sop.createdAt}  
**Created By:** ${sop.createdBy}

---

${sop.content}
`;

    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${sop.title.replace(/[^a-z0-9]/gi, "_")}_v${
      sop.version
    }.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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
            <span className="material-symbols-outlined text-sm">
              visibility
            </span>
            View Details
          </button>
        </li>
        <li>
          <button
            onClick={(e) => {
              e.stopPropagation();
              downloadSOP(sop);
            }}
          >
            <span className="material-symbols-outlined text-sm">download</span>
            Download SOP
          </button>
        </li>
        {canEdit && (
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
        {canDelete && (
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
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-base-content">
            Standard Operating Procedures
          </h1>
          <p className="text-sm text-base-content/60 mt-1">
            Manage and maintain Standard Operating Procedures for warehouse
            operations
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
                <button onClick={() => setCategoryFilter("all")}>
                  All Categories
                </button>
              </li>
              {Object.entries(SOP_CATEGORIES).map(([key, label]) => (
                <li key={key}>
                  <button onClick={() => setCategoryFilter(key as SOPCategory)}>
                    {label}
                  </button>
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
                <button onClick={() => setStatusFilter("draft")}>Draft</button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("archived")}>
                  Archived
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
              <span>Add SOP</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <SummaryCards cards={summaryCards} />

      {/* SOPs Table */}
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

      {/* Create SOP Modal */}
      <CreateSOPModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        currentAdminName={admin?.name ?? "System Admin"}
        onCreated={(created) => {
          setSops((prev) => [created, ...prev]);
        }}
      />

      {/* Edit SOP Modal */}
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

      {/* SOP Detail Modal */}
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

      {/* Delete SOP Modal */}
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
              } catch (error) {
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

// Create SOP Modal Component
function CreateSOPModal({
  isOpen,
  onClose,
  currentAdminName,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  currentAdminName: string;
  onCreated: (sop: SOP) => void;
}) {
  const [formData, setFormData] = useState({
    title: "",
    category: "general" as SOPCategory,
    content: "",
    version: "1.0",
    status: "draft" as SOP["status"],
    applicableRoles: [] as string[],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await sopsApi.create({
        title: formData.title.trim(),
        category: formData.category,
        content: formData.content,
        version: formData.version.trim(),
        status: formData.status,
        createdBy: currentAdminName,
        applicableRoles: formData.applicableRoles,
      });
      onCreated(created as SOP);
      showToast.success("SOP created successfully");
      onClose();
      setFormData({
        title: "",
        category: "general",
        content: "",
        version: "1.0",
        status: "draft",
        applicableRoles: [],
      });
    } catch (error) {
      showToast.error("Failed to create SOP");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add SOP" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Title *</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={formData.title}
            onChange={(e) =>
              setFormData({ ...formData, title: e.target.value })
            }
            required
            placeholder="e.g., SOP for Operating Forklift"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Category *</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={formData.category}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  category: e.target.value as SOPCategory,
                })
              }
              required
            >
              {Object.entries(SOP_CATEGORIES).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Version *</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.version}
              onChange={(e) =>
                setFormData({ ...formData, version: e.target.value })
              }
              required
              placeholder="1.0"
            />
          </div>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Status *</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={formData.status}
            onChange={(e) =>
              setFormData({
                ...formData,
                status: e.target.value as SOP["status"],
              })
            }
            required
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Content *</span>
            <span className="label-text-alt">Markdown supported</span>
          </label>
          <textarea
            className="textarea textarea-bordered w-full h-80 font-mono text-sm"
            value={formData.content}
            onChange={(e) =>
              setFormData({ ...formData, content: e.target.value })
            }
            required
            placeholder={`# SOP Title

## Section 1

Use markdown formatting:

- **Bold text** with **
- *Italic text* with *
- Bullet points with -
- Numbered lists with 1. 2. 3.

### Subsection

\`\`\`code blocks\`\`\`

> Blockquotes for important notes`}
          />
          <label className="label">
            <span className="label-text-alt">
              Supports markdown: **bold**, *italic*, lists, headings, code
              blocks, and more. Content will be rendered with proper formatting
              when viewed.
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Create SOP
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Edit SOP Modal Component (similar to Create, but with existing data)
function EditSOPModal({
  isOpen,
  onClose,
  sop,
  onUpdated,
}: {
  isOpen: boolean;
  onClose: () => void;
  sop: SOP;
  onUpdated: (sop: SOP) => void;
}) {
  const [formData, setFormData] = useState({
    title: sop.title,
    category: sop.category,
    content: sop.content,
    version: sop.version,
    status: sop.status,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = await sopsApi.update(sop.id, {
        title: formData.title.trim(),
        category: formData.category,
        content: formData.content,
        version: formData.version.trim(),
        status: formData.status,
        createdBy: sop.createdBy || "System Admin",
        applicableRoles: sop.applicableRoles || [],
      });
      showToast.success("SOP updated successfully");
      onUpdated(updated as SOP);
      onClose();
    } catch (error) {
      showToast.error("Failed to update SOP");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit SOP" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Title *</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={formData.title}
            onChange={(e) =>
              setFormData({ ...formData, title: e.target.value })
            }
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Category *</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={formData.category}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  category: e.target.value as SOPCategory,
                })
              }
              required
            >
              {Object.entries(SOP_CATEGORIES).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Version *</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.version}
              onChange={(e) =>
                setFormData({ ...formData, version: e.target.value })
              }
              required
            />
          </div>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Content *</span>
            <span className="label-text-alt">Markdown supported</span>
          </label>
          <textarea
            className="textarea textarea-bordered w-full h-80 font-mono text-sm"
            value={formData.content}
            onChange={(e) =>
              setFormData({ ...formData, content: e.target.value })
            }
            placeholder={`# SOP Title

## Section 1

Use markdown formatting:

- **Bold text** with **
- *Italic text* with *
- Bullet points with -
- Numbered lists with 1. 2. 3.

### Subsection

\`\`\`code blocks\`\`\`

> Blockquotes for important notes`}
            required
          />
          <label className="label">
            <span className="label-text-alt">
              Supports markdown: **bold**, *italic*, lists, headings, code
              blocks, and more. Content will be rendered with proper formatting
              when viewed.
            </span>
          </label>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Status *</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={formData.status}
            onChange={(e) =>
              setFormData({
                ...formData,
                status: e.target.value as SOP["status"],
              })
            }
            required
          >
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
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
    </Modal>
  );
}

// SOP Detail Modal Component
function SOPDetailModal({
  isOpen,
  onClose,
  sop,
  onEdit,
  canEdit,
}: {
  isOpen: boolean;
  onClose: () => void;
  sop: SOP;
  onEdit: (sop: SOP) => void;
  canEdit: boolean;
}) {
  return (
    <DetailModal isOpen={isOpen} onClose={onClose} title={sop.title} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-base-content/60">Category</label>
            <p>
              <span className="badge badge-outline">
                {SOP_CATEGORIES[sop.category]}
              </span>
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Version</label>
            <p className="font-semibold">{sop.version}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Status</label>
            <p>
              <span className={`badge ${statusConfig[sop.status].class}`}>
                {statusConfig[sop.status].label}
              </span>
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Last Updated</label>
            <p className="font-semibold">{sop.updatedAt}</p>
          </div>
        </div>
        <div className="border-t pt-4">
          <label className="text-sm text-base-content/60 mb-2 block">
            Content
          </label>
          <div className="bg-base-200 rounded-lg p-6 max-h-[600px] overflow-y-auto text-base-content">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ node, ...props }) => (
                  <h1
                    className="text-2xl font-bold mb-4 mt-6 first:mt-0"
                    {...props}
                  />
                ),
                h2: ({ node, ...props }) => (
                  <h2 className="text-xl font-bold mb-3 mt-5" {...props} />
                ),
                h3: ({ node, ...props }) => (
                  <h3 className="text-lg font-semibold mb-2 mt-4" {...props} />
                ),
                p: ({ node, ...props }) => (
                  <p className="mb-3 leading-relaxed" {...props} />
                ),
                ul: ({ node, ...props }) => (
                  <ul className="list-disc mb-3 space-y-2 ml-6" {...props} />
                ),
                ol: ({ node, ...props }) => (
                  <ol className="list-decimal mb-3 space-y-2 ml-6" {...props} />
                ),
                li: ({ node, ...props }) => (
                  <li className="mb-1 leading-relaxed" {...props} />
                ),
                strong: ({ node, ...props }) => (
                  <strong className="font-bold text-base-content" {...props} />
                ),
                em: ({ node, ...props }) => (
                  <em className="italic" {...props} />
                ),
                code: ({ node, inline, ...props }: any) =>
                  inline ? (
                    <code
                      className="bg-base-300 px-1.5 py-0.5 rounded text-sm font-mono"
                      {...props}
                    />
                  ) : (
                    <code
                      className="block bg-base-300 p-3 rounded text-sm font-mono overflow-x-auto mb-3"
                      {...props}
                    />
                  ),
                pre: ({ node, ...props }) => (
                  <pre
                    className="bg-base-300 p-3 rounded text-sm font-mono overflow-x-auto mb-3"
                    {...props}
                  />
                ),
                blockquote: ({ node, ...props }) => (
                  <blockquote
                    className="border-l-4 border-primary pl-4 italic my-3 text-base-content/70"
                    {...props}
                  />
                ),
                hr: ({ node, ...props }) => (
                  <hr className="my-4 border-base-300" {...props} />
                ),
                table: ({ node, ...props }) => (
                  <div className="overflow-x-auto my-4">
                    <table
                      className="min-w-full border-collapse border border-base-300"
                      {...props}
                    />
                  </div>
                ),
                thead: ({ node, ...props }) => (
                  <thead className="bg-base-300" {...props} />
                ),
                th: ({ node, ...props }) => (
                  <th
                    className="border border-base-300 px-4 py-2 text-left font-semibold"
                    {...props}
                  />
                ),
                td: ({ node, ...props }) => (
                  <td className="border border-base-300 px-4 py-2" {...props} />
                ),
              }}
            >
              {sop.content}
            </ReactMarkdown>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button
            className="btn btn-ghost"
            onClick={() => {
              const content = `# ${sop.title}

**Category:** ${SOP_CATEGORIES[sop.category]}  
**Version:** ${sop.version}  
**Status:** ${sop.status}  
**Last Updated:** ${sop.updatedAt}  
**Created:** ${sop.createdAt}  
**Created By:** ${sop.createdBy}

---

${sop.content}
`;
              const blob = new Blob([content], { type: "text/markdown" });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = `${sop.title.replace(/[^a-z0-9]/gi, "_")}_v${
                sop.version
              }.md`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
            }}
          >
            <span className="material-symbols-outlined">download</span>
            Download
          </button>
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          {canEdit && (
            <button className="btn btn-primary" onClick={() => onEdit(sop)}>
              Edit SOP
            </button>
          )}
        </div>
      </div>
    </DetailModal>
  );
}

// Delete SOP Modal Component
function DeleteSOPModal({
  isOpen,
  onClose,
  onConfirm,
  sop,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  sop: SOP;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete SOP" size="md">
      <div className="space-y-4">
        <div className="alert alert-warning">
          <span className="material-symbols-outlined">warning</span>
          <div>
            <h3 className="font-bold">
              Warning: This action cannot be undone!
            </h3>
            <div className="text-sm">
              You are about to delete <strong>{sop.title}</strong>. This will
              permanently remove this SOP from the system.
            </div>
          </div>
        </div>
        <div className="bg-base-200 rounded-lg p-4">
          <p className="text-sm text-base-content/70">
            <strong>Title:</strong> {sop.title}
          </p>
          <p className="text-sm text-base-content/70">
            <strong>Category:</strong> {SOP_CATEGORIES[sop.category]}
          </p>
          <p className="text-sm text-base-content/70">
            <strong>Version:</strong> {sop.version}
          </p>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-error" onClick={onConfirm}>
            <span className="material-symbols-outlined">delete</span>
            Delete SOP
          </button>
        </div>
      </div>
    </Modal>
  );
}
