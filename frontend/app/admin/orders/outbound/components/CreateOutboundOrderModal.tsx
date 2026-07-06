"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, StepIndicator } from "@/components/Modal";
import { ordersApi } from "@/lib/api/orders";
import { customersApi, Customer } from "@/lib/api/customers";
import { warehousesApi } from "@/lib/api/warehouses";
import { materialsApi, type Material } from "@/lib/api/materials";
import { inventoryApi } from "@/lib/api/inventory";
import { showToast } from "@/lib/utils/toast";
import { SORTED_COUNTRIES, getCountryByName } from "@/lib/utils/countries";
import { validateEmail, validateRequired } from "@/lib/utils/form-validation";
import { OutboundOrderDisplay } from "../types";
import { logger } from "@/lib/utils/logger";

const positive = (value?: number | null): number | null =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;

const unitsPerHandlingUnit = (material?: Material): number =>
  positive(material?.unitsPerHandlingUnit) || positive(material?.palletSpaces) || 1;

const roundOutboundQuantity = (
  material: Material | undefined,
  mode: "units" | "handling",
  requestedQuantity: number,
  handlingUnitCount: number
): number => {
  const unitsPer = unitsPerHandlingUnit(material);
  const raw = mode === "handling" ? handlingUnitCount * unitsPer : requestedQuantity;
  const multiple = positive(material?.orderMultiple) || unitsPer;
  return raw > 0 ? Math.ceil(raw / multiple) * multiple : 0;
};

