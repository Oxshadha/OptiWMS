"use client";

import { useState } from "react";
import Link from "next/link";
import { DataTable } from "@/components/DataTable";
import { Modal, StepIndicator } from "@/components/Modal";
import { SummaryCards } from "@/components/SummaryCards";
import { useAdmin } from "@/contexts/AdminContext";
import { ADMIN_ROUTES } from "@/lib/admin-roles";
import clsx from "clsx";

// Mock data - will be replaced with API calls
const outboundOrders = [
  {
    id: "OO-1001",
    orderNumber: "#56281",
    customerName: "Acme Corp",
    warehouseName: "Warehouse 1",
    orderDate: "2025-12-15",
    requiredDelivery: "2025-12-20",
    priority: "high",
    status: "picking",
    totalItems: 12,
    pickedItems: 5,
  },
  {
    id: "OO-1002",
    orderNumber: "#56282",
    customerName: "Bright Retail",
    warehouseName: "Warehouse 1",
    orderDate: "2025-12-14",
    requiredDelivery: "2025-12-19",
    priority: "normal",
    status: "picked",
    totalItems: 8,
    pickedItems: 8,
  },
  {
    id: "OO-1003",
    orderNumber: "#56283",
    customerName: "Delta Mart",
    warehouseName: "Warehouse 2",
    orderDate: "2025-12-14",
    requiredDelivery: "2025-12-18",
    priority: "urgent",
    status: "pending",
    totalItems: 15,
    pickedItems: 0,
  },
  {
    id: "OO-1004",
    orderNumber: "#56284",
    customerName: "Echo Stores",
    warehouseName: "Warehouse 1",
    orderDate: "2025-12-13",
    requiredDelivery: "2025-12-17",
    priority: "normal",
    status: "ready_to_ship",
    totalItems: 5,
    pickedItems: 5,
  },
  {
    id: "OO-1005",
    orderNumber: "#56285",
    customerName: "Falcon Inc",
    warehouseName: "Warehouse 1",
    orderDate: "2025-12-15",
    requiredDelivery: "2025-12-21",
    priority: "low",
    status: "shipped",
    totalItems: 9,
    pickedItems: 9,
  },
];

const statusConfig = {
  pending: { label: "Pending", class: "badge-outline" },
  picking: { label: "Picking", class: "badge-primary" },
  picked: { label: "Picked", class: "badge-info" },
  packing: { label: "Packing", class: "badge-warning" },
  ready_to_ship: { label: "Ready to Ship", class: "badge-success" },
  shipped: { label: "Shipped", class: "badge-info" },
  delivered: { label: "Delivered", class: "badge-success" },
  cancelled: { label: "Cancelled", class: "badge-error" },
};

const priorityConfig = {
  low: { label: "Low", class: "badge-outline" },
  normal: { label: "Normal", class: "badge-info" },
  high: { label: "High", class: "badge-warning" },
  urgent: { label: "Urgent", class: "badge-error" },
};

