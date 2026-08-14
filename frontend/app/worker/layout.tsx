"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { initDB } from "@/lib/indexeddb";
import { initNetworkMonitoring } from "@/lib/network";
import { startAutoSync } from "@/lib/sync";
import { OfflineIndicator } from "@/components/OfflineIndicator";
import { useOffline } from "@/hooks/useOffline";
import { useWorker } from "@/contexts/WorkerContext";
import { authApi } from "@/lib/api/auth";
import {
  canAccessOperation,
  OPERATIONS,
  getRoleDisplayName,
  isValidRole,
} from "@/lib/worker-roles";
import { WorkerProvider } from "@/contexts/WorkerContext";
import { logger } from "@/lib/utils/logger";
import { WarehouseAssistant } from "@/components/WarehouseAssistant";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <WorkerProvider>
      <WorkerServiceWorkerRegistrar />
      <WorkerLayoutWrapper>{children}</WorkerLayoutWrapper>
    </WorkerProvider>
  );
}

function WorkerServiceWorkerRegistrar() {
  const pathname = usePathname();
  const { worker, isLoading } = useWorker();

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const isWorkerRoute = window.location.pathname.startsWith("/worker");
    if (!isWorkerRoute) {
      return;
    }

    const registerWorkerShell = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });
      } catch (error) {
        logger.error("Failed to register worker service worker:", error);
      }
    };

    void registerWorkerShell();
  }, []);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      isLoading ||
      !worker ||
      pathname === "/worker/login" ||
      !pathname.startsWith("/worker")
    ) {
      return;
    }

    const criticalWorkerRoutes = [
      "/worker/tasks",
      "/worker/picking",
      "/worker/putaway",
      "/worker/receiving",
      "/worker/packing",
      "/worker/cycle-count",
    ];

    const warmCriticalRoutes = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        registration.active?.postMessage({
          type: "PRECACHE_WORKER_ROUTES",
          routes: criticalWorkerRoutes,
        });
      } catch (error) {
        logger.error("Failed to warm worker route cache:", error);
      }
    };

    void warmCriticalRoutes();
  }, [isLoading, pathname, worker]);

  return null;
}

function WorkerLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Don't apply layout to login page
  if (pathname === "/worker/login") {
    return <>{children}</>;
  }

  return <WorkerLayoutContent>{children}</WorkerLayoutContent>;
}

function WorkerLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isOnline } = useOffline();
  const { worker, role, isLoading, clearWorker } = useWorker();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  // Prevent body scroll when modals are open (but not for profile menu)
  useEffect(() => {
    if (showNotifications || showCalendar) {
      // Prevent background scroll
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
      // Also prevent scroll on main content
      const main = document.querySelector("main");
      if (main) {
        (main as HTMLElement).style.overflow = "hidden";
      }
    } else {
      // Restore scrolling
      document.body.style.overflow = "unset";
      document.documentElement.style.overflow = "unset";
      const main = document.querySelector("main");
      if (main) {
        (main as HTMLElement).style.overflow = "auto";
      }
    }
    return () => {
      document.body.style.overflow = "unset";
      document.documentElement.style.overflow = "unset";
      const main = document.querySelector("main");
      if (main) {
        (main as HTMLElement).style.overflow = "auto";
      }
    };
  }, [showNotifications, showCalendar]);

  // Close profile menu when clicking outside
  useEffect(() => {
    if (!showProfileMenu) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const profileMenu = document.querySelector(".profile-menu-container");
      if (profileMenu && !profileMenu.contains(target)) {
        setShowProfileMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showProfileMenu]);

  // Use worker from context, fallback to default for display
  // Use workerId (employeeId) instead of UUID for display
  const displayWorker = worker ? {
    ...worker,
    id: worker.workerId || "N/A", // Use workerId (employeeId), not the UUID
  } : {
    name: "Worker",
    id: "N/A",
    warehouse: "N/A",
    deviceId: "N/A",
    avatar: "/assets/avatars/placeholder.svg",
  };

  const [notifications, setNotifications] = useState<Array<{
    id: string;
    title: string;
    message: string;
    time: string;
    read: boolean;
    actionUrl?: string;
  }>>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [calendarTasks, setCalendarTasks] = useState<Array<{
    id: string;
    taskNumber: string;
    dueDate?: string;
    status: string;
  }>>([]);

  // Load notifications from database
  useEffect(() => {
    const loadNotifications = async () => {
      if (!worker?.id || !isOnline) return;

      try {
        const { notificationsApi } = await import("@/lib/api/notifications");
        const allNotifications = await notificationsApi.getAll(worker.id, undefined, {
          role: role || undefined,
          warehouseId: worker.warehouseId,
        });
        
        // Transform to display format
        const formatted = allNotifications.map(notif => ({
          id: notif.id,
          title: notif.title,
          message: notif.message,
          time: formatTimeAgo(notif.createdAt),
          read: notif.read,
          actionUrl: notif.actionUrl,
        }));

        setNotifications(formatted);
        setUnreadCount(formatted.filter(n => !n.read).length);
      } catch (error: any) {
        // Only log if it's not a 404 or 500 (endpoint might not exist)
        if (error?.message && !error.message.includes('404') && !error.message.includes('500')) {
          logger.error("Failed to load notifications:", error);
        }
        // Set empty notifications on error
        setNotifications([]);
        setUnreadCount(0);
      }
    };

    loadNotifications();
    
    // Refresh notifications every 30 seconds
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [worker?.id, worker?.warehouseId, isOnline, role]);

  useEffect(() => {
    const loadCalendarTasks = async () => {
      if (!worker?.id || !isOnline) {
        setCalendarTasks([]);
        return;
      }

      try {
        const { tasksApi } = await import("@/lib/api/tasks-api");
        const workerTasks = await tasksApi.getAll(undefined, undefined, worker.id);
        setCalendarTasks(
          workerTasks.map((task) => ({
            id: task.id,
            taskNumber: task.taskNumber,
            dueDate: task.dueDate,
            status: task.status,
          }))
        );
      } catch (error) {
        logger.error("Failed to load calendar tasks:", error);
        setCalendarTasks([]);
      }
    };

    void loadCalendarTasks();
    const interval = setInterval(loadCalendarTasks, 60000);
    return () => clearInterval(interval);
  }, [worker?.id, isOnline]);

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const dueDaySet = new Set(
    calendarTasks
      .map((task) => (task.dueDate ? new Date(task.dueDate) : null))
      .filter((date): date is Date => !!date && !Number.isNaN(date.getTime()))
      .filter(
        (date) =>
          date.getFullYear() === currentYear &&
          date.getMonth() === currentMonth
      )
      .map((date) => date.getDate())
  );

  const todaysTaskCount = calendarTasks.filter((task) => {
    if (!task.dueDate) {
      return false;
    }
    const dueDate = new Date(task.dueDate);
    return !Number.isNaN(dueDate.getTime()) && dueDate.toDateString() === today.toDateString();
  }).length;

  const endOfWeek = new Date(today);
  endOfWeek.setDate(today.getDate() + (6 - today.getDay()));
  endOfWeek.setHours(23, 59, 59, 999);

  const upcomingTaskCount = calendarTasks.filter((task) => {
    if (!task.dueDate) {
      return false;
    }
    const dueDate = new Date(task.dueDate);
    return (
      !Number.isNaN(dueDate.getTime()) &&
      dueDate >= today &&
      dueDate <= endOfWeek
    );
  }).length;

  const handleNotificationClick = async (notif: { id: string; read: boolean }) => {
    if (!notif.read && isOnline) {
      try {
        const { notificationsApi } = await import("@/lib/api/notifications");
        await notificationsApi.markAsRead(notif.id);
        setNotifications(prev => 
          prev.map(n => n.id === notif.id ? { ...n, read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (error) {
        logger.error("Failed to mark notification as read:", error);
      }
    }

    const selected = notifications.find((item) => item.id === notif.id);
    if (selected?.actionUrl) {
      setShowNotifications(false);
      router.push(selected.actionUrl);
    }
  };

  // Check if we're on home page (either /worker or /worker/[role])
  const isHome =
    pathname === "/worker" ||
    pathname === "/worker/" ||
    (pathname.startsWith("/worker/") &&
      pathname.split("/").length === 3 &&
      isValidRole(pathname.split("/")[2]));
  const canGoBack = !isHome && pathname !== "/worker/login";

  // Route protection - check if worker has access to current operation
  useEffect(() => {
    // Don't check routes on login page or home page
    if (pathname === "/worker/login" || isHome) {
      return;
    }

    // Check if we have a token (client-side only)
    if (typeof window === 'undefined') return;
    const currentHasToken = !!localStorage.getItem('accessToken');
    
    // Update hasToken state
    setHasToken(currentHasToken);

    // If no token and not loading, redirect immediately (for manual URL entry)
    if (!currentHasToken && !isLoading && !worker && !role) {
      logger.debug("[WorkerLayout] No token on manual URL entry - redirecting to login immediately");
      router.replace("/worker/login");
      return;
    }

    // Wait for loading to complete, but with a timeout
    const checkAuth = setTimeout(() => {
      // List of routes that don't require operation-based permissions
      const publicRoutes = [
        "/worker/profile",
        "/worker/account-settings",
        "/worker/app-settings",
        "/worker/settings",
        "/worker/tasks",
        "/worker/leaderboard",
      ];

      // Skip protection for public routes (including dynamic task routes)
      if (publicRoutes.some((route) => pathname.startsWith(route))) {
        // Still check if authenticated
        const currentHasToken = typeof window !== 'undefined' && !!localStorage.getItem('accessToken');
        if (!worker && !role && !currentHasToken) {
          logger.debug("[WorkerLayout] Public route but not authenticated - redirecting to login");
          router.replace("/worker/login");
        }
        return;
      }

      // Extract operation from path (e.g., /worker/receiving -> receiving)
      // Handle paths like /worker/receiving or /worker/receiving/...
      const pathWithoutPrefix = pathname.replace(/^\/worker\/?/, "");
      const operation = pathWithoutPrefix.split("/")[0]; // Get first segment only

      // Check if this is an operation route that requires permission
      const protectedOperations = Object.values(OPERATIONS);
      const isOperationRoute = protectedOperations.includes(operation as any);

      // Debug logging (remove in production)
      if (process.env.NODE_ENV === "development") {
        logger.debug("[Route Protection]", {
          pathname,
          operation,
          isOperationRoute,
          role,
          worker: !!worker,
          hasToken,
        });
      }

      // Only protect operation routes, let Next.js handle 404 for other routes
      if (isOperationRoute) {
        const currentHasToken = typeof window !== 'undefined' && !!localStorage.getItem('accessToken');
        
        // If no worker AND no token, redirect to login immediately
        if (!worker && !role && !currentHasToken) {
          logger.debug("[WorkerLayout] No worker and no token - redirecting to login");
          router.replace("/worker/login");
          return;
        }

        // If we have a token but no worker state, wait a bit more (API call might be in progress)
        if (!worker && !role && currentHasToken) {
          logger.debug("[WorkerLayout] Has token but no worker - waiting for session restore");
          return;
        }

        // Check if worker has permission for this operation
        if (worker && role && !canAccessOperation(role, operation)) {
          // Redirect to role-specific home with error message
          const homeUrl = role
            ? `/worker/${role}?error=unauthorized`
            : "/worker?error=unauthorized";
          router.push(homeUrl);
          return;
        }
      }
      // If it's not an operation route, let Next.js handle it (404 if doesn't exist)
    }, isLoading ? 1000 : 0); // Wait longer if still loading to allow API call

    return () => clearTimeout(checkAuth);
  }, [pathname, worker, role, isLoading, router, isHome, canAccessOperation]);

  // Initialize offline-first infrastructure
  useEffect(() => {
    // Initialize IndexedDB
    initDB().catch((error) => logger.error(error));

    // Initialize network monitoring
    initNetworkMonitoring();

    // Start auto-sync when online
    const stopAutoSync = startAutoSync(30000); // Sync every 30 seconds when online

    return () => {
      stopAutoSync();
    };
  }, []);

  // Check if we have a token (for route protection) - client-side only
  const [hasToken, setHasToken] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  
  React.useEffect(() => {
    setMounted(true);
    setHasToken(!!localStorage.getItem('accessToken'));
  }, []);
  
  // Add timeout to prevent infinite loading
  const [loadingTimeout, setLoadingTimeout] = React.useState(false);
  
  React.useEffect(() => {
    if (isLoading && !hasToken && !worker) {
      // Set a timeout - if still loading after 5 seconds, force stop
      const timeout = setTimeout(() => {
        logger.warn("[WorkerLayout] Loading timeout after 5 seconds - forcing stop");
        setLoadingTimeout(true);
      }, 5000);
      
      return () => clearTimeout(timeout);
    } else {
      setLoadingTimeout(false);
    }
  }, [isLoading, hasToken, worker]);
  
  // If timeout occurred, redirect to login
  React.useEffect(() => {
    if (loadingTimeout && !worker && !role && !hasToken) {
      logger.debug("[WorkerLayout] Loading timeout - redirecting to login");
      router.replace("/worker/login");
    }
  }, [loadingTimeout, worker, role, hasToken, router]);
  
  // Show loading while checking auth, but with timeout
  if (!mounted) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }
  
  if (isLoading && !worker && !role) {
    // If we have a token, show loading (API call might be in progress)
    if (hasToken && !loadingTimeout) {
      logger.debug("[WorkerLayout] Has token but no worker - showing loading (API call in progress)");
      return (
        <div className="min-h-screen bg-base-200 flex items-center justify-center">
          <div className="text-center">
            <span className="loading loading-spinner loading-lg"></span>
            <p className="mt-4 text-sm">Restoring session...</p>
          </div>
        </div>
      );
    }
    // Timeout occurred - show error
    if (loadingTimeout) {
      return (
        <div className="min-h-screen bg-base-200 flex items-center justify-center">
          <div className="text-center">
            <p className="text-error mb-2">Session expired</p>
            <p className="text-sm">Redirecting to login...</p>
          </div>
        </div>
      );
    }
    // Still loading
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }
  
  // If no worker, no role, and no token after loading - redirect will happen in useEffect
  if (!isLoading && !worker && !role && !hasToken && pathname !== "/worker/login") {
    logger.debug("[WorkerLayout] No worker, no role, no token - redirecting to login");
    // Redirect happens in useEffect, just show loading
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div
      className="bg-base-200 flex flex-col safe-area-inset"
      style={{
        minHeight: "100vh",
        height: "100vh",
        maxHeight: "100vh",
        overflow: "hidden",
      }}
    >
      <OfflineIndicator />
      {/* Header - Matching Sample UI */}
      <header className="bg-base-100 text-base-content border-b border-base-300 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          {/* Left Side - App Icon and Info */}
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-950 p-1.5 shadow-sm ring-1 ring-slate-800">
              {/* Pre-trimmed mark: the original PNG carries ~33% transparent padding,
                  which is why this used to need a scale transform that clipped it. */}
              <Image
                src="/assets/logos/optiwms-mark.png?v=7"
                alt="OptiWMS"
                width={835}
                height={718}
                className="h-full w-full object-contain"
                priority
              />
            </div>
            <div>
              <div className="text-sm font-black leading-none tracking-tight">
                <span className="text-slate-900">Opti</span>
                <span className="text-primary">WMS</span>
              </div>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-base-content/55">
                Worker app
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div
                  className={`w-2 h-2 rounded-full ${
                    isOnline ? "bg-success" : "bg-warning animate-pulse"
                  }`}
                ></div>
                <span
                  className={`text-xs ${
                    isOnline ? "text-success" : "text-warning"
                  }`}
                >
                  {isOnline ? "Online" : "Offline"}
                </span>
              </div>
            </div>
          </div>

          {/* Right Side - User Info and Avatar */}
          <div className="relative profile-menu-container">
            <button
              onClick={() => {
                setShowProfileMenu(!showProfileMenu);
                setShowNotifications(false);
                setShowCalendar(false);
              }}
              className="flex items-center gap-3 px-2 py-1 rounded-lg hover:bg-base-200 transition-colors"
            >
              <div className="hidden text-right sm:block">
                <h2 className="text-sm font-semibold text-base-content">
                  {displayWorker.name}
                </h2>
                <p className="text-xs text-base-content/60">
                  Worker ID: {displayWorker.id}
                </p>
                {role && (
                  <p className="text-xs text-primary font-medium mt-0.5">
                    {getRoleDisplayName(role)}
                  </p>
                )}
              </div>
              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center overflow-hidden">
                <Image
                  src={
                    displayWorker.avatar || "/assets/avatars/placeholder.svg"
                  }
                  alt={displayWorker.name}
                  width={40}
                  height={40}
                  className="rounded-full object-cover"
                />
              </div>
            </button>

            {/* Profile Menu Dropdown */}
            {showProfileMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowProfileMenu(false)}
                ></div>
                <div className="absolute right-0 mt-2 w-56 rounded-xl bg-base-100 shadow-xl border border-base-300 z-50">
                  <div className="px-4 py-3 border-b border-base-200">
                    <div className="font-semibold text-base-content">
                      {displayWorker.name}
                    </div>
                    <div className="text-xs text-base-content">
                      Worker ID: {displayWorker.id}
                    </div>
                    {role && (
                      <div className="text-xs text-primary font-medium mt-1">
                        {getRoleDisplayName(role)}
                      </div>
                    )}
                  </div>
                  <ul className="menu p-2">
                    <li>
                      <Link
                        href="/worker/profile"
                        onClick={() => setShowProfileMenu(false)}
                        className="flex items-center gap-2 text-base-content"
                      >
                        <span className="material-symbols-outlined text-sm text-base-content">
                          person
                        </span>
                        <span className="text-base-content">Profile</span>
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/worker/leaderboard"
                        onClick={() => setShowProfileMenu(false)}
                        className="flex items-center gap-2 text-base-content"
                      >
                        <span className="material-symbols-outlined text-sm text-base-content">
                          emoji_events
                        </span>
                        <span className="text-base-content">Leaderboard</span>
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/worker/account-settings"
                        onClick={() => setShowProfileMenu(false)}
                        className="flex items-center gap-2 text-base-content"
                      >
                        <span className="material-symbols-outlined text-sm text-base-content">
                          person
                        </span>
                        <span className="text-base-content">
                          Account settings
                        </span>
                      </Link>
                    </li>
                    <li>
                      <Link
                        href="/worker/app-settings"
                        onClick={() => setShowProfileMenu(false)}
                        className="flex items-center gap-2 text-base-content"
                      >
                        <span className="material-symbols-outlined text-sm text-base-content">
                          settings
                        </span>
                        <span className="text-base-content">App settings</span>
                      </Link>
                    </li>
                    <li>
                      <a
                        href="#"
                        onClick={async (e) => {
                          e.preventDefault();
                          setShowProfileMenu(false);
                          try {
                            // Clear worker context
                            clearWorker();
                            // Clear tokens and IndexedDB
                            await authApi.logout();
                            // Redirect to login
                            router.push("/worker/login");
                          } catch (error) {
                            logger.error("Error during logout:", error);
                            // Still redirect even if logout fails
                            router.push("/worker/login");
                          }
                        }}
                        className="flex items-center gap-2 text-error"
                      >
                        <span className="material-symbols-outlined text-sm text-error">
                          logout
                        </span>
                        <span className="text-error">Logout</span>
                      </a>
                    </li>
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Back Button - Only when inside widgets */}
      {canGoBack && (
        <div className="bg-base-100 border-b border-base-300 px-4 py-2">
          <button
            onClick={() => router.back()}
            className="btn btn-ghost btn-sm text-base-content"
          >
            <span className="material-symbols-outlined">arrow_back</span>
            <span>Back</span>
          </button>
        </div>
      )}

      {/* Main Content - With bottom padding for fixed nav */}
      <main
        className="flex-1 overflow-y-auto"
        style={{
          overflowY: showNotifications || showCalendar ? "hidden" : "auto",
          paddingBottom: "4.5rem", // Space for fixed bottom nav
        }}
      >
        {children}
      </main>

      <WarehouseAssistant userRole="worker" userId={worker?.id} />

      {/* Bottom Navigation - Always visible on mobile */}
      <nav className="bg-base-100 border-t border-base-300 px-2 py-2 safe-area-bottom fixed bottom-0 left-0 right-0 z-30">
        <div className="flex items-center justify-around">
          <Link
            href={role ? `/worker/${role}` : "/worker"}
            className={`flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl transition-colors ${
              isHome
                ? "bg-primary/15"
                : "text-base-content/60 hover:bg-base-200"
            }`}
          >
            <span
              className={`material-symbols-outlined text-xl ${
                isHome ? "text-primary" : ""
              }`}
            >
              home
            </span>
            <span
              className={`text-xs font-medium ${isHome ? "text-primary" : ""}`}
            >
              Home
            </span>
          </Link>
          <button
            onClick={() => setShowCalendar(!showCalendar)}
            className="flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl text-base-content/60 hover:bg-base-200 transition-colors"
          >
            <span className="material-symbols-outlined text-xl">
              calendar_month
            </span>
            <span className="text-xs font-medium">Calendar</span>
          </button>
          <Link
            href="/worker/tasks"
            className={`flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl transition-colors ${
              pathname === "/worker/tasks"
                ? "bg-primary/15"
                : "text-base-content/60 hover:bg-base-200"
            }`}
          >
            <span
              className={`material-symbols-outlined text-xl ${
                pathname === "/worker/tasks" ? "text-primary" : ""
              }`}
            >
              task_alt
            </span>
            <span
              className={`text-xs font-medium ${
                pathname === "/worker/tasks" ? "text-primary" : ""
              }`}
            >
              Tasks
            </span>
          </Link>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl text-base-content/60 hover:bg-base-200 transition-colors relative"
          >
            <span className="material-symbols-outlined text-xl">
              notifications
            </span>
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 w-2 h-2 bg-primary rounded-full border-2 border-base-100"></span>
            )}
            <span className="text-xs font-medium">Updates</span>
          </button>
          <Link
            href="/worker/app-settings"
            className={`flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl transition-colors ${
              pathname === "/worker/app-settings" ||
              pathname === "/worker/settings" ||
              pathname === "/worker/account-settings"
                ? "bg-primary/15"
                : "text-base-content/60 hover:bg-base-200"
            }`}
          >
            <span
              className={`material-symbols-outlined text-xl ${
                pathname === "/worker/app-settings" ||
                pathname === "/worker/settings" ||
                pathname === "/worker/account-settings"
                  ? "text-primary"
                  : ""
              }`}
            >
              settings
            </span>
            <span
              className={`text-xs font-medium ${
                pathname === "/worker/app-settings" ||
                pathname === "/worker/settings" ||
                pathname === "/worker/account-settings"
                  ? "text-primary"
                  : ""
              }`}
            >
              Settings
            </span>
          </Link>
        </div>
      </nav>

      {/* Notifications Modal */}
      {showNotifications && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowNotifications(false)}
            style={{ position: "fixed", overflow: "hidden" }}
          ></div>
          <div
            className="fixed top-20 right-4 bg-base-100 rounded-xl shadow-xl border border-base-300 w-80 max-w-[calc(100vw-2rem)] z-50"
            style={{ position: "fixed" }}
          >
            <div className="p-4 border-b border-base-200 flex items-center justify-between">
              <h3 className="font-bold text-base-content">Notifications</h3>
              <button
                onClick={() => setShowNotifications(false)}
                className="btn btn-ghost btn-sm btn-circle"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div
              className="max-h-96 overflow-y-auto"
              style={{ maxHeight: "calc(100vh - 8rem)" }}
            >
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-base-content/60">
                  <span className="material-symbols-outlined text-4xl mb-2">
                    notifications_off
                  </span>
                  <p>No notifications</p>
                </div>
              ) : (
                <div className="divide-y divide-base-200">
                  {notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`p-4 hover:bg-base-200 cursor-pointer ${
                        !notif.read ? "bg-primary/5" : ""
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="material-symbols-outlined text-primary">
                            info
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm text-base-content">
                            {notif.title}
                          </div>
                          <div className="text-xs text-base-content/60 mt-1">
                            {notif.message}
                          </div>
                          <div className="text-xs text-base-content/40 mt-1">
                            {notif.time}
                          </div>
                        </div>
                        {!notif.read && (
                          <div className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-2"></div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Calendar Modal */}
      {showCalendar && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowCalendar(false)}
            style={{ position: "fixed", overflow: "hidden" }}
          ></div>
          <div
            className="fixed bottom-0 left-0 right-0 bg-base-100 rounded-t-2xl shadow-xl border-t border-base-300 z-50 overflow-y-auto"
            style={{
              position: "fixed",
              maxHeight: "80vh",
              overflowY: "auto",
            }}
          >
            <div className="p-4 border-b border-base-200 flex items-center justify-between sticky top-0 bg-base-100">
              <h3 className="font-bold text-base-content">Calendar</h3>
              <button
                onClick={() => setShowCalendar(false)}
                className="btn btn-ghost btn-sm btn-circle"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-4">
              <div className="text-center mb-4">
                <div className="text-2xl font-bold text-base-content">
                  {today.toLocaleDateString("en-US", {
                    month: "long",
                    year: "numeric",
                  })}
                </div>
                <div className="text-sm text-base-content/60">
                  Today: {today.toLocaleDateString()}
                </div>
              </div>
              <div className="grid grid-cols-7 gap-1 mb-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                  (day) => (
                    <div
                      key={day}
                      className="text-center text-xs font-semibold text-base-content/60 py-2"
                    >
                      {day}
                    </div>
                  )
                )}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: firstDayOfMonth }).map((_, index) => (
                  <div key={`empty-${index}`} className="aspect-square"></div>
                ))}
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const day = i + 1;
                  const isToday = day === today.getDate();
                  const hasTasks = dueDaySet.has(day);
                  return (
                    <div
                      key={day}
                      className={`aspect-square flex flex-col items-center justify-center text-sm rounded-lg ${
                        isToday
                          ? "bg-primary text-primary-content font-bold"
                          : hasTasks
                          ? "bg-base-200 text-base-content"
                          : "text-base-content/60"
                      }`}
                    >
                      <span>{day}</span>
                      {hasTasks && (
                        <div
                          className={`w-1 h-1 rounded-full mt-0.5 ${
                            isToday ? "bg-primary-content" : "bg-primary"
                          }`}
                        ></div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-6 space-y-3">
                <div className="p-3 bg-base-200 rounded-lg">
                  <div className="font-semibold text-sm text-base-content">
                    Today's Tasks
                  </div>
                  <div className="text-xs text-base-content/60 mt-1">
                    {todaysTaskCount} task{todaysTaskCount === 1 ? "" : "s"} scheduled
                  </div>
                </div>
                <div className="p-3 bg-base-200 rounded-lg">
                  <div className="font-semibold text-sm text-base-content">
                    Upcoming
                  </div>
                  <div className="text-xs text-base-content/60 mt-1">
                    {upcomingTaskCount} task{upcomingTaskCount === 1 ? "" : "s"} due this week
                  </div>
                </div>
                {calendarTasks.length > 0 && (
                  <div className="p-3 bg-base-200 rounded-lg">
                    <div className="font-semibold text-sm text-base-content">
                      Next Due Tasks
                    </div>
                    <div className="mt-2 space-y-2">
                      {calendarTasks
                        .filter((task) => !!task.dueDate)
                        .sort((a, b) => new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime())
                        .slice(0, 3)
                        .map((task) => (
                          <div key={task.id} className="text-xs text-base-content/70">
                            <span className="font-medium text-base-content">{task.taskNumber}</span>
                            {" · "}
                            {new Date(task.dueDate || "").toLocaleString()}
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
