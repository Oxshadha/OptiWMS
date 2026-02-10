"use client";

import { useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
import clsx from "clsx";
import { DetailModal } from "@/components/DetailModal";
import { Modal } from "@/components/Modal";
import { ordersApi } from "@/lib/api/orders";
import { suppliersApi, Supplier } from "@/lib/api/suppliers";
import { warehousesApi, Warehouse } from "@/lib/api/warehouses";
import { materialsApi } from "@/lib/api/materials";
import { orderItemsApi } from "@/lib/api/orderItems";
import { showToast } from "@/lib/utils/toast";
import { buildLookupMap, getLookupValue } from "@/lib/utils/lookup-maps";
import { mapInboundOrderStatus } from "@/lib/utils/status-mappers";
import { logger } from "@/lib/utils/logger";

// Display format for inbound orders
interface InboundOrderDisplay {
  id: string;
  orderNumber: string;
  supplierName: string;
  warehouseName: string;
  orderDate: string;
  expectedDelivery: string;
  status: string;
  totalItems: number;
  receivedItems: number;
}

const statusConfig = {
  ordered: { label: "Ordered", class: "badge-outline" },
  in_transit: { label: "In Transit", class: "badge-warning" },
  arrived: { label: "Arrived", class: "badge-info" },
  receiving: { label: "Receiving", class: "badge-primary" },
  quality_check: { label: "Quality Check", class: "badge-warning" },
  putaway: { label: "Putaway", class: "badge-info" },
  completed: { label: "Completed", class: "badge-success" },
  cancelled: { label: "Cancelled", class: "badge-error" },
};

export default function InboundOrdersPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<InboundOrderDisplay | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  
  // API state
  const [orders, setOrders] = useState<InboundOrderDisplay[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load data from API
  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

        // Load orders, suppliers, and warehouses in parallel
        const [ordersData, suppliersData, warehousesData] = await Promise.all([
          ordersApi.getAllInbound(),
          suppliersApi.getAll(),
          warehousesApi.getAll(),
        ]);

        // Create lookup maps
        const suppliersMap = buildLookupMap(suppliersData, (s) => s.id, (s) => s.name);
        const warehousesMap = buildLookupMap(warehousesData, (w) => w.id, (w) => w.name);

      // Fetch order items for all orders in parallel
      const ordersWithItems = await Promise.all(
        ordersData.map(async (order) => {
          try {
            const orderItems = await orderItemsApi.getByOrderId(order.id);
            const totalItems = orderItems.length;
            // Calculate received items (items with pickedQuantity > 0 or status indicating received)
            const receivedItems = orderItems.filter(
              item => item.pickedQuantity > 0 || item.status === "received" || item.status === "picked"
            ).length;
            
            return {
              order,
              totalItems,
              receivedItems,
            };
          } catch (err) {
            logger.warn(`Failed to load items for order ${order.orderNumber}:`, err);
            return {
              order,
              totalItems: 0,
              receivedItems: 0,
            };
          }
        })
      );

      // Transform orders to display format
      const displayOrders: InboundOrderDisplay[] = ordersWithItems.map(({ order, totalItems, receivedItems }) => {
        const supplierName = order.supplierId
          ? getLookupValue(suppliersMap, order.supplierId, "Unknown Supplier")
          : "N/A";
        const warehouseName = getLookupValue(warehousesMap, order.warehouseId, "Unknown Warehouse");
        
        const status = mapInboundOrderStatus(order.status);

        return {
          id: order.id,
          orderNumber: order.orderNumber,
          supplierName,
          warehouseName,
          orderDate: order.orderDate || new Date().toISOString().split("T")[0],
          expectedDelivery: order.expectedDate || new Date().toISOString().split("T")[0],
          status,
          totalItems,
          receivedItems,
        };
      });

      setOrders(displayOrders);
    } catch (err) {
      logger.error("Failed to load inbound orders:", err);
      setError("Failed to load inbound orders. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Calculate summary from orders
  const summary = {
    totalOrders: orders.length,
    inTransit: orders.filter((o) => o.status === "in_transit").length,
    receiving: orders.filter((o) => o.status === "receiving").length,
    completedThisMonth: orders.filter((o) => o.status === "completed").length,
  };

  const filteredOrders = orders.filter((order) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query || (
      order.orderNumber.toLowerCase().includes(query) ||
      order.supplierName.toLowerCase().includes(query) ||
      order.warehouseName.toLowerCase().includes(query) ||
      order.status.toLowerCase().includes(query) ||
      order.orderDate.toLowerCase().includes(query) ||
      order.expectedDelivery.toLowerCase().includes(query) ||
      order.totalItems.toString().includes(query) ||
      order.receivedItems.toString().includes(query) ||
      order.id.toLowerCase().includes(query)
    );
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      </div>
    );
  }

  if (error && orders.length === 0) {
    return (
      <div className="space-y-6">
        <div className="alert alert-error">
          <span>{error}</span>
          <button className="btn btn-sm" onClick={() => loadData()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-base-content">Inbound Orders</h1>
          <p className="text-sm text-base-content/60 mt-1">Manage purchase orders from suppliers</p>
        </div>
        <div className="flex gap-3">
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => loadData()}
            title="Refresh data"
          >
            <span className="material-symbols-outlined">refresh</span>
          </button>
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
              className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300 z-10"
            >
              <li>
                <button onClick={() => setStatusFilter("all")}>All Status</button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("in_transit")}>In Transit</button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("arrived")}>Arrived</button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("receiving")}>Receiving</button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("completed")}>Completed</button>
              </li>
              <li>
                <button onClick={() => setStatusFilter("cancelled")}>Cancelled</button>
              </li>
            </ul>
          </div>
          <button
            className="btn btn-sm btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            <span className="material-symbols-outlined">add</span>
            <span>Create Inbound Order</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card bg-base-100 border border-base-300 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-base-content/60">Total Orders</div>
              <div className="text-2xl font-bold text-base-content">{summary.totalOrders}</div>
            </div>
            <span className="material-symbols-outlined text-3xl text-primary">inventory_2</span>
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-base-content/60">In Transit</div>
              <div className="text-2xl font-bold text-warning">{summary.inTransit}</div>
            </div>
            <span className="material-symbols-outlined text-3xl text-warning">local_shipping</span>
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-base-content/60">Receiving</div>
              <div className="text-2xl font-bold text-info">{summary.receiving}</div>
            </div>
            <span className="material-symbols-outlined text-3xl text-info">input</span>
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-base-content/60">Completed This Month</div>
              <div className="text-2xl font-bold text-success">{summary.completedThisMonth}</div>
            </div>
            <span className="material-symbols-outlined text-3xl text-success">check_circle</span>
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="card bg-base-100 border border-base-300 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead className="bg-base-200">
              <tr>
                <th className="font-semibold text-base-content">Order Number</th>
                <th className="font-semibold text-base-content">Supplier</th>
                <th className="font-semibold text-base-content">Warehouse</th>
                <th className="font-semibold text-base-content">Order Date</th>
                <th className="font-semibold text-base-content">Expected Delivery</th>
                <th className="font-semibold text-base-content">Status</th>
                <th className="font-semibold text-base-content">Total Items</th>
                <th className="font-semibold text-base-content">Received Items</th>
                <th className="font-semibold text-base-content">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => {
                const status = statusConfig[order.status as keyof typeof statusConfig] || statusConfig.ordered;
                return (
                  <tr key={order.id} className="hover:bg-base-200/50">
                    <td>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedOrder(order);
                          setShowDetailModal(true);
                        }}
                        className="font-semibold text-primary hover:underline text-left"
                      >
                        {order.orderNumber}
                      </button>
                    </td>
                    <td>{order.supplierName}</td>
                    <td>{order.warehouseName}</td>
                    <td className="text-base-content/70">{order.orderDate}</td>
                    <td className="text-base-content/70">{order.expectedDelivery}</td>
                    <td>
                      {status.class === "badge-outline" ? (
                        <span 
                          className="badge text-xs whitespace-nowrap" 
                          style={{ backgroundColor: "#EEEEEE", color: "#1F2937", border: "1px solid #E5E7EB" }}
                        >
                          {status.label}
                        </span>
                      ) : (
                        <span className={`badge ${status.class}`}>{status.label}</span>
                      )}
                    </td>
                    <td>{order.totalItems}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span>{order.receivedItems}</span>
                        <div className="w-16 bg-base-300 rounded-full h-2">
                          <div
                            className="bg-primary h-2 rounded-full"
                            style={{
                              width: `${(order.receivedItems / order.totalItems) * 100}%`,
                            }}
                          ></div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="dropdown dropdown-end">
                        <label tabIndex={0} className="btn btn-ghost btn-xs">
                          <span className="material-symbols-outlined">more_vert</span>
                        </label>
                        <ul
                          tabIndex={0}
                          className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300 z-10"
                        >
                          <li>
                            <button
                              onClick={() => {
                                setSelectedOrder(order);
                                setShowDetailModal(true);
                              }}
                            >
                              <span className="material-symbols-outlined text-sm">visibility</span>
                              View Details
                            </button>
                          </li>
                          {order.status === "ordered" || order.status === "in_transit" ? (
                            <li>
                              <button
                                onClick={() => {
                                  setSelectedOrder(order);
                                  setShowEditModal(true);
                                }}
                              >
                                <span className="material-symbols-outlined text-sm">edit</span>
                                Edit Order
                              </button>
                            </li>
                          ) : null}
                          {order.status === "arrived" ? (
                            <li>
                              <button>
                                <span className="material-symbols-outlined text-sm">person_add</span>
                                Assign Worker
                              </button>
                            </li>
                          ) : null}
                          {order.status === "arrived" ? (
                            <li>
                              <button>
                                <span className="material-symbols-outlined text-sm">check</span>
                                Mark as Arrived
                              </button>
                            </li>
                          ) : null}
                          <li>
                            <button onClick={() => window.print()}>
                              <span className="material-symbols-outlined text-sm">print</span>
                              Print/Export
                            </button>
                          </li>
                          {order.status === "ordered" || order.status === "in_transit" ? (
                            <li>
                              <button 
                                className="text-error"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (confirm(`Are you sure you want to cancel order ${order.orderNumber}?`)) {
                                    try {
                                      await ordersApi.cancel(order.id);
                                      showToast.success("Order cancelled successfully");
                                      await loadData();
                                    } catch (err) {
                                      logger.error("Failed to cancel order:", err);
                                      showToast.error("Failed to cancel order. Please try again.");
                                    }
                                  }
                                }}
                              >
                                <span className="material-symbols-outlined text-sm">cancel</span>
                                Cancel Order
                              </button>
                            </li>
                          ) : null}
                        </ul>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Inbound Order Modal */}
      {showCreateModal && (
        <CreateInboundOrderModal
          onClose={() => setShowCreateModal(false)}
          onSaved={loadData}
        />
      )}

      {/* Inbound Order Detail Modal */}
      {selectedOrder && (
        <InboundOrderDetailModal
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedOrder(null);
          }}
          order={selectedOrder}
        />
      )}

      {/* Edit Inbound Order Modal */}
      {selectedOrder && (
        <EditInboundOrderModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedOrder(null);
          }}
          onSaved={loadData}
          order={selectedOrder}
        />
      )}
    </div>
  );
}

