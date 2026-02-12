"use client";

import { useState, useEffect } from "react";
import { useOffline } from "@/hooks/useOffline";
import { useWorker } from "@/contexts/WorkerContext";
import { Modal } from "@/components/Modal";
import { QRScanner } from "@/components/QRScanner";
import { shipmentsApi } from "@/lib/api/shipments";
import { ordersApi } from "@/lib/api/orders";
import { showToast } from "@/lib/utils/toast";

export default function ShipmentsPage() {
  const { isOnline } = useOffline();
  const { worker } = useWorker();
  const [selectedShipment, setSelectedShipment] = useState<any>(null);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scannedOrder, setScannedOrder] = useState("");
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deliveryDetails, setDeliveryDetails] = useState({
    driverName: "",
    driverPhone: "",
    vehicleNumber: "",
    trackingNumber: "",
    notes: "",
  });

  // Load shipments - filtered by worker's warehouse and ready_to_ship status
  useEffect(() => {
    const loadShipments = async () => {
      if (!isOnline || !worker?.warehouseId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Fetch orders that are ready_to_ship for worker's warehouse
        const readyToShipOrders = await ordersApi.getAll("outbound", "ready_to_ship");
        
        // Filter by worker's warehouse
        const warehouseOrders = readyToShipOrders.filter(
          order => order.warehouseId === worker.warehouseId
        );

        // Fetch shipments for these orders
        const shipmentsData = await Promise.all(
          warehouseOrders.map(async (order) => {
            try {
              const orderShipments = await shipmentsApi.getByOrderId(order.id);
              return orderShipments.map(shipment => ({
                id: shipment.id,
                shipmentNumber: shipment.shipmentNumber,
                orderId: order.id,
                orderNumber: order.orderNumber,
                carrier: shipment.carrier || "N/A",
                status: shipment.status === "label_created" ? "Ready to Ship" : shipment.status,
                destination: shipment.destination || "N/A",
                trackingNumber: shipment.trackingNumber,
                weightKg: shipment.weightKg,
                orders: [order.orderNumber],
              }));
            } catch (error) {
              // If no shipment exists, create a virtual one for display
              return [{
                id: `virtual-${order.id}`,
                shipmentNumber: `SH-${order.orderNumber}`,
                orderId: order.id,
                orderNumber: order.orderNumber,
                carrier: "N/A",
                status: "Ready to Ship",
                destination: "N/A",
                trackingNumber: "",
                weightKg: "",
                orders: [order.orderNumber],
                isVirtual: true, // Flag to indicate this needs shipment creation
              }];
            }
          })
        );

        setShipments(shipmentsData.flat());
      } catch (error) {
        console.error("Failed to load shipments:", error);
        showToast.error("Failed to load shipments");
        setShipments([]);
      } finally {
        setLoading(false);
      }
    };

    if (isOnline && worker?.warehouseId) {
      loadShipments();
    }
  }, [isOnline, worker?.warehouseId]);

  const handleProcessShipment = (shipment: typeof shipments[0]) => {
    setSelectedShipment(shipment);
    setShowProcessModal(true);
  };

  const handleScanOrder = () => {
    setShowScanner(true);
  };

  const handleOrderScan = (result: string) => {
    setScannedOrder(result);
    setShowScanner(false);
    // Validate scanned order is part of shipment
    if (selectedShipment && selectedShipment.orders.includes(result)) {
      // Order is valid
    } else {
      alert("Scanned order is not part of this shipment");
    }
  };

  const handleConfirmShipment = async () => {
    if (!deliveryDetails.driverName || !deliveryDetails.driverPhone || !deliveryDetails.vehicleNumber) {
      showToast.error("Please fill in all required delivery details");
      return;
    }
    
    if (!selectedShipment) {
      showToast.error("No shipment selected");
      return;
    }

    try {
      if (isOnline) {
        // If virtual shipment, create it first
        if (selectedShipment.isVirtual) {
          const shipmentNumber = `SH-${selectedShipment.orderNumber}-${Date.now()}`;
          await shipmentsApi.create({
            shipmentNumber,
            orderId: selectedShipment.orderId,
            carrier: deliveryDetails.trackingNumber ? "Custom" : "N/A",
            trackingNumber: deliveryDetails.trackingNumber || "",
            destination: "N/A",
            weightKg: "",
            driverName: deliveryDetails.driverName,
            driverPhone: deliveryDetails.driverPhone,
            vehicleNumber: deliveryDetails.vehicleNumber,
            status: "label_created",
          });
        } else {
          // Update existing shipment
          await shipmentsApi.update(selectedShipment.id, {
            driverName: deliveryDetails.driverName,
            driverPhone: deliveryDetails.driverPhone,
            vehicleNumber: deliveryDetails.vehicleNumber,
            trackingNumber: deliveryDetails.trackingNumber || selectedShipment.trackingNumber,
            status: "ready_to_ship",
          });
        }

        // Update shipment status to "shipped" (this will update order status automatically)
        if (!selectedShipment.isVirtual) {
          await shipmentsApi.updateStatus(selectedShipment.id, "shipped");
        }

        showToast.success("Shipment processed successfully!");
      } else {
        // Offline mode - save to sync queue
        // TODO: Implement offline sync
        showToast.warning("Offline mode - changes will sync when online");
      }
      
      setShowProcessModal(false);
      setDeliveryDetails({
        driverName: "",
        driverPhone: "",
        vehicleNumber: "",
        trackingNumber: "",
        notes: "",
      });
      setScannedOrder("");
      
      // Reload shipments
      if (isOnline && worker?.warehouseId) {
        window.location.reload();
      }
    } catch (error) {
      console.error("Error processing shipment:", error);
      alert("Error processing shipment. Please try again.");
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <h2 className="text-xl font-bold text-base-content mb-4">Shipments</h2>
        <p className="text-sm text-base-content/60">
          View and manage shipment tasks. Enter delivery details when processing shipments.
        </p>
      </div>

      <div className="space-y-3">
        {shipments.map((shipment) => (
          <div
            key={shipment.id}
            className="bg-base-100 rounded-xl p-4 border border-base-300"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="font-bold text-base-content">{shipment.id}</div>
                <div className="text-sm text-base-content/60">Order: {shipment.orderNumber}</div>
              </div>
              <span className={`badge ${
                shipment.status === "Ready to Ship" ? "badge-warning" : "badge-info"
              }`}>
                {shipment.status}
              </span>
            </div>
            <div className="space-y-2 mb-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="material-symbols-outlined text-base-content/60">local_shipping</span>
                <span className="text-base-content/70">{shipment.carrier}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="material-symbols-outlined text-base-content/60">location_on</span>
                <span className="text-base-content/70">{shipment.destination}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="material-symbols-outlined text-base-content/60">inventory</span>
                <span className="text-base-content/70">{shipment.items} items</span>
              </div>
            </div>
            <button
              onClick={() => handleProcessShipment(shipment)}
              className="btn btn-primary btn-sm w-full"
            >
              <span className="material-symbols-outlined">check_circle</span>
              Process Shipment
            </button>
          </div>
          ))}
        </div>
      )}

      {/* Process Shipment Modal */}
      {selectedShipment && (
        <Modal
          isOpen={showProcessModal}
          onClose={() => {
            setShowProcessModal(false);
            setDeliveryDetails({
              driverName: "",
              driverPhone: "",
              vehicleNumber: "",
              trackingNumber: "",
              notes: "",
            });
            setScannedOrder("");
          }}
          title={`Process Shipment: ${selectedShipment.id}`}
          size="lg"
        >
          <div className="p-6 space-y-4">
            {/* Shipment Info */}
            <div className="bg-base-200 rounded-lg p-4">
              <h4 className="font-semibold text-base-content mb-2">Shipment Details</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-base-content/60">Carrier:</span>
                  <span className="font-medium">{selectedShipment.carrier}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-base-content/60">Destination:</span>
                  <span className="font-medium">{selectedShipment.destination}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-base-content/60">Items:</span>
                  <span className="font-medium">{selectedShipment.items}</span>
                </div>
              </div>
            </div>

            {/* Scan Order */}
            <div>
              <label className="label">
                <span className="label-text font-medium">Scan Order QR Code</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input input-bordered flex-1"
                  placeholder="Scan or enter order number"
                  value={scannedOrder}
                  onChange={(e) => setScannedOrder(e.target.value)}
                />
                <button
                  onClick={handleScanOrder}
                  className="btn btn-primary btn-square"
                >
                  <span className="material-symbols-outlined">qr_code_scanner</span>
                </button>
              </div>
            </div>

            {/* Delivery Details */}
            <div className="divider">Delivery Details</div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Driver Name *</span>
              </label>
              <input
                type="text"
                className="input input-bordered w-full"
                placeholder="Enter driver name"
                value={deliveryDetails.driverName}
                onChange={(e) => setDeliveryDetails({ ...deliveryDetails, driverName: e.target.value })}
                required
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Driver Phone *</span>
              </label>
              <input
                type="tel"
                className="input input-bordered w-full"
                placeholder="Enter driver phone number"
                value={deliveryDetails.driverPhone}
                onChange={(e) => setDeliveryDetails({ ...deliveryDetails, driverPhone: e.target.value })}
                required
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Vehicle Number *</span>
              </label>
              <input
                type="text"
                className="input input-bordered w-full"
                placeholder="Enter vehicle/license plate number"
                value={deliveryDetails.vehicleNumber}
                onChange={(e) => setDeliveryDetails({ ...deliveryDetails, vehicleNumber: e.target.value })}
                required
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Tracking Number</span>
              </label>
              <input
                type="text"
                className="input input-bordered w-full"
                placeholder="Enter tracking number (optional)"
                value={deliveryDetails.trackingNumber}
                onChange={(e) => setDeliveryDetails({ ...deliveryDetails, trackingNumber: e.target.value })}
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Notes</span>
              </label>
              <textarea
                className="textarea textarea-bordered w-full"
                rows={3}
                placeholder="Additional notes (optional)"
                value={deliveryDetails.notes}
                onChange={(e) => setDeliveryDetails({ ...deliveryDetails, notes: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setShowProcessModal(false);
                  setDeliveryDetails({
                    driverName: "",
                    driverPhone: "",
                    vehicleNumber: "",
                    trackingNumber: "",
                    notes: "",
                  });
                  setScannedOrder("");
                }}
              >
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleConfirmShipment}>
                <span className="material-symbols-outlined">check_circle</span>
                Confirm & Process
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* QR Scanner */}
      <QRScanner
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleOrderScan}
        title="Scan Order QR Code"
        description="Point camera at order QR code"
      />
    </div>
  );
}
