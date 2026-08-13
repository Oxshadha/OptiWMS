"use client";

import { useEffect, useMemo, useState } from "react";
import { useAdmin } from "@/contexts/AdminContext";
import { ADMIN_ROUTES } from "@/lib/admin-roles";
import { materialsApi, type Material } from "@/lib/api/materials";
import { warehousesApi, type Warehouse } from "@/lib/api/warehouses";
import {
  bomMasterApi,
  type BomComponent,
  type BomHeader,
} from "@/lib/api/bom-master";
import {
  forecastSkuMappingApi,
  type ForecastSkuMapping,
} from "@/lib/api/forecast-sku-mapping";
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

type MappingDraft = {
  dataset: string;
  forecastSku: string;
  wmsMaterialId: string;
  warehouseId: string;
  isActive: boolean;
  notes: string;
};

const EMPTY_MAPPING_DRAFT: MappingDraft = {
  dataset: "",
  forecastSku: "",
  wmsMaterialId: "",
  warehouseId: "",
  isActive: true,
  notes: "",
};

export default function BomMasterPage() {
  const { hasPermission } = useAdmin();
  const canWrite = hasPermission(ADMIN_ROUTES.BOM_MASTER, "edit");

  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [headers, setHeaders] = useState<BomHeader[]>([]);
  const [skuMappings, setSkuMappings] = useState<ForecastSkuMapping[]>([]);
  const [selectedHeaderId, setSelectedHeaderId] = useState<string>("");
  const [components, setComponents] = useState<BomComponent[]>([]);
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
  const [newMapping, setNewMapping] = useState<MappingDraft>(EMPTY_MAPPING_DRAFT);
  const [mappingEdits, setMappingEdits] = useState<Record<string, MappingDraft>>({});
  const [headerSearch, setHeaderSearch] = useState("");

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

  const childMaterialOptions = useMemo(
    () =>
      materials.filter((m) => {
        const t = (m.materialType || "").toLowerCase();
        return t === "raw_material" || t === "packaging_material" || t === "packaging";
      }),
    [materials],
  );

  const filteredHeaders = useMemo(() => {
    const query = headerSearch.trim().toLowerCase();
    if (!query) return headers;
    return headers.filter((header) => {
      const material = materialMap.get(header.parentMaterialId);
      return [material?.materialCode, material?.description, header.version, header.status]
        .some((value) => String(value || "").toLowerCase().includes(query));
    });
  }, [headerSearch, headers, materialMap]);

  const bomSummary = useMemo(() => ({
    finishedGoods: materials.filter((m) => (m.materialType || "").toLowerCase() === "product").length,
    rawMaterials: materials.filter((m) => (m.materialType || "").toLowerCase() === "raw_material").length,
    packagingMaterials: materials.filter((m) => (m.materialType || "").toLowerCase() === "packaging_material").length,
  }), [materials]);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [materialsData, warehousesData, headersData, mappings] = await Promise.all([
        materialsApi.getAll(),
        warehousesApi.getAll(),
        bomMasterApi.listHeaders(),
        forecastSkuMappingApi.list(),
      ]);
      setMaterials(materialsData);
      setWarehouses(warehousesData);
      const nextHeaders = headersData.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
      setHeaders(nextHeaders);
      const nextMappings = mappings.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
      setSkuMappings(nextMappings);
      const nextEdits: Record<string, MappingDraft> = {};
      nextMappings.forEach((row) => {
        nextEdits[row.id] = {
          dataset: row.dataset || "",
          forecastSku: row.forecastSku || "",
          wmsMaterialId: row.wmsMaterialId || "",
          warehouseId: row.warehouseId || "",
          isActive: row.isActive,
          notes: row.notes || "",
        };
      });
      setMappingEdits(nextEdits);

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

  const createSkuMapping = async () => {
    if (!newMapping.forecastSku.trim()) {
      showToast.error("Forecast SKU is required");
      return;
    }
    if (!newMapping.wmsMaterialId) {
      showToast.error("WMS material is required");
      return;
    }
    try {
      await forecastSkuMappingApi.create({
        dataset: newMapping.dataset || null,
        forecastSku: newMapping.forecastSku.trim().toUpperCase(),
        wmsMaterialId: newMapping.wmsMaterialId,
        warehouseId: newMapping.warehouseId || null,
        isActive: newMapping.isActive,
        notes: newMapping.notes || null,
      });
      showToast.success("Forecast SKU mapping created");
      setNewMapping(EMPTY_MAPPING_DRAFT);
      await loadAll();
    } catch (error) {
      logger.error("[BomMasterPage] Failed to create forecast SKU mapping", error);
      showToast.error("Failed to create forecast SKU mapping");
    }
  };

  const saveSkuMapping = async (id: string) => {
    const draft = mappingEdits[id];
    if (!draft) return;
    try {
      await forecastSkuMappingApi.update(id, {
        dataset: draft.dataset || null,
        forecastSku: draft.forecastSku.trim().toUpperCase(),
        wmsMaterialId: draft.wmsMaterialId,
        warehouseId: draft.warehouseId || null,
        isActive: draft.isActive,
        notes: draft.notes || null,
      });
      showToast.success("Forecast SKU mapping updated");
      await loadAll();
    } catch (error) {
      logger.error("[BomMasterPage] Failed to update forecast SKU mapping", error);
      showToast.error("Failed to update forecast SKU mapping");
    }
  };

  const deleteSkuMapping = async (id: string) => {
    if (!window.confirm("Delete this forecast SKU mapping?")) return;
    try {
      await forecastSkuMappingApi.delete(id);
      showToast.success("Forecast SKU mapping deleted");
      await loadAll();
    } catch (error) {
      logger.error("[BomMasterPage] Failed to delete forecast SKU mapping", error);
      showToast.error("Failed to delete forecast SKU mapping");
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
    if (
      newHeader.effectiveFrom &&
      newHeader.effectiveTo &&
      new Date(newHeader.effectiveTo) < new Date(newHeader.effectiveFrom)
    ) {
      showToast.error("Effective To cannot be earlier than Effective From.");
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
          Manage finished-good BOM records and component lines used for raw/packaging demand planning.
        </p>
      </div>

      <div className="card bg-base-100 border border-base-300 rounded-xl p-4">
        <p className="text-sm text-base-content/70">
          <span className="font-semibold">BOM Record:</span> one finished-good SKU definition (version/date range).
          {" "}
          <span className="font-semibold">Component Line:</span> one raw or packaging material inside that BOM.
          {" "}
          <span className="font-semibold">Scrap Rate:</span> expected process loss ratio for that component.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ["Finished-good BOMs", headers.length],
          ["Finished goods", bomSummary.finishedGoods],
          ["Raw materials", bomSummary.rawMaterials],
          ["Packaging materials", bomSummary.packagingMaterials],
        ].map(([label, value]) => (
          <div key={String(label)} className="border border-base-300 bg-base-100 p-3 rounded-lg">
            <p className="text-xs text-base-content/60">{label}</p>
            <p className="text-xl font-bold mt-1">{value}</p>
          </div>
        ))}
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
              <h2 className="text-lg font-semibold">Create BOM Record</h2>
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
                    min={newHeader.effectiveFrom || undefined}
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
                  Create BOM Record
                </button>
              </div>
            </div>

            <div className="card bg-base-100 border border-base-300 rounded-xl p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="text-lg font-semibold">Finished Good to Components</h2>
                <input
                  className="input input-bordered input-sm w-52"
                  placeholder="Search FG SKU or name"
                  value={headerSearch}
                  onChange={(event) => setHeaderSearch(event.target.value)}
                />
              </div>
              <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Parent SKU</th>
                      <th>Finished Good</th>
                      <th>Warehouse</th>
                      <th>Version</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHeaders.map((h) => (
                      <tr key={h.id} className={selectedHeaderId === h.id ? "bg-base-200" : ""}>
                        <td>{materialMap.get(h.parentMaterialId)?.materialCode || h.parentMaterialId}</td>
                        <td className="max-w-44 truncate">{materialMap.get(h.parentMaterialId)?.description || "-"}</td>
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
                    {!filteredHeaders.length && (
                      <tr>
                        <td colSpan={6} className="text-center text-base-content/60">
                          No matching BOM records
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <details className="collapse collapse-arrow bg-base-100 border border-base-300 rounded-xl">
            <summary className="collapse-title text-base font-semibold">Advanced forecast SKU mapping</summary>
            <div className="collapse-content space-y-4">
            <p className="text-sm text-base-content/70">
              Use explicit map rows for forecast SKU namespace to WMS product SKU namespace.
              This is the enterprise-safe path for shadow evaluation and model governance.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
              <label className="form-control">
                <span className="label-text text-xs mb-1">Dataset</span>
                <input
                  className="input input-bordered"
                  placeholder="B"
                  value={newMapping.dataset}
                  onChange={(e) => setNewMapping((p) => ({ ...p, dataset: e.target.value }))}
                />
              </label>
              <label className="form-control">
                <span className="label-text text-xs mb-1">Forecast SKU</span>
                <input
                  className="input input-bordered"
                  placeholder="FG001"
                  value={newMapping.forecastSku}
                  onChange={(e) => setNewMapping((p) => ({ ...p, forecastSku: e.target.value }))}
                />
              </label>
              <label className="form-control md:col-span-2">
                <span className="label-text text-xs mb-1">WMS Product Material</span>
                <select
                  className="select select-bordered"
                  value={newMapping.wmsMaterialId}
                  onChange={(e) => setNewMapping((p) => ({ ...p, wmsMaterialId: e.target.value }))}
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
                  value={newMapping.warehouseId}
                  onChange={(e) => setNewMapping((p) => ({ ...p, warehouseId: e.target.value }))}
                >
                  <option value="">Global</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-control">
                <span className="label-text text-xs mb-1">Status</span>
                <select
                  className="select select-bordered"
                  value={newMapping.isActive ? "active" : "inactive"}
                  onChange={(e) => setNewMapping((p) => ({ ...p, isActive: e.target.value === "active" }))}
                >
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                </select>
              </label>
            </div>
            <label className="form-control">
              <span className="label-text text-xs mb-1">Notes</span>
              <input
                className="input input-bordered"
                value={newMapping.notes}
                onChange={(e) => setNewMapping((p) => ({ ...p, notes: e.target.value }))}
              />
            </label>
            <div>
              <button className="btn btn-primary" onClick={createSkuMapping} disabled={!canWrite}>
                Add SKU Mapping
              </button>
            </div>
            <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Dataset</th>
                    <th>Forecast SKU</th>
                    <th>WMS SKU</th>
                    <th>Warehouse</th>
                    <th>Status</th>
                    <th>Notes</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {skuMappings.map((row) => {
                    const draft = mappingEdits[row.id] || EMPTY_MAPPING_DRAFT;
                    return (
                      <tr key={row.id}>
                        <td>
                          <input
                            className="input input-bordered input-xs w-20"
                            value={draft.dataset}
                            onChange={(e) => setMappingEdits((p) => ({ ...p, [row.id]: { ...draft, dataset: e.target.value } }))}
                          />
                        </td>
                        <td>
                          <input
                            className="input input-bordered input-xs w-24"
                            value={draft.forecastSku}
                            onChange={(e) => setMappingEdits((p) => ({ ...p, [row.id]: { ...draft, forecastSku: e.target.value } }))}
                          />
                        </td>
                        <td>
                          <select
                            className="select select-bordered select-xs w-56"
                            value={draft.wmsMaterialId}
                            onChange={(e) => setMappingEdits((p) => ({ ...p, [row.id]: { ...draft, wmsMaterialId: e.target.value } }))}
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
                        </td>
                        <td>
                          <select
                            className="select select-bordered select-xs w-36"
                            value={draft.warehouseId}
                            onChange={(e) => setMappingEdits((p) => ({ ...p, [row.id]: { ...draft, warehouseId: e.target.value } }))}
                          >
                            <option value="">Global</option>
                            {warehouses.map((w) => (
                              <option key={w.id} value={w.id}>
                                {w.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <select
                            className="select select-bordered select-xs w-24"
                            value={draft.isActive ? "active" : "inactive"}
                            onChange={(e) => setMappingEdits((p) => ({ ...p, [row.id]: { ...draft, isActive: e.target.value === "active" } }))}
                          >
                            <option value="active">active</option>
                            <option value="inactive">inactive</option>
                          </select>
                        </td>
                        <td>
                          <input
                            className="input input-bordered input-xs w-48"
                            value={draft.notes}
                            onChange={(e) => setMappingEdits((p) => ({ ...p, [row.id]: { ...draft, notes: e.target.value } }))}
                          />
                        </td>
                        <td className="text-right space-x-2">
                          <button className="btn btn-xs btn-outline btn-primary" onClick={() => void saveSkuMapping(row.id)} disabled={!canWrite}>
                            Save
                          </button>
                          <button className="btn btn-xs btn-outline btn-error" onClick={() => void deleteSkuMapping(row.id)} disabled={!canWrite}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {!skuMappings.length && (
                    <tr>
                      <td colSpan={7} className="text-center text-base-content/60">
                        No forecast SKU mappings yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            </div>
          </details>

          <div className="card bg-base-100 border border-base-300 rounded-xl p-4 space-y-4">
            <h2 className="text-lg font-semibold">Selected BOM Record</h2>
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
                  Save BOM Record
                </button>
              </>
            ) : (
              <p className="text-base-content/60">Select a BOM record to manage components.</p>
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
                      {childMaterialOptions
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
                <p className="text-xs text-base-content/60">
                  Lead Time Days = procurement lead time for this component line. UOM = unit of measure (kg, liters, pcs, etc).
                </p>
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
              <p className="text-base-content/60">Select a BOM record to add components.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
