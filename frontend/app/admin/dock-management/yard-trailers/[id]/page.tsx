"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { dockManagementApi, type YardTrailer } from "@/lib/api/operations";

export default function YardTrailerDetailPage() {
  const params = useParams();
  const [trailer, setTrailer] = useState<YardTrailer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setTrailer(await dockManagementApi.getYardTrailerById(params.id as string));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [params.id]);

  if (loading) return <div className="flex items-center justify-center py-12"><span className="loading loading-spinner loading-lg"></span></div>;
  if (!trailer) return <div className="alert alert-error">Yard trailer not found.</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-base-content">Yard Trailer {trailer.trailerNumber}</h1>
        <p className="text-sm text-base-content/60 mt-1">Yard trailer detail view</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DetailCard label="Status" value={trailer.status} />
        <DetailCard label="Warehouse" value={trailer.warehouseId} />
        <DetailCard label="Carrier" value={trailer.carrierName || "Not set"} />
        <DetailCard label="Arrived At" value={trailer.arrivedAt || "Not set"} />
        <DetailCard label="Assigned Dock Door" value={trailer.assignedDockDoorId || "Unassigned"} />
        <DetailCard label="Inbound Order" value={trailer.inboundOrderId || "Not linked"} />
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
