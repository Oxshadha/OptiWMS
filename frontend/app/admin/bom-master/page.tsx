"use client";

import { useEffect, useMemo, useState } from "react";
import { useAdmin } from "@/contexts/AdminContext";
import { ADMIN_ROUTES } from "@/lib/admin-roles";
import { materialsApi, type Material } from "@/lib/api/materials";
import { warehousesApi, type Warehouse } from "@/lib/api/warehouses";
import {
  bomMasterApi,
  type BomAuditRow,
  type BomComponent,
  type BomHeader,
} from "@/lib/api/bom-master";
import { showToast } from "@/lib/utils/toast";
import { logger } from "@/lib/utils/logger";

type ComponentDraft = {
  componentType: string;
  qtyPerParent: string;
  scrapRate: string;
  leadTimeDays: string;
  uom: string;
};

const EMPTY_COMPONENT_DRAFT: ComponentDraft = {
  componentType: "raw_material",
  qtyPerParent: "",
  scrapRate: "0",
  leadTimeDays: "",
  uom: "",
};

export default function BomMasterPage() {
  const { hasPermission } = useAdmin();
  const canWrite = hasPermission(ADMIN_ROUTES.BOM_MASTER, "edit");

  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [headers, setHeaders] = useState<BomHeader[]>([]);
  const [selectedHeaderId, setSelectedHeaderId] = useState<string>("");
  const [components, setComponents] = useState<BomComponent[]>([]);
  const [auditRows, setAuditRows] = useState<BomAuditRow[]>([]);
  const [headerStatusEdit, setHeaderStatusEdit] = useState("active");
  const [headerNotesEdit, setHeaderNotesEdit] = useState("");
  const [newHeader, setNewHeader] = useState({
    parentMaterialId: "",
    warehouseId: "",
    version: "v1",
    status: "active",
    effectiveFrom: "",
    effectiveTo: "",
    notes: "",
  });
  const [newComponent, setNewComponent] = useState<ComponentDraft>(EMPTY_COMPONENT_DRAFT);
  const [componentMaterialId, setComponentMaterialId] = useState("");
  const [componentEdits, setComponentEdits] = useState<Record<string, ComponentDraft>>({});

  const selectedHeader = useMemo(
    () => headers.find((h) => h.id === selectedHeaderId),
    [headers, selectedHeaderId],
  );

  const materialMap = useMemo(() => {
    const map = new Map<string, Material>();
    materials.forEach((m) => map.set(m.id, m));
    return map;
  }, [materials]);

  const warehouseMap = useMemo(() => {
    const map = new Map<string, Warehouse>();
    warehouses.forEach((w) => map.set(w.id, w));
    return map;
  }, [warehouses]);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [materialsData, warehousesData, headersData, auditData] = await Promise.all([
        materialsApi.getAll(),
        warehousesApi.getAll(),
        bomMasterApi.listHeaders(),
        bomMasterApi.listAudit(50),
      ]);
      setMaterials(materialsData);
      setWarehouses(warehousesData);
      const nextHeaders = headersData.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
      setHeaders(nextHeaders);
      setAuditRows(auditData);

      const nextSelected = selectedHeaderId || nextHeaders[0]?.id || "";
      setSelectedHeaderId(nextSelected);
      if (nextSelected) {
        await loadComponents(nextSelected);
      } else {
        setComponents([]);
      }
    } catch (error) {
      logger.error("[BomMasterPage] Failed to load BOM data", error);
      showToast.error("Failed to load BOM master data");
    } finally {
      setLoading(false);
    }
  };

  const loadComponents = async (headerId: string) => {
    try {
      const rows = await bomMasterApi.listComponents(headerId);
      setComponents(rows);
      const draftMap: Record<string, ComponentDraft> = {};
      rows.forEach((row) => {
        draftMap[row.id] = {
          componentType: row.componentType || "raw_material",
          qtyPerParent: String(row.qtyPerParent ?? ""),
          scrapRate: String(row.scrapRate ?? 0),
          leadTimeDays: row.leadTimeDays == null ? "" : String(row.leadTimeDays),
          uom: row.uom || "",
        };
      });
      setComponentEdits(draftMap);
    } catch (error) {
      logger.error("[BomMasterPage] Failed to load BOM components", error);
      showToast.error("Failed to load BOM components");
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    if (!selectedHeader) return;
    setHeaderStatusEdit(selectedHeader.status || "active");
    setHeaderNotesEdit(selectedHeader.notes || "");
  }, [selectedHeader]);

  const onSelectHeader = async (id: string) => {
    setSelectedHeaderId(id);
    await loadComponents(id);
  };

  const createHeader = async () => {
    if (!newHeader.parentMaterialId) {
      showToast.error("Select parent material");
      return;
    }
    try {
      await bomMasterApi.createHeader({
        parentMaterialId: newHeader.parentMaterialId,
        warehouseId: newHeader.warehouseId || null,
        version: newHeader.version || "v1",
        status: newHeader.status,
        effectiveFrom: newHeader.effectiveFrom || null,
        effectiveTo: newHeader.effectiveTo || null,
        notes: newHeader.notes || null,
      });
      showToast.success("BOM header created");
      setNewHeader({
        parentMaterialId: "",
        warehouseId: "",
        version: "v1",
        status: "active",
        effectiveFrom: "",
        effectiveTo: "",
        notes: "",
      });
      await loadAll();
    } catch (error) {
      logger.error("[BomMasterPage] Failed to create BOM header", error);
      showToast.error("Failed to create BOM header");
    }
  };

  const saveHeader = async () => {
    if (!selectedHeader) return;
    try {
      await bomMasterApi.updateHeader(selectedHeader.id, {
        status: headerStatusEdit,
        notes: headerNotesEdit,
      });
      showToast.success("BOM header updated");
      await loadAll();
    } catch (error) {
      logger.error("[BomMasterPage] Failed to update BOM header", error);
      showToast.error("Failed to update BOM header");
    }
  };

  const deleteHeader = async (id: string) => {
    if (!window.confirm("Delete this BOM header and all components?")) return;
    try {
      await bomMasterApi.deleteHeader(id);
      showToast.success("BOM header deleted");
      if (selectedHeaderId === id) {
        setSelectedHeaderId("");
      }
      await loadAll();
    } catch (error) {
      logger.error("[BomMasterPage] Failed to delete BOM header", error);
      showToast.error("Failed to delete BOM header");
    }
  };

  const addComponent = async () => {
    if (!selectedHeaderId) {
      showToast.error("Select a BOM header first");
      return;
    }
    if (!componentMaterialId || !newComponent.qtyPerParent) {
      showToast.error("Component material and qty are required");
      return;
    }
    try {
      await bomMasterApi.createComponent(selectedHeaderId, {
        componentMaterialId,
        componentType: newComponent.componentType || "raw_material",
        qtyPerParent: Number(newComponent.qtyPerParent),
        scrapRate: Number(newComponent.scrapRate || "0"),
        leadTimeDays: newComponent.leadTimeDays ? Number(newComponent.leadTimeDays) : null,
        uom: newComponent.uom || null,
      });
      showToast.success("Component added");
      setComponentMaterialId("");
      setNewComponent(EMPTY_COMPONENT_DRAFT);
      await loadComponents(selectedHeaderId);
      const auditData = await bomMasterApi.listAudit(50);
      setAuditRows(auditData);
    } catch (error) {
      logger.error("[BomMasterPage] Failed to add component", error);
      showToast.error("Failed to add component");
    }
  };

  const saveComponent = async (id: string) => {
    const draft = componentEdits[id];
    if (!draft) return;
    try {
      await bomMasterApi.updateComponent(id, {
        componentType: draft.componentType,
        qtyPerParent: Number(draft.qtyPerParent),
        scrapRate: Number(draft.scrapRate || "0"),
        leadTimeDays: draft.leadTimeDays ? Number(draft.leadTimeDays) : null,
        uom: draft.uom || null,
      });
      showToast.success("Component updated");
      if (selectedHeaderId) {
        await loadComponents(selectedHeaderId);
      }
      const auditData = await bomMasterApi.listAudit(50);
      setAuditRows(auditData);
    } catch (error) {
      logger.error("[BomMasterPage] Failed to update component", error);
      showToast.error("Failed to update component");
    }
  };

  const deleteComponent = async (id: string) => {
    if (!window.confirm("Delete this BOM component?")) return;
    try {
      await bomMasterApi.deleteComponent(id);
      showToast.success("Component deleted");
      if (selectedHeaderId) {
        await loadComponents(selectedHeaderId);
      }
      const auditData = await bomMasterApi.listAudit(50);
      setAuditRows(auditData);
    } catch (error) {
      logger.error("[BomMasterPage] Failed to delete component", error);
      showToast.error("Failed to delete component");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-base-content">BOM Master</h1>
        <p className="text-sm text-base-content/60 mt-1">
          Maintain versioned BOM headers and components used for dependent demand planning.
        </p>
      </div>

      {!canWrite && (
        <div className="alert alert-warning">
          <span>Read-only access. Admin role is required for BOM create/update/delete.</span>
        </div>
      )}

      {loading ? (
        <div className="card bg-base-100 border border-base-300 rounded-xl p-8 text-center">
          <span className="loading loading-spinner loading-lg"></span>
          <p className="mt-3 text-base-content/60">Loading BOM master...</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="card bg-base-100 border border-base-300 rounded-xl p-4 space-y-4">
              <h2 className="text-lg font-semibold">Create BOM Header</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="form-control">
                  <span className="label-text text-xs mb-1">Parent Material</span>
                  <select
                    className="select select-bordered"
                    value={newHeader.parentMaterialId}
                    onChange={(e) => setNewHeader((p) => ({ ...p, parentMaterialId: e.target.value }))}
                  >
                    <option value="">Select material</option>
                    {materials
                      .filter((m) => (m.materialType || "").toLowerCase() === "product")
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.materialCode} - {m.description}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="form-control">
                  <span className="label-text text-xs mb-1">Warehouse (optional)</span>
                  <select
                    className="select select-bordered"
                    value={newHeader.warehouseId}
                    onChange={(e) => setNewHeader((p) => ({ ...p, warehouseId: e.target.value }))}
                  >
                    <option value="">Global BOM</option>
                    {warehouses.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="form-control">
                  <span className="label-text text-xs mb-1">Version</span>
                  <input
                    className="input input-bordered"
                    value={newHeader.version}
                    onChange={(e) => setNewHeader((p) => ({ ...p, version: e.target.value }))}
                  />
                </label>
                <label className="form-control">
                  <span className="label-text text-xs mb-1">Status</span>
                  <select
                    className="select select-bordered"
                    value={newHeader.status}
                    onChange={(e) => setNewHeader((p) => ({ ...p, status: e.target.value }))}
                  >
                    <option value="active">active</option>
                    <option value="inactive">inactive</option>
                    <option value="draft">draft</option>
                    <option value="retired">retired</option>
                  </select>
                </label>
                <label className="form-control">
                  <span className="label-text text-xs mb-1">Effective From</span>
                  <input
                    type="date"
                    className="input input-bordered"
                    value={newHeader.effectiveFrom}
                    onChange={(e) => setNewHeader((p) => ({ ...p, effectiveFrom: e.target.value }))}
                  />
                </label>
                <label className="form-control">
                  <span className="label-text text-xs mb-1">Effective To</span>
                  <input
                    type="date"
                    className="input input-bordered"
                    value={newHeader.effectiveTo}
                    onChange={(e) => setNewHeader((p) => ({ ...p, effectiveTo: e.target.value }))}
                  />
                </label>
              </div>
              <label className="form-control">
                <span className="label-text text-xs mb-1">Notes</span>
                <textarea
                  className="textarea textarea-bordered"
                  rows={2}
                  value={newHeader.notes}
                  onChange={(e) => setNewHeader((p) => ({ ...p, notes: e.target.value }))}
                />
              </label>
              <div>
                <button className="btn btn-primary" onClick={createHeader} disabled={!canWrite}>
                  Create Header
                </button>
              </div>
            </div>

            <div className="card bg-base-100 border border-base-300 rounded-xl p-4">
              <h2 className="text-lg font-semibold mb-3">BOM Headers</h2>
              <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Parent SKU</th>
                      <th>Warehouse</th>
                      <th>Version</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {headers.map((h) => (
                      <tr key={h.id} className={selectedHeaderId === h.id ? "bg-base-200" : ""}>
                        <td>{materialMap.get(h.parentMaterialId)?.materialCode || h.parentMaterialId}</td>
                        <td>{h.warehouseId ? warehouseMap.get(h.warehouseId)?.name || h.warehouseId : "Global"}</td>
                        <td>{h.version}</td>
                        <td>{h.status}</td>
                        <td className="text-right space-x-2">
                          <button className="btn btn-xs btn-outline" onClick={() => void onSelectHeader(h.id)}>
                            Select
                          </button>
                          <button
                            className="btn btn-xs btn-error btn-outline"
                            onClick={() => void deleteHeader(h.id)}
                            disabled={!canWrite}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!headers.length && (
                      <tr>
                        <td colSpan={5} className="text-center text-base-content/60">
                          No BOM headers
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="card bg-base-100 border border-base-300 rounded-xl p-4 space-y-4">
            <h2 className="text-lg font-semibold">Selected Header Details</h2>
            {selectedHeader ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-base-content/60">Parent SKU</p>
                    <p className="font-medium">
                      {materialMap.get(selectedHeader.parentMaterialId)?.materialCode || selectedHeader.parentMaterialId}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-base-content/60">Version</p>
                    <p className="font-medium">{selectedHeader.version}</p>
                  </div>
                  <div>
                    <p className="text-xs text-base-content/60">Updated</p>
                    <p className="font-medium">{selectedHeader.updatedAt || "N/A"}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <label className="form-control">
                    <span className="label-text text-xs mb-1">Status</span>
                    <select
                      className="select select-bordered"
                      value={headerStatusEdit}
                      onChange={(e) => setHeaderStatusEdit(e.target.value)}
                    >
                      <option value="active">active</option>
                      <option value="inactive">inactive</option>
                      <option value="draft">draft</option>
                      <option value="retired">retired</option>
                    </select>
                  </label>
                  <label className="form-control">
                    <span className="label-text text-xs mb-1">Notes</span>
                    <input
                      className="input input-bordered"
                      value={headerNotesEdit}
                      onChange={(e) => setHeaderNotesEdit(e.target.value)}
                    />
                  </label>
                </div>
                <button className="btn btn-outline btn-primary w-fit" onClick={saveHeader} disabled={!canWrite}>
                  Save Header
                </button>
              </>
            ) : (
              <p className="text-base-content/60">Select a header to manage components.</p>
            )}
          </div>

          <div className="card bg-base-100 border border-base-300 rounded-xl p-4 space-y-4">
            <h2 className="text-lg font-semibold">BOM Components</h2>
            {selectedHeader ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                  <label className="form-control md:col-span-2">
                    <span className="label-text text-xs mb-1">Component Material</span>
                    <select
                      className="select select-bordered"
                      value={componentMaterialId}
                      onChange={(e) => setComponentMaterialId(e.target.value)}
                    >
                      <option value="">Select component</option>
                      {materials
                        .filter((m) => m.id !== selectedHeader.parentMaterialId)
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.materialCode} - {m.description}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="form-control">
                    <span className="label-text text-xs mb-1">Type</span>
                    <select
                      className="select select-bordered"
                      value={newComponent.componentType}
                      onChange={(e) =>
                        setNewComponent((p) => ({ ...p, componentType: e.target.value }))
                      }
                    >
                      <option value="raw_material">raw_material</option>
                      <option value="packaging_material">packaging_material</option>
                    </select>
                  </label>
                  <label className="form-control">
                    <span className="label-text text-xs mb-1">Qty / Parent</span>
                    <input
                      className="input input-bordered"
                      value={newComponent.qtyPerParent}
                      onChange={(e) =>
                        setNewComponent((p) => ({ ...p, qtyPerParent: e.target.value }))
                      }
                    />
                  </label>
                  <label className="form-control">
                    <span className="label-text text-xs mb-1">Scrap Rate</span>
                    <input
                      className="input input-bordered"
                      value={newComponent.scrapRate}
                      onChange={(e) => setNewComponent((p) => ({ ...p, scrapRate: e.target.value }))}
                    />
                  </label>
                  <label className="form-control">
                    <span className="label-text text-xs mb-1">Lead Time Days</span>
                    <input
                      className="input input-bordered"
                      value={newComponent.leadTimeDays}
                      onChange={(e) =>
                        setNewComponent((p) => ({ ...p, leadTimeDays: e.target.value }))
                      }
                    />
                  </label>
                </div>
                <button className="btn btn-primary w-fit" onClick={addComponent} disabled={!canWrite}>
                  Add Component
                </button>

                <div className="overflow-x-auto max-h-[440px] overflow-y-auto">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>Component SKU</th>
                        <th>Type</th>
                        <th>Qty / Parent</th>
                        <th>Scrap</th>
                        <th>Lead Time</th>
                        <th>UOM</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {components.map((c) => {
                        const draft = componentEdits[c.id] || EMPTY_COMPONENT_DRAFT;
                        return (
                          <tr key={c.id}>
                            <td>{materialMap.get(c.componentMaterialId)?.materialCode || c.componentMaterialId}</td>
                            <td>
                              <select
                                className="select select-bordered select-xs"
                                value={draft.componentType}
                                onChange={(e) =>
                                  setComponentEdits((p) => ({
                                    ...p,
                                    [c.id]: { ...draft, componentType: e.target.value },
                                  }))
                                }
                              >
                                <option value="raw_material">raw_material</option>
                                <option value="packaging_material">packaging_material</option>
                              </select>
                            </td>
                            <td>
                              <input
                                className="input input-bordered input-xs w-24"
                                value={draft.qtyPerParent}
                                onChange={(e) =>
                                  setComponentEdits((p) => ({
                                    ...p,
                                    [c.id]: { ...draft, qtyPerParent: e.target.value },
                                  }))
                                }
                              />
                            </td>
                            <td>
                              <input
                                className="input input-bordered input-xs w-20"
                                value={draft.scrapRate}
                                onChange={(e) =>
                                  setComponentEdits((p) => ({
                                    ...p,
                                    [c.id]: { ...draft, scrapRate: e.target.value },
                                  }))
                                }
                              />
                            </td>
                            <td>
                              <input
                                className="input input-bordered input-xs w-20"
                                value={draft.leadTimeDays}
                                onChange={(e) =>
                                  setComponentEdits((p) => ({
                                    ...p,
                                    [c.id]: { ...draft, leadTimeDays: e.target.value },
                                  }))
                                }
                              />
                            </td>
                            <td>
                              <input
                                className="input input-bordered input-xs w-20"
                                value={draft.uom}
                                onChange={(e) =>
                                  setComponentEdits((p) => ({ ...p, [c.id]: { ...draft, uom: e.target.value } }))
                                }
                              />
                            </td>
                            <td className="text-right space-x-2">
                              <button
                                className="btn btn-xs btn-outline btn-primary"
                                onClick={() => void saveComponent(c.id)}
                                disabled={!canWrite}
                              >
                                Save
                              </button>
                              <button
                                className="btn btn-xs btn-outline btn-error"
                                onClick={() => void deleteComponent(c.id)}
                                disabled={!canWrite}
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                      {!components.length && (
                        <tr>
                          <td colSpan={7} className="text-center text-base-content/60">
                            No components on selected header.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="text-base-content/60">Select a header to add components.</p>
            )}
          </div>

          <div className="card bg-base-100 border border-base-300 rounded-xl p-4">
            <h2 className="text-lg font-semibold mb-3">BOM Audit Log</h2>
            <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Action</th>
                    <th>Entity</th>
                    <th>Actor</th>
                    <th>Payload</th>
                  </tr>
                </thead>
                <tbody>
                  {auditRows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.createdAt || "N/A"}</td>
                      <td>{row.action}</td>
                      <td>{row.entityType}</td>
                      <td>{row.actor || "system"}</td>
                      <td className="max-w-[520px] truncate" title={row.payloadJson || ""}>
                        {row.payloadJson || "—"}
                      </td>
                    </tr>
                  ))}
                  {!auditRows.length && (
                    <tr>
                      <td colSpan={5} className="text-center text-base-content/60">
                        No audit rows
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
