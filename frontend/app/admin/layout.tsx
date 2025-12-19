"use client";

import React from "react";
import { usePathname } from "next/navigation";
import AdminLayout from "../(admin)/layout";
import { AdminProvider } from "@/contexts/AdminContext";

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Don't apply layout to login page
  if (pathname === "/admin/login") {
    return <AdminProvider>{children}</AdminProvider>;
  }

  return (
    <AdminProvider>
      <AdminLayout>{children}</AdminLayout>
    </AdminProvider>
  );
}
