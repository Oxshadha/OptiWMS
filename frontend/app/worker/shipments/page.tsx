"use client";

import { useState, useEffect, useCallback } from "react";
import { useOffline } from "@/hooks/useOffline";
import { useWorker } from "@/contexts/WorkerContext";
import { Modal } from "@/components/Modal";
import { QRScanner } from "@/components/QRScanner";
import { shipmentsApi } from "@/lib/api/shipments";
import { ordersApi } from "@/lib/api/orders";
import { warehousesApi } from "@/lib/api/warehouses";
import { showToast } from "@/lib/utils/toast";
import { logger } from "@/lib/utils/logger";
import { addToSyncQueue } from "@/lib/indexeddb";

export default function ShipmentsPage() {
  const { isOnline } = useOffline();
  const { worker } = useWorker();
  const [selectedShipment, setSelectedShipment] = useState<any>(null);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scannedOrder, setScannedOrder] = useState("");
  const [orderReference, setOrderReference] = useState("");
  const [shipments, setShipments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvedWarehouseId, setResolvedWarehouseId] = useState<string | null>(null);
  const [resolvingWarehouse, setResolvingWarehouse] = useState(false);
  const [deliveryDetails, setDeliveryDetails] = useState({
    driverName: "",
    driverPhone: "",
    vehicleNumber: "",
    trackingNumber: "",
    notes: "",
  });

  const derivePackReference = (orderNumber?: string) => {
    const normalized = (orderNumber || "").trim().toUpperCase();
    if (!normalized) return `PACK-${Date.now()}`;
    if (normalized.startsWith("OUT-")) {
      return `PACK-${normalized.substring(4)}`;
    }
    return `PACK-${normalized.replace(/^OUT/, "").replace(/^-+/, "")}`;
  };

  const isUuid = (value?: string | null) => {
    if (!value) return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value.trim()
    );
  };

  const effectiveWarehouseId = worker?.warehouseId || resolvedWarehouseId;

  const loadShipments = useCallback(async () => {
    if (!isOnline) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // Fetch orders that are ready_to_ship for worker's warehouse
      const readyToShipOrders = await ordersApi.getAll("outbound", "ready_to_ship");
      
      // Filter by worker's warehouse when available; otherwise allow list so work can proceed.
      const warehouseOrders = effectiveWarehouseId
        ? readyToShipOrders.filter((order) => order.warehouseId === effectiveWarehouseId)
        : readyToShipOrders;

      // Fetch shipments for these orders
      const shipmentsData = await Promise.all(
        warehouseOrders.map(async (order) => {
          try {
            const orderShipments = await shipmentsApi.getByOrderId(order.id);
            if (!orderShipments || orderShipments.length === 0) {
              return [{
                id: `virtual-${order.id}`,
                shipmentNumber: `SH-${order.orderNumber}`,
                orderId: order.id,
                orderNumber: order.orderNumber,
                carrier: "N/A",
                status: "Ready to Ship",
                destination: "N/A",
                trackingNumber: derivePackReference(order.orderNumber),
                weightKg: "",
                orders: [order.orderNumber],
                isVirtual: true,
              }];
            }
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
      logger.error("Failed to load shipments:", error);
      showToast.error("Failed to load shipments");
      setShipments([]);
    } finally {
      setLoading(false);
    }
  }, [derivePackReference, effectiveWarehouseId, isOnline]);

  useEffect(() => {
    const resolveWarehouse = async () => {
      if (worker?.warehouseId) {
        setResolvedWarehouseId(worker.warehouseId);
        return;
      }
      if (!worker?.warehouse || worker.warehouse === "Unknown Warehouse") {
        setResolvedWarehouseId(null);
        return;
      }
      try {
        setResolvingWarehouse(true);
        const warehouses = await warehousesApi.getAll();
        const exact = warehouses.find(
          (w) => w.name.trim().toLowerCase() === worker.warehouse.trim().toLowerCase()
        );
        const loose = warehouses.find((w) =>
          w.name.trim().toLowerCase().includes(worker.warehouse.trim().toLowerCase())
        );
        setResolvedWarehouseId(exact?.id || loose?.id || null);
      } catch (error) {
        logger.error("Failed to resolve worker warehouse for shipments:", error);
        setResolvedWarehouseId(null);
      } finally {
        setResolvingWarehouse(false);
      }
    };
    void resolveWarehouse();
  }, [worker?.warehouseId, worker?.warehouse]);

  // Load shipments - filtered by worker's warehouse and ready_to_ship status
  useEffect(() => {
    if (isOnline && !resolvingWarehouse) {
      void loadShipments();
    }
  }, [isOnline, resolvingWarehouse, loadShipments]);

  useEffect(() => {
    if (!isOnline || resolvingWarehouse) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void loadShipments();
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [isOnline, resolvingWarehouse, loadShipments]);

  const handleLoadOrderByReference = async () => {
    const reference = orderReference.trim().toUpperCase();
    if (!reference) {
      showToast.error("Enter outbound order reference");
      return;
    }
    try {
      const order = await ordersApi.getByOrderNumber(reference);
      if ((order.orderType || "").toLowerCase() !== "outbound") {
        showToast.error("Only outbound orders can be shipped");
        return;
      }
      if ((order.status || "").toLowerCase() !== "ready_to_ship") {
        showToast.error(`Order status is ${order.status}. It must be ready_to_ship.`);
        return;
      }
      if (effectiveWarehouseId && order.warehouseId !== effectiveWarehouseId) {
        showToast.error("This order belongs to a different warehouse");
        return;
      }

      let existingShipment: any | null = null;
      setShipments((current) => {
        existingShipment =
          current.find((s) => s.orderId === order.id || s.orderNumber === order.orderNumber) || null;
        if (existingShipment) return current;
        const added = {
          id: `virtual-${order.id}`,
          shipmentNumber: `SH-${order.orderNumber}`,
          orderId: order.id,
          orderNumber: order.orderNumber,
          carrier: "N/A",
          status: "Ready to Ship",
          destination: "N/A",
          trackingNumber: derivePackReference(order.orderNumber),
          weightKg: "",
          orders: [order.orderNumber],
          isVirtual: true,
        };
        existingShipment = added;
        return [added, ...current];
      });
      setOrderReference("");
      showToast.success(`Loaded ${order.orderNumber} for shipment`);
      if (existingShipment) {
        handleProcessShipment(existingShipment);
      }
    } catch (error) {
      logger.error("Failed to load shipment order by reference:", error);
      showToast.error("Order not found or not ready to ship");
    }
  };

  const handleProcessShipment = (shipment: typeof shipments[0]) => {
    setSelectedShipment(shipment);
    setDeliveryDetails((current) => ({
      ...current,
      trackingNumber: current.trackingNumber || shipment.trackingNumber || derivePackReference(shipment.orderNumber),
    }));
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
      showToast.error("Scanned order is not part of this shipment");
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
    if (scannedOrder && !selectedShipment.orders.includes(scannedOrder)) {
      showToast.error("Entered/scanned order does not match this shipment");
      return;
    }

    try {
      if (isOnline) {
        const workerId = isUuid(worker?.id) ? worker?.id : undefined;
        let shipmentIdToShip = selectedShipment.id as string;

        // If virtual shipment, create it first
        if (selectedShipment.isVirtual) {
          const shipmentNumber = `SH-${selectedShipment.orderNumber}-${Date.now()}`;
          const created = await shipmentsApi.create({
            shipmentNumber,
            orderId: selectedShipment.orderId,
            carrier: deliveryDetails.trackingNumber ? "Custom" : "N/A",
            trackingNumber: deliveryDetails.trackingNumber || derivePackReference(selectedShipment.orderNumber),
            destination: "N/A",
            weightKg: undefined,
            driverName: deliveryDetails.driverName,
            driverPhone: deliveryDetails.driverPhone,
            vehicleNumber: deliveryDetails.vehicleNumber,
            status: "label_created",
          });
          shipmentIdToShip = created.id;
        } else {
          // Update existing shipment
          await shipmentsApi.update(selectedShipment.id, {
            driverName: deliveryDetails.driverName,
            driverPhone: deliveryDetails.driverPhone,
            vehicleNumber: deliveryDetails.vehicleNumber,
            trackingNumber:
              deliveryDetails.trackingNumber ||
              selectedShipment.trackingNumber ||
              derivePackReference(selectedShipment.orderNumber),
            status: "ready_to_ship",
          });
        }

        // Update shipment status to "shipped" (this will update order status automatically)
        await shipmentsApi.updateStatus(shipmentIdToShip, "shipped", workerId);

        showToast.success("Shipment processed successfully!");
      } else {
        if (selectedShipment.isVirtual) {
          showToast.error("Cannot create new shipment while offline. Please reconnect and retry.");
          return;
        }

        await addToSyncQueue({
          type: "shipment",
          action: "update",
          data: {
            mode: "details",
            shipmentId: selectedShipment.id,
            payload: {
              driverName: deliveryDetails.driverName,
              driverPhone: deliveryDetails.driverPhone,
              vehicleNumber: deliveryDetails.vehicleNumber,
              trackingNumber:
                deliveryDetails.trackingNumber ||
                selectedShipment.trackingNumber ||
                derivePackReference(selectedShipment.orderNumber),
              status: "ready_to_ship",
            },
          },
        });

        await addToSyncQueue({
          type: "shipment",
          action: "update",
          data: {
            mode: "status",
            shipmentId: selectedShipment.id,
            payload: {
              status: "shipped",
              workerId: isUuid(worker?.id) ? worker?.id : undefined,
            },
          },
        });

        showToast.warning("Offline mode: shipment update queued and will sync automatically.");
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
      
      // Refresh the list in place when the backend is reachable.
      if (isOnline) {
        await loadShipments();
      }
    } catch (error) {
      logger.error("Error processing shipment:", error);
      showToast.error(error instanceof Error ? error.message : "Error processing shipment. Please try again.");
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <h2 className="text-xl font-bold text-base-content mb-4">Shipments</h2>
        <p className="text-sm text-base-content/60">
          View and manage shipment tasks. Enter delivery details when processing shipments.
        </p>
        {!isOnline && shipments.length > 0 && (
          <p className="text-xs text-warning mt-2">
            Offline: showing last loaded shipment list. New lookups resume when the network returns.
          </p>
        )}
        {!effectiveWarehouseId && (
          <p className="text-xs text-warning mt-2">
            Warehouse assignment missing. Showing ready-to-ship orders without warehouse filter.
          </p>
        )}
      </div>

      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <div className="text-sm font-medium text-base-content mb-2">Fallback: Enter Outbound Order Reference</div>
        <div className="flex gap-2">
          <input
            type="text"
            className="input input-bordered flex-1"
            placeholder="OUT-001770..."
            value={orderReference}
            onChange={(e) => setOrderReference(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                void handleLoadOrderByReference();
              }
            }}
          />
          <button className="btn btn-outline" onClick={() => void handleLoadOrderByReference()}>
            Load
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {shipments.map((shipment) => (
          <div
            key={shipment.id}
            className="bg-base-100 rounded-xl p-4 border border-base-300"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="font-bold text-base-content">{shipment.shipmentNumber || shipment.id}</div>
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
        {!loading && shipments.length === 0 && (
          <div className="bg-base-100 rounded-xl p-6 border border-base-300 text-center">
            <div className="text-base-content font-semibold mb-1">No shipment tasks available</div>
            <div className="text-sm text-base-content/60">
              Orders must be in <code>ready_to_ship</code> status in your warehouse to appear here.
            </div>
            <button
              className="btn btn-outline btn-sm mt-3"
              onClick={() => void loadShipments()}
              disabled={!isOnline}
            >
              Refresh
            </button>
          </div>
        )}
        </div>
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
          title={`Process Shipment: ${selectedShipment.shipmentNumber || selectedShipment.id}`}
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
