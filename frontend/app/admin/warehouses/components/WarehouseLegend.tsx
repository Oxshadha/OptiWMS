export function WarehouseLegend() {
  return (
    <div className="card bg-base-100 border border-base-300 rounded-lg p-3 shadow-sm sticky top-2 z-10">
      <div className="text-xs font-semibold text-base-content/80 mb-2">Rack Color Guide</div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="badge badge-ghost gap-2 px-3 py-3 border border-base-300">
          <span className="w-3 h-3 rounded border border-gray-400 inline-block" style={{ backgroundColor: "#F8FAFC" }}></span>
          Empty
        </span>
        <span className="badge badge-ghost gap-2 px-3 py-3 border border-base-300">
          <span className="w-3 h-3 rounded border border-slate-400 inline-block" style={{ backgroundColor: "#CBD5E1" }}></span>
          Low Fill
        </span>
        <span className="badge badge-ghost gap-2 px-3 py-3 border border-base-300">
          <span className="w-3 h-3 rounded border border-slate-600 inline-block" style={{ backgroundColor: "#64748B" }}></span>
          Medium Fill
        </span>
        <span className="badge badge-ghost gap-2 px-3 py-3 border border-base-300">
          <span className="w-3 h-3 rounded border border-slate-900 inline-block" style={{ backgroundColor: "#1E293B" }}></span>
          High Fill
        </span>
        <span className="badge badge-ghost gap-2 px-3 py-3 border border-blue-200">
          <span className="w-3 h-3 rounded inline-block" style={{ backgroundColor: "#EFF6FF", border: "1px solid #3B82F6" }}></span>
          Reserved
        </span>
        <span className="badge badge-ghost gap-2 px-3 py-3 border" style={{ borderColor: "oklch(55% 0.135 66.442)", color: "oklch(45% 0.135 66.442)" }}>
          <span className="w-3 h-3 rounded inline-block" style={{ backgroundColor: "oklch(96% 0.05 66.442)", border: "1px solid oklch(55% 0.135 66.442)" }}></span>
          Maintenance
        </span>
        <span className="badge badge-ghost gap-2 px-3 py-3 border border-red-600 text-red-700">
          <span className="w-3 h-3 rounded inline-block" style={{ backgroundColor: "#FEE2E2", border: "1px solid #DC2626" }}></span>
          Out of Service
        </span>
      </div>
    </div>
  );
}
