"use client";

import { useState, useEffect } from "react";
import { DataTable } from "@/components/DataTable";
import { SummaryCards } from "@/components/SummaryCards";
import { DetailModal } from "@/components/DetailModal";
import { StatusChip, type StatusTone } from "@/components/StatusChip";
import { useAdmin } from "@/contexts/AdminContext";
import { useRouter } from "next/navigation";
import { notificationsApi, Notification as ApiNotification } from "@/lib/api/notifications";
import { logger } from "@/lib/utils/logger";

// Notification types
type NotificationType =
  | "order"
  | "inventory"
  | "cycle_count"
  | "task"
  | "anomaly"
  | "shipment"
  | "return"
  | "system";

// Notification data structure
type Notification = {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
  actionUrl?: string; // Optional URL to navigate to when clicked
  metadata?: Record<string, unknown>; // Additional data for the notification
};

const parseMetadata = (metadata?: string): Record<string, unknown> => {
  if (!metadata) return {};
  try {
    const parsed = JSON.parse(metadata);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
};

const typeConfig: Record<NotificationType, { label: string; icon: string; tone: StatusTone }> = {
  order: { label: "Order", icon: "inventory_2", tone: "info" },
  inventory: { label: "Inventory", icon: "inventory", tone: "warning" },
  cycle_count: { label: "Cycle Count", icon: "autorenew", tone: "info" },
  task: { label: "Task", icon: "task", tone: "success" },
  anomaly: { label: "Anomaly", icon: "warning", tone: "danger" },
  shipment: { label: "Shipment", icon: "local_shipping", tone: "info" },
  return: { label: "Return", icon: "keyboard_return", tone: "warning" },
  system: { label: "System", icon: "settings", tone: "neutral" },
};

export default function NotificationsPage() {
  const router = useRouter();
  const { admin } = useAdmin();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<NotificationType | "all">("all");
  const [readFilter, setReadFilter] = useState<"all" | "read" | "unread">("all");

  // Load notifications from API
  useEffect(() => {
    const loadNotifications = async () => {
      if (!admin?.id) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const data = await notificationsApi.getAll(admin.id);
        // Map API notifications to display format
        const mappedNotifications: Notification[] = data.map((n: ApiNotification) => ({
          id: n.id,
          title: n.title,
          message: n.message,
          type: n.notificationType as NotificationType,
          read: n.read,
          createdAt: n.createdAt,
          actionUrl: n.actionUrl,
          metadata: parseMetadata(n.metadata),
        }));
        setNotifications(mappedNotifications);
      } catch (error) {
        logger.error("Error loading notifications:", error);
        setNotifications([]);
      } finally {
        setLoading(false);
      }
    };
    loadNotifications();
  }, [admin?.id]);

  const handleMarkAsRead = async (id: string) => {
    try {
      await notificationsApi.markAsRead(id);
      setNotifications(notifications.map(n => 
        n.id === id ? { ...n, read: true } : n
      ));
    } catch (error) {
      logger.error("Error marking notification as read:", error);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!admin?.id) return;
    try {
      await notificationsApi.markAllAsRead(admin.id);
      setNotifications(notifications.map(n => ({ ...n, read: true })));
    } catch (error) {
      logger.error("Error marking all as read:", error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await notificationsApi.delete(id);
      setNotifications(notifications.filter(n => n.id !== id));
    } catch (error) {
      logger.error("Error deleting notification:", error);
    }
  };

  const summary = {
    total: notifications.length,
    unread: notifications.filter((n) => !n.read).length,
    read: notifications.filter((n) => n.read).length,
    today: notifications.filter((n) => {
      const today = new Date().toDateString();
      const notifDate = new Date(n.createdAt).toDateString();
      return today === notifDate;
    }).length,
  };

  const filteredNotifications = notifications.filter((notif) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !query ||
      notif.title.toLowerCase().includes(query) ||
      notif.message.toLowerCase().includes(query) ||
      notif.type.toLowerCase().includes(query);
    const matchesType = typeFilter === "all" || notif.type === typeFilter;
    const matchesRead =
      readFilter === "all" ||
      (readFilter === "read" && notif.read) ||
      (readFilter === "unread" && !notif.read);
    return matchesSearch && matchesType && matchesRead;
  });

  const summaryCards = [
    {
      label: "Total Notifications",
      value: summary.total,
      icon: "notifications",
      color: "primary" as const,
    },
    {
      label: "Unread",
      value: summary.unread,
      icon: "mark_email_unread",
      color: "error" as const,
    },
    {
      label: "Read",
      value: summary.read,
      icon: "mark_email_read",
      color: "success" as const,
    },
    {
      label: "Today",
      value: summary.today,
      icon: "today",
      color: "info" as const,
    },
  ];

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  const markAsRead = async (id: string) => {
    await handleMarkAsRead(id);
  };

  const markAsUnread = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: false } : n))
    );
  };

  const markAllAsRead = async () => {
    await handleMarkAllAsRead();
  };

  const handleNotificationClick = (notif: Notification) => {
    markAsRead(notif.id);
    if (notif.actionUrl) {
      router.push(notif.actionUrl);
    } else {
      setSelectedNotification(notif);
      setShowDetailModal(true);
    }
  };

  const columns = [
    {
      key: "read",
      label: "",
      render: (notif: Notification) => (
        <div className="flex items-center">
          {!notif.read && (
            <div className="w-2 h-2 rounded-full bg-primary"></div>
          )}
        </div>
      ),
      sortable: false,
    },
    {
      key: "type",
      label: "Type",
      render: (notif: Notification) => (
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-base-content/60 text-sm">
            {typeConfig[notif.type].icon}
          </span>
          <StatusChip label={typeConfig[notif.type].label} tone={typeConfig[notif.type].tone} />
        </div>
      ),
      sortable: true,
    },
    {
      key: "title",
      label: "Title",
      render: (notif: Notification) => (
        <div>
          <p
            className={`font-semibold ${
              !notif.read ? "text-base-content" : "text-base-content/70"
            }`}
          >
            {notif.title}
          </p>
          <p className="text-sm text-base-content/60 line-clamp-1">
            {notif.message}
          </p>
        </div>
      ),
      sortable: true,
    },
    {
      key: "createdAt",
      label: "Time",
      render: (notif: Notification) => (
        <span className="text-sm text-base-content/60">
          {formatTime(notif.createdAt)}
        </span>
      ),
      sortable: true,
    },
  ];

  const renderActions = (notif: Notification) => (
    <div className="dropdown dropdown-end">
      <label tabIndex={0} className="btn btn-ghost btn-xs">
        <span className="material-symbols-outlined">more_vert</span>
      </label>
      <ul
        tabIndex={0}
        className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300 z-10"
      >
        <li>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleNotificationClick(notif);
            }}
          >
            <span className="material-symbols-outlined text-sm">visibility</span>
            View Details
          </button>
        </li>
        {notif.read ? (
          <li>
            <button
              onClick={(e) => {
                e.stopPropagation();
                markAsUnread(notif.id);
              }}
            >
              <span className="material-symbols-outlined text-sm">mark_email_unread</span>
              Mark as Unread
            </button>
          </li>
        ) : (
          <li>
            <button
              onClick={(e) => {
                e.stopPropagation();
                markAsRead(notif.id);
              }}
            >
              <span className="material-symbols-outlined text-sm">mark_email_read</span>
              Mark as Read
            </button>
          </li>
        )}
        {notif.actionUrl && (
          <li>
            <button
              onClick={(e) => {
                e.stopPropagation();
                markAsRead(notif.id);
                router.push(notif.actionUrl!);
              }}
            >
              <span className="material-symbols-outlined text-sm">open_in_new</span>
              Go to Related Item
            </button>
          </li>
        )}
      </ul>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-base-content">Notifications</h1>
          <p className="text-sm text-base-content/60 mt-1">
            View and manage all system notifications
          </p>
        </div>
        <div className="flex gap-3">
          {summary.unread > 0 && (
            <button
              className="btn btn-sm btn-ghost"
              onClick={handleMarkAllAsRead}
              title="Mark all as read"
            >
              <span className="material-symbols-outlined">done_all</span>
              Mark All Read
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <SummaryCards cards={summaryCards} />

      {/* Filters and Search */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[200px]">
          <label className="input input-bordered flex items-center gap-2">
            <span className="material-symbols-outlined text-base-content/60">
              search
            </span>
            <input
              type="text"
              className="grow"
              placeholder="Search notifications..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </label>
        </div>

        <div className="dropdown">
          <label tabIndex={0} className="btn btn-sm btn-outline">
            <span className="material-symbols-outlined">filter_list</span>
            Type: {typeFilter === "all" ? "All" : typeConfig[typeFilter].label}
          </label>
          <ul
            tabIndex={0}
            className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300 z-10"
          >
            <li>
              <button onClick={() => setTypeFilter("all")}>All Types</button>
            </li>
            {Object.entries(typeConfig).map(([key, config]) => (
              <li key={key}>
                <button onClick={() => setTypeFilter(key as NotificationType)}>
                  <span className="material-symbols-outlined text-sm">
                    {config.icon}
                  </span>
                  {config.label}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="dropdown">
          <label tabIndex={0} className="btn btn-sm btn-outline">
            <span className="material-symbols-outlined">filter_list</span>
            Status:{" "}
            {readFilter === "all"
              ? "All"
              : readFilter === "read"
              ? "Read"
              : "Unread"}
          </label>
          <ul
            tabIndex={0}
            className="dropdown-content menu p-2 shadow-lg bg-base-100 rounded-box w-52 border border-base-300 z-10"
          >
            <li>
              <button onClick={() => setReadFilter("all")}>All</button>
            </li>
            <li>
              <button onClick={() => setReadFilter("unread")}>Unread</button>
            </li>
            <li>
              <button onClick={() => setReadFilter("read")}>Read</button>
            </li>
          </ul>
        </div>
      </div>

      {/* Notifications Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : (
        <DataTable
          data={filteredNotifications}
          columns={columns}
          keyExtractor={(notif) => notif.id}
          onRowClick={handleNotificationClick}
          actions={renderActions}
          emptyMessage="No notifications found"
        />
      )}

      {/* Notification Detail Modal */}
      {selectedNotification && (
        <NotificationDetailModal
          isOpen={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedNotification(null);
          }}
          notification={selectedNotification}
          onMarkAsRead={() => markAsRead(selectedNotification.id)}
          onMarkAsUnread={() => markAsUnread(selectedNotification.id)}
          onNavigate={() => {
            if (selectedNotification.actionUrl) {
              markAsRead(selectedNotification.id);
              router.push(selectedNotification.actionUrl);
            }
          }}
        />
      )}
    </div>
  );
}

// Notification Detail Modal
function NotificationDetailModal({
  isOpen,
  onClose,
  notification,
  onMarkAsRead,
  onMarkAsUnread,
  onNavigate,
}: {
  isOpen: boolean;
  onClose: () => void;
  notification: Notification;
  onMarkAsRead: () => void;
  onMarkAsUnread: () => void;
  onNavigate: () => void;
}) {
  const typeInfo = typeConfig[notification.type];
  const createdAt = new Date(notification.createdAt);

  return (
    <DetailModal isOpen={isOpen} onClose={onClose} title={notification.title} size="md">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-base-content/60">Type</label>
            <p>
              <StatusChip label={typeInfo.label} tone={typeInfo.tone} />
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Status</label>
            <p>
              <StatusChip label={notification.read ? "Read" : "Unread"} tone={notification.read ? "success" : "warning"} showDot />
            </p>
          </div>
          <div>
            <label className="text-sm text-base-content/60">Date & Time</label>
            <p className="font-semibold">
              {createdAt.toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          {notification.actionUrl && (
            <div>
              <label className="text-sm text-base-content/60">Related Item</label>
              <p className="text-sm text-primary">Available</p>
            </div>
          )}
        </div>

        <div className="border-t pt-4">
          <label className="text-sm text-base-content/60 mb-2 block">Message</label>
          <div className="bg-base-200 rounded-lg p-4">
            <p className="text-base-content leading-relaxed">{notification.message}</p>
          </div>
        </div>

        {notification.metadata && Object.keys(notification.metadata).length > 0 && (
          <div className="border-t pt-4">
            <label className="text-sm text-base-content/60 mb-2 block">Details</label>
            <div className="bg-base-200 rounded-lg p-4">
              <dl className="space-y-2">
                {Object.entries(notification.metadata).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <dt className="text-sm font-medium text-base-content/70 capitalize">
                      {key.replace(/([A-Z])/g, " $1").trim()}:
                    </dt>
                    <dd className="text-sm text-base-content">{String(value)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4">
          {notification.read ? (
            <button className="btn btn-ghost btn-sm" onClick={onMarkAsUnread}>
              <span className="material-symbols-outlined">mark_email_unread</span>
              Mark as Unread
            </button>
          ) : (
            <button className="btn btn-ghost btn-sm" onClick={onMarkAsRead}>
              <span className="material-symbols-outlined">mark_email_read</span>
              Mark as Read
            </button>
          )}
          {notification.actionUrl && (
            <button className="btn btn-primary btn-sm" onClick={onNavigate}>
              <span className="material-symbols-outlined">open_in_new</span>
              Go to Related Item
            </button>
          )}
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </DetailModal>
  );
}
