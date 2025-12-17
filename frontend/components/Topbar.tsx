"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";

type SearchItem = { type: "Warehouse" | "Order" | "Customer"; label: string; extra?: string };

const MOCK_RESULTS: SearchItem[] = [
  { type: "Warehouse", label: "Warehouse 1", extra: "Colombo" },
  { type: "Warehouse", label: "Warehouse 2", extra: "Kandy" },
  { type: "Order", label: "SO-1001", extra: "Acme Corp" },
  { type: "Order", label: "SO-1002", extra: "Bright Retail" },
  { type: "Customer", label: "Acme Corp", extra: "42 orders" },
];

export function Topbar() {
  const [dark, setDark] = useState(false);
  const [query, setQuery] = useState("");
  const [openProfile, setOpenProfile] = useState(false);
  const [openCalendar, setOpenCalendar] = useState(false);

  const filtered = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return MOCK_RESULTS.filter((r) => r.label.toLowerCase().includes(q) || r.extra?.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    const theme = dark ? "dark" : "optiwms";
    document.documentElement.setAttribute("data-theme", theme);
  }, [dark]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    if (!openCalendar && !openProfile) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const calendarEl = document.querySelector(".calendar-dropdown");
      const profileEl = document.querySelector(".profile-dropdown");
      
      if (calendarEl && !calendarEl.contains(target)) {
        setOpenCalendar(false);
      }
      if (profileEl && !profileEl.contains(target)) {
        setOpenProfile(false);
      }
    };
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openCalendar, openProfile]);

  const avatarUrl = "/assets/avatars/Henry Kual.jpg";
  const role = "Admin";

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
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return (
    <header className="relative flex items-center justify-between gap-4 px-6 py-4 bg-base-100 border-b border-base-200">
      {/* Search Bar - Left Aligned */}
      <div className="relative max-w-xl">
        <label className="input input-bordered flex items-center gap-2 w-full">
          <span className="material-symbols-outlined text-base-content/60">search</span>
          <input
            type="text"
            className="grow"
            placeholder="Find inventory, orders or reports"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        {query && (
          <div className="absolute mt-2 w-full rounded-xl bg-base-100 shadow-lg border border-base-200 z-20">
            {filtered.length === 0 ? (
              <div className="px-4 py-3 text-sm text-base-content/70">No results</div>
            ) : (
              <ul className="divide-y divide-base-200">
                {filtered.map((r) => (
                  <li key={r.type + r.label} className="px-4 py-3 text-sm flex justify-between">
                    <span>
                      <span className="font-semibold">{r.label}</span>
                      {r.extra && <span className="text-base-content/60"> — {r.extra}</span>}
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
        <button className="btn btn-ghost btn-circle" title="Notifications">
          <span className="material-symbols-outlined">notifications</span>
        </button>
        
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
                  {today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </div>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                    <div key={day} className="text-center text-xs font-semibold text-base-content/60 py-1">
                      {day}
                    </div>
                  ))}
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
                          ${isToday ? "bg-primary text-primary-content font-bold" : "hover:bg-base-200"}
                          ${!isToday && !isHoliday ? "text-base-content" : ""}
                          ${isHoliday && !isToday ? "text-error" : ""}
                        `}
                      >
                        <span>{day}</span>
                        {hasTasks && (
                          <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 flex gap-0.5">
                            {Array.from({ length: Math.min(hasTasks.count, 3) }).map((_, i) => (
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

        <button
          className="btn btn-primary btn-circle"
          title="Toggle theme"
          onClick={() => setDark((v) => !v)}
        >
          <span className="material-symbols-outlined">{dark ? "light_mode" : "dark_mode"}</span>
        </button>
        
        <div className="relative profile-dropdown">
          <button
            className="flex items-center gap-2 px-3 py-1 rounded-full bg-base-200"
            onClick={() => {
              setOpenProfile((v) => !v);
              setOpenCalendar(false);
            }}
          >
            {avatarUrl ? (
              <Image src={avatarUrl} alt="User avatar" width={28} height={28} className="rounded-full object-cover" />
            ) : (
              <div className="w-7 h-7 bg-primary rounded-full flex items-center justify-center text-primary-content text-sm font-semibold">
                HK
              </div>
            )}
            <div className="flex flex-col items-start leading-tight">
              <span className="text-sm font-medium">Henry Kaul</span>
              <span className="text-xs text-base-content/60">{role}</span>
            </div>
          </button>
          {openProfile && (
            <div className="absolute right-0 mt-2 w-48 rounded-xl bg-base-100 shadow-lg border border-base-200 z-30">
              <div className="px-4 py-3 border-b border-base-200">
                <div className="font-semibold">Henry Kaul</div>
                <div className="text-xs text-base-content/60">{role}</div>
              </div>
              <ul className="menu p-2">
                <li>
                  <a href="/admin/profile">Profile</a>
                </li>
                <li>
                  <a href="/admin/account-settings">Account settings</a>
                </li>
                <li>
                  <a href="/admin/login" className="text-error">Logout</a>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}


