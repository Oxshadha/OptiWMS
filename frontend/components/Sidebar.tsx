"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const navItems = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/admin/warehouses", label: "Warehouses", icon: "warehouse" },
  { href: "/admin/orders", label: "Orders", icon: "inventory_2" },
  { href: "/admin/shipments", label: "Shipments", icon: "local_shipping" },
  { href: "/admin/inventory", label: "Inventory", icon: "inventory" },
  { href: "/admin/customers", label: "Customers", icon: "group" },
  { href: "/admin/returns", label: "Returns", icon: "assignment_return" },
  { href: "/admin/reports", label: "Export Reports", icon: "description" },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden lg:flex flex-col w-64 bg-neutral text-neutral-content fixed h-screen">
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-lg font-bold text-primary-content">O</span>
          </div>
          <span className="text-xl font-bold">OptiWMS</span>
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition-all",
                active
                  ? "bg-primary text-primary-content"
                  : "text-neutral-content/50 hover:bg-white/10 hover:text-neutral-content"
              )}
            >
              <span className="material-symbols-outlined text-xl">
                {item.icon}
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-white/10 space-y-2">
        <Link
          href="/admin/settings"
          className={clsx(
            "flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition-all",
            pathname.startsWith("/admin/settings")
              ? "bg-primary text-primary-content"
              : "text-neutral-content/50 hover:bg-white/10 hover:text-neutral-content"
          )}
        >
          <span className="material-symbols-outlined text-xl">settings</span>
          <span>Settings</span>
        </Link>
        <Link
          href="/admin/help"
          className={clsx(
            "flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition-all",
            pathname.startsWith("/admin/help")
              ? "bg-primary text-primary-content"
              : "text-neutral-content/50 hover:bg-white/10 hover:text-neutral-content"
          )}
        >
          <span className="material-symbols-outlined text-xl">help</span>
          <span>Help Center</span>
        </Link>
      </div>
    </aside>
  );
}
