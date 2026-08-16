"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DataTable } from "@/components/DataTable";
import { Pagination } from "@/components/Pagination";
import { SummaryCards } from "@/components/SummaryCards";
import { useAdmin } from "@/contexts/AdminContext";
import { ADMIN_ROUTES } from "@/lib/admin-roles";
import { materialsApi, type Material } from "@/lib/api/materials";
import { qualityChecksApi } from "@/lib/api/qualityChecks";
import {
  useInvalidateAdminList,
  usePagedAdminQuery,
  useReferenceMaterials,
  useReferenceUsers,
} from "@/lib/hooks/useQuery";
import { showToast } from "@/lib/utils/toast";
import { logger } from "@/lib/utils/logger";
import { QualityCheckDetailModal, RejectQualityCheckModal } from "./components/QualityCheckModals";
import {
  buildColumns,
  buildRenderActions,
  buildSummaryCards,
} from "./tableConfig";
import type { QualityCheckDisplay } from "./types";

export default function QualityChecksPage() {
  const { hasPermission, admin, role } = useAdmin();
  const isWarehouseManager = role === "warehouse_manager";
  const assignedWarehouseName = admin?.warehouseName;
  const canApprove = hasPermission(ADMIN_ROUTES.QUALITY_CHECKS, "approve");

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [selectedCheck, setSelectedCheck] = useState<QualityCheckDisplay | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const qualityChecksQuery = usePagedAdminQuery({
    queryKey: ["admin-quality-checks"],
    queryFn: () => qualityChecksApi.getAll(),
    staleTime: 60 * 1000,
  });
  const materialsQuery = useReferenceMaterials();
  const usersQuery = useReferenceUsers();
  const reload = useInvalidateAdminList(["admin-quality-checks"]);

  // The shared materials reference list only carries operational-tier materials, so a
  // check against an archived or untiered material would otherwise render as "Unknown".
  // Those few are fetched by id, which the API serves regardless of tier.
  const missingMaterialIds = useMemo(() => {
    const known = new Set((materialsQuery.data || []).map((material) => material.id));
    const missing = new Set<string>();
    (qualityChecksQuery.data || []).forEach((check) => {
      if (check.materialId && !check.materialDescription && !known.has(check.materialId)) {
        missing.add(check.materialId);
      }
    });
    return Array.from(missing).sort();
  }, [materialsQuery.data, qualityChecksQuery.data]);

  const extraMaterialsQuery = useQuery({
    queryKey: ["quality-check-materials", missingMaterialIds],
    enabled: missingMaterialIds.length > 0,
    staleTime: 15 * 60 * 1000,
    queryFn: async () => {
      const fetched = await Promise.all(
        missingMaterialIds.map((id) =>
          materialsApi.getById(id).catch((error) => {
            logger.warn("Failed to load material for quality check:", id, error);
            return null;
          })
        )
      );
      return fetched.filter((material): material is Material => material !== null);
    },
  });

  const qualityChecks = useMemo<QualityCheckDisplay[]>(() => {
    const materialsMap = new Map<string, { name: string; sku: string }>();
    [...(materialsQuery.data || []), ...(extraMaterialsQuery.data || [])].forEach((material) => {
      materialsMap.set(material.id, {
        name: material.description || "Unknown",
        sku: material.materialCode || material.id,
      });
    });

    const usersMap = new Map<string, string>();
    (usersQuery.data || []).forEach((user) => {
      const displayName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.username || user.email || "Unknown";
      usersMap.set(user.id, displayName);
    });

    return (qualityChecksQuery.data || []).map((qualityCheck) => {
      const material = qualityCheck.materialId ? materialsMap.get(qualityCheck.materialId) : null;
      const checkedBy = qualityCheck.checkedBy ? usersMap.get(qualityCheck.checkedBy) || "Unknown" : "Unknown";
      const approvedBy = qualityCheck.approvedBy ? usersMap.get(qualityCheck.approvedBy) || "Unknown" : null;

      const qtyReceived = parseInt(qualityCheck.qtyReceived) || 0;
      const qtyPassed = parseInt(qualityCheck.qtyPassed) || 0;
      const qtyRejected = parseInt(qualityCheck.qtyRejected) || 0;
      const approvalStatus = (qualityCheck.approvalStatus || "").toUpperCase();

      let result: QualityCheckDisplay["result"] = "partial";
      if (approvalStatus === "APPROVED") {
        result = "passed";
      } else if (approvalStatus === "REJECTED") {
        result = "failed";
      } else if (qtyRejected === 0 && qtyPassed > 0) {
        result = "passed";
      } else if (qtyPassed === 0 && qtyRejected > 0) {
        result = "failed";
      }

      return {
        id: qualityCheck.id,
        checkId: `QC-${qualityCheck.id.substring(0, 8).toUpperCase()}`,
        inboundOrderNumber: qualityCheck.grnId ? `GRN-${qualityCheck.grnId.substring(0, 8).toUpperCase()}` : "N/A",
        productName: qualityCheck.materialDescription || material?.name || "Unknown",
        sku: qualityCheck.materialCode || material?.sku || "N/A",
        quantityChecked: qtyReceived,
        quantityPassed: qtyPassed,
        quantityFailed: qtyRejected,
        result,
        checkedByName: checkedBy,
        checkDate: qualityCheck.checkDate ? new Date(qualityCheck.checkDate).toLocaleString() : new Date().toLocaleString(),
        approvedByName: approvedBy,
        approvalDate: qualityCheck.approvedAt ? new Date(qualityCheck.approvedAt).toLocaleString() : null,
        warehouseName: "Unknown",
      };
    });
  }, [extraMaterialsQuery.data, materialsQuery.data, qualityChecksQuery.data, usersQuery.data]);

  const qualityChecksForWarehouse =
    isWarehouseManager && assignedWarehouseName
      ? qualityChecks.filter((check) => check.warehouseName === assignedWarehouseName)
      : qualityChecks;

  const summary = {
    totalChecksThisMonth: qualityChecksForWarehouse.length,
    pendingApproval: qualityChecksForWarehouse.filter((check) => !check.approvedByName).length,
    passRate:
      qualityChecksForWarehouse.length > 0
        ? Number(
            ((qualityChecksForWarehouse.filter((check) => check.result === "passed").length /
              qualityChecksForWarehouse.length) *
              100).toFixed(2)
          )
        : 0,
    rejectedItems: qualityChecksForWarehouse.reduce((sum, check) => sum + check.quantityFailed, 0),
  };

  const filteredChecks = qualityChecksForWarehouse.filter((check) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      check.checkId.toLowerCase().includes(query) ||
      check.inboundOrderNumber.toLowerCase().includes(query) ||
      check.productName.toLowerCase().includes(query) ||
      check.sku.toLowerCase().includes(query) ||
      check.quantityChecked.toString().includes(query) ||
      check.quantityPassed.toString().includes(query) ||
      check.quantityFailed.toString().includes(query) ||
      check.result.toLowerCase().includes(query) ||
      check.checkedByName.toLowerCase().includes(query) ||
      check.checkDate.toLowerCase().includes(query) ||
      (check.approvedByName && check.approvedByName.toLowerCase().includes(query)) ||
      (check.approvalDate && check.approvalDate.toLowerCase().includes(query));

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "pending" && !check.approvedByName) ||
      (statusFilter === "approved" && check.approvedByName);

    return matchesSearch && matchesStatus;
  });
  const pagedChecks = filteredChecks.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  const totalPages = Math.max(Math.ceil(filteredChecks.length / itemsPerPage), 1);

  const summaryCards = useMemo(() => buildSummaryCards(summary), [summary]);
  const columns = useMemo(
    () =>
      buildColumns((check) => {
        setSelectedCheck(check);
        setShowDetailModal(true);
      }),
    []
  );

  const renderActions = useMemo(
    () =>
      buildRenderActions({
        canApprove,
        adminId: admin?.id,
        onRefresh: reload,
        onOpenDetails: (check) => {
          setSelectedCheck(check);
          setShowDetailModal(true);
        },
        onOpenReject: (check) => {
          setSelectedCheck(check);
          setShowRejectModal(true);
        },
      }),
    [canApprove, admin?.id]
  );

  const loading =
    (qualityChecksQuery.isPending && !qualityChecksQuery.data) ||
    (materialsQuery.isPending && !materialsQuery.data) ||
    (usersQuery.isPending && !usersQuery.data);
  const error =
    qualityChecksQuery.error || materialsQuery.error || usersQuery.error
      ? qualityChecksQuery.error instanceof Error
        ? qualityChecksQuery.error.message
        : "Failed to load quality checks"
      : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (error && qualityChecks.length === 0) {
    return (
      <div className="alert alert-error">
        <span className="material-symbols-outlined">error</span>
        <span>Error loading quality checks: {error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-base-content">Quality Checks</h1>
          <p className="text-sm text-base-content/60 mt-1">Review and approve quality inspection results</p>
        </div>
        <div className="flex gap-3">
          <div className="form-control">
            <input
              type="text"
              placeholder="Search quality checks..."
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
              <li><button onClick={() => setStatusFilter("all")}>All</button></li>
              <li><button onClick={() => setStatusFilter("pending")}>Pending Approval</button></li>
              <li><button onClick={() => setStatusFilter("approved")}>Approved</button></li>
            </ul>
          </div>
        </div>
      </div>

      <SummaryCards cards={summaryCards} />

      <DataTable
        data={pagedChecks}
        columns={columns}
        keyExtractor={(check) => check.id}
        onRowClick={(check) => {
          setSelectedCheck(check);
          setShowDetailModal(true);
        }}
        actions={renderActions}
        emptyMessage="No quality checks found"
      />
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        itemsPerPage={itemsPerPage}
        totalItems={filteredChecks.length}
        showItemsPerPage
        onItemsPerPageChange={(next) => {
          setItemsPerPage(next);
          setCurrentPage(1);
        }}
      />

      {selectedCheck && (
        <QualityCheckDetailModal
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedCheck(null);
          }}
          check={selectedCheck}
          adminId={admin?.id}
          onRefresh={reload}
          canApprove={canApprove}
          onReject={() => {
            setShowDetailModal(false);
            setShowRejectModal(true);
          }}
        />
      )}

      <RejectQualityCheckModal
        isOpen={showRejectModal}
        check={selectedCheck}
        rejectReason={rejectReason}
        adminId={admin?.id}
        onChangeRejectReason={setRejectReason}
        onClose={() => {
          setShowRejectModal(false);
          setSelectedCheck(null);
          setRejectReason("");
        }}
        onRejected={async () => {
          await reload();
          setShowRejectModal(false);
          setSelectedCheck(null);
          setRejectReason("");
        }}
      />
    </div>
  );
}
