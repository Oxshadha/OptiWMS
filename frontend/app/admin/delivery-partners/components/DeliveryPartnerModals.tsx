"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { DetailModal } from "@/components/DetailModal";
import { StatusChip } from "@/components/StatusChip";
import { useAdmin } from "@/contexts/AdminContext";
import { ADMIN_ROUTES } from "@/lib/admin-roles";
import {
  deliveryPartnersApi,
  DeliveryPartner as ApiDeliveryPartner,
} from "@/lib/api/deliveryPartners";
import { showToast } from "@/lib/utils/toast";
import { logger } from "@/lib/utils/logger";
import { formatCurrency } from "../utils";
import type { DeliveryPartnerDisplay } from "../types";

export function DeliveryPartnerDetailModal({
  isOpen,
  onClose,
  partner,
  onEdit,
}: {
  isOpen: boolean;
  onClose: () => void;
  partner: DeliveryPartnerDisplay;
  onEdit: (partner: DeliveryPartnerDisplay) => void;
}) {
  const { hasPermission } = useAdmin();
  const canEdit = hasPermission(ADMIN_ROUTES.DELIVERY_PARTNERS, "edit");

  return (
    <DetailModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Delivery Partner: ${partner.companyName}`}
      size="lg"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-base-content/60">Partner Code</label>
            <p className="font-semibold">{partner.partnerCode}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Contact Person</label>
            <p className="font-semibold">{partner.contactPerson}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Email</label>
            <p className="font-semibold">{partner.email}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Phone</label>
            <p className="font-semibold">{partner.phone}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Type</label>
            <p>
              <StatusChip label={partner.type === "local" ? "Local" : "Foreign"} tone="neutral" />
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Rating</label>
            <p className="font-semibold">
              <span className="text-warning">★</span> {partner.rating.toFixed(1)}
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Cost per Delivery</label>
            <p className="font-semibold">
              {formatCurrency(partner.costPerDelivery, partner.currencyCode)}
              {partner.currencyCode && (
                <span className="text-xs text-base-content/60 ml-2">
                  ({partner.currencyCode})
                </span>
              )}
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Status</label>
            <p>
              <StatusChip
                label={partner.status === "active" ? "Active" : "Inactive"}
                tone={partner.status === "active" ? "success" : "danger"}
                showDot
              />
            </p>
          </div>
        </div>
        <div>
          <label className="text-sm text-base-content/60">Service Areas</label>
          <div className="flex flex-wrap gap-2 mt-2">
            {partner.serviceAreas.map((area, idx) => (
              <StatusChip key={idx} label={area} tone="neutral" className="whitespace-nowrap" />
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          {canEdit && (
            <button
              className="btn btn-primary"
              onClick={() => {
                onClose();
                onEdit(partner);
              }}
            >
              Edit Partner
            </button>
          )}
        </div>
      </div>
    </DetailModal>
  );
}

export function DeliveryPartnerMetricsModal({
  isOpen,
  onClose,
  partner,
}: {
  isOpen: boolean;
  onClose: () => void;
  partner: DeliveryPartnerDisplay;
}) {
  const totalShipments = partner.totalShipments;
  const onTimeRate = partner.onTimeDeliveryRate;
  const delayedRate = Math.max(0, 100 - onTimeRate);
  const estimatedSpend = totalShipments * partner.costPerDelivery;
  const reliability =
    onTimeRate >= 95 ? "Excellent" : onTimeRate >= 85 ? "Stable" : onTimeRate >= 70 ? "Monitor" : "At Risk";

  return (
    <DetailModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Delivery Metrics: ${partner.companyName}`}
      size="lg"
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-base-300 bg-base-200 p-4">
            <p className="text-sm text-base-content/60">Tracked Shipments</p>
            <p className="text-3xl font-bold text-base-content">{totalShipments}</p>
          </div>
          <div className="rounded-xl border border-base-300 bg-base-200 p-4">
            <p className="text-sm text-base-content/60">On-Time Rate</p>
            <p className="text-3xl font-bold text-success">{onTimeRate.toFixed(1)}%</p>
          </div>
          <div className="rounded-xl border border-base-300 bg-base-200 p-4">
            <p className="text-sm text-base-content/60">Late / Exception Rate</p>
            <p className="text-3xl font-bold text-warning">{delayedRate.toFixed(1)}%</p>
          </div>
          <div className="rounded-xl border border-base-300 bg-base-200 p-4">
            <p className="text-sm text-base-content/60">Estimated Spend</p>
            <p className="text-3xl font-bold text-base-content">
              {formatCurrency(estimatedSpend, partner.currencyCode)}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-base-300 bg-base-100 p-5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-base-content">Service Reliability</h3>
              <p className="text-sm text-base-content/60">
                Based on the persisted partner scorecard values currently stored in the master record.
              </p>
            </div>
            <StatusChip
              label={reliability}
              tone={
                reliability === "Excellent"
                  ? "success"
                  : reliability === "Stable"
                    ? "info"
                    : reliability === "Monitor"
                      ? "warning"
                      : "danger"
              }
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm text-base-content/70">
              <span>On-time deliveries</span>
              <span>{onTimeRate.toFixed(1)}%</span>
            </div>
            <progress
              className="progress progress-success w-full"
              value={Math.max(0, Math.min(onTimeRate, 100))}
              max="100"
            />
            <div className="flex items-center justify-between text-sm text-base-content/70">
              <span>Exceptions / delays</span>
              <span>{delayedRate.toFixed(1)}%</span>
            </div>
            <progress
              className="progress progress-warning w-full"
              value={Math.max(0, Math.min(delayedRate, 100))}
              max="100"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-base-300 bg-base-200 p-4">
            <p className="text-sm text-base-content/60">Average Cost Per Shipment</p>
            <p className="text-xl font-bold text-base-content">
              {formatCurrency(partner.costPerDelivery, partner.currencyCode)}
            </p>
          </div>
          <div className="rounded-xl border border-base-300 bg-base-200 p-4">
            <p className="text-sm text-base-content/60">Coverage</p>
            <p className="text-xl font-bold text-base-content">{partner.serviceAreas.length} service areas</p>
          </div>
          <div className="rounded-xl border border-base-300 bg-base-200 p-4">
            <p className="text-sm text-base-content/60">Quality Rating</p>
            <p className="text-xl font-bold text-base-content">{partner.rating.toFixed(1)} / 5.0</p>
          </div>
        </div>

        <div className="rounded-xl border border-base-300 bg-base-200 p-4">
          <p className="text-sm text-base-content/60 mb-1">Interpretation</p>
          <p className="text-sm text-base-content/80">
            Use this view to review the supplier-maintained carrier scorecard before assigning more outbound work.
            Shipment counts and on-time rate are editable master-data fields today; they can be automated later once
            shipments are explicitly linked to a delivery partner record.
          </p>
        </div>

        <div className="flex justify-end">
          <button className="btn btn-primary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </DetailModal>
  );
}

