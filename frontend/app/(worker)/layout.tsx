"use client";

import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

export default function WorkerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
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
  
  const worker = { 
    name: "John Doe", 
    id: "EMP-2045", 
    warehouse: "Warehouse 1",
    status: "Online",
    deviceId: "e8b5d4",
    avatar: "/assets/avatars/Jhon Doe.jpg"
  };

  const notifications = [
    { id: 1, title: "New task assigned", message: "Receiving task #452368", time: "2m ago", read: false },
    { id: 2, title: "Task completed", message: "Putaway task completed", time: "15m ago", read: false },
    { id: 3, title: "Reminder", message: "Cycle count due in Zone B", time: "1h ago", read: true },
  ];

  const isHome = pathname === "/worker" || pathname === "/worker/";
  const canGoBack = !isHome && pathname !== "/worker/login";

  return (
    <div className="min-h-screen bg-base-200 flex flex-col safe-area-inset">
      {/* Header - Matching Sample UI */}
      <header className="bg-neutral text-neutral-content px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Left Side - App Icon and Info */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-xl font-bold text-primary-content">O</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-neutral-content">OptiWMS</h1>
              <p className="text-xs text-neutral-content/80">Worker App</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="w-2 h-2 bg-success rounded-full"></div>
                <span className="text-xs text-neutral-content/80">{worker.status}</span>
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
                <h2 className="text-sm font-semibold text-neutral-content">{worker.name}</h2>
                <p className="text-xs text-neutral-content/70">Worker ID: {worker.id}</p>
              </div>
              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center overflow-hidden">
                <Image
                  src={worker.avatar}
                  alt={worker.name}
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
                    <div className="font-semibold text-base-content">{worker.name}</div>
                    <div className="text-xs text-base-content">Worker ID: {worker.id}</div>
                  </div>
                  <ul className="menu p-2">
                    <li>
                      <Link 
                        href="/worker/profile"
                        onClick={() => setShowProfileMenu(false)}
                        className="flex items-center gap-2 text-base-content"
                      >
                        <span className="material-symbols-outlined text-sm text-base-content">person</span>
                        <span className="text-base-content">Profile</span>
                      </Link>
                    </li>
                    <li>
                      <Link 
                        href="/worker/account-settings"
                        onClick={() => setShowProfileMenu(false)}
                        className="flex items-center gap-2 text-base-content"
                      >
                        <span className="material-symbols-outlined text-sm text-base-content">person</span>
                        <span className="text-base-content">Account settings</span>
                      </Link>
                    </li>
                    <li>
                      <Link 
                        href="/worker/app-settings"
                        onClick={() => setShowProfileMenu(false)}
                        className="flex items-center gap-2 text-base-content"
                      >
                        <span className="material-symbols-outlined text-sm text-base-content">settings</span>
                        <span className="text-base-content">App settings</span>
                      </Link>
                    </li>
                    <li>
                      <Link 
                        href="/worker/login"
                        onClick={() => setShowProfileMenu(false)}
                        className="flex items-center gap-2 text-error"
                      >
                        <span className="material-symbols-outlined text-sm text-error">logout</span>
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

      {/* Main Content */}
      <main 
        className="flex-1 overflow-y-auto" 
        style={{ 
          background: "oklch(98% 0 0)",
          overflowY: (showNotifications || showCalendar) ? "hidden" : "auto"
        }}
      >
        {children}
      </main>

      {/* Bottom Navigation - Only on home */}
      {isHome && (
        <nav className="bg-neutral border-t-2 border-primary/30 px-4 py-5 safe-area-bottom">
          <div className="flex items-center justify-around">
            <Link href="/worker" className="flex flex-col items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/15">
              <span className="material-symbols-outlined text-primary text-2xl">home</span>
              <span className="text-xs font-medium text-primary">Home</span>
            </Link>
            <button
              onClick={() => setShowCalendar(!showCalendar)}
              className="flex flex-col items-center gap-1.5 px-3 py-2 rounded-xl text-neutral-content/50 hover:bg-white/5 transition-colors"
            >
              <span className="material-symbols-outlined text-2xl">calendar_month</span>
              <span className="text-xs font-medium">Calendar</span>
            </button>
            <Link href="/worker/tasks" className="flex flex-col items-center gap-1.5 px-3 py-2 rounded-xl text-neutral-content/50 hover:bg-white/5 transition-colors">
              <span className="material-symbols-outlined text-2xl">task_alt</span>
              <span className="text-xs font-medium">Tasks</span>
            </Link>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="flex flex-col items-center gap-1.5 px-3 py-2 rounded-xl text-neutral-content/50 hover:bg-white/5 transition-colors relative"
            >
              <span className="material-symbols-outlined text-2xl">notifications</span>
              {notifications.filter(n => !n.read).length > 0 && (
                <span className="absolute top-1 right-2 w-2 h-2 bg-primary rounded-full border-2 border-neutral"></span>
              )}
              <span className="text-xs font-medium">Updates</span>
            </button>
               <Link href="/worker/app-settings" className="flex flex-col items-center gap-1.5 px-3 py-2 rounded-xl text-neutral-content/50 hover:bg-white/5 transition-colors">
                 <span className="material-symbols-outlined text-2xl">settings</span>
                 <span className="text-xs font-medium">Settings</span>
               </Link>
          </div>
        </nav>
      )}

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
            <div className="max-h-96 overflow-y-auto" style={{ maxHeight: "calc(100vh - 8rem)" }}>
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-base-content/60">
                  <span className="material-symbols-outlined text-4xl mb-2">notifications_off</span>
                  <p>No notifications</p>
                </div>
              ) : (
                <div className="divide-y divide-base-200">
                  {notifications.map((notif) => (
                    <div
                      key={notif.id}
                      className={`p-4 hover:bg-base-200 ${!notif.read ? "bg-primary/5" : ""}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                          <span className="material-symbols-outlined text-primary">info</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm text-base-content">{notif.title}</div>
                          <div className="text-xs text-base-content/60 mt-1">{notif.message}</div>
                          <div className="text-xs text-base-content/40 mt-1">{notif.time}</div>
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
              overflowY: "auto"
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
                <div className="text-2xl font-bold text-base-content">December 2025</div>
                <div className="text-sm text-base-content/60">Today: {new Date().toLocaleDateString()}</div>
              </div>
              <div className="grid grid-cols-7 gap-1 mb-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div key={day} className="text-center text-xs font-semibold text-base-content/60 py-2">
                    {day}
                  </div>
                ))}
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
                  <div className="font-semibold text-sm text-base-content">Today's Tasks</div>
                  <div className="text-xs text-base-content/60 mt-1">3 tasks scheduled</div>
                </div>
                <div className="p-3 bg-base-200 rounded-lg">
                  <div className="font-semibold text-sm text-base-content">Upcoming</div>
                  <div className="text-xs text-base-content/60 mt-1">5 tasks this week</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
