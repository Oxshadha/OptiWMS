"use client";

import { useEffect, useRef, useState } from "react";
import { Modal } from "./Modal";

interface QRScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (result: string) => void;
  title?: string;
  description?: string;
}

export function QRScanner({ isOpen, onClose, onScan, title = "Scan QR Code", description }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      // Cleanup when modal closes
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      return;
    }

    // Start camera when modal opens
    startCamera();

    return () => {
      // Cleanup on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen]);

  const startCamera = async () => {
    try {
      setError(null);
      setScanning(true);

      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment", // Use back camera on mobile
        },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      // Simple QR code detection using canvas and manual scanning
      // For production, use a library like html5-qrcode or jsQR
      startQRDetection();
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Unable to access camera. Please check permissions.");
      setScanning(false);
    }
  };

  const startQRDetection = () => {
    // For now, we'll use a simple approach
    // In production, integrate a QR code library like html5-qrcode
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    const scanInterval = setInterval(() => {
      if (!videoRef.current || !context || !isOpen) {
        clearInterval(scanInterval);
        return;
      }

      try {
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);

        // For demo: simulate QR scan with manual input
        // In production, use jsQR or html5-qrcode library here
      } catch (err) {
        console.error("Error scanning:", err);
      }
    }, 500);

    // Cleanup interval when modal closes
    return () => clearInterval(scanInterval);
  };

  const handleManualInput = () => {
    const input = prompt("Enter QR code or scan result:");
    if (input && input.trim()) {
      onScan(input.trim());
      onClose();
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setScanning(false);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="lg">
      <div className="space-y-4">
        {description && <p className="text-sm text-base-content/60">{description}</p>}

        {error ? (
          <div className="bg-error/10 border border-error rounded-lg p-4 text-center">
            <span className="material-symbols-outlined text-error text-4xl mb-2">error</span>
            <p className="text-error mb-4">{error}</p>
            <button className="btn btn-primary btn-sm" onClick={handleManualInput}>
              Enter Manually
            </button>
          </div>
        ) : (
          <>
            <div className="relative bg-base-200 rounded-lg overflow-hidden" style={{ aspectRatio: "1/1" }}>
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />
              {scanning && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="border-4 border-primary rounded-lg" style={{ width: "80%", height: "80%" }}></div>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                className="btn btn-outline flex-1"
                onClick={handleManualInput}
              >
                <span className="material-symbols-outlined">keyboard</span>
                Enter Manually
              </button>
              <button
                className="btn btn-ghost flex-1"
                onClick={() => {
                  stopCamera();
                  onClose();
                }}
              >
                Cancel
              </button>
            </div>

            <div className="text-xs text-base-content/60 text-center">
              Point camera at QR code or tap "Enter Manually" to type
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

