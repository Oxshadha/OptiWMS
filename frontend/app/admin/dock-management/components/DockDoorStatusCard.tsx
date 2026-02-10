"use client";

import { DockAppointment, DockDoor } from "@/lib/api/operations";
import { getStatusColor } from "../utils";

export function DockDoorStatusCard({
  dockDoors,
  appointments,
}: {
  dockDoors: DockDoor[];
  appointments: DockAppointment[];
}) {
  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title text-xl">Dock Door Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {dockDoors.map((door) => {
            const appointment = appointments.find((apt) => apt.id === door.currentAppointmentId);
            return (
              <div
                key={door.id}
                className="border border-base-300 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-lg">{door.doorNumber}</h3>
                  <span className={`badge ${getStatusColor(door.status)}`}>
                    {door.status.charAt(0).toUpperCase() + door.status.slice(1).replace("_", " ")}
                  </span>
                </div>
                {door.location && <p className="text-sm text-base-content/60 mb-2">{door.location}</p>}
                {appointment && (
                  <div className="mt-2 pt-2 border-t border-base-300">
                    <p className="text-xs text-base-content/60">Current Appointment:</p>
                    <p className="text-sm font-semibold">{appointment.appointmentNumber}</p>
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
  );
}
