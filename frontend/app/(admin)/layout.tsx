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
    // Don't check routes on login page
    if (pathname === "/admin/login") {
      return;
    }

    // Check if we have a token in localStorage
    const hasToken = typeof window !== 'undefined' && !!localStorage.getItem('accessToken');
    
    // Wait for loading to complete, but with a timeout
    const checkAuth = setTimeout(() => {
      // If no admin AND no token, redirect to login immediately
      if ((!admin || !role) && !hasToken) {
        console.log("[AdminLayout] No admin and no token - redirecting to login");
        router.push("/admin/login");
        return;
      }

      // If we have a token but no admin state, wait a bit more (API call might be in progress)
      if ((!admin || !role) && hasToken) {
        console.log("[AdminLayout] Has token but no admin - waiting for API call...");
        // Give more time for API call to complete (max 3 seconds)
        const retryTimeout = setTimeout(() => {
          if (!admin || !role) {
            console.log("[AdminLayout] Token exists but no admin after timeout - user is likely a worker, redirecting to worker dashboard");
            // User is authenticated but not an admin - likely a worker
            // Redirect to worker dashboard instead of login
            router.push("/worker/dashboard");
          }
        }, 3000);
        return () => clearTimeout(retryTimeout);
      }

      // Check if admin has access to current route
      if (admin && role && !canAccessRoute(pathname)) {
        // Redirect to dashboard if unauthorized
        router.push("/admin/dashboard?error=unauthorized");
        return;
      }
    }, isLoading ? 1000 : 0); // Wait longer if still loading to allow API call

    return () => clearTimeout(checkAuth);
  }, [pathname, admin, role, canAccessRoute, isLoading, router]);

  // Check if we have a token (fallback authentication check)
  const hasToken = typeof window !== 'undefined' && !!localStorage.getItem('accessToken');
  
  console.log("[AdminLayout] Auth check:", { 
    isLoading, 
    hasAdmin: !!admin, 
    hasRole: !!role, 
    hasToken, 
    pathname 
  });

  // Show loading while checking, but with timeout
  useEffect(() => {
    if (isLoading && admin && role && hasToken) {
      // We have all the data but still loading - force stop after 1 second
      const timeout = setTimeout(() => {
        console.warn("[AdminLayout] Loading timeout - forcing stop (has admin, role, and token)");
        // Can't directly set isLoading, but we can log it
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [isLoading, admin, role, hasToken]);

  // If we have all required data, render immediately (don't wait for isLoading)
  const hasAllRequiredData = admin && role && hasToken;
  
  if (isLoading && !hasAllRequiredData) {
    console.log("[AdminLayout] Still loading (missing data)...");
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }
  
  // If we have all data but isLoading is still true, render anyway (isLoading is stuck)
  if (isLoading && hasAllRequiredData) {
    console.warn("[AdminLayout] isLoading stuck at true but we have all data - rendering anyway");
  }

  // Show loading while waiting for auth check (prevents flash of redirect)
  // Only render layout if we have admin data OR a token (token means we're authenticated)
  if (!admin || !role) {
    if (pathname !== "/admin/login") {
      // If we have a token, show loading (API call might be in progress)
      if (hasToken) {
        // If we're not loading anymore and still no admin, user is likely a worker
        if (!isLoading) {
          console.log("[AdminLayout] Has token but no admin after loading - redirecting worker to worker dashboard");
          router.push("/worker");
          return (
            <div className="min-h-screen bg-base-200 flex items-center justify-center">
              <div className="text-center">
                <span className="loading loading-spinner loading-lg"></span>
                <p className="mt-4 text-sm">Redirecting to worker dashboard...</p>
              </div>
            </div>
          );
        }
        console.log("[AdminLayout] Has token but no admin state - showing loading (API call in progress)");
        // Show loading while API call completes
        return (
          <div className="min-h-screen bg-base-200 flex items-center justify-center">
            <div className="text-center">
              <span className="loading loading-spinner loading-lg"></span>
              <p className="mt-4 text-sm">Restoring session...</p>
            </div>
          </div>
        );
      }
      // No token and no admin, show loading briefly then redirect (handled by useEffect)
      if (isLoading) {
        return (
          <div className="min-h-screen bg-base-200 flex items-center justify-center">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        );
      }
      // Not loading and no token - redirect will happen in useEffect
      return (
        <div className="min-h-screen bg-base-200 flex items-center justify-center">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      );
    }
    return null;
  }
  
  console.log("[AdminLayout] Rendering layout with admin:", { role, name: admin?.name });

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

