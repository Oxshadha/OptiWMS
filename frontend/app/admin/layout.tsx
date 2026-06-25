"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { AdminProvider } from "@/contexts/AdminContext";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { RouteGuard } from "@/lib/auth/RouteGuard";
import clsx from "clsx";

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("optiwms_sidebar_collapsed");
      if (saved !== null) {
        setSidebarCollapsed(saved === "true");
      }
    }
  }, []);

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("optiwms_sidebar_collapsed", String(next));
      return next;
    });
  };

  // Don't apply layout to login page
  if (pathname === "/admin/login") {
    return <AdminProvider>{children}</AdminProvider>;
  }

  return (
    <AdminProvider>
      <RouteGuard requiredRole="admin">
        <div className="min-h-screen bg-base-200 overflow-x-hidden">
          <Sidebar collapsed={sidebarCollapsed} onToggleCollapse={toggleSidebar} />
          <div className={clsx("flex min-h-screen flex-1 flex-col transition-all duration-300", sidebarCollapsed ? "lg:ml-0" : "lg:ml-64")}>
            <Topbar onToggleSidebar={toggleSidebar} showToggle={sidebarCollapsed} />
            <main className="p-6 space-y-6">{children}</main>
          </div>
        </div>
      </RouteGuard>
    </AdminProvider>
  );
}
