"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAdmin } from "@/contexts/AdminContext";
import { authApi } from "@/lib/api/auth";
import { getRoleDisplayName } from "@/lib/admin-roles";
import { AIServiceStatus } from "@/components/AIServiceStatus";
import { AI_SERVICES } from "@/lib/ai-services/registry";
import { notificationsApi, Notification } from "@/lib/api/notifications";
import { useTheme } from "@/lib/hooks/useTheme";
import { logger } from "@/lib/utils/logger";
import { WarehouseAssistant } from "@/components/WarehouseAssistant";

type SearchItem = {
  type: "Warehouse" | "Order" | "Customer";
  label: string;
  extra?: string;
  id?: string; // Optional ID for direct navigation to detail pages
};

const MOCK_RESULTS: SearchItem[] = [
  { type: "Warehouse", label: "Warehouse 1", extra: "Colombo", id: "wh-1" },
  { type: "Warehouse", label: "Warehouse 2", extra: "Kandy", id: "wh-2" },
  { type: "Order", label: "SO-1001", extra: "Acme Corp", id: "SO-1001" },
  { type: "Order", label: "SO-1002", extra: "Bright Retail", id: "SO-1002" },
  { type: "Customer", label: "Acme Corp", extra: "42 orders", id: "cust-1" },
];

