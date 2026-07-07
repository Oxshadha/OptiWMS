"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { AdminProvider } from "@/contexts/AdminContext";
import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import { RouteGuard } from "@/lib/auth/RouteGuard";

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Don't apply layout to login page
  if (pathname === "/admin/login") {
    return <AdminProvider>{children}</AdminProvider>;
  }

  return (
    <AdminProvider>
      <RouteGuard requiredRole="admin">
        <div className="min-h-screen bg-base-200">
          <Sidebar />
          <div className="flex min-h-screen flex-1 flex-col lg:ml-72">
            <Topbar />
            <main className="p-6 space-y-6">{children}</main>
          </div>
        </div>
      </RouteGuard>
    </AdminProvider>
  );
}
