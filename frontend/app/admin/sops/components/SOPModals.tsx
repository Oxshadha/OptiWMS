"use client";

import { FormEvent, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { DetailModal } from "@/components/DetailModal";
import { Modal } from "@/components/Modal";
import { StatusChip } from "@/components/StatusChip";
import { sopsApi } from "@/lib/api/sops";
import { showToast } from "@/lib/utils/toast";
import { SOP, SOP_CATEGORIES, SOPCategory, statusConfig } from "../types";
import { downloadSOPAsMarkdown } from "../utils";

export function CreateSOPModal({
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

  const handleSubmit = async (e: FormEvent) => {
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
    } catch {
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
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
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
              onChange={(e) => setFormData({ ...formData, version: e.target.value })}
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
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
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
              Supports markdown: **bold**, *italic*, lists, headings, code blocks, and more.
              Content will be rendered with proper formatting when viewed.
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

export function EditSOPModal({
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

  const handleSubmit = async (e: FormEvent) => {
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
    } catch {
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
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
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
              onChange={(e) => setFormData({ ...formData, version: e.target.value })}
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
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
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
              Supports markdown: **bold**, *italic*, lists, headings, code blocks, and more.
              Content will be rendered with proper formatting when viewed.
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

export function SOPDetailModal({
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
              <StatusChip label={SOP_CATEGORIES[sop.category]} tone="neutral" />
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Version</label>
            <p className="font-semibold">{sop.version}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Status</label>
            <p>
              <StatusChip label={statusConfig[sop.status].label} tone={statusConfig[sop.status].tone} showDot />
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Last Updated</label>
            <p className="font-semibold">{sop.updatedAt}</p>
          </div>
        </div>
        <div className="border-t pt-4">
          <label className="text-sm text-base-content/60 mb-2 block">Content</label>
          <div className="bg-base-200 rounded-lg p-6 max-h-[600px] overflow-y-auto text-base-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
              {sop.content}
            </ReactMarkdown>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button className="btn btn-ghost" onClick={() => downloadSOPAsMarkdown(sop)}>
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

export function DeleteSOPModal({
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
            <h3 className="font-bold">Warning: This action cannot be undone!</h3>
            <div className="text-sm">
              You are about to delete <strong>{sop.title}</strong>. This will permanently remove this
              SOP from the system.
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

const markdownComponents = {
  h1: (props: any) => <h1 className="text-2xl font-bold mb-4 mt-6 first:mt-0" {...props} />,
  h2: (props: any) => <h2 className="text-xl font-bold mb-3 mt-5" {...props} />,
  h3: (props: any) => <h3 className="text-lg font-semibold mb-2 mt-4" {...props} />,
  p: (props: any) => <p className="mb-3 leading-relaxed" {...props} />,
  ul: (props: any) => <ul className="list-disc mb-3 space-y-2 ml-6" {...props} />,
  ol: (props: any) => <ol className="list-decimal mb-3 space-y-2 ml-6" {...props} />,
  li: (props: any) => <li className="mb-1 leading-relaxed" {...props} />,
  strong: (props: any) => <strong className="font-bold text-base-content" {...props} />,
  em: (props: any) => <em className="italic" {...props} />,
  code: ({ inline, ...props }: any) =>
    inline ? (
      <code className="bg-base-300 px-1.5 py-0.5 rounded text-sm font-mono" {...props} />
    ) : (
      <code className="block bg-base-300 p-3 rounded text-sm font-mono overflow-x-auto mb-3" {...props} />
    ),
  pre: (props: any) => (
    <pre className="bg-base-300 p-3 rounded text-sm font-mono overflow-x-auto mb-3" {...props} />
  ),
  blockquote: (props: any) => (
    <blockquote className="border-l-4 border-primary pl-4 italic my-3 text-base-content/70" {...props} />
  ),
  hr: (props: any) => <hr className="my-4 border-base-300" {...props} />,
  table: (props: any) => (
    <div className="overflow-x-auto overflow-y-auto max-h-80 my-4">
      <table className="min-w-full border-collapse border border-base-300" {...props} />
    </div>
  ),
  thead: (props: any) => <thead className="bg-base-300" {...props} />,
  th: (props: any) => (
    <th className="sticky top-0 z-10 bg-base-300 border border-base-300 px-4 py-2 text-left font-semibold" {...props} />
  ),
  td: (props: any) => <td className="border border-base-300 px-4 py-2" {...props} />,
};
