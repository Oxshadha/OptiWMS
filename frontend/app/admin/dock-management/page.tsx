"use client";

import { useState, useEffect } from "react";
import { useAdmin } from "@/contexts/AdminContext";
import { ADMIN_ROUTES } from "@/lib/admin-roles";
import {
  dockManagementApi,
  DockDoor,
  DockAppointment,
  YardTrailer,
} from "@/lib/api/operations";
import { Modal } from "@/components/Modal";
import { SummaryCards } from "@/components/SummaryCards";

export default function DockManagementPage() {
  const { hasPermission, role } = useAdmin();
  const canCreate = hasPermission(ADMIN_ROUTES.DOCK_MANAGEMENT, "create");
  const canEdit = hasPermission(ADMIN_ROUTES.DOCK_MANAGEMENT, "edit");

  const [dockDoors, setDockDoors] = useState<DockDoor[]>([]);
  const [appointments, setAppointments] = useState<DockAppointment[]>([]);
  const [yardTrailers, setYardTrailers] = useState<YardTrailer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());

  // Appointment form state
  const [appointmentForm, setAppointmentForm] = useState({
    dockDoorId: "",
    inboundOrderId: "",
    inboundOrderNumber: "",
    supplierName: "",
    carrierName: "",
    trailerNumber: "",
    scheduledStart: "",
    scheduledEnd: "",
    notes: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [doorsData, appointmentsData, trailersData] = await Promise.all([
          dockManagementApi.getDockDoors(),
          dockManagementApi.getDockAppointments(),
          dockManagementApi.getYardTrailers(),
        ]);
        setDockDoors(doorsData);
        // Enrich appointments with door numbers
        const enrichedAppointments = appointmentsData.map(apt => ({
          ...apt,
          dockDoorNumber: apt.dockDoorId ? doorsData.find(d => d.id === apt.dockDoorId)?.doorNumber : undefined,
        }));
        setAppointments(enrichedAppointments);
        // Enrich trailers with door numbers
        const enrichedTrailers = trailersData.map(trailer => ({
          ...trailer,
          assignedDockDoorNumber: trailer.assignedDockDoorId ? doorsData.find(d => d.id === trailer.assignedDockDoorId)?.doorNumber : undefined,
        }));
        setYardTrailers(enrichedTrailers);
      } catch (err) {
        console.error("Failed to fetch dock management data:", err);
        setError(err instanceof Error ? err.message : "Failed to load dock management data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const summary = {
    totalDockDoors: dockDoors.length,
    availableDoors: dockDoors.filter((d) => d.status === "available").length,
    occupiedDoors: dockDoors.filter((d) => d.status === "occupied").length,
    waitingTrailers: yardTrailers.filter((t) => t.status === "waiting").length,
    scheduledToday: appointments.filter((a) => {
      const date = new Date(a.scheduledStart).toISOString().split("T")[0];
      return date === selectedDate && a.status !== "cancelled";
    }).length,
  };

  const filteredAppointments = appointments.filter((apt) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      apt.appointmentNumber.toLowerCase().includes(query) ||
      apt.inboundOrderNumber?.toLowerCase().includes(query) ||
      apt.supplierName?.toLowerCase().includes(query) ||
      apt.carrierName?.toLowerCase().includes(query) ||
      apt.trailerNumber?.toLowerCase().includes(query) ||
      apt.dockDoorNumber?.toLowerCase().includes(query);
    const date = new Date(apt.scheduledStart).toISOString().split("T")[0];
    const matchesDate = date === selectedDate;
    return matchesSearch && matchesDate;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-error">
        <span className="material-symbols-outlined">error</span>
        <span>Error loading dock management data: {error}</span>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "available":
        return "badge-success";
      case "occupied":
        return "badge-error";
      case "reserved":
        return "badge-warning";
      case "maintenance":
        return "badge-error";
      case "scheduled":
        return "badge-info";
      case "in_progress":
        return "badge-primary";
      case "completed":
        return "badge-success";
      case "waiting":
        return "badge-warning";
      case "assigned":
        return "badge-info";
      default:
        return "badge-outline";
    }
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  // Calendar helper functions (matching Topbar style)
  const getDaysInMonth = (month: number, year: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month: number, year: number) => {
    return new Date(year, month, 1).getDay();
  };

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

  const today = new Date();
  const todayDate = today.getDate();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  const daysInMonth = getDaysInMonth(calendarMonth, calendarYear);
  const firstDay = getFirstDayOfMonth(calendarMonth, calendarYear);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const emptyDays = Array.from({ length: firstDay }, (_, i) => i);

  // Get appointments count per day for calendar indicators
  const appointmentsByDate: Record<number, number> = {};
  appointments.forEach((apt) => {
    const aptDate = new Date(apt.scheduledStart);
    if (
      aptDate.getMonth() === calendarMonth &&
      aptDate.getFullYear() === calendarYear
    ) {
      const day = aptDate.getDate();
      appointmentsByDate[day] = (appointmentsByDate[day] || 0) + 1;
    }
  });

  const handleDateSelect = (day: number) => {
    const selected = new Date(calendarYear, calendarMonth, day);
    setSelectedDate(selected.toISOString().split("T")[0]);
    setShowCalendar(false);
  };

  const navigateMonth = (direction: "prev" | "next") => {
    if (direction === "prev") {
      if (calendarMonth === 0) {
        setCalendarMonth(11);
        setCalendarYear(calendarYear - 1);
      } else {
        setCalendarMonth(calendarMonth - 1);
      }
    } else {
      if (calendarMonth === 11) {
        setCalendarMonth(0);
        setCalendarYear(calendarYear + 1);
      } else {
        setCalendarMonth(calendarMonth + 1);
      }
    }
  };

  // Reset form when modal opens/closes
  const handleOpenModal = () => {
    const now = new Date();
    const startTime = new Date(now);
    startTime.setHours(now.getHours() + 1, 0, 0, 0);
    const endTime = new Date(startTime);
    endTime.setHours(startTime.getHours() + 2);

    setAppointmentForm({
      dockDoorId: "",
      inboundOrderId: "",
      inboundOrderNumber: "",
      supplierName: "",
      carrierName: "",
      trailerNumber: "",
      scheduledStart: startTime.toISOString().slice(0, 16),
      scheduledEnd: endTime.toISOString().slice(0, 16),
      notes: "",
    });
    setFormErrors({});
    setShowAppointmentModal(true);
  };

  const handleCloseModal = () => {
    setShowAppointmentModal(false);
    setFormErrors({});
  };

  // Handle inbound order selection
  const handleInboundOrderSelect = (orderId: string) => {
    // TODO: Fetch order details from API
    // For now, just set the order ID
    setAppointmentForm((prev) => ({
      ...prev,
      inboundOrderId: orderId,
    }));
  };

  // Validate form
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!appointmentForm.dockDoorId) {
      errors.dockDoorId = "Dock door is required";
    }

    if (!appointmentForm.scheduledStart) {
      errors.scheduledStart = "Start time is required";
    }

    if (!appointmentForm.scheduledEnd) {
      errors.scheduledEnd = "End time is required";
    }

    if (appointmentForm.scheduledStart && appointmentForm.scheduledEnd) {
      const start = new Date(appointmentForm.scheduledStart);
      const end = new Date(appointmentForm.scheduledEnd);
      if (end <= start) {
        errors.scheduledEnd = "End time must be after start time";
      }
    }

    // Check for conflicts
    if (
      appointmentForm.dockDoorId &&
      appointmentForm.scheduledStart &&
      appointmentForm.scheduledEnd
    ) {
      const start = new Date(appointmentForm.scheduledStart);
      const end = new Date(appointmentForm.scheduledEnd);
      const hasConflict = appointments.some((apt) => {
        if (
          apt.dockDoorId !== appointmentForm.dockDoorId ||
          apt.status === "cancelled"
        ) {
          return false;
        }
        const aptStart = new Date(apt.scheduledStart);
        const aptEnd = new Date(apt.scheduledEnd);
        return start < aptEnd && end > aptStart;
      });

      if (hasConflict) {
        errors.dockDoorId = "This dock door is already booked during this time";
      }
    }

    if (!appointmentForm.carrierName.trim()) {
      errors.carrierName = "Carrier name is required";
    }

    if (!appointmentForm.trailerNumber.trim()) {
      errors.trailerNumber = "Trailer number is required";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form submission
  const handleSubmitAppointment = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const selectedDoor = dockDoors.find(
        (d) => d.id === appointmentForm.dockDoorId
      );
      if (!selectedDoor) {
        throw new Error("Selected dock door not found");
      }

      // Create appointment request
      const appointmentRequest = {
        dockDoorId: appointmentForm.dockDoorId || undefined,
        warehouseId: selectedDoor.warehouseId,
        appointmentType: appointmentForm.inboundOrderId ? "inbound" : "outbound",
        scheduledStart: new Date(appointmentForm.scheduledStart).toISOString(),
        scheduledEnd: new Date(appointmentForm.scheduledEnd).toISOString(),
        inboundOrderId: appointmentForm.inboundOrderId || undefined,
        outboundOrderId: undefined,
        supplierId: undefined, // TODO: Get from order if available
        carrierName: appointmentForm.carrierName,
        trailerNumber: appointmentForm.trailerNumber,
        notes: appointmentForm.notes || undefined,
      };

      // Call API
      try {
        const created = await dockManagementApi.createDockAppointment(
          appointmentRequest
        );
        // Enrich with door number
        const enrichedAppointment = {
          ...created,
          dockDoorNumber: selectedDoor.doorNumber,
          inboundOrderNumber: appointmentForm.inboundOrderNumber,
          supplierName: appointmentForm.supplierName,
        };
        setAppointments((prev) => [...prev, enrichedAppointment]);

        // Update dock door status
        setDockDoors((prev) =>
          prev.map((door) =>
            door.id === appointmentForm.dockDoorId
              ? {
                  ...door,
                  status: "reserved" as const,
                  currentAppointmentId: created.id,
                }
              : door
          )
        );
      } catch (error) {
        console.error("Failed to create appointment:", error);
        alert("Failed to create appointment. Please try again.");
        return;
      }

      handleCloseModal();
    } catch (error) {
      console.error("Error creating appointment:", error);
      setFormErrors({
        submit: "Failed to create appointment. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-base-content">
            Dock Management
          </h1>
          <p className="text-sm text-base-content/60 mt-1">
            Manage dock doors, schedule appointments, and track yard trailers
          </p>
        </div>
        {canCreate && (
          <button className="btn btn-sm btn-primary" onClick={handleOpenModal}>
            <span className="material-symbols-outlined">add</span>
            <span>Schedule Appointment</span>
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <SummaryCards
        cards={[
          {
            label: "Total Dock Doors",
            value: summary.totalDockDoors.toString(),
            icon: "warehouse",
          },
          {
            label: "Available Doors",
            value: summary.availableDoors.toString(),
            icon: "check_circle",
            color: "success",
          },
          {
            label: "Occupied Doors",
            value: summary.occupiedDoors.toString(),
            icon: "block",
            color: "error",
          },
          {
            label: "Waiting Trailers",
            value: summary.waitingTrailers.toString(),
            icon: "local_shipping",
            color: "warning",
          },
          {
            label: "Scheduled Today",
            value: summary.scheduledToday.toString(),
            icon: "event",
            color: "info",
          },
        ]}
      />

      {/* Dock Doors Status */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title text-xl">Dock Door Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {dockDoors.map((door) => {
              const appointment = appointments.find(
                (apt) => apt.id === door.currentAppointmentId
              );
              return (
                <div
                  key={door.id}
                  className="border border-base-300 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-bold text-lg">{door.doorNumber}</h3>
                    <span className={`badge ${getStatusColor(door.status)}`}>
                      {door.status.charAt(0).toUpperCase() +
                        door.status.slice(1).replace("_", " ")}
                    </span>
                  </div>
                  {door.location && (
                    <p className="text-sm text-base-content/60 mb-2">
                      {door.location}
                    </p>
                  )}
                  {appointment && (
                    <div className="mt-2 pt-2 border-t border-base-300">
                      <p className="text-xs text-base-content/60">
                        Current Appointment:
                      </p>
                      <p className="text-sm font-semibold">
                        {appointment.appointmentNumber}
                      </p>
                      <p className="text-xs text-base-content/60">
                        {appointment.supplierName} - {appointment.trailerNumber}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Yard Trailer Queue */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h2 className="card-title text-xl">Yard Trailer Queue</h2>
          <div className="overflow-x-auto mt-4">
            <table className="table table-zebra">
              <thead>
                <tr>
                  <th>Trailer Number</th>
                  <th>Carrier</th>
                  <th>PO Number</th>
                  <th>Supplier</th>
                  <th>Arrived</th>
                  <th>Wait Time</th>
                  <th>Status</th>
                  <th>Assigned Dock</th>
                </tr>
              </thead>
              <tbody>
                {yardTrailers.map((trailer) => (
                  <tr key={trailer.id}>
                    <td className="font-semibold">{trailer.trailerNumber}</td>
                    <td>{trailer.carrierName}</td>
                    <td>{trailer.inboundOrderNumber || "N/A"}</td>
                    <td>{trailer.supplierName || "N/A"}</td>
                    <td>{formatTime(trailer.arrivedAt)}</td>
                    <td>
                      <span
                        className={
                          trailer.waitTimeMinutes > 60
                            ? "text-error font-semibold"
                            : ""
                        }
                      >
                        {trailer.waitTimeMinutes} min
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${getStatusColor(trailer.status)}`}
                      >
                        {trailer.status.charAt(0).toUpperCase() +
                          trailer.status.slice(1)}
                      </span>
                    </td>
                    <td>{trailer.assignedDockDoorNumber || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Appointments Calendar */}
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <div className="flex items-center justify-between mb-4">
            <h2 className="card-title text-xl">Scheduled Appointments</h2>
            <div className="flex gap-2">
              {/* Calendar Picker (Topbar Style) */}
              <div className="relative">
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => setShowCalendar(!showCalendar)}
                >
                  <span className="material-symbols-outlined text-sm">
                    calendar_today
                  </span>
                  <span>{formatDate(selectedDate + "T00:00:00Z")}</span>
                </button>
                {showCalendar && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowCalendar(false)}
                    ></div>
                    <div className="absolute right-0 mt-2 w-80 rounded-xl bg-base-100 shadow-lg border border-base-200 z-50">
                      <div className="p-4 border-b border-base-200">
                        <div className="flex items-center justify-between mb-2">
                          <button
                            className="btn btn-ghost btn-sm btn-circle"
                            onClick={() => navigateMonth("prev")}
                          >
                            <span className="material-symbols-outlined">
                              chevron_left
                            </span>
                          </button>
                          <div className="text-lg font-bold text-base-content">
                            {monthNames[calendarMonth]} {calendarYear}
                          </div>
                          <button
                            className="btn btn-ghost btn-sm btn-circle"
                            onClick={() => navigateMonth("next")}
                          >
                            <span className="material-symbols-outlined">
                              chevron_right
                            </span>
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
                          {[
                            "Sun",
                            "Mon",
                            "Tue",
                            "Wed",
                            "Thu",
                            "Fri",
                            "Sat",
                          ].map((day) => (
                            <div
                              key={day}
                              className="text-center text-xs font-semibold text-base-content/60 py-1"
                            >
                              {day}
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-7 gap-1">
                          {emptyDays.map((_, idx) => (
                            <div
                              key={`empty-${idx}`}
                              className="aspect-square"
                            ></div>
                          ))}
                          {days.map((day) => {
                            const isToday =
                              day === todayDate &&
                              calendarMonth === currentMonth &&
                              calendarYear === currentYear;
                            const hasAppointments = appointmentsByDate[day];
                            const isSelected =
                              new Date(selectedDate).getDate() === day &&
                              new Date(selectedDate).getMonth() ===
                                calendarMonth &&
                              new Date(selectedDate).getFullYear() ===
                                calendarYear;
                            return (
                              <button
                                key={day}
                                onClick={() => handleDateSelect(day)}
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
                                    {Array.from({
                                      length: Math.min(hasAppointments, 3),
                                    }).map((_, i) => (
                                      <div
                                        key={i}
                                        className="w-1 h-1 rounded-full bg-primary"
                                      />
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
                            <span className="text-base-content/70">
                              Appointments
                            </span>
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
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="table table-zebra">
              <thead>
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
                      {formatTime(apt.scheduledStart)} -{" "}
                      {formatTime(apt.scheduledEnd)}
                      <br />
                      <span className="text-xs text-base-content/60">
                        {formatDate(apt.scheduledStart)}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${getStatusColor(apt.status)}`}>
                        {apt.status.charAt(0).toUpperCase() +
                          apt.status.slice(1).replace("_", " ")}
                      </span>
                    </td>
                    {canEdit && (
                      <td>
                        <div className="flex gap-1">
                          <button className="btn btn-xs btn-ghost" title="Edit">
                            <span className="material-symbols-outlined text-sm">
                              edit
                            </span>
                          </button>
                          {apt.status === "scheduled" && (
                            <button
                              className="btn btn-xs btn-ghost text-error"
                              title="Cancel"
                            >
                              <span className="material-symbols-outlined text-sm">
                                cancel
                              </span>
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
                No appointments scheduled for{" "}
                {formatDate(selectedDate + "T00:00:00Z")}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Schedule Appointment Modal */}
      {showAppointmentModal && (
        <Modal
          isOpen={showAppointmentModal}
          onClose={handleCloseModal}
          title="Schedule Dock Appointment"
          size="lg"
        >
          <div className="space-y-4">
            {formErrors.submit && (
              <div className="alert alert-error">
                <span className="material-symbols-outlined">error</span>
                <span>{formErrors.submit}</span>
              </div>
            )}

            {/* Dock Door Selection */}
            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">
                  Dock Door <span className="text-error">*</span>
                </span>
              </label>
              <select
                className={`select select-bordered w-full ${
                  formErrors.dockDoorId ? "select-error" : ""
                }`}
                value={appointmentForm.dockDoorId}
                onChange={(e) =>
                  setAppointmentForm((prev) => ({
                    ...prev,
                    dockDoorId: e.target.value,
                  }))
                }
              >
                <option value="">Select a dock door</option>
                {dockDoors
                  .filter(
                    (door) =>
                      door.status === "available" || door.status === "reserved"
                  )
                  .map((door) => (
                    <option key={door.id} value={door.id}>
                      {door.doorNumber}{" "}
                      {door.location ? `(${door.location})` : ""} -{" "}
                      {door.status}
                    </option>
                  ))}
              </select>
              {formErrors.dockDoorId && (
                <label className="label">
                  <span className="label-text-alt text-error">
                    {formErrors.dockDoorId}
                  </span>
                </label>
              )}
            </div>

            {/* Inbound Order Selection (Optional) */}
            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">
                  Inbound Order (Optional)
                </span>
              </label>
              <select
                className="select select-bordered w-full"
                value={appointmentForm.inboundOrderId}
                onChange={(e) => handleInboundOrderSelect(e.target.value)}
              >
                <option value="">No order linked</option>
                {mockInboundOrders
                  .filter(
                    (order) =>
                      order.status === "in_transit" ||
                      order.status === "arrived"
                  )
                  .map((order) => (
                    <option key={order.id} value={order.id}>
                      {order.orderNumber} - {order.supplierName}
                    </option>
                  ))}
              </select>
              <label className="label">
                <span className="label-text-alt">
                  Linking an order will auto-fill supplier information
                </span>
              </label>
            </div>

            {/* Supplier Name */}
            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">Supplier Name</span>
              </label>
              <input
                type="text"
                className="input input-bordered w-full"
                placeholder="Enter supplier name"
                value={appointmentForm.supplierName}
                onChange={(e) =>
                  setAppointmentForm((prev) => ({
                    ...prev,
                    supplierName: e.target.value,
                  }))
                }
              />
            </div>

            {/* Carrier Name */}
            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">
                  Carrier Name <span className="text-error">*</span>
                </span>
              </label>
              <input
                type="text"
                className={`input input-bordered w-full ${
                  formErrors.carrierName ? "input-error" : ""
                }`}
                placeholder="Enter carrier name"
                value={appointmentForm.carrierName}
                onChange={(e) =>
                  setAppointmentForm((prev) => ({
                    ...prev,
                    carrierName: e.target.value,
                  }))
                }
              />
              {formErrors.carrierName && (
                <label className="label">
                  <span className="label-text-alt text-error">
                    {formErrors.carrierName}
                  </span>
                </label>
              )}
            </div>

            {/* Trailer Number */}
            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">
                  Trailer Number <span className="text-error">*</span>
                </span>
              </label>
              <input
                type="text"
                className={`input input-bordered w-full ${
                  formErrors.trailerNumber ? "input-error" : ""
                }`}
                placeholder="Enter trailer number"
                value={appointmentForm.trailerNumber}
                onChange={(e) =>
                  setAppointmentForm((prev) => ({
                    ...prev,
                    trailerNumber: e.target.value,
                  }))
                }
              />
              {formErrors.trailerNumber && (
                <label className="label">
                  <span className="label-text-alt text-error">
                    {formErrors.trailerNumber}
                  </span>
                </label>
              )}
            </div>

            {/* Scheduled Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">
                    Scheduled Start <span className="text-error">*</span>
                  </span>
                </label>
                <input
                  type="datetime-local"
                  className={`input input-bordered w-full ${
                    formErrors.scheduledStart ? "input-error" : ""
                  }`}
                  value={appointmentForm.scheduledStart}
                  onChange={(e) =>
                    setAppointmentForm((prev) => ({
                      ...prev,
                      scheduledStart: e.target.value,
                    }))
                  }
                />
                {formErrors.scheduledStart && (
                  <label className="label">
                    <span className="label-text-alt text-error">
                      {formErrors.scheduledStart}
                    </span>
                  </label>
                )}
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">
                    Scheduled End <span className="text-error">*</span>
                  </span>
                </label>
                <input
                  type="datetime-local"
                  className={`input input-bordered w-full ${
                    formErrors.scheduledEnd ? "input-error" : ""
                  }`}
                  value={appointmentForm.scheduledEnd}
                  onChange={(e) =>
                    setAppointmentForm((prev) => ({
                      ...prev,
                      scheduledEnd: e.target.value,
                    }))
                  }
                />
                {formErrors.scheduledEnd && (
                  <label className="label">
                    <span className="label-text-alt text-error">
                      {formErrors.scheduledEnd}
                    </span>
                  </label>
                )}
              </div>
            </div>

            {/* Notes */}
            <div className="form-control">
              <label className="label">
                <span className="label-text font-semibold">
                  Notes (Optional)
                </span>
              </label>
              <textarea
                className="textarea textarea-bordered w-full"
                placeholder="Add any additional notes or special instructions"
                rows={3}
                value={appointmentForm.notes}
                onChange={(e) =>
                  setAppointmentForm((prev) => ({
                    ...prev,
                    notes: e.target.value,
                  }))
                }
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-4 border-t border-base-300">
              <button
                className="btn btn-ghost"
                onClick={handleCloseModal}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSubmitAppointment}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    Scheduling...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined">schedule</span>
                    Schedule Appointment
                  </>
                )}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
