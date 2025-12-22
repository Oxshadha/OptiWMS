"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { DetailModal } from "@/components/DetailModal";

// Mock data - will be replaced with API calls
const tasks = [
  {
    id: "task-1",
    taskNumber: "TASK-452368",
    taskType: "receiving",
    workerName: "John Doe",
    warehouseName: "Warehouse 1",
    priority: "high",
    status: "in_progress",
    assignedDate: "2025-12-15 08:00",
    startedAt: "2025-12-15 08:15",
    completedAt: null,
    duration: null,
    items: [
      { sku: "SKU-1001", name: "Wireless Earbuds", quantity: 50, location: "A-01-01" },
      { sku: "SKU-1002", name: "Smart Projector", quantity: 10, location: "B-02-03" },
    ],
    instructions: "Handle with care. Check for damage before putaway.",
    relatedOrder: "SO-1001",
  },
  {
    id: "task-2",
    taskNumber: "TASK-452369",
    taskType: "picking",
    workerName: "Jane Smith",
    warehouseName: "Warehouse 1",
    priority: "urgent",
    status: "in_progress",
    assignedDate: "2025-12-15 09:00",
    startedAt: "2025-12-15 09:05",
    completedAt: null,
    duration: null,
    items: [
      { sku: "SKU-1001", name: "Wireless Earbuds", quantity: 2, location: "A-01-01" },
    ],
    instructions: "Priority order. Expedite shipping.",
    relatedOrder: "SO-1002",
  },
];

const taskTypeConfig = {
  receiving: { label: "Receiving", icon: "input", class: "badge-primary" },
  quality_check: { label: "Quality Check", icon: "verified", class: "badge-info" },
  putaway: { label: "Putaway", icon: "move_to_inbox", class: "badge-success" },
  picking: { label: "Picking", icon: "shopping_cart", class: "badge-warning" },
  packing: { label: "Packing", icon: "inventory_2", class: "badge-info" },
  cycle_count: { label: "Cycle Count", icon: "autorenew", class: "badge-accent" },
  returns: { label: "Returns", icon: "keyboard_return", class: "badge-warning" },
  relocation: { label: "Relocation", icon: "swap_horiz", class: "badge-info" },
  shipment: { label: "Shipment", icon: "local_shipping", class: "badge-primary" },
};

const statusConfig = {
  pending: { label: "Pending", class: "badge-outline" },
  assigned: { label: "Assigned", class: "badge-info" },
  in_progress: { label: "In Progress", class: "badge-primary" },
  completed: { label: "Completed", class: "badge-success" },
  cancelled: { label: "Cancelled", class: "badge-error" },
};

const priorityConfig = {
  low: { label: "Low", class: "badge-outline" },
  normal: { label: "Normal", class: "badge-info" },
  high: { label: "High", class: "badge-warning" },
  urgent: { label: "Urgent", class: "badge-error" },
};

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.id as string;
  const task = tasks.find((t) => t.id === taskId);

  if (!task) {
    return (
      <div className="space-y-6">
        <div className="alert alert-error">
          <span>Task not found</span>
          <Link href="/admin/tasks" className="btn btn-sm">
            Back to Tasks
          </Link>
        </div>
      </div>
    );
  }

  const type = taskTypeConfig[task.taskType as keyof typeof taskTypeConfig];
  const status = statusConfig[task.status as keyof typeof statusConfig];
  const priority = priorityConfig[task.priority as keyof typeof priorityConfig];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/tasks" className="text-primary hover:underline mb-2 inline-block">
            ← Back to Tasks
          </Link>
          <h1 className="text-3xl font-bold text-base-content">{task.taskNumber}</h1>
          <p className="text-sm text-base-content/60 mt-1">Task Details</p>
        </div>
      </div>

      {/* Task Information */}
      <div className="card bg-base-100 border border-base-300 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-sm text-base-content/60">Task Number</label>
            <p className="font-semibold text-lg">{task.taskNumber}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Task Type</label>
            <p>
              <span className={`badge ${type.class}`}>
                <span className="material-symbols-outlined text-xs mr-1">
                  {type.icon}
                </span>
                {type.label}
              </span>
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Worker</label>
            <p className="font-semibold">{task.workerName}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Warehouse</label>
            <p className="font-semibold">{task.warehouseName}</p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Priority</label>
            <p>
              <span className={`badge ${priority.class}`}>{priority.label}</span>
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Status</label>
            <p>
              <span className={`badge ${status.class}`}>{status.label}</span>
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Assigned Date</label>
            <p className="font-semibold">{task.assignedDate}</p>
          </div>
          {task.startedAt && (
            <div>
              <label className="text-sm text-base-content/60">Started At</label>
              <p className="font-semibold">{task.startedAt}</p>
            </div>
          )}
          {task.completedAt && (
            <div>
              <label className="text-sm text-base-content/60">Completed At</label>
              <p className="font-semibold">{task.completedAt}</p>
            </div>
          )}
          {task.duration && (
            <div>
              <label className="text-sm text-base-content/60">Duration</label>
              <p className="font-semibold">{task.duration} minutes</p>
            </div>
          )}
          {task.relatedOrder && (
            <div>
              <label className="text-sm text-base-content/60">Related Order</label>
              <Link href={`/admin/orders?search=${task.relatedOrder}`} className="font-semibold text-primary hover:underline">
                {task.relatedOrder}
              </Link>
            </div>
          )}
        </div>

        {task.instructions && (
          <div className="mt-6 pt-6 border-t border-base-300">
            <label className="text-sm text-base-content/60">Instructions</label>
            <p className="mt-2">{task.instructions}</p>
          </div>
        )}

        {/* Items */}
        {task.items && task.items.length > 0 && (
          <div className="mt-6 pt-6 border-t border-base-300">
            <h3 className="font-semibold mb-4">Items</h3>
            <div className="overflow-x-auto">
              <table className="table table-zebra w-full">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Name</th>
                    <th>Quantity</th>
                    <th>Location</th>
                  </tr>
                </thead>
                <tbody>
                  {task.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="font-mono">{item.sku}</td>
                      <td>{item.name}</td>
                      <td>{item.quantity}</td>
                      <td className="font-mono">{item.location}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Link href="/admin/tasks">
          <button className="btn btn-ghost">Back to Tasks</button>
        </Link>
        {task.status === "pending" && (
          <button className="btn btn-primary">
            <span className="material-symbols-outlined">person_add</span>
            Reassign Worker
          </button>
        )}
        {task.status === "in_progress" && (
          <button className="btn btn-error">
            <span className="material-symbols-outlined">cancel</span>
            Cancel Task
          </button>
        )}
      </div>
    </div>
  );
}

