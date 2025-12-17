"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

const taskDetails: Record<string, any> = {
  "1": {
    id: 1,
    title: "Receiving",
    detail: "PO/ASN 452368",
    type: "info",
    icon: "inventory_2",
    priority: "high",
    dueTime: "2:00 PM",
    status: "in_progress",
    items: [
      { sku: "WB-1001", name: "Wireless Earbuds", expected: 50, received: 0 },
    ],
  },
  "2": {
    id: 2,
    title: "Putaway",
    detail: "Stage -> Aisle A",
    type: "primary",
    icon: "move_to_inbox",
    priority: "medium",
    dueTime: "3:30 PM",
    status: "pending",
    lpn: "LPN-123",
    fromLocation: "Stage Area",
    toLocation: "Aisle A / Bin A5",
    item: "Wireless Earbuds",
    qty: 50,
  },
  "3": {
    id: 3,
    title: "Picking",
    detail: "Order #56281",
    type: "accent",
    icon: "shopping_cart",
    priority: "high",
    dueTime: "4:00 PM",
    status: "pending",
    order: "#56281",
    location: "B3",
    item: "Smart Projector",
    sku: "SKU-1002",
    qty: 2,
  },
};

const priorityColors = {
  high: "bg-error/10 text-error border-error/20",
  medium: "bg-warning/10 text-warning border-warning/20",
  low: "bg-info/10 text-info border-info/20",
};

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = params.id as string;
  const task = taskDetails[taskId];

  const [receivedQty, setReceivedQty] = useState(0);
  const [pickedQty, setPickedQty] = useState(0);
  const [scannedLPN, setScannedLPN] = useState("");
  const [scannedLocation, setScannedLocation] = useState("");

  if (!task) {
    return (
      <div className="p-4 text-center">
        <span className="material-symbols-outlined text-6xl text-base-content/30 mb-4">error</span>
        <h3 className="font-semibold text-base-content mb-2">Task not found</h3>
        <button onClick={() => router.back()} className="btn btn-primary">
          Go Back
        </button>
      </div>
    );
  }

  const handleStart = () => {
    // Handle task start
    console.log("Task started:", task.id);
  };

  const handleComplete = () => {
    // Handle task completion
    console.log("Task completed:", task.id);
    router.push("/worker/tasks");
  };

  return (
    <div className="p-4 space-y-4">
      {/* Task Header */}
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 bg-${task.type}/10 rounded-xl flex items-center justify-center`}>
              <span className={`material-symbols-outlined text-${task.type} text-xl`}>
                {task.icon}
              </span>
            </div>
            <div>
              <h2 className="font-bold text-lg text-base-content">{task.title}</h2>
              <p className="text-sm text-base-content/60">{task.detail}</p>
            </div>
          </div>
          <span className={`px-2 py-1 rounded-full text-xs font-medium border ${priorityColors[task.priority as keyof typeof priorityColors]}`}>
            {task.priority}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-base-content/60">
          <span className="material-symbols-outlined text-sm">schedule</span>
          <span>Due: {task.dueTime}</span>
        </div>
      </div>

      {/* Receiving Task Content */}
      {task.title === "Receiving" && task.items && (
        <div className="space-y-4">
          {task.items.map((item: any, idx: number) => (
            <div key={idx} className="bg-base-100 rounded-xl p-4 border border-base-300">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="font-bold text-base-content mb-1">{item.name}</div>
                  <div className="text-sm text-base-content/60">SKU: {item.sku}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-base-content/60">Expected</div>
                  <div className="font-bold text-base-content">{item.expected}</div>
                </div>
              </div>
              <div className="bg-base-200 rounded-lg p-3">
                <div className="text-sm text-base-content/60 mb-2">Received Quantity</div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setReceivedQty(Math.max(0, receivedQty - 1))}
                    className="btn btn-circle btn-outline btn-sm"
                  >
                    <span className="material-symbols-outlined">remove</span>
                  </button>
                  <input
                    type="number"
                    className="input input-bordered flex-1 text-center text-xl font-bold"
                    value={receivedQty}
                    onChange={(e) => setReceivedQty(Math.max(0, parseInt(e.target.value) || 0))}
                    min="0"
                  />
                  <button
                    onClick={() => setReceivedQty(receivedQty + 1)}
                    className="btn btn-circle btn-outline btn-sm"
                  >
                    <span className="material-symbols-outlined">add</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Putaway Task Content */}
      {task.title === "Putaway" && (
        <div className="space-y-4">
          <div className="bg-base-100 rounded-xl p-4 border border-base-300">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-base-200 rounded-lg">
                <span className="text-sm text-base-content/60">LPN</span>
                <span className="font-semibold text-base-content">{task.lpn}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-base-200 rounded-lg">
                <span className="text-sm text-base-content/60">Item</span>
                <span className="font-semibold text-base-content">{task.item}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-base-200 rounded-lg">
                <span className="text-sm text-base-content/60">Quantity</span>
                <span className="font-semibold text-base-content">{task.qty}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg border border-primary/20">
                <span className="text-sm text-primary font-medium">To Location</span>
                <span className="font-bold text-primary">{task.toLocation}</span>
              </div>
            </div>
          </div>
          <div className="bg-base-100 rounded-xl p-4 border border-base-300">
            <div className="text-sm font-medium text-base-content mb-2">Scan Location</div>
            <div className="flex gap-2">
              <input
                className="input input-bordered flex-1"
                placeholder="Scan or enter location"
                value={scannedLocation}
                onChange={(e) => setScannedLocation(e.target.value)}
              />
              <button className="btn btn-primary btn-square">
                <span className="material-symbols-outlined">qr_code_scanner</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Picking Task Content */}
      {task.title === "Picking" && (
        <div className="space-y-4">
          <div className="bg-primary/10 border-2 border-primary rounded-xl p-4">
            <div className="space-y-3">
              <div>
                <div className="text-sm text-base-content/60">Order</div>
                <div className="font-bold text-lg text-base-content">{task.order}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-base-content/60">Location</div>
                  <div className="font-semibold text-base-content">{task.location}</div>
                </div>
                <div>
                  <div className="text-xs text-base-content/60">Quantity</div>
                  <div className="font-semibold text-base-content">{task.qty}</div>
                </div>
              </div>
              <div>
                <div className="text-xs text-base-content/60">Item</div>
                <div className="font-semibold text-base-content">{task.item}</div>
                <div className="text-xs text-base-content/60">SKU: {task.sku}</div>
              </div>
              <div className="bg-base-100 rounded-lg p-3">
                <div className="text-xs text-base-content/60 mb-2">Picked Quantity</div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setPickedQty(Math.max(0, pickedQty - 1))}
                    className="btn btn-circle btn-outline btn-sm"
                  >
                    <span className="material-symbols-outlined">remove</span>
                  </button>
                  <input
                    type="number"
                    className="input input-bordered flex-1 text-center text-xl font-bold"
                    value={pickedQty}
                    onChange={(e) => setPickedQty(Math.max(0, parseInt(e.target.value) || 0))}
                    min="0"
                    max={task.qty}
                  />
                  <button
                    onClick={() => setPickedQty(Math.min(task.qty, pickedQty + 1))}
                    className="btn btn-circle btn-outline btn-sm"
                  >
                    <span className="material-symbols-outlined">add</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-2">
        {task.status === "pending" && (
          <button onClick={handleStart} className="btn btn-primary w-full btn-lg">
            <span className="material-symbols-outlined">play_arrow</span>
            Start Task
          </button>
        )}
        {task.status === "in_progress" && (
          <button
            onClick={handleComplete}
            className="btn btn-success w-full btn-lg"
            disabled={
              (task.title === "Receiving" && receivedQty === 0) ||
              (task.title === "Picking" && (pickedQty === 0 || pickedQty > task.qty)) ||
              (task.title === "Putaway" && !scannedLocation)
            }
          >
            <span className="material-symbols-outlined">check_circle</span>
            Complete Task
          </button>
        )}
      </div>
    </div>
  );
}