export default function OutboundOrdersPage() {
  const { hasPermission } = useAdmin();
  const canCreate = hasPermission(ADMIN_ROUTES.ORDERS, "create");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const summary = {
    totalOrders: 245,
    pendingPicking: 18,
    readyToShip: 12,
    shippedToday: 35,
  };

  const filteredOrders = outboundOrders.filter((order) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query || (
      order.orderNumber.toLowerCase().includes(query) ||
      order.customerName.toLowerCase().includes(query) ||
      order.warehouseName.toLowerCase().includes(query) ||
      order.status.toLowerCase().includes(query) ||
      order.priority.toLowerCase().includes(query) ||
      order.orderDate.toLowerCase().includes(query) ||
      order.requiredDelivery.toLowerCase().includes(query) ||
      order.totalItems.toString().includes(query) ||
      order.pickedItems.toString().includes(query) ||
      order.id.toLowerCase().includes(query)
    );
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || order.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const summaryCards = [
    {
      label: "Total Orders",
      value: summary.totalOrders,
      icon: "inventory_2",
      color: "primary" as const,
    },
    {
      label: "Pending Picking",
      value: summary.pendingPicking,
      icon: "schedule",
      color: "warning" as const,
    },
    {
      label: "Ready to Ship",
      value: summary.readyToShip,
      icon: "local_shipping",
      color: "success" as const,
    },
    {
      label: "Shipped Today",
      value: summary.shippedToday,
      icon: "check_circle",
      color: "info" as const,
    },
  ];

  const columns = [
    {
      key: "orderNumber",
      label: "Order Number",
      render: (order: typeof outboundOrders[0]) => (
        <Link
          href={`/admin/orders/outbound/${order.id}`}
          className="font-semibold text-primary hover:underline"
        >
          {order.orderNumber}
        </Link>
      ),
      sortable: true,
    },
    {
      key: "customerName",
      label: "Customer",
      sortable: true,
    },
    {
      key: "warehouseName",
      label: "Warehouse",
      sortable: true,
    },
    {
      key: "orderDate",
      label: "Order Date",
      sortable: true,
      className: "text-base-content/70",
    },
    {
      key: "requiredDelivery",
      label: "Required Delivery",
      sortable: true,
      className: "text-base-content/70",
    },
    {
      key: "priority",
      label: "Priority",
      render: (order: typeof outboundOrders[0]) => {
        const priority = priorityConfig[order.priority as keyof typeof priorityConfig];
        // Only apply #EEEEEE to badge-outline (white/neutral), keep colored badges
        if (priority.class === "badge-outline") {
          return (
            <span 
              className="badge text-xs whitespace-nowrap" 
              style={{ backgroundColor: "#EEEEEE", color: "#1F2937", border: "1px solid #E5E7EB" }}
            >
              {priority.label}
            </span>
          );
        }
        return <span className={`badge ${priority.class}`}>{priority.label}</span>;
      },
      sortable: true,
    },
    {
      key: "status",
      label: "Status",
      render: (order: typeof outboundOrders[0]) => {
        const status = statusConfig[order.status as keyof typeof statusConfig];
        // Only apply #EEEEEE to badge-outline (white/neutral), keep colored badges
        if (status.class === "badge-outline") {
          return (
            <span 
              className="badge text-xs whitespace-nowrap" 
              style={{ backgroundColor: "#EEEEEE", color: "#1F2937", border: "1px solid #E5E7EB" }}
            >
              {status.label}
            </span>
          );
        }
        return <span className={`badge ${status.class}`}>{status.label}</span>;
      },
      sortable: true,
    },
    {
      key: "items",
      label: "Items",
      render: (order: typeof outboundOrders[0]) => (
        <div className="flex items-center gap-2">
          <span>{order.pickedItems}/{order.totalItems}</span>
          <div className="w-16 bg-base-300 rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full"
              style={{
                width: `${(order.pickedItems / order.totalItems) * 100}%`,
              }}
            ></div>
          </div>
        </div>
      ),
    },
  ];

  const renderActions = (order: typeof outboundOrders[0]) => (
    <div className="dropdown dropdown-end">
      <label tabIndex={0} className="btn btn-ghost btn-xs">
        <span className="material-symbols-outlined">more_vert</span>
      </label>
      <ul
        tabIndex={0}
        className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300 z-10"
      >
        <li>
          <Link href={`/admin/orders/outbound/${order.id}`}>
            <span className="material-symbols-outlined text-sm">visibility</span>
            View Details
          </Link>
        </li>
        {order.status === "pending" && (
          <li>
            <button>
              <span className="material-symbols-outlined text-sm">person_add</span>
              Assign Picker
            </button>
          </li>
        )}
        {order.status === "picked" && (
          <li>
            <button>
              <span className="material-symbols-outlined text-sm">check</span>
              Mark as Ready to Ship
            </button>
          </li>
        )}
        {order.status === "ready_to_ship" && (
          <li>
            <button>
              <span className="material-symbols-outlined text-sm">local_shipping</span>
              Assign to Shipment
            </button>
          </li>
        )}
        <li>
          <button onClick={() => window.print()}>
            <span className="material-symbols-outlined text-sm">print</span>
            Print/Export
          </button>
        </li>
        {order.status === "pending" && (
          <li>
            <button className="text-error">
              <span className="material-symbols-outlined text-sm">cancel</span>
              Cancel Order
            </button>
          </li>
        )}
      </ul>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-base-content">Outbound Orders</h1>
          <p className="text-sm text-base-content/60 mt-1">Manage customer orders and fulfillment</p>
        </div>
        <div className="flex gap-3">
          <div className="form-control">
            <input
              type="text"
              placeholder="Search orders..."
              className="input input-bordered input-sm w-64"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="dropdown dropdown-end">
            <label tabIndex={0} className="btn btn-sm btn-ghost">
              <span className="material-symbols-outlined">filter_list</span>
              <span>Filter</span>
            </label>
            <ul
              tabIndex={0}
              className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-64 border border-base-300 z-10"
            >
              <li className="menu-title">Status</li>
              <li>
                <button onClick={() => setStatusFilter("all")}>All Status</button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("pending")}>Pending</button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("picking")}>Picking</button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("ready_to_ship")}>Ready to Ship</button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("shipped")}>Shipped</button>
              </li>
              <li className="menu-title mt-2">Priority</li>
              <li>
                <button onClick={() => setPriorityFilter("all")}>All Priority</button>
              </li>
              <li>
                <button onClick={() => setPriorityFilter("urgent")}>Urgent</button>
              </li>
              <li>
                <button onClick={() => setPriorityFilter("high")}>High</button>
              </li>
              <li>
                <button onClick={() => setPriorityFilter("normal")}>Normal</button>
              </li>
            </ul>
          </div>
          {canCreate && (
            <button
              className="btn btn-sm btn-primary"
              onClick={() => setShowCreateModal(true)}
              title="Create manual orders (for internal transfers)"
            >
              <span className="material-symbols-outlined">add</span>
              <span>Create Order</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <SummaryCards cards={summaryCards} />

      {/* Orders Table */}
      <DataTable
        data={filteredOrders}
        columns={columns}
        keyExtractor={(order) => order.id}
        onRowClick={(order) => {
          window.location.href = `/admin/orders/outbound/${order.id}`;
        }}
        actions={renderActions}
        emptyMessage="No orders found"
      />

      {/* Create Outbound Order Modal */}
      <CreateOutboundOrderModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </div>
  );
}

