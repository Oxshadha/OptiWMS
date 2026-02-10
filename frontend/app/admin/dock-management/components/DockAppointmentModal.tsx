"use client";

import { Modal } from "@/components/Modal";
import { DockAppointment, DockDoor, YardTrailer } from "@/lib/api/operations";

interface InboundOrderOption {
  id: string;
  orderNumber: string;
  supplierName: string;
}

interface AppointmentFormState {
  dockDoorId: string;
  inboundOrderId: string;
  inboundOrderNumber: string;
  supplierName: string;
  carrierName: string;
  trailerNumber: string;
  scheduledStart: string;
  scheduledEnd: string;
  notes: string;
}

export function DockAppointmentModal({
  isOpen,
  onClose,
  dockDoors,
  inboundOrderOptions,
  appointmentForm,
  setAppointmentForm,
  formErrors,
  isSubmitting,
  onInboundOrderSelect,
  onSubmit,
}: {
  isOpen: boolean;
  onClose: () => void;
  dockDoors: DockDoor[];
  inboundOrderOptions: InboundOrderOption[];
  appointmentForm: AppointmentFormState;
  setAppointmentForm: React.Dispatch<React.SetStateAction<AppointmentFormState>>;
  formErrors: Record<string, string>;
  isSubmitting: boolean;
  onInboundOrderSelect: (orderId: string) => void;
  onSubmit: () => void;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Schedule Dock Appointment" size="lg">
      <div className="space-y-4">
        {formErrors.submit && (
          <div className="alert alert-error">
            <span className="material-symbols-outlined">error</span>
            <span>{formErrors.submit}</span>
          </div>
        )}

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
              .filter((door) => door.status === "available" || door.status === "reserved")
              .map((door) => (
                <option key={door.id} value={door.id}>
                  {door.doorNumber} {door.location ? `(${door.location})` : ""} - {door.status}
                </option>
              ))}
          </select>
          {formErrors.dockDoorId && (
            <label className="label">
              <span className="label-text-alt text-error">{formErrors.dockDoorId}</span>
            </label>
          )}
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-semibold">Inbound Order (Optional)</span>
          </label>
          <select
            className="select select-bordered w-full"
            value={appointmentForm.inboundOrderId}
            onChange={(e) => onInboundOrderSelect(e.target.value)}
          >
            <option value="">No order linked</option>
            {inboundOrderOptions.map((order) => (
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
              <span className="label-text-alt text-error">{formErrors.carrierName}</span>
            </label>
          )}
        </div>

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
              <span className="label-text-alt text-error">{formErrors.trailerNumber}</span>
            </label>
          )}
        </div>

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
                <span className="label-text-alt text-error">{formErrors.scheduledStart}</span>
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
                <span className="label-text-alt text-error">{formErrors.scheduledEnd}</span>
              </label>
            )}
          </div>
        </div>

        <div className="form-control">
          <label className="label">
            <span className="label-text font-semibold">Notes (Optional)</span>
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

        <div className="flex justify-end gap-2 pt-4 border-t border-base-300">
          <button className="btn btn-ghost" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={onSubmit} disabled={isSubmitting}>
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
  );
}
