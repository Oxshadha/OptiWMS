"use client";

import { useEffect, useState } from "react";
import { QRScanner } from "./QRScanner";
import { locationsApi } from "@/lib/api/locations";
import { logger } from "@/lib/utils/logger";

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

  // Racks are not uniform: a bay may hold 4 levels or 8, so a fixed list made real
  // bins unreachable (a level-5 suggestion could not be entered at all). Once the bay
  // is known its actual bins are loaded and drive both selectors; the fixed lists
  // remain as the offline fallback.
  const FALLBACK_LEVELS = ["5", "4", "3", "2", "1"]; // Level 5 (top) to Level 1 (bottom)
  const FALLBACK_BINS = ["A", "B", "C"];
  const [rackLevels, setRackLevels] = useState<string[] | null>(null);
  const [rackBins, setRackBins] = useState<string[] | null>(null);
  const [loadingRack, setLoadingRack] = useState(false);

  const levels = rackLevels ?? FALLBACK_LEVELS;
  const bins = rackBins ?? FALLBACK_BINS;

  const LEVEL_COLORS = [
    "bg-yellow-500",
    "bg-purple-500",
    "bg-blue-500",
    "bg-green-500",
    "bg-rose-500",
    "bg-teal-500",
  ];
  // Colour by height from the floor so level 1 keeps its colour whatever the rack height.
  const levelColor = (value: string) =>
    LEVEL_COLORS[(Number(value) - 1) % LEVEL_COLORS.length] ?? "bg-base-300";

  useEffect(() => {
    if (!warehouseId || !area || !row || !bay) {
      setRackLevels(null);
      setRackBins(null);
      return;
    }

    let cancelled = false;
    setLoadingRack(true);
    locationsApi
      .getRackDetail(warehouseId, `${area}-${row}-${bay}`)
      .then((bins) => {
        if (cancelled) return;
        const levelValues = Array.from(
          new Set(bins.map((item) => item.levelNumber).filter((value): value is number => !!value))
        ).sort((a, b) => b - a);
        const binValues = Array.from(
          new Set(bins.map((item) => item.binPosition).filter((value): value is string => !!value))
        ).sort();
        setRackLevels(levelValues.length > 0 ? levelValues.map(String) : null);
        setRackBins(binValues.length > 0 ? binValues : null);
      })
      .catch((error) => {
        if (cancelled) return;
        // Offline or an unknown bay: keep the fallback lists rather than blocking entry.
        logger.warn("[LocationPicker] Could not load bins for rack:", error);
        setRackLevels(null);
        setRackBins(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingRack(false);
      });

    return () => {
      cancelled = true;
    };
  }, [warehouseId, area, row, bay]);

  // Drop a selection the loaded rack does not actually have.
  useEffect(() => {
    if (level && !levels.includes(level)) setLevel("");
    if (bin && !bins.includes(bin)) setBin("");
  }, [levels, bins]); // eslint-disable-line react-hooks/exhaustive-deps

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
                {loadingRack && (
                  <span className="label-text-alt text-base-content/50">Loading rack…</span>
                )}
              </label>
              <div className="grid grid-cols-5 gap-2">
                {levels.map((l) => (
                  <button
                    key={l}
                    onClick={() => setLevel(l)}
                    className={`btn ${
                      level === l ? "btn-primary" : "btn-outline"
                    } relative px-1 sm:px-4`}
                  >
                    <span className={`absolute top-1.5 left-1.5 sm:top-2 sm:left-2 w-2.5 h-2.5 rounded-full ${levelColor(l)}`}></span>
                    <span className="ml-2 sm:ml-4">{l}</span>
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

