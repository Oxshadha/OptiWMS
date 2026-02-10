export function WarehouseLegend() {
  return (
    <div className="card bg-base-100 border border-base-300 rounded-lg p-3 shadow-sm">
      <div className="space-y-3">
        <div>
          <h4 className="text-xs font-medium mb-2 text-base-content/70">Active Rack Occupancy Levels:</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="flex items-center gap-2 p-2 rounded bg-base-200">
              <div className="w-8 h-8 rounded border border-gray-400 flex-shrink-0" style={{ backgroundColor: "#F5F5F5" }}></div>
              <div className="min-w-0"><div className="text-xs font-medium text-base-content">Empty (0%)</div><div className="text-xs text-base-content/60">White/Gray</div></div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded bg-base-200">
              <div className="w-8 h-8 rounded border border-green-600 flex-shrink-0" style={{ backgroundColor: "#22C55E" }}></div>
              <div className="min-w-0"><div className="text-xs font-medium text-base-content">Low (&lt;50%)</div><div className="text-xs text-base-content/60">Green</div></div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded bg-base-200">
              <div className="w-8 h-8 rounded border border-amber-600 flex-shrink-0" style={{ backgroundColor: "#F59E0B" }}></div>
              <div className="min-w-0"><div className="text-xs font-medium text-base-content">Medium (50-85%)</div><div className="text-xs text-base-content/60">Amber</div></div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded bg-base-200">
              <div className="w-8 h-8 rounded border border-indigo-700 flex-shrink-0" style={{ backgroundColor: "#1E3A8A" }}></div>
              <div className="min-w-0"><div className="text-xs font-medium text-base-content">High (&gt;85%)</div><div className="text-xs text-base-content/60">Dark Blue</div></div>
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-xs font-medium mb-2 text-base-content/70">Special Status:</h4>
          <div className="grid grid-cols-3 gap-2">
            <div className="flex items-center gap-2 p-2 rounded bg-base-200 border border-blue-600">
              <div className="w-8 h-8 rounded border border-blue-600 flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: "#4A90E2" }}>
                <span className="material-symbols-outlined text-white text-sm">lock</span>
              </div>
              <div className="min-w-0"><div className="text-xs font-medium text-base-content">Reserved</div><div className="text-xs text-base-content/60">Blue</div></div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded bg-base-200 border border-orange-600">
              <div className="w-8 h-8 rounded border border-orange-600 flex-shrink-0 flex items-center justify-center relative" style={{ backgroundColor: "#FF6B35" }}>
                <span className="material-symbols-outlined text-white text-sm">build</span>
                <div
                  className="absolute inset-0 rounded opacity-20"
                  style={{ backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(0,0,0,0.2) 2px, rgba(0,0,0,0.2) 4px)" }}
                ></div>
              </div>
              <div className="min-w-0"><div className="text-xs font-medium text-base-content">Maintenance</div><div className="text-xs text-base-content/60">Orange</div></div>
            </div>
            <div className="flex items-center gap-2 p-2 rounded bg-base-200 border border-red-700">
              <div className="w-8 h-8 rounded border border-red-700 flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: "#DC2626" }}>
                <span className="material-symbols-outlined text-white text-sm">warning</span>
              </div>
              <div className="min-w-0"><div className="text-xs font-medium text-base-content">Out of Service</div><div className="text-xs text-base-content/60">Red</div></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
