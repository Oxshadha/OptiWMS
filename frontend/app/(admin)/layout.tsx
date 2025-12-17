import { Sidebar } from "@/components/Sidebar";
import { Topbar } from "@/components/Topbar";
import React from "react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
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


