import { DetailModal } from "@/components/DetailModal";
import { Modal } from "@/components/Modal";
import { StatusChip } from "@/components/StatusChip";
import type { User } from "@/lib/api/users";
import { packingStatusTone, type PackingRecord } from "../types";

interface PackingModalsProps {
  selectedRecord: PackingRecord | null;
  showDetailModal: boolean;
  onCloseDetails: () => void;
  onPrintLabel: (record: PackingRecord) => void;
  onPrintSlip: (record: PackingRecord) => void;
  showAssignModal: boolean;
  selectedRecordForAssign: PackingRecord | null;
  availableWorkers: User[];
  onCloseAssign: () => void;
  onConfirmAssign: (packerId: string) => void;
}

export function PackingModals({
  selectedRecord,
  showDetailModal,
  onCloseDetails,
  onPrintLabel,
  onPrintSlip,
  showAssignModal,
  selectedRecordForAssign,
  availableWorkers,
  onCloseAssign,
  onConfirmAssign,
}: PackingModalsProps) {
  return (
    <>
      {showDetailModal && selectedRecord && (
        <DetailModal isOpen={showDetailModal} onClose={onCloseDetails} title={`Packing Details: ${selectedRecord.orderNumber}`}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-base-content/60">Order Number</label>
                <p className="font-semibold text-base-content">{selectedRecord.orderNumber}</p>
              </div>
              <div>
                <label className="text-sm text-base-content/60">Status</label>
                <p>
                  <StatusChip
                    label={selectedRecord.status.replace("_", " ").toUpperCase()}
                    tone={packingStatusTone(selectedRecord.status)}
                    showDot
                  />
                </p>
              </div>
              <div>
                <label className="text-sm text-base-content/60">Customer</label>
                <p className="font-semibold text-base-content">{selectedRecord.customer}</p>
              </div>
              <div>
                <label className="text-sm text-base-content/60">Priority</label>
                <p>
                  <StatusChip
                    label={selectedRecord.priority === "express" ? "Express" : "Normal"}
                    tone={selectedRecord.priority === "express" ? "danger" : "neutral"}
                  />
                </p>
              </div>
            </div>
            {selectedRecord.packagingType && (
              <div>
                <label className="text-sm text-base-content/60">Packaging Type</label>
                <p className="font-semibold text-base-content capitalize">{selectedRecord.packagingType}</p>
                {selectedRecord.boxDimensions && (
                  <p className="text-sm text-base-content/60">
                    Dimensions: {selectedRecord.boxDimensions.length} × {selectedRecord.boxDimensions.width} × {selectedRecord.boxDimensions.height} cm
                  </p>
                )}
              </div>
            )}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm text-base-content/60">Actual Weight</label>
                <p className="font-semibold text-base-content">{selectedRecord.actualWeight.toFixed(2)} kg</p>
              </div>
              <div>
                <label className="text-sm text-base-content/60">Dimensional Weight</label>
                <p className="font-semibold text-base-content">{selectedRecord.dimensionalWeight.toFixed(2)} kg</p>
              </div>
              <div>
                <label className="text-sm text-base-content/60">Chargeable Weight</label>
                <p className="font-semibold text-base-content">{selectedRecord.chargeableWeight.toFixed(2)} kg</p>
              </div>
            </div>
            {selectedRecord.trackingNumber && (
              <div>
                <label className="text-sm text-base-content/60">Tracking Number</label>
                <p className="font-mono font-semibold text-primary">{selectedRecord.trackingNumber}</p>
              </div>
            )}
            {selectedRecord.packerName && (
              <div>
                <label className="text-sm text-base-content/60">Packer</label>
                <p className="font-semibold text-base-content">{selectedRecord.packerName}</p>
              </div>
            )}
            <div className="divider"></div>
            <div>
              <h4 className="font-semibold text-base-content mb-2">Timeline</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-base-content/60">Created:</span>
                  <span className="text-base-content">{new Date(selectedRecord.createdAt).toLocaleString()}</span>
                </div>
                {selectedRecord.startedAt && (
                  <div className="flex justify-between text-sm">
                    <span className="text-base-content/60">Started:</span>
                    <span className="text-base-content">{new Date(selectedRecord.startedAt).toLocaleString()}</span>
                  </div>
                )}
                {selectedRecord.completedAt && (
                  <div className="flex justify-between text-sm">
                    <span className="text-base-content/60">Completed:</span>
                    <span className="text-base-content">{new Date(selectedRecord.completedAt).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              {selectedRecord.trackingNumber && (
                <>
                  <button onClick={() => onPrintLabel(selectedRecord)} className="btn btn-primary flex-1">
                    <span className="material-symbols-outlined">print</span>
                    Print Label
                  </button>
                  <button onClick={() => onPrintSlip(selectedRecord)} className="btn btn-outline btn-primary flex-1">
                    <span className="material-symbols-outlined">print</span>
                    Print Slip
                  </button>
                </>
              )}
            </div>
          </div>
        </DetailModal>
      )}

      {showAssignModal && selectedRecordForAssign && (
        <Modal isOpen={showAssignModal} onClose={onCloseAssign} title="Assign Packer">
          <div className="p-6 space-y-4">
            <p className="text-base-content/70">
              Select a worker to assign to order <strong>{selectedRecordForAssign.orderNumber}</strong>
            </p>
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Select Packer</span>
              </label>
              <select
                className="select select-bordered w-full"
                onChange={(e) => {
                  if (e.target.value) {
                    onConfirmAssign(e.target.value);
                  }
                }}
              >
                <option value="">Select a worker...</option>
                {availableWorkers.map((worker) => (
                  <option key={worker.id} value={worker.id}>
                    {worker.firstName} {worker.lastName} ({worker.username})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <button className="btn btn-ghost" onClick={onCloseAssign}>
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