// Inbound Order Detail Modal
function InboundOrderDetailModal({
  isOpen,
  onClose,
  order,
}: {
  isOpen: boolean;
  onClose: () => void;
  order: InboundOrderDisplay;
}) {
  const status = statusConfig[order.status as keyof typeof statusConfig] || statusConfig.ordered;

  return (
    <DetailModal isOpen={isOpen} onClose={onClose} title={`Inbound Order: ${order.orderNumber}`} size="lg">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-base-content/60">Order Number</label>
            <p className="font-semibold">{order.orderNumber}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Status</label>
            <p>
              {status.class === "badge-outline" ? (
                <span 
                  className="badge text-xs whitespace-nowrap" 
                  style={{ backgroundColor: "#EEEEEE", color: "#1F2937", border: "1px solid #E5E7EB" }}
                >
                  {status.label}
                </span>
              ) : (
                <span className={`badge ${status.class}`}>{status.label}</span>
              )}
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Supplier</label>
            <p className="font-semibold">{order.supplierName}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Warehouse</label>
            <p className="font-semibold">{order.warehouseName}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Order Date</label>
            <p className="font-semibold">{order.orderDate}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Expected Delivery</label>
            <p className="font-semibold">{order.expectedDelivery}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Total Items</label>
            <p className="font-semibold">{order.totalItems}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Received Items</label>
            <p className="font-semibold">{order.receivedItems}/{order.totalItems}</p>
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          <button className="btn btn-primary" onClick={() => window.print()}>
            <span className="material-symbols-outlined">print</span>
            Print Order
          </button>
        </div>
      </div>
    </DetailModal>
  );
}

