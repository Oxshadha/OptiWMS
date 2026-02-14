"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { tasksApi, Task } from "@/lib/api/tasks-api";
import { useWorker } from "@/contexts/WorkerContext";
import { useOffline } from "@/hooks/useOffline";
import { showToast } from "@/lib/utils/toast";
import { QRScanner } from "@/components/QRScanner";
import { logger } from "@/lib/utils/logger";

const priorityColors = {
  high: "bg-error/10 text-error border-error/20",
  medium: "bg-warning/10 text-warning border-warning/20",
  low: "bg-info/10 text-info border-info/20",
};

const taskTypeConfig: Record<string, { icon: string; type: string }> = {
  receiving: { icon: "inventory_2", type: "info" },
  putaway: { icon: "move_to_inbox", type: "primary" },
  picking: { icon: "shopping_cart", type: "accent" },
  cycle_count: { icon: "calculate", type: "warning" },
  packing: { icon: "inventory", type: "success" },
  stock_transfer: { icon: "swap_horiz", type: "info" },
  returns: { icon: "keyboard_return", type: "warning" },
  shipment: { icon: "local_shipping", type: "primary" },
};

export default function WorkerTasksPage() {
  const { worker } = useWorker();
  const { isOnline } = useOffline();
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showScanner, setShowScanner] = useState(false);

  // Fetch tasks for the logged-in worker
  useEffect(() => {
    const loadTasks = async () => {
      if (!worker?.id || !isOnline) {
        setLoading(false);
        return;
      }

      try {
        // Fetch tasks assigned to this worker (pending and in_progress)
        const allTasks = await tasksApi.getAll(undefined, undefined, worker.id);
        // Show actionable task states for worker flow.
        const activeTasks = allTasks.filter(
          task => task.status === "pending" || task.status === "assigned" || task.status === "in_progress"
        );
        setTasks(activeTasks);
      } catch (error) {
        logger.error("Failed to load tasks:", error);
        showToast.error("Failed to load tasks");
      } finally {
        setLoading(false);
      }
    };

    loadTasks();
  }, [worker?.id, isOnline]);

  const filteredTasks = selectedFilter === "all" 
    ? tasks 
    : tasks.filter(t => t.priority === selectedFilter.toLowerCase());

  const formatTaskTitle = (taskType: string) => {
    return taskType
      .split("_")
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const formatDueTime = (dueDate?: string) => {
    if (!dueDate) return "No due date";
    const date = new Date(dueDate);
    return date.toLocaleTimeString("en-US", { 
      hour: "numeric", 
      minute: "2-digit",
      hour12: true 
    });
  };

  const getTaskConfig = (taskType: string) => {
    return taskTypeConfig[taskType.toLowerCase()] || { icon: "task", type: "info" };
  };

  const handleQRScan = (result: string) => {
    // Try to find task by scanned value (could be task number, reference ID, etc.)
    const scannedTask = tasks.find(
      task => 
        task.taskNumber === result ||
        task.referenceId === result ||
        task.id === result
    );
    
    if (scannedTask) {
      // Navigate to task detail page
      window.location.href = `/worker/tasks/${scannedTask.id}`;
    } else {
      showToast.error("Task not found. Please check the scanned code.");
    }
    setShowScanner(false);
  };

  const handleRefresh = () => {
    if (!worker?.id || !isOnline) {
      showToast.error("Cannot refresh while offline");
      return;
    }
    setLoading(true);
    // Reload tasks
    const loadTasks = async () => {
      try {
        const allTasks = await tasksApi.getAll(undefined, undefined, worker.id);
        const activeTasks = allTasks.filter(
          task => task.status === "pending" || task.status === "assigned" || task.status === "in_progress"
        );
        setTasks(activeTasks);
        showToast.success("Tasks refreshed");
      } catch (error) {
        logger.error("Failed to refresh tasks:", error);
        showToast.error("Failed to refresh tasks");
      } finally {
        setLoading(false);
      }
    };
    loadTasks();
  };

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center min-h-[400px]">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {["all", "high", "medium", "low"].map((filter) => (
          <button
            key={filter}
            onClick={() => setSelectedFilter(filter)}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
              selectedFilter === filter
                ? "bg-primary text-primary-content"
                : "bg-base-200 text-base-content"
            }`}
          >
            {filter === "all" ? "All Tasks" : filter.charAt(0).toUpperCase() + filter.slice(1)}
          </button>
        ))}
      </div>

      {/* Tasks List */}
      <div className="space-y-3">
        {filteredTasks.map((task) => {
          const config = getTaskConfig(task.taskType);
          const taskTitle = formatTaskTitle(task.taskType);
          const taskDetail = task.referenceId 
            ? `${task.referenceType || "Reference"}: ${task.referenceId}`
            : task.locationCode 
            ? `Location: ${task.locationCode}`
            : task.taskNumber;
          
          return (
            <Link
              key={task.id}
              href={`/worker/tasks/${task.id}`}
              className="block bg-base-100 rounded-xl p-4 border border-base-300 active:scale-[0.98] transition-transform shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <div className={`w-12 h-12 bg-${config.type}/10 rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <span className={`material-symbols-outlined text-${config.type} text-xl`}>
                      {config.icon}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-base-content">{taskTitle}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${priorityColors[task.priority.toLowerCase() as keyof typeof priorityColors] || priorityColors.medium}`}>
                        {task.priority}
                      </span>
                    </div>
                    <p className="text-sm text-base-content/60 mb-2">{taskDetail}</p>
                    <div className="flex items-center gap-2 text-xs text-base-content/50">
                      <span className="material-symbols-outlined text-sm">schedule</span>
                      <span>Due: {formatDueTime(task.dueDate)}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    // Handle start task - will navigate to detail page
                  }}
                  className={`btn btn-${config.type} btn-sm ml-2 flex-shrink-0`}
                >
                  {task.status === "in_progress" ? "Continue" : "Start"}
                </button>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredTasks.length === 0 && (
        <div className="text-center py-12">
          <span className="material-symbols-outlined text-6xl text-base-content/30 mb-4">task_alt</span>
          <h3 className="font-semibold text-base-content mb-2">No tasks found</h3>
          <p className="text-sm text-base-content/60">Try selecting a different filter</p>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <h3 className="font-bold text-base-content mb-3">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={() => setShowScanner(true)}
            className="btn btn-outline btn-sm"
          >
            <span className="material-symbols-outlined">qr_code_scanner</span>
            Scan Barcode
          </button>
          <button 
            onClick={handleRefresh}
            className="btn btn-outline btn-sm"
            disabled={loading || !isOnline}
          >
            <span className="material-symbols-outlined">refresh</span>
            Refresh
          </button>
        </div>
      </div>

      {/* QR Scanner Modal */}
      <QRScanner
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleQRScan}
        title="Scan Task QR Code"
        description="Point camera at task QR code or barcode"
      />
    </div>
  );
}
