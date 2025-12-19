"use client";

import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import React, { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAdmin } from "@/contexts/AdminContext";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { admin, role, canAccessRoute, isLoading } = useAdmin();

  // Route protection - check if admin has access to current route
  useEffect(() => {
    // Don't check routes during loading or on login page
    if (isLoading || pathname === "/admin/login") {
      return;
    }

    // If no admin, redirect to login
    if (!admin || !role) {
      router.push("/admin/login");
      return;
    }

    // Check if admin has access to current route
    if (!canAccessRoute(pathname)) {
      // Redirect to dashboard if unauthorized
      router.push("/admin/dashboard?error=unauthorized");
      return;
    }
  }, [pathname, admin, role, canAccessRoute, isLoading, router]);

  // Show loading while checking
  if (isLoading) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  // Don't render layout if no admin (will redirect)
  if (!admin || !role) {
    return null;
  }

  return (
    <div className="min-h-screen bg-base-200">
      <Sidebar />
      <div className="lg:ml-64 flex-1 flex flex-col min-h-screen">
        <Topbar />
        <main className="p-6 space-y-6">{children}</main>
      </div>
    </div>
  );
}