// Multi-step Create Outbound Order Modal
export function CreateOutboundOrderModal({ 
  isOpen, 
  onClose,
  onSaved,
  editingOrder 
}: { 
  isOpen: boolean; 
  onClose: () => void;
  onSaved: () => Promise<void>;
  editingOrder?: OutboundOrderDisplay | null;
}) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    deliveryAddressLine1: "",
    deliveryAddressLine2: "",
    deliveryCity: "",
    deliveryState: "",
    deliveryCountry: "",
    deliveryPostalCode: "",
    customCountry: "",
    warehouseId: "",
    requiredDeliveryDate: "",
    priority: "normal",
    notes: "",
    items: [] as Array<{
      productId: string;
      availableQuantity: number;
      orderQuantity: number;
      quantityMode: "units" | "handling";
      handlingUnitCount: number;
      requestedQuantity: number;
    }>,
  });
  
  // Validation errors
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const steps = ["Customer Details", "Order Details", "Add Items", "Review & Confirm"];

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [warehouses, setWarehouses] = useState<Array<{ id: string; name: string }>>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [inventoryTotalsByMaterialId, setInventoryTotalsByMaterialId] = useState<Map<string, number>>(new Map());
  const [isInventoryLoading, setIsInventoryLoading] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const customerDropdownRef = useRef<HTMLDivElement | null>(null);

  const filteredCustomers = useMemo(() => {
    const query = customerSearch.trim().toLowerCase();
    if (!query) return customers.slice(0, 20);
    return customers
      .filter((c) => {
        const name = c.name?.toLowerCase() || "";
        const code = c.code?.toLowerCase() || "";
        const email = c.email?.toLowerCase() || "";
        const phone = c.phone?.toLowerCase() || "";
        return name.includes(query) || code.includes(query) || email.includes(query) || phone.includes(query);
      })
      .slice(0, 20);
  }, [customers, customerSearch]);

  const selectableMaterials = useMemo(() => {
    if (!formData.warehouseId) return materials;
    if (isInventoryLoading) return [];
    if (inventoryTotalsByMaterialId.size === 0) return [];
    return materials.filter((m) => inventoryTotalsByMaterialId.has(m.id));
  }, [formData.warehouseId, inventoryTotalsByMaterialId, isInventoryLoading, materials]);
  const materialById = useMemo(() => new Map(materials.map((material) => [material.id, material])), [materials]);

  const applyCustomerToForm = (customer: Customer) => {
    const addressParts = (customer.address || "").split("\n");
    setFormData((prev) => ({
      ...prev,
      customerName: customer.name || prev.customerName,
      customerEmail: customer.email || "",
      customerPhone: customer.phone || "",
      deliveryAddressLine1: addressParts[0] || "",
      deliveryAddressLine2: addressParts[1] || "",
      deliveryCity: customer.city || "",
      deliveryCountry: customer.country || "",
      deliveryState: prev.deliveryState || "",
      deliveryPostalCode: prev.deliveryPostalCode || "",
      customCountry: "",
    }));
    setSelectedCustomerId(customer.id);
    setCustomerSearch(customer.name || "");
    setIsCustomerDropdownOpen(false);
    setValidationErrors((prev) => ({ ...prev, customerName: "" }));
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const [customersData, warehousesData, materialsData] = await Promise.all([
          customersApi.getAll(),
          warehousesApi.getAll(),
          materialsApi.getAll(),
        ]);
        setCustomers(customersData);
        setWarehouses(warehousesData);
        setMaterials(materialsData);
      } catch (err) {
        const isDev = process.env.NODE_ENV === 'development';
        if (isDev) {
          logger.error("Failed to load data:", err instanceof Error ? err.message : 'Unknown error');
        }
      }
    };
    loadData();
  }, []);

  // When a warehouse is selected, load inventory for that warehouse so the item dropdown can be filtered.
  useEffect(() => {
    const warehouseId = formData.warehouseId;
    if (!warehouseId) {
      setInventoryTotalsByMaterialId(new Map());
      setIsInventoryLoading(false);
      return;
    }

    let cancelled = false;
    setIsInventoryLoading(true);

    (async () => {
      try {
        const items = await inventoryApi.getByWarehouse(warehouseId);
        const totals = new Map<string, number>();
        for (const item of items) {
          const current = totals.get(item.materialId) || 0;
          const add = parseInt(item.availableQuantity) || 0;
          totals.set(item.materialId, current + add);
        }
        if (!cancelled) setInventoryTotalsByMaterialId(totals);
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          logger.error(
            "[Outbound Order] Failed to load warehouse inventory:",
            err instanceof Error ? err.message : "Unknown error"
          );
        }
        if (!cancelled) setInventoryTotalsByMaterialId(new Map());
      } finally {
        if (!cancelled) setIsInventoryLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [formData.warehouseId]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!customerDropdownRef.current) return;
      if (!customerDropdownRef.current.contains(event.target as Node)) {
        setIsCustomerDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  // Load order data when editing
  useEffect(() => {
    if (editingOrder && isOpen) {
      const loadOrderData = async () => {
        try {
          const order = await ordersApi.getById(editingOrder.id);
          const { orderItemsApi } = await import("@/lib/api/orderItems");
          const items = await orderItemsApi.getByOrderId(editingOrder.id);
          
          // Load customer if exists
          let customerName = "";
          let customerEmail = "";
          let customerPhone = "";
          let deliveryAddressLine1 = "";
          let deliveryAddressLine2 = "";
          let deliveryCity = "";
          let deliveryState = "";
          let deliveryCountry = "";
          let deliveryPostalCode = "";
          
          if (order.customerId) {
            try {
              const customer = await customersApi.getById(order.customerId);
              customerName = customer.name;
              customerEmail = customer.email || "";
              customerPhone = customer.phone || "";
              
              // Parse address (assuming format: "Line1\nLine2" or just "Line1")
              const addressParts = (customer.address || "").split("\n");
              deliveryAddressLine1 = addressParts[0] || "";
              deliveryAddressLine2 = addressParts[1] || "";
              deliveryCity = customer.city || "";
              deliveryCountry = customer.country || "";
              // Backend customer contract currently has no state/postalCode fields.
              deliveryState = "";
              deliveryPostalCode = "";
              setSelectedCustomerId(customer.id);
              setCustomerSearch(customer.name);
            } catch (err) {
              const isDev = process.env.NODE_ENV === 'development';
              if (isDev) {
                logger.error("Failed to load customer:", err instanceof Error ? err.message : 'Unknown error');
              }
            }
          }
          
          // Load order items with available quantities
          const orderItems = await Promise.all(
            items.map(async (item) => {
              let availableQuantity = 0;
              if (item.materialId && order.warehouseId) {
                try {
                  const inventoryItem = await inventoryApi.getByMaterialAndWarehouse(
                    item.materialId,
                    order.warehouseId
                  );
                  availableQuantity = inventoryItem
                    ? parseInt(inventoryItem.availableQuantity) || 0
                    : 0;
                } catch (err) {
                  const isDev = process.env.NODE_ENV === 'development';
                  if (isDev) {
                    logger.error("Failed to fetch available quantity:", err instanceof Error ? err.message : 'Unknown error');
                  }
                }
              }
              
              return {
                productId: item.materialId,
                availableQuantity,
                orderQuantity: item.quantity,
                quantityMode: "units" as const,
                handlingUnitCount: 0,
                requestedQuantity: item.quantity,
              };
            })
          );
          
          setFormData({
            customerName,
            customerEmail,
            customerPhone,
            deliveryAddressLine1,
            deliveryAddressLine2,
            deliveryCity,
            deliveryState,
            deliveryCountry,
            deliveryPostalCode,
            customCountry: "",
            warehouseId: order.warehouseId,
            requiredDeliveryDate: order.expectedDate || "",
            priority: order.priority || "normal",
            notes: order.notes || "",
            items: orderItems,
          });
        } catch (err) {
          const isDev = process.env.NODE_ENV === 'development';
          if (isDev) {
            logger.error("Failed to load order data:", err instanceof Error ? err.message : 'Unknown error');
          }
          showToast.error("Failed to load order data");
        }
      };
      loadOrderData();
    } else if (!editingOrder && isOpen) {
      // Reset form when creating new order
      setFormData({
        customerName: "",
        customerEmail: "",
        customerPhone: "",
        deliveryAddressLine1: "",
        deliveryAddressLine2: "",
        deliveryCity: "",
        deliveryState: "",
        deliveryCountry: "",
        deliveryPostalCode: "",
        customCountry: "",
        warehouseId: "",
        requiredDeliveryDate: "",
        priority: "normal",
        notes: "",
        items: [],
      });
      setValidationErrors({});
      setSelectedCustomerId(null);
      setCustomerSearch("");
      setStep(1);
    }
  }, [editingOrder, isOpen]);

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setError(null);

      // Validate required fields with country-specific validation
      const { validateEmail, validateRequired, validatePhone, validatePostalCode } = await import("@/lib/utils/form-validation");
      const { getCountryCodeFromName } = await import("@/lib/utils/countries");
      
      const errors: Record<string, string> = {};
      const nameResult = validateRequired(formData.customerName, "Customer Name");
      if (!nameResult.valid) errors.customerName = nameResult.error || "";
      
      const emailResult = validateEmail(formData.customerEmail);
      if (!emailResult.valid) errors.customerEmail = emailResult.error || "";
      
      const countryValue = formData.deliveryCountry === "CUSTOM" ? formData.customCountry : formData.deliveryCountry;
      const countryCode = getCountryCodeFromName(countryValue);
      
      const phoneResult = await validatePhone(formData.customerPhone, countryCode);
      if (!phoneResult.valid) errors.customerPhone = phoneResult.error || "";
      
      const addressResult = validateRequired(formData.deliveryAddressLine1, "Address Line 1");
      if (!addressResult.valid) errors.deliveryAddressLine1 = addressResult.error || "";
      
      const cityResult = validateRequired(formData.deliveryCity, "City");
      if (!cityResult.valid) errors.deliveryCity = cityResult.error || "";
      
      const countryResult = validateRequired(countryValue, "Country");
      if (!countryResult.valid) errors.deliveryCountry = countryResult.error || "";
      
      const postalResult = await validatePostalCode(formData.deliveryPostalCode, countryCode);
      if (!postalResult.valid) errors.deliveryPostalCode = postalResult.error || "";
      
      if (!formData.warehouseId || !formData.requiredDeliveryDate) {
        setError("Please fill in all required fields.");
        return;
      }
      
      if (Object.keys(errors).length > 0) {
        setValidationErrors(errors);
        setError("Please fix the validation errors before submitting.");
        setStep(1); // Go back to step 1 to show errors
        return;
      }

      // Find or create customer
      let customerId = selectedCustomerId || customers.find((c) => c.name === formData.customerName)?.id;
      if (!customerId) {
        // Create new customer
        const newCustomer = await customersApi.create({
          name: formData.customerName,
          email: formData.customerEmail || undefined,
          phone: formData.customerPhone || undefined,
          address: formData.deliveryAddressLine1 + (formData.deliveryAddressLine2 ? `\n${formData.deliveryAddressLine2}` : ""),
          city: formData.deliveryCity,
          country: formData.deliveryCountry || formData.customCountry,
          status: "active",
        });
        customerId = newCustomer.id;
      }

      // Validate items
      if (formData.items.length === 0) {
        setError("Please add at least one item to the order.");
        return;
      }

      // Validate all items have product and quantity
      const invalidItems = formData.items.filter(
        item => !item.productId || item.orderQuantity <= 0
      );
      if (invalidItems.length > 0) {
        setError("Please ensure all items have a product selected and quantity greater than 0.");
        return;
      }

      // Validate that order quantities don't exceed available stock
      for (const item of formData.items) {
        if (item.orderQuantity > item.availableQuantity) {
          setError(`Order quantity (${item.orderQuantity}) exceeds available stock (${item.availableQuantity}) for one or more items.`);
          setStep(3); // Go back to items step
          return;
        }
      }

      let orderId: string;
      
      if (editingOrder) {
        // Update existing order
        orderId = editingOrder.id;
        
        await ordersApi.update(orderId, {
          customerId,
          warehouseId: formData.warehouseId,
          expectedDate: formData.requiredDeliveryDate,
          priority: formData.priority,
          notes: formData.notes || undefined,
        });
      } else {
        // Create new order
        const createdOrder = await ordersApi.create({
          orderType: "outbound",
          customerId,
          warehouseId: formData.warehouseId,
          expectedDate: formData.requiredDeliveryDate,
          priority: formData.priority,
          notes: formData.notes || undefined,
          status: "pending",
        });
        orderId = createdOrder.id;
      }

      // Create or update order items
      const { orderItemsApi } = await import("@/lib/api/orderItems");
      try {
        if (editingOrder) {
          // Delete existing items and create new ones
          const existingItems = await orderItemsApi.getByOrderId(orderId);
          await Promise.all(
            existingItems.map(item => orderItemsApi.delete(item.id))
          );
        }
        
        await Promise.all(
          formData.items.map(item =>
            orderItemsApi.create(orderId, {
              materialId: item.productId,
              quantity: item.orderQuantity,
              locationCode: undefined, // Will be set during picking
            })
          )
        );
      } catch (itemError) {
        const isDev = process.env.NODE_ENV === 'development';
        if (isDev) {
          logger.error("Failed to save order items:", itemError instanceof Error ? itemError.message : 'Unknown error');
        }
        setError(editingOrder 
          ? "Order updated but failed to update items. Please try again."
          : "Order created but failed to add items. Please edit the order to add items.");
        // Don't return - order was created/updated, just show warning
      }

      showToast.success(editingOrder
        ? `Outbound order updated successfully with ${formData.items.length} item(s)!`
        : `Outbound order created successfully with ${formData.items.length} item(s)!`);
      await onSaved();
      onClose();
      setStep(1);
      setFormData({
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      deliveryAddressLine1: "",
      deliveryAddressLine2: "",
      deliveryCity: "",
      deliveryState: "",
      deliveryCountry: "",
      deliveryPostalCode: "",
      customCountry: "",
      warehouseId: "",
      requiredDeliveryDate: "",
      priority: "normal",
      notes: "",
      items: [],
    });
    setValidationErrors({});
    setSelectedCustomerId(null);
    setCustomerSearch("");
    } catch (err) {
      const isDev = process.env.NODE_ENV === 'development';
      if (isDev) {
        logger.error("Failed to create outbound order:", err instanceof Error ? err.message : 'Unknown error');
      }
      setError("Failed to create order. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Outbound Order"
      size="lg"
    >
      <StepIndicator steps={steps} currentStep={step} />

      {/* Step 1: Customer Details */}
      {step === 1 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-base-content mb-4">Customer Details</h3>
          
          {/* Customer Name */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Customer Name *</span>
            </label>
            <div className="relative" ref={customerDropdownRef}>
              <input
                type="text"
                className={`input input-bordered w-full ${validationErrors.customerName ? 'input-error' : ''}`}
                value={customerSearch}
                onFocus={() => setIsCustomerDropdownOpen(true)}
                onChange={(e) => {
                  const value = e.target.value;
                  setCustomerSearch(value);
                  setFormData({ ...formData, customerName: value });
                  setSelectedCustomerId(null);
                  setIsCustomerDropdownOpen(true);
                  if (validationErrors.customerName) {
                    setValidationErrors({ ...validationErrors, customerName: "" });
                  }
                }}
                onBlur={() => {
                  const result = validateRequired(formData.customerName, "Customer Name");
                  if (!result.valid) {
                    setValidationErrors({ ...validationErrors, customerName: result.error || "" });
                  }
                }}
                placeholder="Select customer or type to search"
                required
              />
              <button
                type="button"
                className="btn btn-ghost btn-xs absolute right-2 top-1/2 -translate-y-1/2"
                onClick={() => setIsCustomerDropdownOpen((prev) => !prev)}
                title="Toggle customer list"
              >
                <span className="material-symbols-outlined text-sm">
                  {isCustomerDropdownOpen ? "expand_less" : "expand_more"}
                </span>
              </button>

              {isCustomerDropdownOpen && (
                <div className="absolute z-20 mt-1 w-full rounded-lg border border-base-300 bg-base-100 shadow-md max-h-64 overflow-auto">
                  {filteredCustomers.length > 0 ? (
                    filteredCustomers.map((customer) => (
                      <button
                        key={customer.id}
                        type="button"
                        className="w-full text-left px-3 py-2 hover:bg-base-200 transition-colors"
                        onClick={() => applyCustomerToForm(customer)}
                      >
                        <div className="font-medium">{customer.name}</div>
                        <div className="text-xs text-base-content/70">
                          {customer.code ? `${customer.code} · ` : ""}{customer.email || customer.phone || "No contact details"}
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-sm text-base-content/70">
                      No matching customer found. You can continue to create a new customer.
                    </div>
                  )}
                </div>
              )}
            </div>
            {validationErrors.customerName && (
              <label className="label">
                <span className="label-text-alt text-error">{validationErrors.customerName}</span>
              </label>
            )}
          </div>

          {/* Customer Email */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Customer Email</span>
            </label>
            <input
              type="email"
              className={`input input-bordered w-full ${validationErrors.customerEmail ? 'input-error' : ''}`}
              value={formData.customerEmail}
              onChange={(e) => {
                setFormData({ ...formData, customerEmail: e.target.value });
                if (validationErrors.customerEmail) {
                  setValidationErrors({ ...validationErrors, customerEmail: "" });
                }
              }}
              onBlur={() => {
                const result = validateEmail(formData.customerEmail);
                if (!result.valid) {
                  setValidationErrors({ ...validationErrors, customerEmail: result.error || "" });
                }
              }}
            />
            {validationErrors.customerEmail && (
              <label className="label">
                <span className="label-text-alt text-error">{validationErrors.customerEmail}</span>
              </label>
            )}
          </div>

          {/* Customer Phone */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Customer Phone</span>
            </label>
            <input
              type="tel"
              className={`input input-bordered w-full ${validationErrors.customerPhone ? 'input-error' : ''}`}
              value={formData.customerPhone}
              onChange={(e) => {
                setFormData({ ...formData, customerPhone: e.target.value });
                if (validationErrors.customerPhone) {
                  setValidationErrors({ ...validationErrors, customerPhone: "" });
                }
              }}
              onBlur={async () => {
                const { validatePhone } = await import("@/lib/utils/form-validation");
                const { getCountryCodeFromName } = await import("@/lib/utils/countries");
                
                const countryValue = formData.deliveryCountry === "CUSTOM" ? formData.customCountry : formData.deliveryCountry;
                const countryCode = getCountryCodeFromName(countryValue);
                const result = await validatePhone(formData.customerPhone, countryCode);
                
                if (!result.valid) {
                  setValidationErrors({ ...validationErrors, customerPhone: result.error || "" });
                }
              }}
              placeholder="+94 77 123 4567 or 0771234567"
            />
            {validationErrors.customerPhone && (
              <label className="label">
                <span className="label-text-alt text-error">{validationErrors.customerPhone}</span>
              </label>
            )}
          </div>

          {/* Delivery Address - Simplified to 2 lines */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Delivery Address Line 1 *</span>
            </label>
            <input
              type="text"
              className={`input input-bordered w-full ${validationErrors.deliveryAddressLine1 ? 'input-error' : ''}`}
              value={formData.deliveryAddressLine1}
              onChange={(e) => {
                setFormData({ ...formData, deliveryAddressLine1: e.target.value });
                if (validationErrors.deliveryAddressLine1) {
                  setValidationErrors({ ...validationErrors, deliveryAddressLine1: "" });
                }
              }}
              onBlur={() => {
                const result = validateRequired(formData.deliveryAddressLine1, "Address Line 1");
                if (!result.valid) {
                  setValidationErrors({ ...validationErrors, deliveryAddressLine1: result.error || "" });
                }
              }}
              placeholder="Street address, building number"
              required
            />
            {validationErrors.deliveryAddressLine1 && (
              <label className="label">
                <span className="label-text-alt text-error">{validationErrors.deliveryAddressLine1}</span>
              </label>
            )}
          </div>

          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Delivery Address Line 2 (Optional)</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.deliveryAddressLine2}
              onChange={(e) => setFormData({ ...formData, deliveryAddressLine2: e.target.value })}
              placeholder="Apartment, suite, unit, building, floor, etc."
            />
          </div>

          {/* City, State, Country - Auto-filled or manual entry */}
          <div className="grid grid-cols-2 gap-3">
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">City *</span>
              </label>
              <input
                type="text"
                className={`input input-bordered w-full ${validationErrors.deliveryCity ? 'input-error' : ''}`}
                value={formData.deliveryCity}
                onChange={(e) => {
                  setFormData({ ...formData, deliveryCity: e.target.value });
                  if (validationErrors.deliveryCity) {
                    setValidationErrors({ ...validationErrors, deliveryCity: "" });
                  }
                }}
                onBlur={() => {
                  const result = validateRequired(formData.deliveryCity, "City");
                  if (!result.valid) {
                    setValidationErrors({ ...validationErrors, deliveryCity: result.error || "" });
                  }
                }}
                required
              />
              {validationErrors.deliveryCity && (
                <label className="label">
                  <span className="label-text-alt text-error">{validationErrors.deliveryCity}</span>
                </label>
              )}
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">State/Province</span>
              </label>
              <input
                type="text"
                className="input input-bordered w-full"
                value={formData.deliveryState}
                onChange={(e) => setFormData({ ...formData, deliveryState: e.target.value })}
                placeholder="Optional"
              />
            </div>
          </div>

          {/* Country with custom entry option */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Country *</span>
            </label>
            <select
              className={`select select-bordered w-full ${validationErrors.deliveryCountry ? 'select-error' : ''}`}
              value={formData.deliveryCountry}
              onChange={(e) => {
                setFormData({ 
                  ...formData, 
                  deliveryCountry: e.target.value,
                  customCountry: e.target.value === "CUSTOM" ? formData.customCountry : ""
                });
                if (validationErrors.deliveryCountry) {
                  setValidationErrors({ ...validationErrors, deliveryCountry: "" });
                }
              }}
              required
            >
              <option value="">Select country</option>
              {SORTED_COUNTRIES.map((country) => (
                <option key={country.code} value={country.name}>
                  {country.name}
                </option>
              ))}
              <option value="CUSTOM">Other (Enter custom country)</option>
            </select>
            {formData.deliveryCountry === "CUSTOM" && (
              <input
                type="text"
                className="input input-bordered w-full mt-2"
                value={formData.customCountry}
                onChange={(e) => setFormData({ ...formData, customCountry: e.target.value })}
                placeholder="Enter country name"
                onBlur={() => {
                  const result = validateRequired(formData.customCountry, "Country");
                  if (!result.valid) {
                    setValidationErrors({ ...validationErrors, deliveryCountry: result.error || "" });
                  }
                }}
              />
            )}
            {validationErrors.deliveryCountry && (
              <label className="label">
                <span className="label-text-alt text-error">{validationErrors.deliveryCountry}</span>
              </label>
            )}
          </div>

          {/* Postal Code */}
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Postal Code</span>
            </label>
            <input
              type="text"
              className={`input input-bordered w-full ${validationErrors.deliveryPostalCode ? 'input-error' : ''}`}
              value={formData.deliveryPostalCode}
              onChange={(e) => {
                setFormData({ ...formData, deliveryPostalCode: e.target.value });
                if (validationErrors.deliveryPostalCode) {
                  setValidationErrors({ ...validationErrors, deliveryPostalCode: "" });
                }
              }}
              onBlur={async () => {
                const { validatePostalCode } = await import("@/lib/utils/form-validation");
                const { getCountryCodeFromName } = await import("@/lib/utils/countries");
                
                const countryValue = formData.deliveryCountry === "CUSTOM" ? formData.customCountry : formData.deliveryCountry;
                const countryCode = getCountryCodeFromName(countryValue);
                const result = await validatePostalCode(formData.deliveryPostalCode, countryCode);
                
                if (!result.valid) {
                  setValidationErrors({ ...validationErrors, deliveryPostalCode: result.error || "" });
                }
              }}
              placeholder="Optional"
            />
            {validationErrors.deliveryPostalCode && (
              <label className="label">
                <span className="label-text-alt text-error">{validationErrors.deliveryPostalCode}</span>
              </label>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button 
              className="btn btn-primary" 
              onClick={async () => {
                // Validate before proceeding
                const { validateEmail, validateRequired, validatePhone, validatePostalCode } = await import("@/lib/utils/form-validation");
                const { getCountryCodeFromName } = await import("@/lib/utils/countries");
                
                const errors: Record<string, string> = {};
                const nameResult = validateRequired(formData.customerName, "Customer Name");
                if (!nameResult.valid) errors.customerName = nameResult.error || "";
                
                const emailResult = validateEmail(formData.customerEmail);
                if (!emailResult.valid) errors.customerEmail = emailResult.error || "";
                
                const countryValue = formData.deliveryCountry === "CUSTOM" ? formData.customCountry : formData.deliveryCountry;
                const countryCode = getCountryCodeFromName(countryValue);
                
                const phoneResult = await validatePhone(formData.customerPhone, countryCode);
                if (!phoneResult.valid) errors.customerPhone = phoneResult.error || "";
                
                const addressResult = validateRequired(formData.deliveryAddressLine1, "Address Line 1");
                if (!addressResult.valid) errors.deliveryAddressLine1 = addressResult.error || "";
                
                const cityResult = validateRequired(formData.deliveryCity, "City");
                if (!cityResult.valid) errors.deliveryCity = cityResult.error || "";
                
                const countryResult = validateRequired(countryValue, "Country");
                if (!countryResult.valid) errors.deliveryCountry = countryResult.error || "";
                
                const postalResult = await validatePostalCode(formData.deliveryPostalCode, countryCode);
                if (!postalResult.valid) errors.deliveryPostalCode = postalResult.error || "";
                
                if (Object.keys(errors).length > 0) {
                  setValidationErrors(errors);
                  showToast.error("Please fix the validation errors before proceeding");
                  return;
                }
                
                setValidationErrors({});
                setStep(2);
              }}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Order Details */}
      {step === 2 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-base-content mb-4">Order Details</h3>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Warehouse *</span>
            </label>
              <select
                className="select select-bordered w-full"
                value={formData.warehouseId}
                onChange={async (e) => {
                  const newWarehouseId = e.target.value;
                  setFormData({ ...formData, warehouseId: newWarehouseId });
                  
                  // Refetch available quantities for all items when warehouse changes
                  if (newWarehouseId && formData.items.length > 0) {
                    const newItems = [...formData.items];
                    const isDev = process.env.NODE_ENV === 'development';
                    
                    for (let i = 0; i < newItems.length; i++) {
                      if (newItems[i].productId) {
                        try {
                          // Use combined endpoint to get inventory for material + warehouse
                          const inventoryItem = await inventoryApi.getByMaterialAndWarehouse(
                            newItems[i].productId,
                            newWarehouseId
                          );
                          newItems[i].availableQuantity = inventoryItem 
                            ? parseInt(inventoryItem.availableQuantity) || 0
                            : 0;
                          // Reset order quantity if it exceeds new available quantity
                          if (newItems[i].orderQuantity > newItems[i].availableQuantity) {
                            newItems[i].orderQuantity = newItems[i].availableQuantity;
                          }
                        } catch (err: any) {
                          if (isDev) {
                            logger.error(`[Outbound Order] Failed to fetch available quantity for item ${i}`);
                          }
                          newItems[i].availableQuantity = 0;
                        }
                      }
                    }
                    setFormData({ ...formData, warehouseId: newWarehouseId, items: newItems });
                  }
                }}
                required
              >
                <option value="">Select warehouse</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Required Delivery Date *</span>
            </label>
            <input
              type="date"
              className="input input-bordered w-full"
              value={formData.requiredDeliveryDate}
              onChange={(e) => setFormData({ ...formData, requiredDeliveryDate: e.target.value })}
              required
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Priority *</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              required
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
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
              placeholder="Additional notes..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button className="btn btn-ghost" onClick={() => setStep(1)}>
              Back
            </button>
            <button 
              className="btn btn-primary" 
              onClick={() => {
                if (!formData.warehouseId) {
                  try {
                    showToast.error("Please select a warehouse before adding items");
                  } catch (toastErr) {
                    logger.error("[Outbound Order] Toast error:", toastErr);
                    alert("Please select a warehouse before adding items");
                  }
                  return;
                }
                setStep(3);
              }}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Add Items */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-base-content">Add Items</h3>
            {formData.warehouseId && (
              <div className="badge badge-info badge-lg">
                <span className="material-symbols-outlined text-sm mr-1">warehouse</span>
                Warehouse: {warehouses.find(w => w.id === formData.warehouseId)?.name || "Unknown"}
              </div>
            )}
          </div>
          {!formData.warehouseId && (
            <div className="alert alert-warning">
              <span className="material-symbols-outlined">warning</span>
              <span>No warehouse selected. Please go back to Step 2 and select a warehouse.</span>
            </div>
          )}
          <div className="space-y-4">
            {formData.items.map((item, idx) => (
              <div key={idx} className="card bg-base-200 p-4 rounded-lg">
                <div className="flex justify-between items-start mb-3">
                  <span className="font-semibold">Item {idx + 1}</span>
                  <button
                    className="btn btn-ghost btn-xs"
                    onClick={() => {
                      const newItems = formData.items.filter((_, i) => i !== idx);
                      setFormData({ ...formData, items: newItems });
                    }}
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text text-xs">Product *</span>
                    </label>
                    <select
                      className="select select-bordered select-sm"
                      value={item.productId}
                      onChange={async (e) => {
                        const newItems = [...formData.items];
                        newItems[idx].productId = e.target.value;
                        newItems[idx].orderQuantity = 0; // Reset quantity when product changes
                        newItems[idx].requestedQuantity = 0;
                        newItems[idx].handlingUnitCount = 0;
                        
                        // Fetch available quantity from preloaded warehouse totals.
                        if (e.target.value && formData.warehouseId) {
                          const availableQty = inventoryTotalsByMaterialId.get(e.target.value) ?? 0;
                          newItems[idx].availableQuantity = availableQty;

                          if (availableQty === 0) {
                            try {
                              showToast.warning(`No available stock for this product in selected warehouse`);
                            } catch {}
                          }
                        } else if (e.target.value && !formData.warehouseId) { 
                          // Warehouse not selected yet 
                          newItems[idx].availableQuantity = 0; 
                          try { 
                            showToast.warning("Please select a warehouse first to see available quantity"); 
                          } catch (toastErr) {
                            const isDev = process.env.NODE_ENV === 'development';
                            if (isDev) logger.error("[Outbound Order] Toast error");
                          }
                        } else {
                          newItems[idx].availableQuantity = 0;
                        }
                        
                        setFormData({ ...formData, items: newItems });
                      }}
                      required
                    >
                      <option value="">Select material</option>
                      {formData.warehouseId && isInventoryLoading && (
                        <option value="" disabled>
                          Loading warehouse inventory...
                        </option>
                      )}
                      {formData.warehouseId && !isInventoryLoading && selectableMaterials.length === 0 && (
                        <option value="" disabled>
                          No inventory items in selected warehouse
                        </option>
                      )}
                      {(formData.warehouseId ? selectableMaterials : materials).map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.materialCode} - {m.description}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text text-xs">Available Quantity</span>
                    </label>
                    <input
                      type="number"
                      className="input input-bordered input-sm"
                      value={item.availableQuantity}
                      disabled
                    />
                  </div>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text text-xs">Quantity Mode</span>
                    </label>
                    <select
                      className="select select-bordered select-sm"
                      value={item.quantityMode}
                      onChange={(e) => {
                        const newItems = [...formData.items];
                        newItems[idx].quantityMode = e.target.value as "units" | "handling";
                        const material = materialById.get(item.productId);
                        newItems[idx].orderQuantity = roundOutboundQuantity(
                          material,
                          newItems[idx].quantityMode,
                          newItems[idx].requestedQuantity,
                          newItems[idx].handlingUnitCount
                        );
                        setFormData({ ...formData, items: newItems });
                      }}
                    >
                      <option value="units">Units</option>
                      <option value="handling">{materialById.get(item.productId)?.handlingUnitType || materialById.get(item.productId)?.unitType || "Handling unit"}</option>
                    </select>
                  </div>
                  <div className="form-control">
                    <label className="label">
                      <span className="label-text text-xs">
                        {item.quantityMode === "handling"
                          ? `${materialById.get(item.productId)?.handlingUnitType || materialById.get(item.productId)?.unitType || "Handling unit"} count`
                          : "Requested units"}
                      </span>
                    </label>
                    <input
                      type="number"
                      className="input input-bordered input-sm"
                      value={item.quantityMode === "handling" ? item.handlingUnitCount : item.requestedQuantity}
                      onChange={(e) => {
                        const newItems = [...formData.items];
                        const qty = parseInt(e.target.value) || 0;
                        const material = materialById.get(item.productId);
                        if (item.quantityMode === "handling") {
                          newItems[idx].handlingUnitCount = qty;
                        } else {
                          newItems[idx].requestedQuantity = qty;
                        }
                        const rounded = roundOutboundQuantity(
                          material,
                          newItems[idx].quantityMode,
                          newItems[idx].requestedQuantity,
                          newItems[idx].handlingUnitCount
                        );
                        if (rounded > item.availableQuantity) {
                          showToast.error(`Cannot order more than available stock (${item.availableQuantity})`);
                        }
                        newItems[idx].orderQuantity = Math.min(rounded, item.availableQuantity);
                        
                        setFormData({ ...formData, items: newItems });
                      }}
                      required
                      min="1"
                    />
                  </div>
                  <div className="form-control col-span-2">
                    <label className="label">
                      <span className="label-text text-xs">Issued Base Quantity</span>
                    </label>
                    <input
                      type="number"
                      className={`input input-bordered input-sm ${item.orderQuantity > item.availableQuantity ? 'input-error' : ''}`}
                      value={item.orderQuantity}
                      disabled
                    />
                    {item.productId && (
                      <label className="label">
                        <span className="label-text-alt">
                          Units/handling unit: {unitsPerHandlingUnit(materialById.get(item.productId))}. Remaining after order: {Math.max(item.availableQuantity - item.orderQuantity, 0)}
                        </span>
                      </label>
                    )}
                    {item.orderQuantity > item.availableQuantity && (
                      <label className="label">
                        <span className="label-text-alt text-error">
                          Available: {item.availableQuantity}. Cannot exceed available stock.
                        </span>
                      </label>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <button
              className="btn btn-outline btn-sm w-full"
              onClick={() => {
                setFormData({
                  ...formData,
                  items: [
                    ...formData.items,
                    {
                      productId: "",
                      availableQuantity: 0,
                      orderQuantity: 0,
                      quantityMode: "units",
                      handlingUnitCount: 0,
                      requestedQuantity: 0,
                    },
                  ],
                });
              }}
            >
              <span className="material-symbols-outlined">add</span>
              Add Another Item
            </button>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button className="btn btn-ghost" onClick={() => setStep(2)}>
              Back
            </button>
            <button className="btn btn-primary" onClick={() => setStep(4)}>
              Next
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Review & Confirm */}
      {step === 4 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-base-content mb-4">Review & Confirm</h3>
          <div className="card bg-base-200 p-4 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-base-content/60">Customer:</span>
              <span className="font-semibold">{formData.customerName}</span>
            </div>
            {formData.customerEmail && (
              <div className="flex justify-between">
                <span className="text-base-content/60">Email:</span>
                <span className="font-semibold">{formData.customerEmail}</span>
              </div>
            )}
            {formData.customerPhone && (
              <div className="flex justify-between">
                <span className="text-base-content/60">Phone:</span>
                <span className="font-semibold">{formData.customerPhone}</span>
              </div>
            )}
            <div className="flex justify-between items-start">
              <span className="text-base-content/60">Delivery Address:</span>
              <div className="text-right">
                <div className="font-semibold">{formData.deliveryAddressLine1}</div>
                {formData.deliveryAddressLine2 && (
                  <div className="font-semibold">{formData.deliveryAddressLine2}</div>
                )}
                <div className="text-sm text-base-content/60">
                  {formData.deliveryCity}
                  {formData.deliveryState && `, ${formData.deliveryState}`}
                  {formData.deliveryPostalCode && ` ${formData.deliveryPostalCode}`}
                </div>
                <div className="text-sm text-base-content/60">
                  {formData.deliveryCountry === "CUSTOM" ? formData.customCountry : formData.deliveryCountry}
                </div>
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-base-content/60">Warehouse:</span>
              <span className="font-semibold">{warehouses.find(w => w.id === formData.warehouseId)?.name || "N/A"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-base-content/60">Required Delivery:</span>
              <span className="font-semibold">{formData.requiredDeliveryDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-base-content/60">Priority:</span>
              <span className="font-semibold capitalize">{formData.priority}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-base-content/60">Total Items:</span>
              <span className="font-semibold">{formData.items.length}</span>
            </div>
          </div>
          <div className="divider"></div>
          <div className="space-y-2">
            <h4 className="font-semibold">Items:</h4>
            {formData.items.map((item, idx) => (
              <div key={idx} className="flex justify-between text-sm">
                <span>{materialById.get(item.productId)?.materialCode || `Item ${idx + 1}`}</span>
                <span>
                  {item.quantityMode === "handling"
                    ? `${item.handlingUnitCount} ${materialById.get(item.productId)?.handlingUnitType || "units"}`
                    : `${item.requestedQuantity} requested`} / {item.orderQuantity} base units
                </span>
              </div>
            ))}
          </div>
          {error && (
            <div className="alert alert-error">
              <span>{error}</span>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4">
            <button className="btn btn-ghost" onClick={() => setStep(3)} disabled={isSubmitting}>
              Back
            </button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  Creating...
                </>
              ) : (
                "Create Order"
              )}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
