"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import Image from "next/image";
import { useAdmin } from "@/contexts/AdminContext";
import {
  filterRoutesByRole,
  canAccessRoute,
  type AdminRole,
} from "@/lib/admin-roles";

const allNavItems = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/admin/warehouses", label: "Warehouses", icon: "warehouse" },
  {
    href: "/admin/orders",
    label: "Orders",
    icon: "inventory_2",
    subItems: [
      { href: "/admin/orders/inbound", label: "Inbound Orders" },
      { href: "/admin/orders/outbound", label: "Outbound Orders" },
    ],
  },
  { href: "/admin/shipments", label: "Shipments", icon: "local_shipping" },
  {
    href: "/admin/delivery-partners",
    label: "Delivery Partners",
    icon: "local_shipping",
  },
  { href: "/admin/inventory", label: "Inventory", icon: "inventory" },
  { href: "/admin/products", label: "Products", icon: "category" },
  { href: "/admin/raw-materials", label: "Raw Materials", icon: "science" },
  { href: "/admin/suppliers", label: "Suppliers", icon: "business" },
  {
    href: "/admin/dock-management",
    label: "Dock Management",
    icon: "warehouse",
  },
  {
    href: "/admin/labor-productivity",
    label: "Labor Productivity",
    icon: "trending_up",
  },
  {
    href: "/admin/staff",
    label: "Staff",
    icon: "group",
    subItems: [
      { href: "/admin/workers", label: "Workers" },
      { href: "/admin/admins", label: "Managers" },
    ],
  },
  { href: "/admin/tasks", label: "Tasks", icon: "task" },
  { href: "/admin/cycle-counts", label: "Cycle Counts", icon: "autorenew" },
  {
    href: "/admin/stock-transfers",
    label: "Stock Transfers",
    icon: "swap_horiz",
  },
  { href: "/admin/packing", label: "Packing", icon: "inventory" },
  { href: "/admin/quality-checks", label: "Quality Checks", icon: "verified" },
  { href: "/admin/returns", label: "Returns", icon: "keyboard_return" },
  { href: "/admin/anomalies", label: "Anomalies", icon: "warning" },
  { href: "/admin/customers", label: "Customers", icon: "people" },
  { href: "/admin/sops", label: "SOPs", icon: "description" },
  { href: "/admin/reports", label: "Export Reports", icon: "description" },
];

/**
 * Get role-specific navigation items based on role focus areas
 * This filters out items that are not relevant to each role's primary responsibilities
 */
function getRoleRelevantNavItems(
  items: typeof allNavItems,
  role: AdminRole | null | undefined
) {
  if (!role) {
    return [];
  }

  // Admin sees everything
  if (role === "admin") {
    return filterRoutesByRole(items, role);
  }

  // Warehouse Manager: Focus on operational and inventory management
  // Hide: Admins (no access), Settings (no access), Customers (not primary focus)
  if (role === "warehouse_manager") {
    return filterRoutesByRole(items, role).filter((item) => {
      // Hide Admins sub-item from Staff menu
      if (item.href === "/admin/staff" && item.subItems) {
        item.subItems = item.subItems.filter(
          (sub) => sub.href !== "/admin/admins"
        );
        // If no sub-items left, hide the parent item
        if (item.subItems.length === 0) {
          return false;
        }
      }
      // Keep all other accessible items
      return true;
    });
  }

  // Inbound Coordinator: Focus on inbound coordination
  // Hide: Outbound-focused items (Packing, Shipments - outbound focus), Customers (view only, not primary), Labor Productivity (view-only, Warehouse Manager primary)
  // Keep: Inbound Orders, Suppliers, Inventory, Products, Quality Checks (inbound), Returns (to supplier), Tasks (receiving)
  if (role === "inbound_coordinator") {
    return filterRoutesByRole(items, role).filter((item) => {
      // Hide outbound-focused operational items and non-primary features
      if (
        item.href === "/admin/packing" ||
        item.href === "/admin/shipments" ||
        item.href === "/admin/customers" ||
        item.href === "/admin/labor-productivity"
      ) {
        return false;
      }

      // Filter Orders sub-items to show only Inbound
      if (item.href === "/admin/orders" && item.subItems) {
        item.subItems = item.subItems.filter(
          (sub) => sub.href === "/admin/orders/inbound"
        );
        // If no sub-items left, hide the parent item
        if (item.subItems.length === 0) {
          return false;
        }
      }

      // Hide Admins sub-item from Staff menu
      if (item.href === "/admin/staff" && item.subItems) {
        item.subItems = item.subItems.filter(
          (sub) => sub.href !== "/admin/admins"
        );
        // If no sub-items left, hide the parent item
        if (item.subItems.length === 0) {
          return false;
        }
      }

      return true;
    });
  }

  // Default: use permission-based filtering
  return filterRoutesByRole(items, role);
}

