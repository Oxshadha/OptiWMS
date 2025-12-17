"use client";

import WorkerLayout from "../(worker)/layout";
import React from "react";
import { usePathname } from "next/navigation";

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Don't apply layout to login page
  if (pathname === "/worker/login") {
    return <>{children}</>;
  }
  
  return <WorkerLayout>{children}</WorkerLayout>;
}


