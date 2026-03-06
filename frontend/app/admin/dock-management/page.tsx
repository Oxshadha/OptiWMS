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
import { ordersApi } from "@/lib/api/orders";
import { suppliersApi } from "@/lib/api/suppliers";
import { SummaryCards } from "@/components/SummaryCards";
import { logger } from "@/lib/utils/logger";
import { showToast } from "@/lib/utils/toast";
import { DockAppointmentModal } from "./components/DockAppointmentModal";
import { DockDoorStatusCard } from "./components/DockDoorStatusCard";
import { YardTrailerQueueCard } from "./components/YardTrailerQueueCard";
import { AppointmentsCard } from "./components/AppointmentsCard";
import { getDaysInMonth, getFirstDayOfMonth } from "./utils";

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
        logger.error("Failed to fetch dock management data:", err);
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

  const inboundOrderOptions = Array.from(
    new Map(
      [
        ...appointments
          .filter((apt) => apt.inboundOrderId && apt.inboundOrderNumber)
          .map((apt) => ({
            id: apt.inboundOrderId as string,
            orderNumber: apt.inboundOrderNumber as string,
            supplierName: apt.supplierName || "Unknown Supplier",
          })),
        ...yardTrailers
          .filter((trailer) => trailer.inboundOrderId && trailer.inboundOrderNumber)
          .map((trailer) => ({
            id: trailer.inboundOrderId as string,
            orderNumber: trailer.inboundOrderNumber as string,
            supplierName: trailer.supplierName || "Unknown Supplier",
          })),
      ].map((order) => [order.id, order])
    ).values()
  );

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
    if (!orderId) {
      setAppointmentForm((prev) => ({
        ...prev,
        inboundOrderId: "",
        inboundOrderNumber: "",
        supplierName: "",
      }));
      return;
    }

    const fallback = inboundOrderOptions.find((o) => o.id === orderId);
    setAppointmentForm((prev) => ({
      ...prev,
      inboundOrderId: orderId,
      inboundOrderNumber: fallback?.orderNumber || prev.inboundOrderNumber,
      supplierName: fallback?.supplierName || prev.supplierName,
    }));

    void (async () => {
      try {
        const order = await ordersApi.getById(orderId);
        let supplierName = fallback?.supplierName || "";
        if (order.supplierId) {
          try {
            const supplier = await suppliersApi.getById(order.supplierId);
            supplierName = supplier.name || supplierName;
          } catch {
            // Keep fallback supplier name.
          }
        }
        setAppointmentForm((prev) => ({
          ...prev,
          inboundOrderId: orderId,
          inboundOrderNumber: order.orderNumber || prev.inboundOrderNumber,
          supplierName: supplierName || prev.supplierName,
        }));
      } catch (error) {
        logger.error("Failed to load inbound order details:", error);
        showToast.error("Failed to load selected order details");
      }
    })();
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
      let supplierId: string | undefined = undefined;
      if (appointmentForm.inboundOrderId) {
        try {
          const linkedOrder = await ordersApi.getById(appointmentForm.inboundOrderId);
          supplierId = linkedOrder.supplierId || undefined;
        } catch {
          // Keep supplierId undefined if order lookup fails.
        }
      }
      const appointmentRequest = {
        dockDoorId: appointmentForm.dockDoorId || undefined,
        warehouseId: selectedDoor.warehouseId,
        appointmentType: appointmentForm.inboundOrderId ? "inbound" : "outbound",
        scheduledStart: new Date(appointmentForm.scheduledStart).toISOString(),
        scheduledEnd: new Date(appointmentForm.scheduledEnd).toISOString(),
        inboundOrderId: appointmentForm.inboundOrderId || undefined,
        outboundOrderId: undefined,
        supplierId,
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
        logger.error("Failed to create appointment:", error);
        alert("Failed to create appointment. Please try again.");
        return;
      }

      handleCloseModal();
    } catch (error) {
      logger.error("Error creating appointment:", error);
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

      <DockDoorStatusCard dockDoors={dockDoors} appointments={appointments} />

      <YardTrailerQueueCard yardTrailers={yardTrailers} />

      <AppointmentsCard
        canEdit={canEdit}
        selectedDate={selectedDate}
        showCalendar={showCalendar}
        calendarMonth={calendarMonth}
        calendarYear={calendarYear}
        todayDate={todayDate}
        currentMonth={currentMonth}
        currentYear={currentYear}
        days={days}
        emptyDays={emptyDays}
        appointmentsByDate={appointmentsByDate}
        searchQuery={searchQuery}
        filteredAppointments={filteredAppointments}
        onToggleCalendar={() => setShowCalendar(!showCalendar)}
        onCloseCalendar={() => setShowCalendar(false)}
        onNavigateMonth={navigateMonth}
        onDateSelect={handleDateSelect}
        onSearchChange={setSearchQuery}
      />

      {/* Schedule Appointment Modal */}
      {showAppointmentModal && (
        <DockAppointmentModal
          isOpen={showAppointmentModal}
          onClose={handleCloseModal}
          dockDoors={dockDoors}
          inboundOrderOptions={inboundOrderOptions}
          appointmentForm={appointmentForm}
          setAppointmentForm={setAppointmentForm}
          formErrors={formErrors}
          isSubmitting={isSubmitting}
          onInboundOrderSelect={handleInboundOrderSelect}
          onSubmit={handleSubmitAppointment}
        />
      )}
    </div>
  );
}