export function Sidebar() {
  const pathname = usePathname();
  const { role } = useAdmin();
  const [expandedItems, setExpandedItems] = useState<string[]>(() => {
    // Auto-expand Orders if on orders page
    if (pathname.startsWith("/admin/orders")) {
      return ["/admin/orders"];
    }
    // Auto-expand Team if on workers or admins page
    if (
      pathname.startsWith("/admin/workers") ||
      pathname.startsWith("/admin/admins")
    ) {
      return ["/admin/team"];
    }
    return [];
  });

  // Filter nav items based on admin role and role relevance
  const navItems = getRoleRelevantNavItems(allNavItems, role);

  const toggleExpand = (href: string) => {
    setExpandedItems((prev) =>
      prev.includes(href)
        ? prev.filter((item) => item !== href)
        : [...prev, href]
    );
  };

  return (
    <aside className="hidden lg:flex flex-col w-64 bg-neutral text-neutral-content fixed h-screen">
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div
            className="w-14 h-14 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0 p-1"
            style={{ backgroundColor: "#EEEEEE" }}
          >
            <Image
              src="/assets/logos/OptiWMS Logo.JPG"
              alt="OptiWMS Logo"
              width={56}
              height={56}
              className="object-contain w-full h-full"
              style={{ objectFit: "contain" }}
            />
          </div>
          <span className="text-xl font-bold">OptiWMS</span>
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => {
          const active = pathname.startsWith(item.href);
          const hasSubItems = item.subItems && item.subItems.length > 0;
          const isExpanded = expandedItems.includes(item.href);
          const hasActiveSubItem =
            hasSubItems &&
            item.subItems?.some((sub) => pathname.startsWith(sub.href));

          return (
            <div key={item.href} className="space-y-1">
              {hasSubItems ? (
                <>
                  <button
                    onClick={() => toggleExpand(item.href)}
                    className={clsx(
                      "flex items-center justify-between w-full rounded-xl px-4 py-3 text-sm transition-all",
                      active || hasActiveSubItem
                        ? "bg-primary text-primary-content"
                        : "text-neutral-content/50 hover:bg-white/10 hover:text-neutral-content"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-xl">
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </div>
                    <span
                      className={clsx(
                        "material-symbols-outlined text-sm transition-transform",
                        isExpanded && "rotate-90"
                      )}
                    >
                      chevron_right
                    </span>
                  </button>
                  {isExpanded && (
                    <div className="ml-4 space-y-1 border-l-2 border-white/10 pl-2">
                      {item.subItems?.map((subItem) => {
                        const subActive = pathname.startsWith(subItem.href);
                        return (
                          <Link
                            key={subItem.href}
                            href={subItem.href}
                            className={clsx(
                              "flex items-center gap-3 rounded-lg px-4 py-2 text-sm transition-all",
                              subActive
                                ? "bg-primary/20 text-primary-content"
                                : "text-neutral-content/50 hover:bg-white/10 hover:text-neutral-content"
                            )}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                            <span>{subItem.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <Link
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
              )}
            </div>
          );
        })}
      </nav>
      <div className="p-4 border-t border-white/10 space-y-2">
        {canAccessRoute(role, "/admin/dashboard-settings") && (
          <Link
            href="/admin/dashboard-settings"
            className={clsx(
              "flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition-all",
              pathname.startsWith("/admin/dashboard-settings")
                ? "bg-primary text-primary-content"
                : "text-neutral-content/50 hover:bg-white/10 hover:text-neutral-content"
            )}
          >
            <span className="material-symbols-outlined text-xl">settings</span>
            <span>Settings</span>
          </Link>
        )}
        {canAccessRoute(role, "/admin/help") && (
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
        )}
      </div>
    </aside>
  );
}
