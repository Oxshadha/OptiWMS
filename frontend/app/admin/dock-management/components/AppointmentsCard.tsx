"use client";

import { DockAppointment } from "@/lib/api/operations";
import { formatDate, formatTime, getStatusColor, monthNames } from "../utils";

export function AppointmentsCard({
  canEdit,
  selectedDate,
  showCalendar,
  calendarMonth,
  calendarYear,
  todayDate,
  currentMonth,
  currentYear,
  days,
  emptyDays,
  appointmentsByDate,
  searchQuery,
  filteredAppointments,
  onToggleCalendar,
  onCloseCalendar,
  onNavigateMonth,
  onDateSelect,
  onSearchChange,
}: {
  canEdit: boolean;
  selectedDate: string;
  showCalendar: boolean;
  calendarMonth: number;
  calendarYear: number;
  todayDate: number;
  currentMonth: number;
  currentYear: number;
  days: number[];
  emptyDays: number[];
  appointmentsByDate: Record<number, number>;
  searchQuery: string;
  filteredAppointments: DockAppointment[];
  onToggleCalendar: () => void;
  onCloseCalendar: () => void;
  onNavigateMonth: (direction: "prev" | "next") => void;
  onDateSelect: (day: number) => void;
  onSearchChange: (value: string) => void;
}) {
  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <div className="flex items-center justify-between mb-4">
          <h2 className="card-title text-xl">Scheduled Appointments</h2>
          <div className="flex gap-2">
            <div className="relative">
              <button className="btn btn-outline btn-sm" onClick={onToggleCalendar}>
                <span className="material-symbols-outlined text-sm">calendar_today</span>
                <span>{formatDate(selectedDate + "T00:00:00Z")}</span>
              </button>
              {showCalendar && (
                <>
                  <div className="fixed inset-0 z-40" onClick={onCloseCalendar}></div>
                  <div className="absolute right-0 mt-2 w-80 rounded-xl bg-base-100 shadow-lg border border-base-200 z-50">
                    <div className="p-4 border-b border-base-200">
                      <div className="flex items-center justify-between mb-2">
                        <button className="btn btn-ghost btn-sm btn-circle" onClick={() => onNavigateMonth("prev")}>
                          <span className="material-symbols-outlined">chevron_left</span>
                        </button>
                        <div className="text-lg font-bold text-base-content">
                          {monthNames[calendarMonth]} {calendarYear}
                        </div>
                        <button className="btn btn-ghost btn-sm btn-circle" onClick={() => onNavigateMonth("next")}>
                          <span className="material-symbols-outlined">chevron_right</span>
                        </button>
                      </div>
                      <div className="text-sm text-base-content/60">
                        {new Date(selectedDate).toLocaleDateString("en-US", {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                        })}
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
                          const isToday = day === todayDate && calendarMonth === currentMonth && calendarYear === currentYear;
                          const hasAppointments = appointmentsByDate[day];
                          const selectedDateObj = new Date(selectedDate);
                          const isSelected =
                            selectedDateObj.getDate() === day &&
                            selectedDateObj.getMonth() === calendarMonth &&
                            selectedDateObj.getFullYear() === calendarYear;

                          return (
                            <button
                              key={day}
                              onClick={() => onDateSelect(day)}
                              className={`
                                aspect-square flex flex-col items-center justify-center text-sm rounded-lg relative
                                ${
                                  isSelected
                                    ? "bg-primary text-primary-content font-bold"
                                    : isToday
                                      ? "bg-primary/20 text-primary font-semibold"
                                      : "hover:bg-base-200 text-base-content"
                                }
                              `}
                            >
                              <span>{day}</span>
                              {hasAppointments && (
                                <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 flex gap-0.5">
                                  {Array.from({ length: Math.min(hasAppointments, 3) }).map((_, i) => (
                                    <div key={i} className="w-1 h-1 rounded-full bg-primary" />
                                  ))}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      <div className="mt-4 pt-4 border-t border-base-200 space-y-2 text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-primary"></div>
                          <span className="text-base-content/70">Appointments</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
            <input
              type="text"
              placeholder="Search appointments..."
              className="input input-bordered input-sm w-64"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        </div>
        <div className="overflow-x-auto overflow-y-auto max-h-96">
          <table className="table table-zebra">
            <thead className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-base-200">
              <tr>
                <th>Appointment #</th>
                <th>Dock Door</th>
                <th>PO Number</th>
                <th>Supplier</th>
                <th>Carrier</th>
                <th>Trailer</th>
                <th>Time</th>
                <th>Status</th>
                {canEdit && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filteredAppointments.map((apt) => (
                <tr key={apt.id}>
                  <td className="font-semibold">{apt.appointmentNumber}</td>
                  <td>{apt.dockDoorNumber}</td>
                  <td>{apt.inboundOrderNumber || "N/A"}</td>
                  <td>{apt.supplierName || "N/A"}</td>
                  <td>{apt.carrierName || "N/A"}</td>
                  <td>{apt.trailerNumber || "N/A"}</td>
                  <td>
                    {formatTime(apt.scheduledStart)} - {formatTime(apt.scheduledEnd)}
                    <br />
                    <span className="text-xs text-base-content/60">{formatDate(apt.scheduledStart)}</span>
                  </td>
                  <td>
                    <span className={`badge ${getStatusColor(apt.status)}`}>
                      {apt.status.charAt(0).toUpperCase() + apt.status.slice(1).replace("_", " ")}
                    </span>
                  </td>
                  {canEdit && (
                    <td>
                      <div className="flex gap-1">
                        <button className="btn btn-xs btn-ghost" title="Edit">
                          <span className="material-symbols-outlined text-sm">edit</span>
                        </button>
                        {apt.status === "scheduled" && (
                          <button className="btn btn-xs btn-ghost text-error" title="Cancel">
                            <span className="material-symbols-outlined text-sm">cancel</span>
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {filteredAppointments.length === 0 && (
            <div className="text-center py-8 text-base-content/60">
              No appointments scheduled for {formatDate(selectedDate + "T00:00:00Z")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
