import React, { useState, useRef, useEffect } from 'react';
import { Bell, X, CheckCircle, AlertCircle } from 'lucide-react';
import { notificationsApi, Notification } from '@/lib/api/notifications';
import './NotificationBell.module.css';

interface NotificationBellProps {
  userId: string;
}

export function NotificationBell({ userId }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchNotifications();
    
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [userId]);

  useEffect(() => {
    // Close notification center when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const fetchNotifications = async () => {
    try {
      setIsLoading(true);
      const notifs = await notificationsApi.getAll(userId);
      setNotifications(notifs.slice(0, 10));
      const unread = await notificationsApi.getUnreadCount(userId);
      setUnreadCount(unread);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await notificationsApi.markAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, read: true } : n
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleDelete = async (notificationId: string) => {
    try {
      await notificationsApi.delete(notificationId);
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationsApi.markAllAsRead(userId);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const getSeverityColor = (type: string) => {
    switch (type) {
      case 'anomaly':
      case 'system':
        return '#e74c3c';
      case 'inventory':
      case 'return':
        return '#f39c12';
      case 'order':
      case 'shipment':
      case 'task':
        return '#3498db';
      default:
        return '#95a5a6';
    }
  };

  return (
    <div className="notification-bell" ref={bellRef}>
      <button
        className={`bell-button ${unreadCount > 0 ? 'has-unread' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unreadCount > 0 && <span className="badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
      </button>

      {isOpen && (
        <div className="notification-dropdown">
          <div className="notification-header">
            <h3>Notifications</h3>
            {unreadCount > 0 && (
              <button
                className="mark-all-read-btn"
                onClick={handleMarkAllAsRead}
                title="Mark all as read"
              >
                Mark all as read
              </button>
            )}
          </div>

          {isLoading && notifications.length === 0 && (
            <div className="notification-loading">
              <div className="loader"></div>
              <p>Loading notifications...</p>
            </div>
          )}

          {!isLoading && notifications.length === 0 && (
            <div className="notification-empty">
              <Bell size={32} opacity={0.3} />
              <p>No notifications yet</p>
            </div>
          )}

          {notifications.length > 0 && (
            <div className="notification-list">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`notification-item ${
                    !notification.read ? 'unread' : ''
                  }`}
                  style={{
                    borderLeftColor: getSeverityColor(notification.notificationType),
                  }}
                >
                  <div className="notification-icon">
                    {notification.notificationType === 'anomaly' ||
                    notification.notificationType === 'system' ? (
                      <AlertCircle
                        size={18}
                        color={getSeverityColor(notification.notificationType)}
                      />
                    ) : (
                      <CheckCircle size={18} color={getSeverityColor(notification.notificationType)} />
                    )}
                  </div>

                  <div className="notification-content">
                    <div className="notification-title">{notification.title}</div>
                    <div className="notification-message">{notification.message}</div>
                    <div className="notification-meta">
                      {new Date(notification.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                  </div>

                  <div className="notification-actions">
                    {!notification.read && (
                      <button
                        className="action-btn"
                        onClick={() => handleMarkAsRead(notification.id)}
                        title="Mark as read"
                      >
                        <CheckCircle size={16} />
                      </button>
                    )}
                    <button
                      className="action-btn delete"
                      onClick={() => handleDelete(notification.id)}
                      title="Delete"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {notifications.length > 0 && (
            <div className="notification-footer">
              <a href="/admin/notifications" className="view-all-link">
                View all notifications →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
