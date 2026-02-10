"use client";

import { useEffect, useState } from "react";
import { useOffline } from "@/hooks/useOffline";
import { useWorker } from "@/contexts/WorkerContext";
import { saveScanRecord, addToSyncQueue } from "@/lib/indexeddb";
import { QRScanner } from "@/components/QRScanner";
import { ordersApi } from "@/lib/api/orders";
import { customersApi } from "@/lib/api/customers";
import { orderItemsApi } from "@/lib/api/orderItems";
import { materialsApi } from "@/lib/api/materials";
import { formatMaterialDisplay } from "@/lib/utils/material-display";
import { logger } from "@/lib/utils/logger";
import { NetworkStatus } from "./components/NetworkStatus";
import { OrderSelectionStep } from "./components/OrderSelectionStep";
import { VerifyItemsStep } from "./components/VerifyItemsStep";
import { PackageStep } from "./components/PackageStep";
import { WeightStep } from "./components/WeightStep";
import { CompleteStep } from "./components/CompleteStep";
import { packagingTypes } from "./constants";
import type { Order, OrderItem, PackingData } from "./types";

export default function PackingPage() {
  const { isOnline } = useOffline();
  const { worker } = useWorker();

  const [step, setStep] = useState<"select" | "verify" | "package" | "weight" | "complete">("select");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderScanner, setShowOrderScanner] = useState(false);
  const [showItemScanner, setShowItemScanner] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const [packingData, setPackingData] = useState<Partial<PackingData>>({
    packagingType: "",
    dunnageMaterials: [],
    hasFragileItems: false,
    actualWeight: 0,
    packingNotes: "",
    photos: [],
  });

  useEffect(() => {
    const loadOrders = async () => {
      if (!isOnline || !worker?.warehouseId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const allOutboundOrders = await ordersApi.getAll("outbound", "picked");
        const warehouseOrders = allOutboundOrders.filter((order) => order.warehouseId === worker.warehouseId);

        const ordersWithDetails: Array<Order | null> = await Promise.all(
          warehouseOrders.map(async (apiOrder) => {
            try {
              let customerName = "Unknown";
              if (apiOrder.customerId) {
                try {
                  const customer = await customersApi.getById(apiOrder.customerId);
                  customerName = customer.name || customer.code || "Unknown";
                } catch (error) {
                  logger.error(`Error fetching customer ${apiOrder.customerId}:`, error);
                }
              }

              let items: OrderItem[] = [];
              try {
                const orderItems = await orderItemsApi.getByOrderId(apiOrder.id);
                items = await Promise.all(
                  orderItems.map(async (item) => {
                    try {
                      const material = await materialsApi.getById(item.materialId);
                      const display = formatMaterialDisplay(material.materialCode, material.description, material.id);
                      return {
                        id: item.id,
                        sku: display.sku,
                        name: display.name,
                        quantity: item.quantity,
                        pickedQuantity: item.pickedQuantity || 0,
                        verified: false,
                      };
                    } catch (error) {
                      logger.error(`Error fetching material ${item.materialId}:`, error);
                      return {
                        id: item.id,
                        sku: "N/A",
                        name: "Material details not available",
                        quantity: item.quantity,
                        pickedQuantity: item.pickedQuantity || 0,
                        verified: false,
                      };
                    }
                  })
                );
              } catch (error) {
                logger.error(`Error fetching order items for ${apiOrder.id}:`, error);
              }

              return {
                id: apiOrder.id,
                orderNumber: apiOrder.orderNumber,
                customer: customerName,
                priority: apiOrder.priority === "high" || apiOrder.priority === "urgent" ? "express" : "normal",
                status: "ready_to_pack" as const,
                items,
              };
            } catch (error) {
              logger.error(`Error processing order ${apiOrder.id}:`, error);
              return null;
            }
          })
        );

        setOrders(ordersWithDetails.filter((order): order is Order => order !== null));
      } catch (error) {
        logger.error("Error loading orders:", error);
        setOrders([]);
      } finally {
        setLoading(false);
      }
    };

    void loadOrders();
  }, [isOnline, worker?.warehouseId]);

  const handleOrderSelect = (order: Order) => {
    setSelectedOrder(order);
    setStep("verify");
  };

  const handleOrderScan = (code: string) => {
    const order = orders.find((candidate) => candidate.orderNumber === code || candidate.id === code);
    if (!order) {
      alert("Order not found");
      return;
    }

    handleOrderSelect(order);
    setShowOrderScanner(false);
  };

  const handleItemScan = (code: string) => {
    if (!selectedOrder) {
      return;
    }

    const itemIndex = selectedOrder.items.findIndex((item) => item.sku === code);
    if (itemIndex === -1) {
      alert("Item not found in this order");
      setShowItemScanner(false);
      return;
    }

    const updatedItems = [...selectedOrder.items];
    updatedItems[itemIndex].verified = true;
    setSelectedOrder({ ...selectedOrder, items: updatedItems });

    if (updatedItems.every((item) => item.verified)) {
      setTimeout(() => setStep("package"), 500);
    }

    setShowItemScanner(false);
  };

  const handlePackageSelect = (packageId: string) => {
    const selectedPackage = packagingTypes.find((packagingType) => packagingType.id === packageId);
    if (!selectedPackage) {
      return;
    }

    setPackingData((current) => ({
      ...current,
      packagingType: selectedPackage.id,
      boxDimensions: selectedPackage.dimensions,
    }));
  };

  const handleDunnageToggle = (material: string) => {
    setPackingData((current) => {
      const selectedDunnage = current.dunnageMaterials || [];
      return {
        ...current,
        dunnageMaterials: selectedDunnage.includes(material)
          ? selectedDunnage.filter((selected) => selected !== material)
          : [...selectedDunnage, material],
      };
    });
  };

  const calculateDimensionalWeight = () => {
    if (!packingData.boxDimensions) {
      return 0;
    }
    const { length, width, height } = packingData.boxDimensions;
    return (length * width * height) / 5000;
  };

  const handleCompletePacking = async () => {
    if (!selectedOrder || !packingData.packagingType) {
      alert("Please complete all required fields");
      return;
    }

    const dimensionalWeight = calculateDimensionalWeight();
    const chargeableWeight = Math.max(packingData.actualWeight || 0, dimensionalWeight);

    const packingRecord = {
      orderId: selectedOrder.id,
      orderNumber: selectedOrder.orderNumber,
      packagingType: packingData.packagingType,
      boxDimensions: packingData.boxDimensions,
      dunnageMaterials: packingData.dunnageMaterials,
      hasFragileItems: packingData.hasFragileItems,
      actualWeight: packingData.actualWeight,
      dimensionalWeight,
      chargeableWeight,
      packingNotes: packingData.packingNotes,
      photos: packingData.photos,
      trackingNumber: `TRK-${Date.now()}`,
      status: "completed",
      completedAt: new Date().toISOString(),
    };

    await saveScanRecord({
      taskId: selectedOrder.id,
      location: "PACKING_STATION",
      item: selectedOrder.orderNumber,
      sku: "",
      qty: selectedOrder.items.reduce((sum, item) => sum + item.quantity, 0),
    });

    await addToSyncQueue({
      type: "operation",
      action: "create",
      data: packingRecord,
    });

    setOrders((currentOrders) =>
      currentOrders.map((order) => (order.id === selectedOrder.id ? { ...order, status: "packed" } : order))
    );

    alert(`Order ${selectedOrder.orderNumber} packed successfully!\nTracking: ${packingRecord.trackingNumber}`);

    setSelectedOrder(null);
    setStep("select");
    setPackingData({
      packagingType: "",
      dunnageMaterials: [],
      hasFragileItems: false,
      actualWeight: 0,
      packingNotes: "",
      photos: [],
    });
  };

  const handlePrintLabel = () => {
    alert("Printing shipping label...");
  };

  const handlePrintSlip = () => {
    alert("Printing packing slip...");
  };

  const readyToPackOrders = orders.filter((order) => order.status === "ready_to_pack");
  const dimensionalWeight = calculateDimensionalWeight();

  return (
    <div className="p-6 space-y-6">
      <NetworkStatus isOnline={isOnline} />

      {step === "select" && (
        <OrderSelectionStep
          loading={loading}
          readyToPackOrders={readyToPackOrders}
          onSelectOrder={handleOrderSelect}
          onOpenScanner={() => setShowOrderScanner(true)}
        />
      )}

      {step === "verify" && selectedOrder && (
        <VerifyItemsStep
          order={selectedOrder}
          onBack={() => setStep("select")}
          onScanItem={() => setShowItemScanner(true)}
        />
      )}

      {step === "package" && selectedOrder && (
        <PackageStep
          packingData={packingData}
          onBack={() => setStep("verify")}
          onNext={() => setStep("weight")}
          onSelectPackage={handlePackageSelect}
          onToggleDunnage={handleDunnageToggle}
          onFragileChange={(value) => setPackingData((current) => ({ ...current, hasFragileItems: value }))}
          onNotesChange={(value) => setPackingData((current) => ({ ...current, packingNotes: value }))}
        />
      )}

      {step === "weight" && selectedOrder && (
        <WeightStep
          packingData={packingData}
          dimensionalWeight={dimensionalWeight}
          onBack={() => setStep("package")}
          onWeightChange={(value) => setPackingData((current) => ({ ...current, actualWeight: value }))}
          onPrintLabel={handlePrintLabel}
          onPrintSlip={handlePrintSlip}
          onNext={() => setStep("complete")}
        />
      )}

      {step === "complete" && selectedOrder && (
        <CompleteStep
          order={selectedOrder}
          packingData={packingData}
          dimensionalWeight={dimensionalWeight}
          onConfirm={handleCompletePacking}
        />
      )}

      {showOrderScanner && (
        <QRScanner
          isOpen={showOrderScanner}
          onClose={() => setShowOrderScanner(false)}
          onScan={handleOrderScan}
          title="Scan Order QR Code"
        />
      )}

      {showItemScanner && (
        <QRScanner
          isOpen={showItemScanner}
          onClose={() => setShowItemScanner(false)}
          onScan={handleItemScan}
          title="Scan Item QR Code"
        />
      )}
    </div>
  );
}
