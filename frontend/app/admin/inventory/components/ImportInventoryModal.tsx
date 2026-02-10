"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { materialsApi } from "@/lib/api/materials";
import { showToast } from "@/lib/utils/toast";
import { logger } from "@/lib/utils/logger";

export function ImportInventoryModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const handleImport = async () => {
    if (!file) {
      showToast.error("Please select a file");
      return;
    }

    try {
      setImporting(true);
      const result = await materialsApi.importInventoryCsv(file);
      if (result.successCount > 0) {
        showToast.success(
          `Successfully imported ${result.successCount} inventory items`
        );
        await onSuccess();
      }
      if (result.errorCount > 0) {
        showToast.error(`${result.errorCount} items failed to import`);
      }
    } catch (error: any) {
      logger.error("[Inventory] Import failed:", error);
      showToast.error(error.message || "Failed to import inventory");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Import Inventory from CSV">
      <div className="space-y-4">
        <div className="alert alert-info">
          <span className="material-symbols-outlined">info</span>
          <div>
            <div className="font-semibold">Import Active stock.csv</div>
            <div className="text-sm">
              This will <strong>update existing inventory records</strong> with
              values from CSV. All planning fields (ROP, Buffer Stock, MOQ,
              etc.) will be updated. This will import stock levels for
              materials. Materials will be auto-created if they don&apos;t exist.
              <br />
              <strong>Note:</strong> Quantity is extracted from &quot;Future
              Average&quot; column (Column 9).
            </div>
          </div>
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">CSV File</span>
          </label>
          <input
            type="file"
            accept=".csv"
            className="file-input file-input-bordered w-full"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            disabled={importing}
          />
          <label className="label">
            <span className="label-text-alt">
              Expected format: Material Code, Unit Type, Description, Supply
              Plan, ..., Future Average (Column 9 = Quantity), ...
            </span>
          </label>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button className="btn btn-ghost" onClick={onClose} disabled={importing}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleImport}
            disabled={!file || importing}
          >
            {importing ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Importing...
              </>
            ) : (
              "Import"
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}
