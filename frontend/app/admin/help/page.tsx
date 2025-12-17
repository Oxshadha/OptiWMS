export default function HelpPage() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Help Center</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card bg-base-100 border border-base-300 p-6">
          <h2 className="text-lg font-semibold mb-3">Getting Started</h2>
          <ul className="space-y-2 text-sm text-base-content/70">
            <li>• How to create a warehouse</li>
            <li>• Setting up your first order</li>
            <li>• Managing inventory</li>
            <li>• User roles and permissions</li>
          </ul>
        </div>
        <div className="card bg-base-100 border border-base-300 p-6">
          <h2 className="text-lg font-semibold mb-3">Workflows</h2>
          <ul className="space-y-2 text-sm text-base-content/70">
            <li>• Receiving process</li>
            <li>• Putaway operations</li>
            <li>• Picking and packing</li>
            <li>• Shipping procedures</li>
          </ul>
        </div>
        <div className="card bg-base-100 border border-base-300 p-6">
          <h2 className="text-lg font-semibold mb-3">Reports & Analytics</h2>
          <ul className="space-y-2 text-sm text-base-content/70">
            <li>• Generating reports</li>
            <li>• Understanding KPIs</li>
            <li>• Exporting data</li>
            <li>• Custom dashboards</li>
          </ul>
        </div>
        <div className="card bg-base-100 border border-base-300 p-6">
          <h2 className="text-lg font-semibold mb-3">Troubleshooting</h2>
          <ul className="space-y-2 text-sm text-base-content/70">
            <li>• Common issues</li>
            <li>• Error messages</li>
            <li>• Performance tips</li>
            <li>• Contact support</li>
          </ul>
        </div>
      </div>
      <div className="card bg-base-100 border border-base-300 p-6">
        <h2 className="text-lg font-semibold mb-3">Contact Support</h2>
        <p className="text-sm text-base-content/70 mb-4">
          Need additional help? Our support team is here to assist you.
        </p>
        <div className="flex gap-3">
          <button className="btn btn-primary">Email Support</button>
          <button className="btn btn-outline">Live Chat</button>
        </div>
      </div>
    </div>
  );
}

