"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { tasksApi, Task } from "@/lib/api/tasks";
import { useOffline } from "@/hooks/useOffline";

// Frontend task structure
interface WorkerTask {
  id: string;
  title: string;
  detail: string;
  type: string;
  icon: string;
  priority: string;
  dueTime: string;
}

// Mock data for fallback
const mockTasks: WorkerTask[] = [
  { 
    id: "1",
    title: "Receiving", 
    detail: "PO/ASN 452368", 
    type: "info",
    icon: "inventory_2",
    priority: "high",
    dueTime: "2:00 PM"
  },
  { 
    id: "2",
    title: "Putaway", 
    detail: "Stage -> Aisle A", 
    type: "primary",
    icon: "move_to_inbox",
    priority: "medium",
    dueTime: "3:30 PM"
  },
  { 
    id: "3",
    title: "Picking", 
    detail: "Order #56281", 
    type: "accent",
    icon: "shopping_cart",
    priority: "high",
    dueTime: "4:00 PM"
  },
  { 
    id: "4",
    title: "Cycle Count", 
    detail: "Zone B", 
    type: "warning",
    icon: "calculate",
    priority: "low",
    dueTime: "5:00 PM"
  },
];

const priorityColors = {
  high: "bg-error/10 text-error border-error/20",
  medium: "bg-warning/10 text-warning border-warning/20",
  low: "bg-info/10 text-info border-info/20",
};

export default function WorkerTasksPage() {
  const { isOnline } = useOffline();
  const [tasks, setTasks] = useState<WorkerTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState("all");

  // Load tasks from API
  useEffect(() => {
    if (isOnline) {
      loadTasks();
    } else {
      // Use mock data when offline
      setTasks(mockTasks);
      setLoading(false);
    }
  }, [isOnline]);

  const loadTasks = async () => {
    try {
      setLoading(true);
      // Get tasks assigned to current worker (would need worker ID from auth)
      const apiTasks = await tasksApi.getAll();
      
      // Filter to pending/assigned tasks and map to frontend structure
      const workerTasks: WorkerTask[] = apiTasks
        .filter(t => t.status === "pending" || t.status === "assigned")
        .map((task: Task) => {
          // Map task type to icon and color
          let icon = "task";
          let type = "info";
          if (task.taskType === "receiving") {
            icon = "inventory_2";
            type = "info";
          } else if (task.taskType === "putaway") {
            icon = "move_to_inbox";
            type = "primary";
          } else if (task.taskType === "picking") {
            icon = "shopping_cart";
            type = "accent";
          } else if (task.taskType === "cycle_count") {
            icon = "calculate";
            type = "warning";
          }
          
          // Map priority
          let priority = "medium";
          if (task.priority === "high" || task.priority === "urgent") priority = "high";
          else if (task.priority === "low") priority = "low";
          
          // Format due time
          let dueTime = "N/A";
          if (task.dueDate) {
            const due = new Date(task.dueDate);
            dueTime = due.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          }
          
          return {
            id: task.id,
            title: task.taskType.charAt(0).toUpperCase() + task.taskType.slice(1).replace("_", " "),
            detail: task.locationCode || task.referenceId || "Task",
            type,
            icon,
            priority,
            dueTime,
          };
        });
      
      setTasks(workerTasks.length > 0 ? workerTasks : mockTasks);
    } catch (err) {
      console.error("Error loading tasks:", err);
      setTasks(mockTasks);
    } finally {
      setLoading(false);
    }
  };

  const filteredTasks = selectedFilter === "all" 
    ? tasks 
    : tasks.filter(t => t.priority === selectedFilter);

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
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((task) => (
          <Link
            key={task.id}
            href={`/worker/tasks/${task.id}`}
            className="block bg-base-100 rounded-xl p-4 border border-base-300 active:scale-[0.98] transition-transform shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                <div className={`w-12 h-12 bg-${task.type}/10 rounded-xl flex items-center justify-center flex-shrink-0`}>
                  <span className={`material-symbols-outlined text-${task.type} text-xl`}>
                    {task.icon}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-base-content">{task.title}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${priorityColors[task.priority as keyof typeof priorityColors]}`}>
                      {task.priority}
                    </span>
                  </div>
                  <p className="text-sm text-base-content/60 mb-2">{task.detail}</p>
                  <div className="flex items-center gap-2 text-xs text-base-content/50">
                    <span className="material-symbols-outlined text-sm">schedule</span>
                    <span>Due: {task.dueTime}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  // Handle start task
                }}
                className={`btn btn-${task.type} btn-sm ml-2 flex-shrink-0`}
              >
                Start
              </button>
            </div>
          </Link>
        ))}
        </div>
      )}

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
          <button className="btn btn-outline btn-sm">
            <span className="material-symbols-outlined">qr_code_scanner</span>
            Scan Barcode
          </button>
          <button className="btn btn-outline btn-sm">
            <span className="material-symbols-outlined">refresh</span>
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
}
