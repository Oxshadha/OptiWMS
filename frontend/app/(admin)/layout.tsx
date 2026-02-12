"use client";

import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import React from "react";
import { RouteGuard } from "@/lib/auth/RouteGuard";
import { useAdmin } from "@/contexts/AdminContext";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { admin, role } = useAdmin();

  return (
    <RouteGuard requiredRole="admin">
      <div className="min-h-screen bg-base-200">
        <Sidebar />
        <div className="lg:ml-64 flex-1 flex flex-col min-h-screen">
          <Topbar />
          <main className="p-6 space-y-6">{children}</main>
        </div>
      </div>
    </RouteGuard>
  );
}

