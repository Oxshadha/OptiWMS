"use client";

import React from "react";
import { usePathname } from "next/navigation";
import AdminLayout from "../(admin)/layout";

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Don't apply layout to login page
  if (pathname === "/admin/login") {
    return <>{children}</>;
  }
  
  return <AdminLayout>{children}</AdminLayout>;
}