// Multi-step Create Outbound Order Modal
function CreateOutboundOrderModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    deliveryAddress: "",
    deliveryCity: "",
    deliveryState: "",
    deliveryCountry: "",
    deliveryPostalCode: "",
    warehouseId: "",
    requiredDeliveryDate: "",
    priority: "normal",
    notes: "",
    items: [] as Array<{
      productId: string;
      availableQuantity: number;
      orderQuantity: number;
    }>,
  });

  const steps = ["Customer Details", "Order Details", "Add Items", "Review & Confirm"];

  const handleSubmit = () => {
    // TODO: API call to create outbound order
    console.log("Creating outbound order:", formData);
    onClose();
    setStep(1);
    setFormData({
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      deliveryAddress: "",
      deliveryCity: "",
      deliveryState: "",
      deliveryCountry: "",
      deliveryPostalCode: "",
      warehouseId: "",
      requiredDeliveryDate: "",
      priority: "normal",
      notes: "",
      items: [],
    });
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
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Customer Name *</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.customerName}
              onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
              required
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Customer Email</span>
            </label>
            <input
              type="email"
              className="input input-bordered w-full"
              value={formData.customerEmail}
              onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Customer Phone</span>
            </label>
            <input
              type="tel"
              className="input input-bordered w-full"
              value={formData.customerPhone}
              onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Delivery Address *</span>
            </label>
            <textarea
              className="textarea textarea-bordered w-full"
              rows={2}
              value={formData.deliveryAddress}
              onChange={(e) => setFormData({ ...formData, deliveryAddress: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">City *</span>
              </label>
              <input
                type="text"
                className="input input-bordered w-full"
                value={formData.deliveryCity}
                onChange={(e) => setFormData({ ...formData, deliveryCity: e.target.value })}
                required
              />
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
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Country *</span>
              </label>
              <select
                className="select select-bordered w-full"
                value={formData.deliveryCountry}
                onChange={(e) => setFormData({ ...formData, deliveryCountry: e.target.value })}
                required
              >
                <option value="">Select country</option>
                <option value="US">United States</option>
                <option value="UK">United Kingdom</option>
                <option value="CA">Canada</option>
              </select>
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Postal Code</span>
              </label>
              <input
                type="text"
                className="input input-bordered w-full"
                value={formData.deliveryPostalCode}
                onChange={(e) => setFormData({ ...formData, deliveryPostalCode: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="btn btn-primary" onClick={() => setStep(2)}>
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
              onChange={(e) => setFormData({ ...formData, warehouseId: e.target.value })}
              required
            >
              <option value="">Select warehouse</option>
              <option value="wh-1">Warehouse 1</option>
              <option value="wh-2">Warehouse 2</option>
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
            <button className="btn btn-primary" onClick={() => setStep(3)}>
              Next
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Add Items */}
      {step === 3 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-base-content mb-4">Add Items</h3>
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
                      onChange={(e) => {
                        const newItems = [...formData.items];
                        newItems[idx].productId = e.target.value;
                        // TODO: Fetch available quantity from API
                        newItems[idx].availableQuantity = 100;
                        setFormData({ ...formData, items: newItems });
                      }}
                      required
                    >
                      <option value="">Select product</option>
                      <option value="prod-1">Wireless Earbuds (Available: 50)</option>
                      <option value="prod-2">Smart Projector (Available: 30)</option>
                      <option value="prod-3">Remote Control (Available: 100)</option>
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
                  <div className="form-control col-span-2">
                    <label className="label">
                      <span className="label-text text-xs">Order Quantity *</span>
                    </label>
                    <input
                      type="number"
                      className="input input-bordered input-sm"
                      value={item.orderQuantity}
                      onChange={(e) => {
                        const newItems = [...formData.items];
                        const qty = parseInt(e.target.value) || 0;
                        newItems[idx].orderQuantity = Math.min(qty, item.availableQuantity);
                        setFormData({ ...formData, items: newItems });
                      }}
                      required
                      min="1"
                      max={item.availableQuantity}
                    />
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
            <div className="flex justify-between">
              <span className="text-base-content/60">Warehouse:</span>
              <span className="font-semibold">Warehouse 1</span>
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
                <span>Item {idx + 1}</span>
                <span>Qty: {item.orderQuantity}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button className="btn btn-ghost" onClick={() => setStep(3)}>
              Back
            </button>
            <button className="btn btn-primary" onClick={handleSubmit}>
              Create Order
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