export function EditDeliveryPartnerModal({
  isOpen,
  onClose,
  partner,
  onUpdated,
}: {
  isOpen: boolean;
  onClose: () => void;
  partner: DeliveryPartnerDisplay;
  onUpdated: () => Promise<void>;
}) {
  const [formData, setFormData] = useState({
    partnerCode: partner.partnerCode,
    companyName: partner.companyName,
    contactPerson: partner.contactPerson,
    email: partner.email,
    phone: partner.phone,
    country: "",
    type: partner.type,
    serviceAreas: [...partner.serviceAreas],
    costPerDelivery: partner.costPerDelivery.toString(),
    currencyCode: partner.currencyCode || "USD",
    rating: partner.rating.toString(),
    totalShipments: partner.totalShipments.toString(),
    onTimeDeliveryRate: partner.onTimeDeliveryRate.toString(),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const updateData: Partial<ApiDeliveryPartner> = {
        partnerCode: formData.partnerCode,
        companyName: formData.companyName,
        contactPerson: formData.contactPerson || undefined,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        country: formData.country || undefined,
        currencyCode: formData.currencyCode || undefined,
        serviceAreas: JSON.stringify(formData.serviceAreas),
        costPerDelivery: formData.costPerDelivery ? formData.costPerDelivery : undefined,
        rating: formData.rating ? formData.rating : undefined,
        totalShipments: formData.totalShipments ? Number(formData.totalShipments) : undefined,
        onTimeDeliveryRate: formData.onTimeDeliveryRate
          ? formData.onTimeDeliveryRate
          : undefined,
      };

      await deliveryPartnersApi.update(partner.id, updateData);
      showToast.success("Delivery partner updated successfully");
      await onUpdated();
      onClose();
    } catch (err) {
      logger.error("Failed to update delivery partner:", err);
      showToast.error(
        err instanceof Error ? err.message : "Failed to update delivery partner"
      );
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Delivery Partner" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Partner Code *</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.partnerCode}
              onChange={(e) => setFormData({ ...formData, partnerCode: e.target.value })}
              required
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Company Name *</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Tracked Shipments</span>
            </label>
            <input
              type="number"
              min="0"
              className="input input-bordered w-full"
              value={formData.totalShipments}
              onChange={(e) => setFormData({ ...formData, totalShipments: e.target.value })}
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">On-Time Rate (%)</span>
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              className="input input-bordered w-full"
              value={formData.onTimeDeliveryRate}
              onChange={(e) =>
                setFormData({ ...formData, onTimeDeliveryRate: e.target.value })
              }
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Contact Person</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.contactPerson}
              onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Email</span>
            </label>
            <input
              type="email"
              className="input input-bordered w-full"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Phone</span>
          </label>
          <input
            type="tel"
            className="input input-bordered w-full"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Country *</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={formData.country}
            onChange={(e) => setFormData({ ...formData, country: e.target.value })}
            required
          >
            <option value="">Select country...</option>
            <option value="United States">United States</option>
            <option value="United Kingdom">United Kingdom</option>
            <option value="Canada">Canada</option>
            <option value="Australia">Australia</option>
            <option value="Germany">Germany</option>
            <option value="France">France</option>
            <option value="China">China</option>
            <option value="Japan">Japan</option>
            <option value="India">India</option>
            <option value="Sri Lanka">Sri Lanka</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Partner Type *</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={formData.type}
            onChange={(e) =>
              setFormData({ ...formData, type: e.target.value as "local" | "foreign" })
            }
            required
          >
            <option value="">Select type...</option>
            <option value="local">Local</option>
            <option value="foreign">Foreign</option>
          </select>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Service Areas *</span>
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {formData.serviceAreas.map((area, idx) => (
              <StatusChip key={idx} label={area} tone="neutral" className="gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFormData({
                      ...formData,
                      serviceAreas: formData.serviceAreas.filter((_, i) => i !== idx),
                    });
                  }}
                  className="text-base-content/60 hover:text-error"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </StatusChip>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              className="input input-bordered flex-1"
              placeholder="Enter service area and press Enter"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const input = e.currentTarget;
                  if (input.value.trim()) {
                    setFormData({
                      ...formData,
                      serviceAreas: [...formData.serviceAreas, input.value.trim()],
                    });
                    input.value = "";
                  }
                }
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Cost per Delivery</span>
            </label>
            <div className="input-group">
              <span>$</span>
              <input
                type="number"
                step="0.01"
                className="input input-bordered w-full"
                value={formData.costPerDelivery}
                onChange={(e) =>
                  setFormData({ ...formData, costPerDelivery: e.target.value })
                }
              />
            </div>
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Rating (0-5)</span>
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="5"
              className="input input-bordered w-full"
              value={formData.rating}
              onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Update Partner
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function CreateDeliveryPartnerModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}) {
  const [formData, setFormData] = useState({
    partnerCode: "",
    companyName: "",
    contactPerson: "",
    email: "",
    phone: "",
    address: "",
    country: "",
    type: "" as "local" | "foreign" | "",
    serviceAreas: [] as string[],
    costPerDelivery: "",
    currencyCode: "USD",
    rating: "",
    totalShipments: "0",
    onTimeDeliveryRate: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const createData: Omit<ApiDeliveryPartner, "id"> = {
        partnerCode: formData.partnerCode,
        companyName: formData.companyName,
        contactPerson: formData.contactPerson || undefined,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        address: formData.address || undefined,
        country: formData.country || undefined,
        currencyCode: formData.currencyCode || undefined,
        serviceAreas: JSON.stringify(formData.serviceAreas),
        costPerDelivery: formData.costPerDelivery || undefined,
        rating: formData.rating || undefined,
        totalShipments: Number(formData.totalShipments || "0"),
        onTimeDeliveryRate: formData.onTimeDeliveryRate || undefined,
        status: "active",
      };

      await deliveryPartnersApi.create(createData);
      showToast.success("Delivery partner created successfully");
      await onSuccess();
      onClose();
      setFormData({
        partnerCode: "",
        companyName: "",
        contactPerson: "",
        email: "",
        phone: "",
        address: "",
        country: "",
        type: "" as "local" | "foreign" | "",
        serviceAreas: [],
        costPerDelivery: "",
        currencyCode: "USD",
        rating: "",
        totalShipments: "0",
        onTimeDeliveryRate: "",
      });
    } catch (err) {
      logger.error("Failed to create delivery partner:", err);
      showToast.error(
        err instanceof Error ? err.message : "Failed to create delivery partner"
      );
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Delivery Partner" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Partner Code *</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.partnerCode}
              onChange={(e) => setFormData({ ...formData, partnerCode: e.target.value })}
              required
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Company Name *</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.companyName}
              onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Tracked Shipments</span>
            </label>
            <input
              type="number"
              min="0"
              className="input input-bordered w-full"
              value={formData.totalShipments}
              onChange={(e) => setFormData({ ...formData, totalShipments: e.target.value })}
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">On-Time Rate (%)</span>
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              className="input input-bordered w-full"
              value={formData.onTimeDeliveryRate}
              onChange={(e) =>
                setFormData({ ...formData, onTimeDeliveryRate: e.target.value })
              }
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Contact Person</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.contactPerson}
              onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Email</span>
            </label>
            <input
              type="email"
              className="input input-bordered w-full"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Phone</span>
          </label>
          <input
            type="tel"
            className="input input-bordered w-full"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Country *</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={formData.country}
            onChange={(e) => setFormData({ ...formData, country: e.target.value })}
            required
          >
            <option value="">Select country...</option>
            <option value="United States">United States</option>
            <option value="United Kingdom">United Kingdom</option>
            <option value="Canada">Canada</option>
            <option value="Australia">Australia</option>
            <option value="Germany">Germany</option>
            <option value="France">France</option>
            <option value="China">China</option>
            <option value="Japan">Japan</option>
            <option value="India">India</option>
            <option value="Sri Lanka">Sri Lanka</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Partner Type *</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={formData.type}
            onChange={(e) =>
              setFormData({ ...formData, type: e.target.value as "local" | "foreign" })
            }
            required
          >
            <option value="">Select type...</option>
            <option value="local">Local</option>
            <option value="foreign">Foreign</option>
          </select>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Address</span>
          </label>
          <textarea
            className="textarea textarea-bordered w-full"
            rows={2}
            value={formData.address}
            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          />
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Service Areas *</span>
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {formData.serviceAreas.map((area, idx) => (
              <StatusChip key={idx} label={area} tone="neutral" className="gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFormData({
                      ...formData,
                      serviceAreas: formData.serviceAreas.filter((_, i) => i !== idx),
                    });
                  }}
                  className="text-base-content/60 hover:text-error"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </StatusChip>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              className="input input-bordered flex-1"
              placeholder="Enter service area and press Enter"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const input = e.currentTarget;
                  if (input.value.trim()) {
                    setFormData({
                      ...formData,
                      serviceAreas: [...formData.serviceAreas, input.value.trim()],
                    });
                    input.value = "";
                  }
                }
              }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Cost per Delivery</span>
            </label>
            <div className="input-group">
              <select
                className="select select-bordered"
                value={formData.currencyCode}
                onChange={(e) => setFormData({ ...formData, currencyCode: e.target.value })}
              >
                <option value="USD">USD ($)</option>
                <option value="LKR">LKR (Rs.)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="INR">INR (₹)</option>
              </select>
              <input
                type="number"
                step="0.01"
                className="input input-bordered w-full"
                value={formData.costPerDelivery}
                onChange={(e) =>
                  setFormData({ ...formData, costPerDelivery: e.target.value })
                }
              />
            </div>
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Rating (0-5)</span>
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="5"
              className="input input-bordered w-full"
              value={formData.rating}
              onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Create Partner
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function DeleteDeliveryPartnerModal({
  isOpen,
  onClose,
  onConfirm,
  partner,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  partner: DeliveryPartnerDisplay;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Delivery Partner" size="md">
      <div className="space-y-4">
        <div className="alert alert-warning">
          <span className="material-symbols-outlined">warning</span>
          <div>
            <h3 className="font-bold">Warning: This action cannot be undone!</h3>
            <div className="text-sm">
              You are about to delete <strong>{partner.companyName}</strong> (Partner
              Code: {partner.partnerCode}). This will permanently remove the delivery
              partner from the system and all associated data.
            </div>
          </div>
        </div>
        <div className="bg-base-200 rounded-lg p-4">
          <p className="text-sm text-base-content/70">
            <strong>Company Name:</strong> {partner.companyName}
          </p>
          <p className="text-sm text-base-content/70">
            <strong>Partner Code:</strong> {partner.partnerCode}
          </p>
          <p className="text-sm text-base-content/70">
            <strong>Type:</strong> {partner.type === "local" ? "Local" : "Foreign"}
          </p>
          <p className="text-sm text-base-content/70">
            <strong>Service Areas:</strong> {partner.serviceAreas.join(", ")}
          </p>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-error" onClick={onConfirm}>
            <span className="material-symbols-outlined">delete</span>
            Delete Partner
          </button>
        </div>
      </div>
    </Modal>
  );
}
