"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { dockManagementApi, type YardTrailer } from "@/lib/api/operations";

export default function YardTrailerDetailPage() {
  const params = useParams();
  const trailerId = params.id as string;
  const trailerQuery = useQuery({
    queryKey: ["admin-dock-management", "yard-trailers", "detail", trailerId],
    queryFn: () => dockManagementApi.getYardTrailerById(trailerId),
    enabled: !!trailerId,
  });

  const trailer = trailerQuery.data as YardTrailer | undefined;
  const loading = trailerQuery.isPending && !trailerQuery.data;

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
