"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/Modal";
import { DetailModal } from "@/components/DetailModal";
import { StatusChip } from "@/components/StatusChip";
import { shipmentsApi } from "@/lib/api/shipments";
import { ordersApi } from "@/lib/api/orders";
import { showToast } from "@/lib/utils/toast";
import { warehousesApi } from "@/lib/api/warehouses";
import { deliveryPartnersApi } from "@/lib/api/deliveryPartners";
import { logger } from "@/lib/utils/logger";
import { ShipmentDisplay, shipmentStatusTone } from "../types";

export function CreateShipmentModal({ onClose }: { onClose: () => void }) {
  const [formData, setFormData] = useState({
    warehouse: "",
    deliveryPartner: "",
    driverName: "",
    driverPhone: "",
    vehicleNumber: "",
    estimatedDeliveryDate: "",
    selectedOrders: [] as string[],
    notes: "",
  });

  const [availableOrders, setAvailableOrders] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [deliveryPartners, setDeliveryPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const results = await Promise.allSettled([
          ordersApi.getAllOutbound(),
          warehousesApi.getAll(),
          deliveryPartnersApi.getAll(),
        ]);

        const [ordersResult, warehousesResult, partnersResult] = results;

        if (ordersResult.status === "fulfilled") {
          const readyOrders = ordersResult.value.filter(
            (o) =>
              o.status === "ready_to_ship" ||
              o.status === "picked" ||
              o.status === "packing" ||
              o.status === "packed"
          );
          setAvailableOrders(readyOrders);
          if (readyOrders.length === 0) {
            logger.warn("No orders ready for shipment. Orders need to be picked/packed first.");
          }
        } else {
          setAvailableOrders([]);
          const error = ordersResult.reason;
          const errorMsg = error instanceof Error ? error.message : String(error);
          logger.error("Failed to load orders:", error);
          if (errorMsg.includes("403") || errorMsg.includes("Forbidden") || errorMsg.includes("Access Denied")) {
            logger.warn("No permission to access orders API");
          }
        }

        if (warehousesResult.status === "fulfilled") {
          setWarehouses(warehousesResult.value);
        } else {
          setWarehouses([]);
          const error = warehousesResult.reason;
          const errorMsg = error instanceof Error ? error.message : String(error);
          logger.error("Failed to load warehouses:", error);
          if (errorMsg.includes("403") || errorMsg.includes("Forbidden") || errorMsg.includes("Access Denied")) {
            logger.warn("No permission to access warehouses API");
            showToast.error("Access denied: You may not have permission to view warehouses. Please contact your administrator.");
          }
        }

        if (partnersResult.status === "fulfilled") {
          setDeliveryPartners(partnersResult.value);
        } else {
          setDeliveryPartners([]);
          const error = partnersResult.reason;
          const errorMsg = error instanceof Error ? error.message : String(error);
          logger.error("Failed to load delivery partners:", error);
          if (errorMsg.includes("403") || errorMsg.includes("Forbidden") || errorMsg.includes("Access Denied")) {
            logger.warn("No permission to access delivery partners API - this may be a role/permission issue");
            showToast.error("Access denied: You may not have permission to view delivery partners. Please contact your administrator.");
          } else {
            showToast.error("Failed to load delivery partners. Please check your connection and try again.");
          }
        }
      } catch (err) {
        logger.error("Failed to load shipment form data:", err);
        showToast.error(err instanceof Error ? err.message : "Failed to load data");
      }
    };
    void loadData();
  }, []);

  const handleSubmit = async () => {
    if (!formData.warehouse || !formData.deliveryPartner || !formData.driverName) {
      showToast.error("Please fill in all required fields");
      return;
    }
    if (formData.selectedOrders.length === 0) {
      showToast.error("Please select at least one order");
      return;
    }

    try {
      setLoading(true);
      const partner = deliveryPartners.find((p) => p.id === formData.deliveryPartner);

      const shipmentPromises = formData.selectedOrders.map((orderId, index) =>
        shipmentsApi.create({
          shipmentNumber: `SHP-${Date.now()}-${index + 1}`,
          orderId,
          deliveryPartnerId: formData.deliveryPartner,
          carrier: partner?.companyName || partner?.partnerCode || formData.deliveryPartner,
          driverName: formData.driverName,
          driverPhone: formData.driverPhone,
          vehicleNumber: formData.vehicleNumber,
          eta: formData.estimatedDeliveryDate,
          status: "pending",
        })
      );

      await Promise.all(shipmentPromises);
      showToast.success(`Successfully created ${formData.selectedOrders.length} shipment(s)`);
      onClose();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("reloadShipments"));
      }
    } catch (err) {
      logger.error("Failed to create shipment:", err);
      showToast.error(err instanceof Error ? err.message : "Failed to create shipment");
    } finally {
      setLoading(false);
    }
  };

  const toggleOrder = (orderId: string) => {
    setFormData({
      ...formData,
      selectedOrders: formData.selectedOrders.includes(orderId)
        ? formData.selectedOrders.filter((id) => id !== orderId)
        : [...formData.selectedOrders, orderId],
    });
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="Create Shipment" size="lg">
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Warehouse *</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={formData.warehouse}
              onChange={(e) => setFormData({ ...formData, warehouse: e.target.value })}
              required
            >
              <option value="">Select Warehouse</option>
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Delivery Partner *</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={formData.deliveryPartner}
              onChange={(e) => setFormData({ ...formData, deliveryPartner: e.target.value })}
              required
            >
              <option value="">Select Partner</option>
              {deliveryPartners.length === 0 ? (
                <option value="" disabled>
                  No delivery partners available. Generate data first.
                </option>
              ) : (
                deliveryPartners.map((partner) => (
                  <option key={partner.id} value={partner.id}>
                    {partner.companyName || partner.partnerCode}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Driver Name *</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.driverName}
              onChange={(e) => setFormData({ ...formData, driverName: e.target.value })}
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
              value={formData.driverPhone}
              onChange={(e) => setFormData({ ...formData, driverPhone: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Vehicle Number *</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.vehicleNumber}
              onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value })}
              required
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Estimated Delivery Date *</span>
            </label>
            <input
              type="date"
              className="input input-bordered w-full"
              value={formData.estimatedDeliveryDate}
              onChange={(e) => setFormData({ ...formData, estimatedDeliveryDate: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Select Orders to Include *</span>
          </label>
          <div className="space-y-2 max-h-48 overflow-y-auto border border-base-300 rounded-lg p-3">
            {availableOrders.length === 0 ? (
              <div className="text-center py-4 text-base-content/60">
                <p className="text-sm">No orders ready for shipment</p>
                <p className="text-xs mt-1">Orders need to be picked/packed first</p>
              </div>
            ) : (
              availableOrders.map((order) => (
                <label key={order.id} className="flex items-center gap-3 cursor-pointer p-2 hover:bg-base-200 rounded">
                  <input
                    type="checkbox"
                    className="checkbox"
                    checked={formData.selectedOrders.includes(order.id)}
                    onChange={() => toggleOrder(order.id)}
                  />
                  <div className="flex-1">
                    <div className="font-medium">{order.orderNumber || order.id}</div>
                    <div className="text-sm text-base-content/60">
                      Status: {order.status} • {order.orderDate ? new Date(order.orderDate).toLocaleDateString() : "N/A"}
                    </div>
                  </div>
                </label>
              ))
            )}
          </div>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Notes</span>
          </label>
          <textarea
            className="textarea textarea-bordered w-full"
            rows={3}
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <>
                <span className="loading loading-spinner loading-sm"></span>
                Creating...
              </>
            ) : (
              "Create Shipment"
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function ShipmentDetailModal({
  isOpen,
  onClose,
  shipment,
}: {
  isOpen: boolean;
  onClose: () => void;
  shipment: ShipmentDisplay;
}) {
  return (
    <DetailModal isOpen={isOpen} onClose={onClose} title={`Shipment: ${shipment.id}`} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-base-content/60">Shipment ID</label>
            <p className="font-semibold">{shipment.id}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Status</label>
            <p>
              <StatusChip label={shipment.status} tone={shipmentStatusTone(shipment.status)} showDot />
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Carrier</label>
            <p>
              <StatusChip label={shipment.carrier} tone="neutral" className="whitespace-nowrap" />
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Destination</label>
            <p className="font-semibold">{shipment.destination}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Tracking Number</label>
            <p className="font-semibold">{shipment.tracking}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Weight</label>
            <p className="font-semibold">{shipment.weight}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">ETA</label>
            <p className="font-semibold">{shipment.eta}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Shipment Date</label>
            <p className="font-semibold">{shipment.shipmentDate}</p>
          </div>
        </div>

        {shipment.driverName && (
          <>
            <div className="divider">Delivery Details</div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-base-content/60">Driver Name</label>
                <p className="font-semibold">{shipment.driverName}</p>
              </div>
              <div>
                <label className="text-sm text-base-content/60">Driver Phone</label>
                <p className="font-semibold">{shipment.driverPhone}</p>
              </div>
              <div>
                <label className="text-sm text-base-content/60">Vehicle Number</label>
                <p className="font-semibold">{shipment.vehicleNumber}</p>
              </div>
            </div>
          </>
        )}

        <div className="divider">Orders</div>
        <div className="space-y-2">
          {shipment.orders.map((orderId) => (
            <Link
              key={orderId}
              href={`/admin/orders/outbound/${orderId}`}
              className="block p-3 bg-base-200 rounded-lg hover:bg-base-300 transition-colors"
            >
              <div className="font-semibold text-primary">{orderId}</div>
            </Link>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              logger.info("Printing shipment manifest", shipment.id);
              const printWindow = window.open("", "_blank");
              if (printWindow) {
                printWindow.document.write(`
                  <html>
                    <head><title>Shipment Manifest - ${shipment.id}</title></head>
                    <body>
                      <h1>Shipment Manifest</h1>
                      <p><strong>Shipment ID:</strong> ${shipment.id}</p>
                      <p><strong>Carrier:</strong> ${shipment.carrier}</p>
                      <p><strong>Tracking:</strong> ${shipment.tracking}</p>
                      <p><strong>Destination:</strong> ${shipment.destination}</p>
                      <p><strong>Weight:</strong> ${shipment.weight}</p>
                      <p><strong>ETA:</strong> ${shipment.eta}</p>
                      <h2>Orders:</h2>
                      <ul>
                        ${shipment.orders.map((order) => `<li>${order}</li>`).join("")}
                      </ul>
                      ${
                        shipment.driverName
                          ? `
                        <h2>Delivery Details:</h2>
                        <p><strong>Driver:</strong> ${shipment.driverName}</p>
                        <p><strong>Phone:</strong> ${shipment.driverPhone}</p>
                        <p><strong>Vehicle:</strong> ${shipment.vehicleNumber}</p>
                      `
                          : ""
                      }
                    </body>
                  </html>
                `);
                printWindow.document.close();
                printWindow.print();
              }
            }}
          >
            <span className="material-symbols-outlined">print</span>
            Print Manifest
          </button>
        </div>
      </div>
    </DetailModal>
  );
}
