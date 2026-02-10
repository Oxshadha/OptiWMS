"use client";

import { Pick } from "../types";

export function NetworkStatusCard({
  isOnline,
  isLoading,
  onRefresh,
}: {
  isOnline: boolean;
  isLoading: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="bg-base-100 rounded-xl p-3 border border-base-300">
      <div className="flex items-center justify-between">
        <span className="text-sm text-base-content/60">Network Status</span>
        <div className="flex items-center gap-3">
          <button
            onClick={onRefresh}
            disabled={isLoading || !isOnline}
            className="btn btn-sm btn-outline btn-primary"
            title="Refresh tasks to see newly created orders"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            Refresh
          </button>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isOnline ? "bg-success" : "bg-warning animate-pulse"}`}></div>
            <span className={`text-sm font-medium ${isOnline ? "text-success" : "text-warning"}`}>
              {isOnline ? "Online" : "Offline"}
            </span>
          </div>
        </div>
      </div>
      {!isOnline && (
        <div className="mt-2 text-xs text-warning-content bg-warning/10 rounded p-2">
          <span className="material-symbols-outlined text-xs align-middle">info</span>
          <span className="ml-1">Working offline. Picks will sync when connection is restored.</span>
        </div>
      )}
    </div>
  );
}

export function UpcomingPicksCard({ upcomingPicks }: { upcomingPicks: Pick[] }) {
  if (upcomingPicks.length === 0) return null;
  return (
    <div className="bg-base-100 rounded-xl p-4 border border-base-300">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-base-content">Upcoming Picks</h3>
        <span className="badge badge-outline">{upcomingPicks.length}</span>
      </div>
      <div className="space-y-2">
        {upcomingPicks.map((pick) => (
          <div key={pick.id} className="flex items-center justify-between p-3 bg-base-200 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-info/10 rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined text-info">location_on</span>
              </div>
              <div>
                <div className="font-semibold text-sm text-base-content">
                  {pick.location} • {pick.item}
                </div>
                <div className="text-xs text-base-content/60">Qty: {pick.qty}</div>
              </div>
            </div>
            <span className="material-symbols-outlined text-base-content/40">chevron_right</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SavedPicksCard({ savedPicks }: { savedPicks: any[] }) {
  if (savedPicks.length === 0) return null;
  return (
    <div className="bg-base-100 rounded-xl p-4 border border-base-300">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-base-content">Saved Picks</h3>
        <span className="badge badge-outline">{savedPicks.length}</span>
      </div>
      <div className="space-y-2">
        {savedPicks.slice(-5).reverse().map((record, idx) => (
          <div key={record.id || idx} className="flex items-center justify-between p-3 bg-base-200 rounded-lg">
            <div>
              <div className="font-semibold text-sm text-base-content">
                {record.location} • {record.item || record.sku}
              </div>
              <div className="text-xs text-base-content/60">
                Qty: {record.qty} • {new Date(record.timestamp).toLocaleTimeString()}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!record.synced && <span className="badge badge-warning badge-sm">Pending Sync</span>}
              {record.synced && <span className="badge badge-success badge-sm">Synced</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function QuickActionsCard({
  onOpenLocationScanner,
  onRefreshSaved,
}: {
  onOpenLocationScanner: () => void;
  onRefreshSaved: () => void;
}) {
  return (
    <div className="bg-base-100 rounded-xl p-4 border border-base-300">
      <h3 className="font-bold text-base-content mb-3">Quick Actions</h3>
      <div className="grid grid-cols-2 gap-2">
        <button className="btn btn-outline btn-sm" onClick={onOpenLocationScanner}>
          <span className="material-symbols-outlined">qr_code_scanner</span>
          Scan Location
        </button>
        <button className="btn btn-outline btn-sm" onClick={onRefreshSaved}>
          <span className="material-symbols-outlined">refresh</span>
          Refresh List
        </button>
      </div>
    </div>
  );
}
