"use client";

import { useState } from "react";
import { QRScanner } from "./QRScanner";

interface LocationPickerProps {
  onLocationSelect: (locationCode: string) => void;
  onClose: () => void;
  title?: string;
  warehouseId?: string;
}

export function LocationPicker({ 
  onLocationSelect, 
  onClose, 
  title = "Select Location",
  warehouseId 
}: LocationPickerProps) {
  const [area, setArea] = useState<string>("");
  const [row, setRow] = useState<string>("");
  const [bay, setBay] = useState<string>("");
  const [level, setLevel] = useState<string>("");
  const [bin, setBin] = useState<string>("");
  const [showQRScanner, setShowQRScanner] = useState(false);

  const areas = ["A", "B", "C", "D", "R"];
  const rows = Array.from({ length: 50 }, (_, i) => String(i + 1).padStart(2, "0"));
  const bays = Array.from({ length: 20 }, (_, i) => String(i + 1).padStart(2, "0"));
  const levels = ["4", "3", "2", "1"]; // Level 4 (top) to Level 1 (bottom)
  const bins = ["A", "B", "C"];

  const levelColors: Record<string, string> = {
    "4": "bg-green-500",
    "3": "bg-blue-500",
    "2": "bg-purple-500",
    "1": "bg-yellow-500",
  };

  const handleQRScan = (code: string) => {
    // Parse location code: A-01-01-4-A
    const parts = code.split("-");
    if (parts.length === 5) {
      setArea(parts[0]);
      setRow(parts[1]);
      setBay(parts[2]);
      setLevel(parts[3]);
      setBin(parts[4]);
      setShowQRScanner(false);
    } else {
      alert("Invalid location code format. Expected: A-01-01-4-A");
    }
  };

  const handleConfirm = () => {
    if (!area || !row || !bay || !level || !bin) {
      alert("Please select all location components");
      return;
    }
    const locationCode = `${area}-${row}-${bay}-${level}-${bin}`;
    onLocationSelect(locationCode);
  };

  const locationCode = area && row && bay && level && bin 
    ? `${area}-${row}-${bay}-${level}-${bin}` 
    : "";

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-base-100 rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-base-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-base-content">{title}</h2>
            <button
              onClick={onClose}
              className="btn btn-ghost btn-sm btn-circle"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* QR Scanner Option */}
          <div className="flex justify-center">
            <button
              onClick={() => setShowQRScanner(true)}
              className="btn btn-outline btn-primary"
            >
              <span className="material-symbols-outlined">qr_code_scanner</span>
              Scan Location QR Code
            </button>
          </div>

          <div className="divider">OR</div>

          {/* Manual Selection */}
          <div className="space-y-4">
            {/* Area Selection */}
            <div>
              <label className="label">
                <span className="label-text font-medium">Area *</span>
              </label>
              <div className="grid grid-cols-5 gap-2">
                {areas.map((a) => (
                  <button
                    key={a}
                    onClick={() => setArea(a)}
                    className={`btn ${area === a ? "btn-primary" : "btn-outline"}`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            {/* Row Selection */}
            <div>
              <label className="label">
                <span className="label-text font-medium">Row *</span>
              </label>
              <select
                className="select select-bordered w-full"
                value={row}
                onChange={(e) => setRow(e.target.value)}
              >
                <option value="">Select Row</option>
                {rows.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {/* Bay Selection */}
            <div>
              <label className="label">
                <span className="label-text font-medium">Bay *</span>
              </label>
              <select
                className="select select-bordered w-full"
                value={bay}
                onChange={(e) => setBay(e.target.value)}
              >
                <option value="">Select Bay</option>
                {bays.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            {/* Level Selection with Colors */}
            <div>
              <label className="label">
                <span className="label-text font-medium">Level *</span>
              </label>
              <div className="grid grid-cols-4 gap-2">
                {levels.map((l) => (
                  <button
                    key={l}
                    onClick={() => setLevel(l)}
                    className={`btn ${
                      level === l ? "btn-primary" : "btn-outline"
                    } relative`}
                  >
                    <span className={`absolute top-1 left-1 w-3 h-3 rounded-full ${levelColors[l]}`}></span>
                    <span className="ml-4">Level {l}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Bin Selection */}
            <div>
              <label className="label">
                <span className="label-text font-medium">Bin/Position *</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {bins.map((b) => (
                  <button
                    key={b}
                    onClick={() => setBin(b)}
                    className={`btn ${bin === b ? "btn-primary" : "btn-outline"}`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Location Preview */}
          {locationCode && (
            <div className="card bg-base-200 p-4">
              <div className="text-sm text-base-content/60 mb-2">Location Code:</div>
              <div className="text-2xl font-bold text-base-content font-mono">
                {locationCode}
              </div>
              <div className="text-xs text-base-content/50 mt-2">
                Format: AREA - ROW - BAY - LEVEL - POS
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <button onClick={onClose} className="btn btn-ghost flex-1">
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!locationCode}
              className="btn btn-primary flex-1"
            >
              Confirm Location
            </button>
          </div>
        </div>
      </div>

      {/* QR Scanner Modal */}
      {showQRScanner && (
        <QRScanner
          isOpen={showQRScanner}
          onClose={() => setShowQRScanner(false)}
          onScan={handleQRScan}
          title="Scan Location QR Code"
        />
      )}
    </div>
  );
}

