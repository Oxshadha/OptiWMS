"use client";

import { useState, useRef } from "react";
import { QRScanner } from "@/components/QRScanner";
import { Modal } from "@/components/Modal";

export default function PutawayPage() {
  const [scannedLPN, setScannedLPN] = useState("");
  const [scannedLocation, setScannedLocation] = useState("");
  const [showLPNScanner, setShowLPNScanner] = useState(false);
  const [showLocationScanner, setShowLocationScanner] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [note, setNote] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const task = {
    lpn: "LPN-123",
    fromLocation: "Stage Area",
    toLocation: "Aisle A / Bin A5",
    item: "Wireless Earbuds",
    qty: 50,
  };

  const handleScanLPN = () => {
    setShowLPNScanner(true);
  };

  const handleScanLocation = () => {
    setShowLocationScanner(true);
  };

  const handleLPNScan = (result: string) => {
    setScannedLPN(result);
    setShowLPNScanner(false);
  };

  const handleLocationScan = (result: string) => {
    setScannedLocation(result);
    setShowLocationScanner(false);
  };

  const handleConfirm = () => {
    if (scannedLPN && scannedLocation) {
      // Handle confirmation
      console.log("Putaway confirmed", { scannedLPN, scannedLocation, note, photos });
      // TODO: API call to confirm putaway
    }
  };

  const handleTakePhoto = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotos((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveNote = () => {
    console.log("Note saved:", note);
    setShowNoteModal(false);
  };

  return (
    <div className="p-4 space-y-4">
      {/* Task Overview */}
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <div className="text-xs text-base-content/60 mb-1">Putaway Task</div>
        <div className="font-bold text-lg text-base-content mb-4">
          Move {task.lpn} to {task.toLocation}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-base-200 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base-content/60">inventory</span>
              <span className="text-sm text-base-content/60">Item</span>
            </div>
            <span className="font-semibold text-base-content">{task.item}</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-base-200 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base-content/60">numbers</span>
              <span className="text-sm text-base-content/60">Quantity</span>
            </div>
            <span className="font-semibold text-base-content">{task.qty}</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-base-200 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base-content/60">location_on</span>
              <span className="text-sm text-base-content/60">From</span>
            </div>
            <span className="font-semibold text-base-content">{task.fromLocation}</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg border border-primary/20">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">location_on</span>
              <span className="text-sm text-primary font-medium">To Location</span>
            </div>
            <span className="font-bold text-primary">{task.toLocation}</span>
          </div>
        </div>
      </div>

      {/* Scan LPN */}
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <div className="text-sm font-medium text-base-content mb-2">Scan LPN</div>
        <div className="flex gap-2">
          <input
            className="input input-bordered flex-1"
            placeholder="Scan or enter LPN"
            value={scannedLPN}
            onChange={(e) => setScannedLPN(e.target.value)}
          />
          <button
            onClick={handleScanLPN}
            className="btn btn-primary btn-square"
            title="Scan LPN"
          >
            <span className="material-symbols-outlined">qr_code_scanner</span>
          </button>
        </div>
        {scannedLPN && (
          <div className="mt-2 text-xs text-success flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">check_circle</span>
            LPN scanned: {scannedLPN}
          </div>
        )}
      </div>

      {/* Scan Location */}
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <div className="text-sm font-medium text-base-content mb-2">Scan Target Location</div>
        <div className="flex gap-2">
          <input
            className="input input-bordered flex-1"
            placeholder="Scan or enter location"
            value={scannedLocation}
            onChange={(e) => setScannedLocation(e.target.value)}
          />
          <button
            onClick={handleScanLocation}
            className="btn btn-primary btn-square"
            title="Scan Location"
          >
            <span className="material-symbols-outlined">qr_code_scanner</span>
          </button>
        </div>
        {scannedLocation && (
          <div className="mt-2 text-xs text-success flex items-center gap-1">
            <span className="material-symbols-outlined text-sm">check_circle</span>
            Location scanned: {scannedLocation}
          </div>
        )}
      </div>

      {/* Confirm Button */}
      <button
        onClick={handleConfirm}
        className="btn btn-primary w-full btn-lg"
        disabled={!scannedLPN || !scannedLocation}
      >
        <span className="material-symbols-outlined">check_circle</span>
        Confirm Putaway
      </button>

      {/* Quick Actions */}
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <h3 className="font-bold text-base-content mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-2">
          <button 
            onClick={handleTakePhoto}
            className="btn btn-outline btn-sm"
          >
            <span className="material-symbols-outlined">photo_camera</span>
            Take Photo {photos.length > 0 && `(${photos.length})`}
          </button>
          <button 
            onClick={() => setShowNoteModal(true)}
            className="btn btn-outline btn-sm"
          >
            <span className="material-symbols-outlined">note_add</span>
            Add Note {note && "✓"}
          </button>
        </div>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept="image/*"
          capture="environment"
        />
        {photos.length > 0 && (
          <div className="mt-3 flex gap-2 overflow-x-auto">
            {photos.map((photo, idx) => (
              <div key={idx} className="relative">
                <img src={photo} alt={`Photo ${idx + 1}`} className="w-20 h-20 object-cover rounded-lg" />
                <button
                  onClick={() => setPhotos(photos.filter((_, i) => i !== idx))}
                  className="absolute -top-2 -right-2 btn btn-circle btn-xs btn-error"
                >
                  <span className="material-symbols-outlined text-xs">close</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* QR Scanners */}
      <QRScanner
        isOpen={showLPNScanner}
        onClose={() => setShowLPNScanner(false)}
        onScan={handleLPNScan}
        title="Scan LPN QR Code"
        description="Point camera at LPN (License Plate Number) QR code"
      />

      <QRScanner
        isOpen={showLocationScanner}
        onClose={() => setShowLocationScanner(false)}
        onScan={handleLocationScan}
        title="Scan Location QR Code"
        description="Point camera at target location QR code"
      />

      {/* Note Modal */}
      <Modal isOpen={showNoteModal} onClose={() => setShowNoteModal(false)} title="Add Note">
        <div className="p-4 space-y-4">
          <textarea
            className="textarea textarea-bordered w-full"
            rows={4}
            placeholder="Enter note about this putaway..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <button className="btn btn-ghost" onClick={() => setShowNoteModal(false)}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={handleSaveNote}>
              Save Note
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
