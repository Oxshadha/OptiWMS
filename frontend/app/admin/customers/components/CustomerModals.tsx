"use client";

import { type FormEvent, useState } from "react";
import { DetailModal } from "@/components/DetailModal";
import { Modal } from "@/components/Modal";
import { StatusChip } from "@/components/StatusChip";
import { customersApi, type Customer } from "@/lib/api/customers";
import { showToast } from "@/lib/utils/toast";
import { logger } from "@/lib/utils/logger";
import { CustomerDisplay, customerStatusTone } from "../types";

export function AddCustomerModal({
  isOpen,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}) {
  const [formData, setFormData] = useState({
    name: "",
    contact: "",
    phone: "",
    status: "Active",
  });
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const { validateEmail, validatePhone, validateRequired } = await import("@/lib/utils/form-validation");
    const errors: Record<string, string> = {};

    const nameResult = validateRequired(formData.name, "Customer Name");
    if (!nameResult.valid) errors.name = nameResult.error || "";

    const emailResult = validateRequired(formData.contact, "Contact Email");
    if (!emailResult.valid) {
      errors.contact = emailResult.error || "";
    } else {
      const emailFormatResult = validateEmail(formData.contact);
      if (!emailFormatResult.valid) errors.contact = emailFormatResult.error || "";
    }

    const phoneResult = await validatePhone(formData.phone);
    if (!phoneResult.valid) errors.phone = phoneResult.error || "";

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      showToast.error("Please fix the validation errors before submitting");
      return;
    }

    try {
      const createData: Omit<Customer, "id"> = {
        name: formData.name,
        email: formData.contact || undefined,
        phone: formData.phone || undefined,
        status: formData.status.toLowerCase(),
      };

      await customersApi.create(createData);
      showToast.success("Customer added successfully");
      await onSuccess();
      onClose();
      setFormData({
        name: "",
        contact: "",
        phone: "",
        status: "Active",
      });
      setValidationErrors({});
    } catch (err) {
      logger.error("Failed to add customer:", err);
      showToast.error(err instanceof Error ? err.message : "Failed to add customer");
    }
  };

  return (
    <DetailModal isOpen={isOpen} onClose={onClose} title="Add Customer" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Customer Name *</span>
          </label>
          <input
            type="text"
            className={`input input-bordered w-full ${validationErrors.name ? "input-error" : ""}`}
            value={formData.name}
            onChange={(e) => {
              setFormData({ ...formData, name: e.target.value });
              if (validationErrors.name) {
                setValidationErrors({ ...validationErrors, name: "" });
              }
            }}
            required
          />
          {validationErrors.name && (
            <label className="label">
              <span className="label-text-alt text-error">{validationErrors.name}</span>
            </label>
          )}
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Contact Email *</span>
          </label>
          <input
            type="email"
            className={`input input-bordered w-full ${validationErrors.contact ? "input-error" : ""}`}
            value={formData.contact}
            onChange={(e) => {
              setFormData({ ...formData, contact: e.target.value });
              if (validationErrors.contact) {
                setValidationErrors({ ...validationErrors, contact: "" });
              }
            }}
            onBlur={async () => {
              const { validateEmail, validateRequired } = await import("@/lib/utils/form-validation");
              const requiredResult = validateRequired(formData.contact, "Contact Email");
              if (!requiredResult.valid) {
                setValidationErrors({ ...validationErrors, contact: requiredResult.error || "" });
              } else {
                const emailResult = validateEmail(formData.contact);
                if (!emailResult.valid) {
                  setValidationErrors({ ...validationErrors, contact: emailResult.error || "" });
                }
              }
            }}
            required
          />
          {validationErrors.contact && (
            <label className="label">
              <span className="label-text-alt text-error">{validationErrors.contact}</span>
            </label>
          )}
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Phone</span>
          </label>
          <input
            type="tel"
            className={`input input-bordered w-full ${validationErrors.phone ? "input-error" : ""}`}
            value={formData.phone}
            onChange={(e) => {
              setFormData({ ...formData, phone: e.target.value });
              if (validationErrors.phone) {
                setValidationErrors({ ...validationErrors, phone: "" });
              }
            }}
            onBlur={async () => {
              const { validatePhone } = await import("@/lib/utils/form-validation");
              const result = await validatePhone(formData.phone);
              if (!result.valid) {
                setValidationErrors({ ...validationErrors, phone: result.error || "" });
              }
            }}
            placeholder="+94 77 123 4567 or 0771234567"
          />
          {validationErrors.phone && (
            <label className="label">
              <span className="label-text-alt text-error">{validationErrors.phone}</span>
            </label>
          )}
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Status</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
          >
            <option value="Active">Active</option>
            <option value="On Hold">On Hold</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Add Customer
          </button>
        </div>
      </form>
    </DetailModal>
  );
}

