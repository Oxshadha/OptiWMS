import Link from "next/link";

export default function AdminHome() {
  const links = [
    { href: "/admin/dashboard", label: "Dashboard" },
    { href: "/admin/warehouses", label: "Warehouses" },
    { href: "/admin/orders", label: "Orders" },
    { href: "/admin/shipments", label: "Shipments" },
    { href: "/admin/inventory", label: "Inventory" },
    { href: "/admin/customers", label: "Customers" },
    { href: "/admin/returns", label: "Returns" },
    { href: "/admin/reports", label: "Reports" },
    { href: "/admin/settings", label: "Settings" },
  ];
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Admin</h1>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="btn btn-outline">
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