export function Topbar() {
  const { admin, role, clearAdmin } = useAdmin();
  const router = useRouter();
  const { isDark, toggleTheme, mounted } = useTheme();
  const [query, setQuery] = useState("");
  const [openProfile, setOpenProfile] = useState(false);
  const [openCalendar, setOpenCalendar] = useState(false);
  const [openSearch, setOpenSearch] = useState(false);
  const [openNotifications, setOpenNotifications] = useState(false);

  const filtered = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return MOCK_RESULTS.filter(
      (r) =>
        r.label.toLowerCase().includes(q) || r.extra?.toLowerCase().includes(q)
    );
  }, [query]);


  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const calendarEl = document.querySelector(".calendar-dropdown");
      const profileEl = document.querySelector(".profile-dropdown");
      const searchEl = document.querySelector(".search-dropdown");
      const notificationsEl = document.querySelector(".notifications-dropdown");

      if (calendarEl && !calendarEl.contains(target)) {
        setOpenCalendar(false);
      }
      if (profileEl && !profileEl.contains(target)) {
        setOpenProfile(false);
      }
      if (searchEl && !searchEl.contains(target)) {
        setOpenSearch(false);
      }
      if (notificationsEl && !notificationsEl.contains(target)) {
        setOpenNotifications(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openCalendar, openProfile, openSearch, openNotifications]);

  // Handle search result click
  const handleSearchResultClick = (result: SearchItem) => {
    setQuery("");
    setOpenSearch(false);

    // Navigate based on result type
    // If ID is available, we could navigate to detail pages in the future
    // For now, navigate to list pages with search query
    switch (result.type) {
      case "Warehouse":
        // Navigate to warehouses page with search query
        // Future: if result.id exists, could navigate to /admin/warehouses/[id]
        router.push(
          `/admin/warehouses?search=${encodeURIComponent(result.label)}`
        );
        break;
      case "Order":
        // Navigate to orders page with search query
        // Try to determine if it's inbound or outbound based on label (SO = Sales Order = Outbound)
        // Future: if result.id exists, could navigate to /admin/orders/[id]
        if (result.label.startsWith("SO-")) {
          router.push(
            `/admin/orders/outbound?search=${encodeURIComponent(result.label)}`
          );
        } else {
          router.push(
            `/admin/orders?search=${encodeURIComponent(result.label)}`
          );
        }
        break;
      case "Customer":
        // Navigate to customers page with search query
        // Future: if result.id exists, could navigate to /admin/customers/[id]
        router.push(
          `/admin/customers?search=${encodeURIComponent(result.label)}`
        );
        break;
      default:
        // Fallback to dashboard if type is unknown
        router.push("/admin/dashboard");
    }
  };

  const avatarUrl = admin?.avatar || "/assets/avatars/Henry Kual.jpg";
  const displayName = admin?.name || "Admin";
  const displayRole = role ? getRoleDisplayName(role) : "Admin";

  // Mock data for calendar
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const todayDate = today.getDate();

  // Mock tasks and holidays
  const tasksByDate: Record<number, { count: number; color: string }> = {
    5: { count: 2, color: "bg-primary" },
    12: { count: 1, color: "bg-warning" },
    18: { count: 3, color: "bg-info" },
    25: { count: 1, color: "bg-success" },
  };

  const holidays: number[] = [1, 15, 28]; // Mock holidays

  // Notifications from API
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(true);

  useEffect(() => {
    const loadNotifications = async () => {
      if (!admin?.id) return;
      try {
        setLoadingNotifications(true);
        const [notifs, count] = await Promise.all([
          notificationsApi.getAll(admin.id, undefined, { role: role || undefined, warehouseId: admin.warehouseId }),
          notificationsApi.getUnreadCount(admin.id, { role: role || undefined, warehouseId: admin.warehouseId }),
        ]);
        setNotifications(notifs.slice(0, 10)); // Show latest 10
        setUnreadCount(count);
      } catch (error) {
        logger.error("Error loading notifications:", error);
        setNotifications([]);
        setUnreadCount(0);
      } finally {
        setLoadingNotifications(false);
      }
    };
    loadNotifications();
    // Refresh every 30 seconds
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, [admin?.id]);

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      try {
        await notificationsApi.markAsRead(notification.id);
        setNotifications(notifications.map(n => 
          n.id === notification.id ? { ...n, read: true } : n
        ));
        setUnreadCount(Math.max(0, unreadCount - 1));
      } catch (error) {
        logger.error("Error marking notification as read:", error);
      }
    }
    if (notification.actionUrl) {
      router.push(notification.actionUrl);
    }
  };

  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month: number, year: number) => {
    return new Date(year, month, 1).getDay();
  };

  const daysInMonth = getDaysInMonth(currentMonth, currentYear);
  const firstDay = getFirstDayOfMonth(currentMonth, currentYear);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptyDays = Array.from({ length: firstDay }, (_, i) => i);

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  return (
    <header className="relative flex items-center justify-between gap-4 px-6 py-4 bg-base-100 border-b border-base-200">
      {/* Search Bar - Left Aligned */}
      <div className="relative max-w-xl search-dropdown">
        <label className="input input-bordered flex items-center gap-2 w-full">
          <span className="material-symbols-outlined text-base-content/60">
            search
          </span>
          <input
            type="text"
            className="grow"
            placeholder="Find inventory, orders or reports"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpenSearch(true);
            }}
            onFocus={() => {
              if (query) setOpenSearch(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setOpenSearch(false);
                setQuery("");
              }
            }}
          />
        </label>
        {openSearch && query && (
          <div className="absolute mt-2 w-full rounded-xl bg-base-100 shadow-lg border border-base-200 z-20">
            {filtered.length === 0 ? (
              <div className="px-4 py-3 text-sm text-base-content/70">
                No results found
              </div>
            ) : (
              <ul className="divide-y divide-base-200">
                {filtered.map((r) => (
                  <li
                    key={r.type + r.label}
                    className="px-4 py-3 text-sm flex justify-between hover:bg-base-200 cursor-pointer transition-colors"
                    onClick={() => handleSearchResultClick(r)}
                  >
                    <span>
                      <span className="font-semibold">{r.label}</span>
                      {r.extra && (
                        <span className="text-base-content/60">
                          {" "}
                          — {r.extra}
                        </span>
                      )}
                    </span>
                    <span className="badge badge-outline">{r.type}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Icons - Right Aligned */}
      <div className="flex items-center gap-3">
        {/* AI Services Status - Only show if user has access to any AI service */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-lg bg-base-200/50">
          <span className="text-xs text-base-content/60">AI:</span>
          <AIServiceStatus
            serviceId={AI_SERVICES.ANOMALY_DETECTION}
            size="sm"
          />
        </div>

        {/* Notifications */}
        <div className="relative notifications-dropdown">
          <button
            className="btn btn-ghost btn-circle relative"
            title="Notifications"
            onClick={() => {
              setOpenNotifications((v) => !v);
              setOpenCalendar(false);
              setOpenProfile(false);
            }}
          >
            <span className="material-symbols-outlined">notifications</span>
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-error rounded-full flex items-center justify-center">
                <span className="text-[10px] text-white font-bold">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              </span>
            )}
          </button>
          {openNotifications && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl bg-base-100 shadow-lg border border-base-200 z-30">
              <div className="p-4 border-b border-base-200 flex items-center justify-between">
                <div className="text-lg font-bold text-base-content">
                  Notifications
                </div>
                {unreadCount > 0 && (
                  <span className="badge badge-primary badge-sm">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto">
                {loadingNotifications ? (
                  <div className="px-4 py-8 text-center">
                    <span className="loading loading-spinner loading-md"></span>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-base-content/60">
                    No notifications
                  </div>
                ) : (
                  <ul className="divide-y divide-base-200">
                    {notifications.map((notif) => (
                      <li
                        key={notif.id}
                        className={`px-4 py-3 hover:bg-base-200 transition-colors cursor-pointer ${
                          !notif.read ? "bg-primary/5" : ""
                        }`}
                        onClick={() => handleNotificationClick(notif)}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                              !notif.read ? "bg-primary" : "bg-transparent"
                            }`}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <p
                                className={`text-sm font-semibold ${
                                  !notif.read
                                    ? "text-base-content"
                                    : "text-base-content/70"
                                }`}
                              >
                                {notif.title}
                              </p>
                              <span className="text-xs text-base-content/50 flex-shrink-0 ml-2">
                                {formatTimeAgo(notif.createdAt)}
                              </span>
                            </div>
                            <p className="text-xs text-base-content/60 line-clamp-2">
                              {notif.message}
                            </p>
                            <span className="inline-block mt-1 text-xs badge badge-outline badge-sm">
                              {notif.notificationType.replace("_", " ")}
                            </span>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {notifications.length > 0 && (
                <div className="p-3 border-t border-base-200">
                  <Link
                    href="/admin/notifications"
                    className="btn btn-ghost btn-sm w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenNotifications(false);
                    }}
                  >
                    View All Notifications
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Calendar */}
        <div className="relative calendar-dropdown">
          <button
            className="btn btn-ghost btn-circle"
            title="Calendar"
            onClick={() => {
              setOpenCalendar((v) => !v);
              setOpenProfile(false);
            }}
          >
            <span className="material-symbols-outlined">calendar_today</span>
          </button>
          {openCalendar && (
            <div className="absolute right-0 mt-2 w-80 rounded-xl bg-base-100 shadow-lg border border-base-200 z-30">
              <div className="p-4 border-b border-base-200">
                <div className="text-lg font-bold text-base-content">
                  {monthNames[currentMonth]} {currentYear}
                </div>
                <div className="text-sm text-base-content/60">
                  {today.toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </div>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                    (day) => (
                      <div
                        key={day}
                        className="text-center text-xs font-semibold text-base-content/60 py-1"
                      >
                        {day}
                      </div>
                    )
                  )}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {emptyDays.map((_, idx) => (
                    <div key={`empty-${idx}`} className="aspect-square"></div>
                  ))}
                  {days.map((day) => {
                    const isToday = day === todayDate;
                    const hasTasks = tasksByDate[day];
                    const isHoliday = holidays.includes(day);
                    return (
                      <div
                        key={day}
                        className={`
                          aspect-square flex flex-col items-center justify-center text-sm rounded-lg relative
                          ${
                            isToday
                              ? "bg-primary text-primary-content font-bold"
                              : "hover:bg-base-200"
                          }
                          ${!isToday && !isHoliday ? "text-base-content" : ""}
                          ${isHoliday && !isToday ? "text-error" : ""}
                        `}
                      >
                        <span>{day}</span>
                        {hasTasks && (
                          <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 flex gap-0.5">
                            {Array.from({
                              length: Math.min(hasTasks.count, 3),
                            }).map((_, i) => (
                              <div
                                key={i}
                                className={`w-1 h-1 rounded-full ${hasTasks.color}`}
                              />
                            ))}
                          </div>
                        )}
                        {isHoliday && !hasTasks && (
                          <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 rounded-full bg-error" />
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 pt-4 border-t border-base-200 space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-primary"></div>
                    <span className="text-base-content/70">Pending Tasks</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-error"></div>
                    <span className="text-base-content/70">Holidays</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {mounted && (
          <button
            className="btn btn-primary btn-circle"
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            onClick={toggleTheme}
          >
            <span className="material-symbols-outlined">
              {isDark ? "dark_mode" : "light_mode"}
            </span>
          </button>
        )}

        <WarehouseAssistant
          userRole="manager"
          userId={admin?.id}
        />

        <div className="relative profile-dropdown">
          <button
            className="flex items-center gap-2 px-3 py-1 rounded-full bg-base-200"
            onClick={() => {
              setOpenProfile((v) => !v);
              setOpenCalendar(false);
            }}
          >
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt="User avatar"
                width={28}
                height={28}
                className="rounded-full object-cover"
              />
            ) : (
              <div className="w-7 h-7 bg-primary rounded-full flex items-center justify-center text-primary-content text-sm font-semibold">
                HK
              </div>
            )}
            <div className="flex flex-col items-start leading-tight">
              <span className="text-sm font-medium">{displayName}</span>
              <span className="text-xs text-base-content/60">
                {displayRole}
              </span>
            </div>
          </button>
          {openProfile && (
            <div className="absolute right-0 mt-2 w-48 rounded-xl bg-base-100 shadow-lg border border-base-200 z-30">
              <div className="px-4 py-3 border-b border-base-200">
                <div className="font-semibold">{displayName}</div>
                <div className="text-xs text-base-content/60">
                  {displayRole}
                </div>
              </div>
              <ul className="menu p-2">
                <li>
                  <a href="/admin/profile">Profile</a>
                </li>
                <li>
                  <a href="/admin/account-settings">Account settings</a>
                </li>
                <li>
                  <a
                    href="#"
                    className="text-error"
                    onClick={async (e) => {
                      e.preventDefault();
                      setOpenProfile(false);
                      try {
                        // Clear admin context
                        clearAdmin();
                        // Clear tokens and IndexedDB
                        await authApi.logout();
                        // Redirect to login
                        router.push("/admin/login");
                      } catch (error) {
                        logger.error("Error during logout:", error);
                        // Still redirect even if logout fails
                        router.push("/admin/login");
                      }
                    }}
                  >
                    Logout
                  </a>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
