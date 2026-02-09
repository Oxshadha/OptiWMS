"use client";

import { useEffect, ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "./AuthContext";

interface RouteGuardProps {
  children: ReactNode;
  requiredRole?: 'admin' | 'worker' | 'any';
}

export function RouteGuard({ 
  children, 
  requiredRole = 'any'
}: RouteGuardProps) {
  const { user, isAuthenticated, isLoading, isAdmin, isWorker, checkRouteAccess } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Don't check on login pages
    if (pathname === '/admin/login' || pathname === '/worker/login') {
      return;
    }

    // Wait for auth to load
    if (isLoading) {
      return;
    }

    // Check authentication
    if (!isAuthenticated || !user) {
      // Determine redirect based on route
      let loginPath = '/admin/login';
      if (pathname?.startsWith('/worker')) {
        loginPath = '/worker/login';
      } else if (pathname?.startsWith('/admin')) {
        loginPath = '/admin/login';
      }

      console.log(`[RouteGuard] Not authenticated, redirecting to ${loginPath}`);
      router.replace(loginPath);
      return;
    }

    // Check role requirement
    if (requiredRole === 'admin' && !isAdmin) {
      console.log('[RouteGuard] Admin role required but user is not admin');
      router.replace('/worker');
      return;
    }

    if (requiredRole === 'worker' && !isWorker) {
      console.log('[RouteGuard] Worker role required but user is not worker');
      router.replace('/admin/dashboard');
      return;
    }

    // Check route access
    if (!checkRouteAccess(pathname)) {
      console.log(`[RouteGuard] User does not have access to ${pathname}`);
      
      // Redirect based on user role
      if (isAdmin) {
        router.replace('/admin/dashboard?error=unauthorized');
      } else if (isWorker) {
        router.replace('/worker?error=unauthorized');
      } else {
        router.replace('/admin/login');
      }
      return;
    }
  }, [pathname, isAuthenticated, isLoading, user, isAdmin, isWorker, requiredRole, checkRouteAccess, router]);

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="text-center">
          <span className="loading loading-spinner loading-lg"></span>
          <p className="mt-4 text-sm">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // Don't render if not authenticated (redirect is happening)
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="text-center">
          <span className="loading loading-spinner loading-lg"></span>
          <p className="mt-4 text-sm">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  // Check role requirement
  if (requiredRole === 'admin' && !isAdmin) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="text-center">
          <span className="loading loading-spinner loading-lg"></span>
          <p className="mt-4 text-sm">Redirecting...</p>
        </div>
      </div>
    );
  }

  if (requiredRole === 'worker' && !isWorker) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="text-center">
          <span className="loading loading-spinner loading-lg"></span>
          <p className="mt-4 text-sm">Redirecting...</p>
        </div>
      </div>
    );
  }

  // Render children if all checks pass
  return <>{children}</>;
}
