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
  { href: "/admin/dashboard", label: "Dashboard", icon: "dashboard", tourTarget: "nav-dashboard" },
  {
    href: "/admin/warehouses",
    label: "Warehouses",
    icon: "warehouse",
    tourTarget: "nav-warehouses",
    subItems: [
      { href: "/admin/warehouses", label: "Warehouse Layout", tourTarget: "nav-warehouses-layout" },
      { href: "/admin/pathfinding", label: "Live Route Control", tourTarget: "nav-pathfinding" },
    ],
  },
  {
    href: "/admin/orders",
    label: "Orders",
    icon: "inventory_2",
    tourTarget: "nav-orders",
    subItems: [
      { href: "/admin/orders/inbound", label: "Inbound Orders", tourTarget: "nav-orders-inbound" },
      { href: "/admin/orders/outbound", label: "Outbound Orders", tourTarget: "nav-orders-outbound" },
    ],
  },
  { href: "/admin/inventory", label: "Inventory", icon: "inventory", tourTarget: "nav-inventory" },
  { href: "/admin/materials", label: "Product Catalog", icon: "inventory_2", tourTarget: "nav-materials" },
  { href: "/admin/forecasts", label: "Forecasts", icon: "timeline", tourTarget: "nav-forecasts" },
  {
    href: "/admin/inventory-intelligence",
    label: "Inventory Intelligence",
    icon: "psychology",
    tourTarget: "nav-intelligent-engine",
    subItems: [
      { href: "/admin/replenishment", label: "Action Center", tourTarget: "nav-action-center" },
      { href: "/admin/replenishment/forecast-space", label: "Inventory & Space Planner", tourTarget: "nav-forecast-space" },
      { href: "/admin/slotting-plans", label: "Slotting Planner", tourTarget: "nav-slotting" },
    ],
  },
  { href: "/admin/tasks", label: "Tasks", icon: "task", tourTarget: "nav-tasks" },

  // Operations Group
  {
    href: "/admin/operations",
    label: "Warehouse Operations",
    icon: "engineering",
    tourTarget: "nav-operations",
    subItems: [
      { href: "/admin/packing", label: "Packing", tourTarget: "nav-packing" },
      { href: "/admin/picking", label: "Picking", tourTarget: "nav-picking" },
      { href: "/admin/cycle-counts", label: "Cycle Counts", tourTarget: "nav-cycle-counts" },
      { href: "/admin/stock-transfers", label: "Stock Transfers", tourTarget: "nav-stock-transfers" },
      { href: "/admin/quality-checks", label: "Quality Checks", tourTarget: "nav-quality-checks" },
      { href: "/admin/returns", label: "Returns", tourTarget: "nav-returns" },
      { href: "/admin/shipments", label: "Shipments", tourTarget: "nav-shipments" },
    ],
  },

  // Network & Partners Group
  {
    href: "/admin/network",
    label: "Network & Partners",
    icon: "hub",
    tourTarget: "nav-network",
    subItems: [
      { href: "/admin/suppliers", label: "Suppliers", tourTarget: "nav-suppliers" },
      { href: "/admin/delivery-partners", label: "Delivery Partners", tourTarget: "nav-delivery-partners" },
      { href: "/admin/customers", label: "Customers", tourTarget: "nav-customers" },
    ],
  },

  // Management & Data Group
  {
    href: "/admin/management",
    label: "Management & Data",
    icon: "admin_panel_settings",
    tourTarget: "nav-management",
    subItems: [
      { href: "/admin/labor-productivity", label: "Labor Productivity", tourTarget: "nav-labor-productivity" },
      { href: "/admin/workers", label: "Workers", tourTarget: "nav-workers" },
      { href: "/admin/admins", label: "Managers", tourTarget: "nav-admins" },
      { href: "/admin/supply-plans", label: "Supply Plans", tourTarget: "nav-supply-plans" },
      { href: "/admin/bom-master", label: "BOM Master", tourTarget: "nav-bom-master" },
      { href: "/admin/sops", label: "SOPs", tourTarget: "nav-sops" },
      { href: "/admin/reports", label: "Export Reports", tourTarget: "nav-reports" },
      { href: "/admin/data-quality", label: "Data Quality", tourTarget: "nav-data-quality" },
    ],
  },
  { href: "/admin/anomalies", label: "Anomalies", icon: "warning", tourTarget: "nav-anomalies" },
  { href: "/admin/dashboard-settings", label: "Settings", icon: "settings", tourTarget: "nav-settings" },
  { href: "/admin/help", label: "Help Center", icon: "help", tourTarget: "nav-help" },
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

export function Sidebar({
  collapsed = false,
  onToggleCollapse,
}: {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
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

  return (
    <aside className={clsx(
      "hidden lg:flex flex-col bg-neutral text-neutral-content fixed h-screen transition-all duration-300 z-50 overflow-hidden",
      collapsed ? "w-0 -translate-x-full" : "w-64 translate-x-0"
    )}>
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
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
            <span className="text-xl font-bold truncate">OptiWMS</span>
          </div>
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className="btn btn-ghost btn-xs btn-circle text-neutral-content/70 hover:text-neutral-content flex-shrink-0"
              title="Collapse Sidebar"
            >
              <span className="material-symbols-outlined text-lg">menu_open</span>
            </button>
          )}
        </div>
      </div>
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => {
          const hasSubItems = item.subItems && item.subItems.length > 0;
          // Exact match (or a true sub-path) so that sibling routes sharing a
          // prefix — /admin/inventory and /admin/inventory-intelligence — do
          // not both highlight.
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
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
              {...(item.tourTarget ? { "data-tour-target": item.tourTarget } : {})}
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
                  const subActive = pathname === subItem.href || pathname.startsWith(`${subItem.href}/`);
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
                      {...(subItem.tourTarget ? { "data-tour-target": subItem.tourTarget } : {})}
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
            {...(item.tourTarget ? { "data-tour-target": item.tourTarget } : {})}
          >
            <span className="material-symbols-outlined text-xl shrink-0">
              {item.icon}
            </span>
            <span>{item.label}</span>
          </Link>
        )}
      </div>
    );
  })}
      </nav>
    </aside>
  );
}
