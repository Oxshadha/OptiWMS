"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { tasksApi, Task } from "@/lib/api/tasks-api";
import { useWorker } from "@/contexts/WorkerContext";
import { useOffline } from "@/hooks/useOffline";
import { showToast } from "@/lib/utils/toast";
import { logger } from "@/lib/utils/logger";

const priorityColors = {
  high: "bg-error/10 text-error border-error/20",
  medium: "bg-warning/10 text-warning border-warning/20",
  low: "bg-info/10 text-info border-info/20",
  normal: "bg-base-200 text-base-content border-base-300",
};

const taskTypeConfig: Record<string, { icon: string; type: string; title: string }> = {
  receiving: { icon: "inventory_2", type: "info", title: "Receiving" },
  putaway: { icon: "move_to_inbox", type: "primary", title: "Putaway" },
  picking: { icon: "shopping_cart", type: "accent", title: "Picking" },
  cycle_count: { icon: "calculate", type: "warning", title: "Cycle Count" },
  packing: { icon: "inventory", type: "success", title: "Packing" },
  stock_transfer: { icon: "swap_horiz", type: "info", title: "Stock Transfer" },
  returns: { icon: "keyboard_return", type: "warning", title: "Returns" },
  shipment: { icon: "local_shipping", type: "primary", title: "Shipment" },
};

function formatDateTime(value?: string) {
  if (!value) {
    return "Not set";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Not set";
  }
  return date.toLocaleString();
}

function formatTaskTitle(taskType: string) {
  const config = taskTypeConfig[taskType.toLowerCase()];
  if (config) {
    return config.title;
  }
  return taskType
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { worker } = useWorker();
  const { isOnline } = useOffline();
  const taskId = params.id as string;

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const loadTask = async () => {
      if (!taskId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const nextTask = await tasksApi.getById(taskId);
        setTask(nextTask);
      } catch (error) {
        logger.error("Error loading task:", error);
        showToast.error("Failed to load task");
        setTask(null);
      } finally {
        setLoading(false);
      }
    };

    void loadTask();
  }, [taskId]);

  const updateTaskStatus = async (nextStatus: "in_progress" | "completed") => {
    if (!task || !worker?.id || !isOnline) {
      showToast.error("You must be online to update tasks");
      return;
    }

    try {
      setUpdating(true);
      const updated = await tasksApi.updateStatus(task.id, nextStatus, worker.id);
      setTask(updated);
      showToast.success(nextStatus === "completed" ? "Task completed" : "Task started");
      if (nextStatus === "completed") {
        router.push("/worker/tasks");
      }
    } catch (error) {
      logger.error("Failed to update task status:", error);
      showToast.error("Failed to update task");
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 text-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="p-4 text-center">
        <span className="material-symbols-outlined text-6xl text-base-content/30 mb-4">error</span>
        <h3 className="font-semibold text-base-content mb-2">Task not found</h3>
        <p className="text-sm text-base-content/60 mb-4">Task ID: {taskId}</p>
        <button onClick={() => router.back()} className="btn btn-primary">
          Go Back
        </button>
      </div>
    );
  }

  const taskConfig = taskTypeConfig[task.taskType.toLowerCase()] || {
    icon: "task",
    type: "info",
    title: formatTaskTitle(task.taskType),
  };

  const canStart = task.status === "pending" || task.status === "assigned";
  const canComplete = task.status === "in_progress";

  return (
    <div className="p-4 space-y-4">
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 bg-${taskConfig.type}/10 rounded-xl flex items-center justify-center`}>
              <span className={`material-symbols-outlined text-${taskConfig.type} text-xl`}>
                {taskConfig.icon}
              </span>
            </div>
            <div>
              <h2 className="font-bold text-lg text-base-content">{taskConfig.title}</h2>
              <p className="text-sm text-base-content/60">{task.taskNumber}</p>
            </div>
          </div>
          <span
            className={`px-2 py-1 rounded-full text-xs font-medium border ${
              priorityColors[task.priority.toLowerCase() as keyof typeof priorityColors] || priorityColors.normal
            }`}
          >
            {task.priority}
          </span>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="bg-base-200 rounded-lg p-3">
            <div className="text-xs text-base-content/60">Status</div>
            <div className="font-semibold text-base-content capitalize">{task.status.replace(/_/g, " ")}</div>
          </div>
          <div className="bg-base-200 rounded-lg p-3">
            <div className="text-xs text-base-content/60">Due</div>
            <div className="font-semibold text-base-content">{formatDateTime(task.dueDate)}</div>
          </div>
          <div className="bg-base-200 rounded-lg p-3">
            <div className="text-xs text-base-content/60">Started</div>
            <div className="font-semibold text-base-content">{formatDateTime(task.startedAt)}</div>
          </div>
          <div className="bg-base-200 rounded-lg p-3">
            <div className="text-xs text-base-content/60">Completed</div>
            <div className="font-semibold text-base-content">{formatDateTime(task.completedAt)}</div>
          </div>
          <div className="bg-base-200 rounded-lg p-3">
            <div className="text-xs text-base-content/60">Reference</div>
            <div className="font-semibold text-base-content">
              {task.referenceId ? `${task.referenceType || "Reference"}: ${task.referenceId}` : "No reference"}
            </div>
          </div>
          <div className="bg-base-200 rounded-lg p-3">
            <div className="text-xs text-base-content/60">Location</div>
            <div className="font-semibold text-base-content">{task.locationCode || "Not specified"}</div>
          </div>
        </div>
      </div>

      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <h3 className="font-bold text-base-content mb-2">Work Instructions</h3>
        <p className="text-sm text-base-content/70">
          {task.notes?.trim()
            ? task.notes
            : `Complete the ${taskConfig.title.toLowerCase()} workflow for ${task.referenceId || task.taskNumber}.`}
        </p>
        {task.assignedTo && worker?.id && task.assignedTo !== worker.id && (
          <div className="alert alert-warning mt-3">
            <span className="material-symbols-outlined">warning</span>
            <span>This task is currently assigned to another worker.</span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {canStart && (
          <button
            onClick={() => void updateTaskStatus("in_progress")}
            className="btn btn-primary w-full btn-lg"
            disabled={updating || !isOnline}
          >
            <span className="material-symbols-outlined">play_arrow</span>
            Start Task
          </button>
        )}
        {canComplete && (
          <button
            onClick={() => void updateTaskStatus("completed")}
            className="btn btn-success w-full btn-lg"
            disabled={updating || !isOnline}
          >
            <span className="material-symbols-outlined">check_circle</span>
            Complete Task
          </button>
        )}
        {!canStart && !canComplete && (
          <div className="alert alert-info">
            <span className="material-symbols-outlined">info</span>
            <span>This task is already {task.status.replace(/_/g, " ")}.</span>
          </div>
        )}
      </div>
    </div>
  );
}
