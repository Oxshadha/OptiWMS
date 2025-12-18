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
import { canAccessOperation, OPERATIONS } from "@/lib/worker-roles";
import { WorkerProvider } from "@/contexts/WorkerContext";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <WorkerProvider>
      <WorkerLayoutWrapper>{children}</WorkerLayoutWrapper>
    </WorkerProvider>
  );
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
  const { worker, role, isLoading } = useWorker();
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
  const displayWorker = worker || {
    name: "Worker",
    id: "N/A",
    warehouse: "N/A",
    deviceId: "N/A",
    avatar: "/assets/avatars/placeholder.svg",
  };

  const notifications = [
    {
      id: 1,
      title: "New task assigned",
      message: "Receiving task #452368",
      time: "2m ago",
      read: false,
    },
    {
      id: 2,
      title: "Task completed",
      message: "Putaway task completed",
      time: "15m ago",
      read: false,
    },
    {
      id: 3,
      title: "Reminder",
      message: "Cycle count due in Zone B",
      time: "1h ago",
      read: true,
    },
  ];

  const isHome = pathname === "/worker" || pathname === "/worker/";
  const canGoBack = !isHome && pathname !== "/worker/login";

  // Route protection - check if worker has access to current operation
  useEffect(() => {
    // Don't check routes during loading, on login page, or home page
    if (isLoading || pathname === "/worker/login" || isHome) {
      return;
    }

    // List of routes that don't require operation-based permissions
    const publicRoutes = [
      "/worker/profile",
      "/worker/account-settings",
      "/worker/app-settings",
      "/worker/settings",
      "/worker/tasks",
    ];

    // Skip protection for public routes (including dynamic task routes)
    if (publicRoutes.some((route) => pathname.startsWith(route))) {
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
      console.log("[Route Protection]", {
        pathname,
        operation,
        isOperationRoute,
        role,
        worker: !!worker,
      });
    }

    // Only protect operation routes, let Next.js handle 404 for other routes
    if (isOperationRoute) {
      // If no worker or no role, redirect to login
      if (!worker || !role) {
        router.push("/worker/login");
        return;
      }

      // Check if worker has permission for this operation
      if (!canAccessOperation(role, operation)) {
        // Redirect to home with error message
        router.push("/worker?error=unauthorized");
        return;
      }
    }
    // If it's not an operation route, let Next.js handle it (404 if doesn't exist)
  }, [pathname, worker, role, isLoading, router, isHome]);

  // Initialize offline-first infrastructure
  useEffect(() => {
    // Initialize IndexedDB
    initDB().catch(console.error);

    // Initialize network monitoring
    initNetworkMonitoring();

    // Start auto-sync when online
    const stopAutoSync = startAutoSync(30000); // Sync every 30 seconds when online

    return () => {
      stopAutoSync();
    };
  }, []);

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
      <header className="bg-neutral text-neutral-content px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          {/* Left Side - App Icon and Info */}
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center overflow-hidden flex-shrink-0"
              style={{ backgroundColor: "#EEEEEE" }}
            >
              <Image
                src="/assets/logos/OptiWMS Logo.JPG"
                alt="OptiWMS Logo"
                width={48}
                height={48}
                className="object-contain w-full h-full"
              />
            </div>
            <div>
              <h1 className="text-lg font-bold text-neutral-content">
                OptiWMS
              </h1>
              <p className="text-xs text-neutral-content/80">Worker App</p>
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
              className="flex items-center gap-3 px-2 py-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <div className="text-right">
                <h2 className="text-sm font-semibold text-neutral-content">
                  {displayWorker.name}
                </h2>
                <p className="text-xs text-neutral-content/70">
                  Worker ID: {displayWorker.id}
                </p>
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
                      <Link
                        href="/worker/login"
                        onClick={() => setShowProfileMenu(false)}
                        className="flex items-center gap-2 text-error"
                      >
                        <span className="material-symbols-outlined text-sm text-error">
                          logout
                        </span>
                        <span className="text-error">Logout</span>
                      </Link>
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
        <div className="bg-neutral border-b border-white/10 px-4 py-2">
          <button
            onClick={() => router.back()}
            className="btn btn-ghost btn-sm text-neutral-content"
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
          background: "oklch(98% 0 0)",
          overflowY: showNotifications || showCalendar ? "hidden" : "auto",
          paddingBottom: "4.5rem", // Space for fixed bottom nav
        }}
      >
        {children}
      </main>

      {/* Bottom Navigation - Always visible on mobile */}
      <nav className="bg-neutral border-t-2 border-primary/30 px-2 py-2 safe-area-bottom fixed bottom-0 left-0 right-0 z-30">
        <div className="flex items-center justify-around">
          <Link
            href="/worker"
            className={`flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl transition-colors ${
              isHome
                ? "bg-primary/15"
                : "text-neutral-content/50 hover:bg-white/5"
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
            className="flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl text-neutral-content/50 hover:bg-white/5 transition-colors"
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
                : "text-neutral-content/50 hover:bg-white/5"
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
            className="flex flex-col items-center gap-1 px-2 py-1.5 rounded-xl text-neutral-content/50 hover:bg-white/5 transition-colors relative"
          >
            <span className="material-symbols-outlined text-xl">
              notifications
            </span>
            {notifications.filter((n) => !n.read).length > 0 && (
              <span className="absolute top-0 right-0 w-2 h-2 bg-primary rounded-full border-2 border-neutral"></span>
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
                : "text-neutral-content/50 hover:bg-white/5"
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
                      className={`p-4 hover:bg-base-200 ${
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
                  December 2025
                </div>
                <div className="text-sm text-base-content/60">
                  Today: {new Date().toLocaleDateString()}
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
                {Array.from({ length: 31 }, (_, i) => {
                  const day = i + 1;
                  const isToday = day === new Date().getDate();
                  const hasTasks = [5, 12, 18, 25].includes(day);
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
                        <div className="w-1 h-1 bg-primary rounded-full mt-0.5"></div>
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
                    3 tasks scheduled
                  </div>
                </div>
                <div className="p-3 bg-base-200 rounded-lg">
                  <div className="font-semibold text-sm text-base-content">
                    Upcoming
                  </div>
                  <div className="text-xs text-base-content/60 mt-1">
                    5 tasks this week
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
