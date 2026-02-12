import { DetailModal } from "@/components/DetailModal";
import { statusClass, type StockTransfer } from "../types";

interface StockTransferDetailModalProps {
  transfer: StockTransfer | null;
  isOpen: boolean;
  onClose: () => void;
  onCancelTransfer: (transfer: StockTransfer) => void;
  onPrintSlip: (transfer: StockTransfer) => void;
}

export function StockTransferDetailModal({
  transfer,
  isOpen,
  onClose,
  onCancelTransfer,
  onPrintSlip,
}: StockTransferDetailModalProps) {
  if (!transfer) {
    return null;
  }

  return (
    <DetailModal isOpen={isOpen} onClose={onClose} title={`Transfer Details: ${transfer.transferNumber}`}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-base-content/60">Transfer Number</label>
            <p className="font-semibold text-base-content">{transfer.transferNumber}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Status</label>
            <p>
              <span className={`badge ${statusClass(transfer.status)}`}>
                {transfer.status.replace("_", " ").toUpperCase()}
              </span>
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Transfer Type</label>
            <p className="font-semibold text-base-content">
              {transfer.transferType === "intra_warehouse" ? "Intra-Warehouse" : "Inter-Warehouse"}
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Quantity</label>
            <p className="font-semibold text-base-content">{transfer.quantity} units</p>
          </div>
        </div>

        <div>
          <label className="text-sm text-base-content/60">Item</label>
          <p className="font-semibold text-base-content">{transfer.itemName}</p>
          <p className="text-sm text-base-content/60">SKU: {transfer.itemSku}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-base-content/60">Source Location</label>
            <p className="font-mono font-bold text-primary text-lg">{transfer.sourceLocationCode}</p>
            {transfer.sourceWarehouse && (
              <p className="text-sm text-base-content/60">Warehouse: {transfer.sourceWarehouse}</p>
            )}
          </div>
          <div>
            <label className="text-sm text-base-content/60">Destination Location</label>
            <p className="font-mono font-bold text-primary text-lg">{transfer.destLocationCode}</p>
            {transfer.destWarehouse && (
              <p className="text-sm text-base-content/60">Warehouse: {transfer.destWarehouse}</p>
            )}
          </div>
        </div>

        {transfer.notes && (
          <div>
            <label className="text-sm text-base-content/60">Notes</label>
            <p className="text-base-content">{transfer.notes}</p>
          </div>
        )}

        <div className="divider"></div>

        <div>
          <h4 className="font-semibold text-base-content mb-2">Timeline</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-base-content/60">Created:</span>
              <span className="text-base-content">{new Date(transfer.createdAt).toLocaleString()}</span>
            </div>
            {transfer.dispatchedAt && (
              <div className="flex justify-between text-sm">
                <span className="text-base-content/60">Dispatched:</span>
                <span className="text-base-content">
                  {new Date(transfer.dispatchedAt).toLocaleString()}
                  {transfer.dispatchedBy && ` by ${transfer.dispatchedBy}`}
                </span>
              </div>
            )}
            {transfer.receivedAt && (
              <div className="flex justify-between text-sm">
                <span className="text-base-content/60">Received:</span>
                <span className="text-base-content">
                  {new Date(transfer.receivedAt).toLocaleString()}
                  {transfer.receivedBy && ` by ${transfer.receivedBy}`}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <button className="btn btn-primary flex-1" onClick={() => onPrintSlip(transfer)}>
            <span className="material-symbols-outlined">print</span>
            Print Transfer Slip
          </button>
          {transfer.status === "draft" && (
            <button
              onClick={() => {
                onCancelTransfer(transfer);
                onClose();
              }}
              className="btn btn-error flex-1"
            >
              <span className="material-symbols-outlined">cancel</span>
              Cancel Transfer
            </button>
          )}
        </div>
      </div>
    </DetailModal>
  );
}