export function CustomerDetailModal({
  isOpen,
  onClose,
  onEdit,
  customer,
}: {
  isOpen: boolean;
  onClose: () => void;
  onEdit: (customer: CustomerDisplay) => void;
  customer: CustomerDisplay;
}) {
  return (
    <DetailModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Customer: ${customer.name}`}
      size="lg"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-base-content/60">Customer ID</label>
            <p className="font-semibold">{customer.id}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Status</label>
            <p>
              <StatusChip label={customer.status} tone={customerStatusTone(customer.status)} showDot />
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Contact Email</label>
            <p className="font-semibold">{customer.contact}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Phone</label>
            <p className="font-semibold">{customer.phone}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Total Orders</label>
            <p className="font-semibold">{customer.orders}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Join Date</label>
            <p className="font-semibold">{customer.joinDate}</p>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          <button className="btn btn-primary" onClick={() => onEdit(customer)}>
            Edit Customer
          </button>
        </div>
      </div>
    </DetailModal>
  );
}

export function CustomerEditModal({
  isOpen,
  onClose,
  onUpdated,
  customer,
}: {
  isOpen: boolean;
  onClose: () => void;
  onUpdated: () => Promise<void>;
  customer: CustomerDisplay;
}) {
  const [formData, setFormData] = useState({
    name: customer.name,
    contact: customer.contact,
    phone: customer.phone,
    status: customer.status,
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    try {
      const customerId = customer.originalId || customer.id;
      const updateData: Partial<Customer> = {
        name: formData.name,
        email: formData.contact || undefined,
        phone: formData.phone || undefined,
        status: formData.status.toLowerCase(),
      };

      await customersApi.update(customerId, updateData);
      showToast.success("Customer updated successfully");
      await onUpdated();
      onClose();
    } catch (err) {
      logger.error("Failed to update customer:", err);
      showToast.error(err instanceof Error ? err.message : "Failed to update customer");
    }
  };

  return (
    <DetailModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit Customer: ${customer.name}`}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Customer Name *</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Contact Email *</span>
          </label>
          <input
            type="email"
            className="input input-bordered w-full"
            value={formData.contact}
            onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
            required
          />
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
            <span className="label-text font-medium">Status</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
          >
            <option value="Active">Active</option>
            <option value="On Hold">On Hold</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Save Changes
          </button>
        </div>
      </form>
    </DetailModal>
  );
}

export function DeleteCustomerModal({
  isOpen,
  onClose,
  onConfirm,
  customer,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  customer: CustomerDisplay;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Delete Customer" size="md">
      <div className="space-y-4">
        <div className="alert alert-warning">
          <span className="material-symbols-outlined">warning</span>
          <div>
            <h3 className="font-bold">Warning: This action cannot be undone!</h3>
            <div className="text-sm">
              You are about to delete <strong>{customer.name}</strong> (Customer ID: {customer.id}).
              This will permanently remove the customer from the system and all associated data.
            </div>
          </div>
        </div>
        <div className="bg-base-200 rounded-lg p-4">
          <p className="text-sm text-base-content/70">
            <strong>Customer Name:</strong> {customer.name}
          </p>
          <p className="text-sm text-base-content/70">
            <strong>Customer ID:</strong> {customer.id}
          </p>
          <p className="text-sm text-base-content/70">
            <strong>Contact:</strong> {customer.contact}
          </p>
          <p className="text-sm text-base-content/70">
            <strong>Total Orders:</strong> {customer.orders}
          </p>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-error" onClick={onConfirm}>
            <span className="material-symbols-outlined">delete</span>
            Delete Customer
          </button>
        </div>
      </div>
    </Modal>
  );
}
