"use client";

import React, { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToasterProvider } from "@/components/ToasterProvider";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { AdminProvider } from "@/contexts/AdminContext";
import { WorkerProvider } from "@/contexts/WorkerContext";

export function Providers({ children }: { children: React.ReactNode }) {
  // Create QueryClient instance (only once per app)
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Cache data for 5 minutes
            staleTime: 5 * 60 * 1000,
            // Keep unused data in cache for 10 minutes
            gcTime: 10 * 60 * 1000,
            // Keep page state stable when switching tabs
            refetchOnWindowFocus: false,
            // Refetch when network reconnects
            refetchOnReconnect: true,
            // Retry failed requests once
            retry: 1,
            // Show cached data while fetching fresh data
            refetchOnMount: "always",
          },
          mutations: {
            // Retry failed mutations once
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AdminProvider>
          <WorkerProvider>
            {children}
            <ToasterProvider />
          </WorkerProvider>
        </AdminProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
