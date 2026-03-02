"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { operationsApi, type StockTransfer } from "@/lib/api/operations";

export default function StockTransferDetailPage() {
  const params = useParams();
  const transferId = params.id as string;
  const transferQuery = useQuery({
    queryKey: ["admin-stock-transfers", "detail", transferId],
    queryFn: () => operationsApi.getStockTransferById(transferId),
    enabled: !!transferId,
  });

  const transfer = transferQuery.data as StockTransfer | undefined;
  const loading = transferQuery.isPending && !transferQuery.data;

  if (loading) {
    return <div className="flex items-center justify-center py-12"><span className="loading loading-spinner loading-lg"></span></div>;
  }

  if (!transfer) {
    return <div className="alert alert-error">Stock transfer not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-base-content">Stock Transfer {transfer.transferNumber}</h1>
        <p className="text-sm text-base-content/60 mt-1">Stock transfer detail view</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DetailCard label="Status" value={transfer.status} />
        <DetailCard label="Type" value={transfer.transferType} />
        <DetailCard label="Source Location" value={transfer.sourceLocationCode || "Not set"} />
        <DetailCard label="Destination Location" value={transfer.destLocationCode || "Not set"} />
        <DetailCard label="Quantity" value={transfer.quantity} />
        <DetailCard label="Released At" value={transfer.releasedAt || "Not released"} />
      </div>
      <div className="card bg-base-100 border border-base-300">
        <div className="card-body">
          <h2 className="card-title text-lg">Lines</h2>
          {transfer.lines && transfer.lines.length > 0 ? (
            <div className="space-y-2">
              {transfer.lines.map((line) => (
                <div key={line.id} className="rounded-lg border border-base-300 p-3">
                  <div className="font-medium">Line {line.lineNumber}</div>
                  <div className="text-sm text-base-content/70">
                    {line.sourceLocationCode} to {line.destLocationCode} · {line.status}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-base-content/60">No transfer lines.</div>
          )}
        </div>
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
