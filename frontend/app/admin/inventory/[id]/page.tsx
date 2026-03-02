"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { inventoryApi, type InventoryItem } from "@/lib/api/inventory";

export default function InventoryDetailPage() {
  const params = useParams();
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setItem(await inventoryApi.getById(params.id as string));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [params.id]);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><span className="loading loading-spinner loading-lg"></span></div>;
  }

  if (!item) {
    return <div className="alert alert-error">Inventory item not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-base-content">Inventory Detail</h1>
        <p className="text-sm text-base-content/60 mt-1">Inventory record {item.id}</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DetailCard label="Status" value={item.status} />
        <DetailCard label="Warehouse" value={item.warehouseId} />
        <DetailCard label="Material" value={item.materialId} />
        <DetailCard label="Location" value={item.locationCode || "Not set"} />
        <DetailCard label="Quantity" value={item.quantity} />
        <DetailCard label="Available Quantity" value={item.availableQuantity} />
        <DetailCard label="Reserved Quantity" value={item.reservedQuantity} />
        <DetailCard label="Batch Number" value={item.batchNumber || "Not set"} />
      </div>
    </div>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card bg-base-100 border border-base-300">
      <div className="card-body">
        <div className="text-sm text-base-content/60">{label}</div>
        <div className="font-semibold text-base-content break-all">{value}</div>
      </div>
    </div>
  );
}
