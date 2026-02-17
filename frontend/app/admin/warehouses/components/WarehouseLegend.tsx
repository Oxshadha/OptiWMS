export function WarehouseLegend() {
  return (
    <div className="card bg-base-100 border border-base-300 rounded-lg p-3 shadow-sm sticky top-2 z-10">
      <div className="text-xs font-semibold text-base-content/80 mb-2">Rack Color Guide</div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="badge badge-ghost gap-2 px-3 py-3 border border-base-300">
          <span className="w-3 h-3 rounded border border-gray-400 inline-block" style={{ backgroundColor: "#F5F5F5" }}></span>
          Empty
        </span>
        <span className="badge badge-ghost gap-2 px-3 py-3 border border-base-300">
          <span className="w-3 h-3 rounded inline-block" style={{ backgroundColor: "#22C55E" }}></span>
          Low Fill
        </span>
        <span className="badge badge-ghost gap-2 px-3 py-3 border border-base-300">
          <span className="w-3 h-3 rounded inline-block" style={{ backgroundColor: "#F59E0B" }}></span>
          Medium Fill
        </span>
        <span className="badge badge-ghost gap-2 px-3 py-3 border border-base-300">
          <span className="w-3 h-3 rounded inline-block" style={{ backgroundColor: "#1E3A8A" }}></span>
          High Fill
        </span>
        <span className="badge badge-ghost gap-2 px-3 py-3 border border-sky-700">
          <span className="w-3 h-3 rounded inline-block" style={{ backgroundColor: "#E0F2FE", border: "1px solid #0284C7" }}></span>
          Reserved
        </span>
        <span className="badge badge-ghost gap-2 px-3 py-3 border border-orange-600">
          <span className="w-3 h-3 rounded inline-block" style={{ backgroundColor: "#FEF3C7", border: "1px solid #D97706" }}></span>
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