// Edit Inbound Order Modal
function EditInboundOrderModal({
  isOpen,
  onClose,
  onSaved,
  order,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
  order: InboundOrderDisplay;
}) {
  const [formData, setFormData] = useState({
    expectedDelivery: order.expectedDelivery,
    supplierName: order.supplierName,
    warehouseName: order.warehouseName,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      await ordersApi.update(order.id, {
        expectedDate: formData.expectedDelivery,
        notes: undefined,
        priority: undefined,
      });
      showToast.success("Order updated successfully!");
      await onSaved();
      onClose();
    } catch (error) {
      logger.error("Failed to update order:", error);
      showToast.error("Failed to update order. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DetailModal isOpen={isOpen} onClose={onClose} title={`Edit Order: ${order.orderNumber}`} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Expected Delivery *</span>
          </label>
          <input
            type="date"
            className="input input-bordered w-full"
            value={formData.expectedDelivery}
            onChange={(e) => setFormData({ ...formData, expectedDelivery: e.target.value })}
            required
          />
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Supplier</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={formData.supplierName}
            disabled
          />
        </div>
        <div className="form-control">
          <label className="label">
            <span className="label-text font-medium">Warehouse</span>
          </label>
          <input
            type="text"
            className="input input-bordered w-full"
            value={formData.warehouseName}
            disabled
          />
        </div>
        <div className="flex justify-end gap-3 pt-4">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            Update Order
          </button>
        </div>
      </form>
    </DetailModal>
  );
}

// Multi-step Create Inbound Order Modal
function CreateInboundOrderModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [materials, setMaterials] = useState<Array<{ id: string; description: string }>>([]);
  const [formData, setFormData] = useState({
    supplierId: "",
    warehouseId: "",
    expectedDeliveryDate: "",
    notes: "",
    items: [] as Array<{
      productId: string;
      quantityOrdered: number;
      batchNumber: string;
      manufactureDate: string;
      expiryDate: string;
    }>,
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [suppliersData, warehousesData, materialsData] = await Promise.all([
          suppliersApi.getAll(),
          warehousesApi.getAll(),
          materialsApi.getAll(),
        ]);
        setSuppliers(suppliersData);
        setWarehouses(warehousesData);
        setMaterials(materialsData);
      } catch (err) {
        logger.error("Failed to load data:", err);
      }
    };
    loadData();
  }, []);

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setError(null);

      if (!formData.supplierId || !formData.warehouseId || !formData.expectedDeliveryDate) {
        setError("Please fill in all required fields.");
        return;
      }

      // Validate items
      if (formData.items.length === 0) {
        setError("Please add at least one item to the order.");
        return;
      }

      // Validate all items have product and quantity
      const invalidItems = formData.items.filter(
        item => !item.productId || item.quantityOrdered <= 0
      );
      if (invalidItems.length > 0) {
        setError("Please ensure all items have a product selected and quantity greater than 0.");
        return;
      }

      // Validate date logic: expiry date must be after manufacture date
      const invalidDates = formData.items.filter(
        item => item.manufactureDate && item.expiryDate && new Date(item.expiryDate) <= new Date(item.manufactureDate)
      );
      if (invalidDates.length > 0) {
        setError("Expiry date must be after manufacture date for all items. Please correct the dates.");
        return;
      }

      // Generate order number
      const orderNumber = `PO-${Date.now()}`;

      // Create the order first
      const createdOrder = await ordersApi.create({
        orderNumber,
        orderType: "inbound",
        supplierId: formData.supplierId,
        warehouseId: formData.warehouseId,
        expectedDate: formData.expectedDeliveryDate,
        notes: formData.notes || undefined,
        status: "pending",
        priority: "normal", // Default priority for inbound orders
      });

      // Create order items
      const { orderItemsApi } = await import("@/lib/api/orderItems");
      try {
        await Promise.all(
          formData.items.map(item =>
            orderItemsApi.create(createdOrder.id, {
              materialId: item.productId,
              quantity: item.quantityOrdered,
              locationCode: undefined, // Will be set during putaway
            })
          )
        );
      } catch (itemError) {
        logger.error("Failed to create order items:", itemError);
        setError("Order created but failed to add items. Please edit the order to add items.");
        // Don't return - order was created, just show warning
      }

      showToast.success(`Inbound order created successfully with ${formData.items.length} item(s)!`);
      await onSaved();
      onClose();
    } catch (err) {
      logger.error("Failed to create inbound order:", err);
      setError("Failed to create order. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-base-100 rounded-xl border border-base-300 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-base-300">
          <h2 className="text-2xl font-bold text-base-content">Create Inbound Order</h2>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-sm btn-circle"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center p-4 border-b border-base-300">
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center">
                <div
                  className={clsx(
                    "w-8 h-8 rounded-full flex items-center justify-center font-semibold",
                    step >= s ? "bg-primary text-primary-content" : "bg-base-300 text-base-content/60"
                  )}
                >
                  {s}
                </div>
                {s < 3 && (
                  <div
                    className={clsx(
                      "w-16 h-1 mx-2",
                      step > s ? "bg-primary" : "bg-base-300"
                    )}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step 1: Order Details */}
        {step === 1 && (
          <div className="p-6 space-y-4">
            <h3 className="text-lg font-semibold text-base-content mb-4">Order Details</h3>
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Supplier *</span>
              </label>
              <select
                className="select select-bordered w-full"
                value={formData.supplierId}
                onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
                required
              >
                <option value="">Select supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
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
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Expected Delivery Date *</span>
              </label>
              <input
                type="date"
                className="input input-bordered w-full"
                value={formData.expectedDeliveryDate}
                onChange={(e) => setFormData({ ...formData, expectedDeliveryDate: e.target.value })}
                required
              />
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
              <button className="btn btn-ghost" onClick={onClose}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={() => setStep(2)}>
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Add Items */}
        {step === 2 && (
          <div className="p-6 space-y-4">
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
                          setFormData({ ...formData, items: newItems });
                        }}
                        required
                      >
                        <option value="">Select material</option>
                        {materials.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.description}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text text-xs">Quantity *</span>
                      </label>
                      <input
                        type="number"
                        className="input input-bordered input-sm"
                        value={item.quantityOrdered}
                        onChange={(e) => {
                          const newItems = [...formData.items];
                          newItems[idx].quantityOrdered = parseInt(e.target.value) || 0;
                          setFormData({ ...formData, items: newItems });
                        }}
                        required
                        min="1"
                      />
                    </div>
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text text-xs">Batch Number</span>
                      </label>
                      <input
                        type="text"
                        className="input input-bordered input-sm"
                        value={item.batchNumber}
                        onChange={(e) => {
                          const newItems = [...formData.items];
                          newItems[idx].batchNumber = e.target.value;
                          setFormData({ ...formData, items: newItems });
                        }}
                      />
                    </div>
                    <div className="form-control">
                      <label className="label">
                        <span className="label-text text-xs">Manufacture Date</span>
                      </label>
                      <input
                        type="date"
                        className={`input input-bordered input-sm ${item.manufactureDate && item.expiryDate && new Date(item.expiryDate) <= new Date(item.manufactureDate) ? 'input-error' : ''}`}
                        value={item.manufactureDate}
                        onChange={(e) => {
                          const newItems = [...formData.items];
                          newItems[idx].manufactureDate = e.target.value;
                          setFormData({ ...formData, items: newItems });
                        }}
                        max={item.expiryDate || undefined}
                      />
                      {item.manufactureDate && item.expiryDate && new Date(item.expiryDate) <= new Date(item.manufactureDate) && (
                        <label className="label">
                          <span className="label-text-alt text-error">Expiry date must be after manufacture date</span>
                        </label>
                      )}
                    </div>
                    <div className="form-control col-span-2">
                      <label className="label">
                        <span className="label-text text-xs">Expiry Date</span>
                      </label>
                      <input
                        type="date"
                        className={`input input-bordered input-sm ${item.manufactureDate && item.expiryDate && new Date(item.expiryDate) <= new Date(item.manufactureDate) ? 'input-error' : ''}`}
                        value={item.expiryDate}
                        onChange={(e) => {
                          const newItems = [...formData.items];
                          newItems[idx].expiryDate = e.target.value;
                          setFormData({ ...formData, items: newItems });
                        }}
                        min={item.manufactureDate || undefined}
                      />
                      {item.manufactureDate && item.expiryDate && new Date(item.expiryDate) <= new Date(item.manufactureDate) && (
                        <label className="label">
                          <span className="label-text-alt text-error">Expiry date must be after manufacture date</span>
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
                        quantityOrdered: 0,
                        batchNumber: "",
                        manufactureDate: "",
                        expiryDate: "",
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
              <button className="btn btn-ghost" onClick={() => setStep(1)}>
                Back
              </button>
              <button className="btn btn-primary" onClick={() => setStep(3)}>
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Confirm */}
        {step === 3 && (
          <div className="p-6 space-y-4">
            <h3 className="text-lg font-semibold text-base-content mb-4">Review & Confirm</h3>
            <div className="card bg-base-200 p-4 rounded-lg space-y-2">
              <div className="flex justify-between">
                <span className="text-base-content/60">Supplier:</span>
                <span className="font-semibold">Tech Supplies Inc</span>
              </div>
              <div className="flex justify-between">
                <span className="text-base-content/60">Warehouse:</span>
                <span className="font-semibold">Warehouse 1</span>
              </div>
              <div className="flex justify-between">
                <span className="text-base-content/60">Expected Delivery:</span>
                <span className="font-semibold">{formData.expectedDeliveryDate}</span>
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
                  <span>Qty: {item.quantityOrdered}</span>
                </div>
              ))}
            </div>
            {error && (
              <div className="alert alert-error">
                <span>{error}</span>
              </div>
            )}
            <div className="flex justify-end gap-3 pt-4">
              <button className="btn btn-ghost" onClick={() => setStep(2)} disabled={isSubmitting}>
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
      </div>
    </div>
  );
}
