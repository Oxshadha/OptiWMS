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
  // Top Level
  { href: "/admin/dashboard", label: "Dashboard", icon: "dashboard" },
  {
    href: "/admin/warehouses",
    label: "Warehouses",
    icon: "warehouse",
    subItems: [
      { href: "/admin/warehouses", label: "Warehouse Layout" },
      { href: "/admin/pathfinding", label: "Live Route Control" },
    ],
  },
  {
    href: "/admin/orders",
    label: "Orders",
    icon: "inventory_2",
    subItems: [
      { href: "/admin/orders/inbound", label: "Inbound Orders" },
      { href: "/admin/orders/outbound", label: "Outbound Orders" },
    ],
  },
  { href: "/admin/inventory", label: "Inventory", icon: "inventory" },
  { href: "/admin/materials", label: "Product Catalog", icon: "inventory_2" },
  { href: "/admin/forecasts", label: "Forecasts", icon: "timeline" },
  {
    href: "/admin/inventory-intelligence",
    label: "Inventory Intelligence",
    icon: "psychology",
  },
  { href: "/admin/tasks", label: "Tasks", icon: "task" },
  
  // Operations Group
  {
    href: "/admin/operations",
    label: "Warehouse Operations",
    icon: "engineering",
    subItems: [
      { href: "/admin/packing", label: "Packing" },
      { href: "/admin/picking", label: "Picking" },
      { href: "/admin/cycle-counts", label: "Cycle Counts" },
      { href: "/admin/stock-transfers", label: "Stock Transfers" },
      { href: "/admin/quality-checks", label: "Quality Checks" },
      { href: "/admin/returns", label: "Returns" },
      { href: "/admin/shipments", label: "Shipments" },
    ],
  },

  // Network & Partners Group
  {
    href: "/admin/network",
    label: "Network & Partners",
    icon: "hub",
    subItems: [
      { href: "/admin/suppliers", label: "Suppliers" },
      { href: "/admin/delivery-partners", label: "Delivery Partners" },
      { href: "/admin/customers", label: "Customers" },
    ],
  },

  // Management & Data Group
  {
    href: "/admin/management",
    label: "Management & Data",
    icon: "admin_panel_settings",
    subItems: [
      { href: "/admin/labor-productivity", label: "Labor Productivity" },
      { href: "/admin/workers", label: "Workers" },
      { href: "/admin/admins", label: "Managers" },
      { href: "/admin/supply-plans", label: "Supply Plans" },
      { href: "/admin/bom-master", label: "BOM Master" },
      { href: "/admin/sops", label: "SOPs" },
      { href: "/admin/reports", label: "Export Reports" },
      { href: "/admin/data-quality", label: "Data Quality" },
    ],
  },
  { href: "/admin/anomalies", label: "Anomalies", icon: "warning" },
  { href: "/admin/dashboard-settings", label: "Settings", icon: "settings" },
  { href: "/admin/help", label: "Help Center", icon: "help" },
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

  // Filter routes based on core role permissions via admin-roles.ts
  let allowedItems = filterRoutesByRole(items, role);

  // For specific roles, we manually prune items that might technically be viewable 
  // but clutter the UX for that role's primary workflow.
  
  if (role === "warehouse_manager") {
    // Hide: Admins (no access), Settings (no access), Customers (not primary focus)
    const hiddenHrefs = ["/admin/admins"];
    allowedItems = allowedItems.map(item => {
      if (item.subItems) {
        return { ...item, subItems: item.subItems.filter(sub => !hiddenHrefs.includes(sub.href)) };
      }
      return item;
    }).filter(item => !hiddenHrefs.includes(item.href) && !(item.subItems && item.subItems.length === 0));
  }

  if (role === "inbound_coordinator") {
    // Hide: Outbound-focused items and non-primary features
    const hiddenHrefs = [
      "/admin/packing",
      "/admin/picking",
      "/admin/shipments",
      "/admin/customers",
      "/admin/labor-productivity",
      "/admin/admins"
    ];

    allowedItems = allowedItems.map(item => {
      if (item.subItems) {
        let newSubItems = item.subItems.filter(sub => !hiddenHrefs.includes(sub.href));
        // Force orders to only show inbound
        if (item.href === "/admin/orders") {
          newSubItems = newSubItems.filter(sub => sub.href === "/admin/orders/inbound");
        }
        return { ...item, subItems: newSubItems };
      }
      return item;
    }).filter(item => !hiddenHrefs.includes(item.href) && !(item.subItems && item.subItems.length === 0));
  }

  return allowedItems;
}

export function Sidebar() {
  const pathname = usePathname();
  const { role } = useAdmin();
  const [expandedItems, setExpandedItems] = useState<string[]>(() => {
    // Auto-expand Orders if on orders page
    if (pathname.startsWith("/admin/orders")) {
      return ["/admin/orders"];
    }
    if (
      pathname.startsWith("/admin/warehouses") ||
      pathname.startsWith("/admin/pathfinding")
    ) {
      return ["/admin/warehouses"];
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

  const renderNavItem = (item: typeof allNavItems[0]) => {
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
                "flex items-center justify-between w-full rounded-xl px-4 py-3 text-sm transition-all text-left",
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
            <span className="material-symbols-outlined text-xl shrink-0">
              {item.icon}
            </span>
            <span>{item.label}</span>
          </Link>
        )}
      </div>
    );
  };

  return (
    <aside className="hidden lg:flex flex-col w-72 bg-neutral text-neutral-content fixed h-screen">
      <div className="px-4 pb-4 pt-2 border-b border-white/10 flex justify-center items-center overflow-hidden">
        <Image
          src="/assets/logos/OptiWMS Logo.png?v=5"
          alt="OptiWMS Logo"
          width={150}
          height={150}
          className="object-contain w-[150px] h-auto scale-150"
          priority
        />
      </div>
      <nav className="flex-1 p-4 overflow-y-auto flex flex-col dark-scrollbar">
        <div className="space-y-2">
          {navItems
            .filter(
              (item) =>
                item.href !== "/admin/dashboard-settings" &&
                item.href !== "/admin/help"
            )
            .map(renderNavItem)}
        </div>
        <div className="mt-auto pt-4 space-y-2 border-t border-white/10">
          {navItems
            .filter(
              (item) =>
                item.href === "/admin/dashboard-settings" ||
                item.href === "/admin/help"
            )
            .map(renderNavItem)}
        </div>
      </nav>

    </aside>
  );
}
