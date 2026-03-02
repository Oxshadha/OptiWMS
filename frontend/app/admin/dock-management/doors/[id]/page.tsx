"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { dockManagementApi, type DockDoor } from "@/lib/api/operations";

export default function DockDoorDetailPage() {
  const params = useParams();
  const [door, setDoor] = useState<DockDoor | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setDoor(await dockManagementApi.getDockDoorById(params.id as string));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [params.id]);

  if (loading) return <div className="flex items-center justify-center py-12"><span className="loading loading-spinner loading-lg"></span></div>;
  if (!door) return <div className="alert alert-error">Dock door not found.</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-base-content">Dock Door {door.doorNumber}</h1>
        <p className="text-sm text-base-content/60 mt-1">Dock door detail view</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DetailCard label="Status" value={door.status} />
        <DetailCard label="Warehouse" value={door.warehouseId} />
        <DetailCard label="Location" value={door.location || "Not set"} />
        <DetailCard label="Current Appointment" value={door.currentAppointmentId || "None"} />
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
