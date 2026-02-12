"use client";

import { useState, useEffect } from "react";
import { useWorker } from "@/contexts/WorkerContext";
import { showToast } from "@/lib/utils/toast";
import { logger } from "@/lib/utils/logger";

const SETTINGS_KEY = "worker_settings";

export default function SettingsPage() {
  const { worker } = useWorker();
  const [notifications, setNotifications] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoSync, setAutoSync] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  // Load settings from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SETTINGS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setNotifications(parsed.notifications ?? true);
        setSoundEnabled(parsed.soundEnabled ?? true);
        setAutoSync(parsed.autoSync ?? true);
        setDarkMode(parsed.darkMode ?? false);
      }
    } catch (error) {
      logger.error("Failed to load settings:", error);
    }
  }, []);

  const handleSave = () => {
    // Settings are already saved to localStorage on change
    // Just show success message
    showToast.success("Settings saved successfully");
  };

  return (
    <div className="p-4 space-y-4">
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <h2 className="text-xl font-bold text-base-content mb-4">Settings</h2>
        <p className="text-sm text-base-content/60">
          Manage your app preferences and account settings.
        </p>
      </div>

      {/* Notification Settings */}
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <h3 className="font-bold text-base-content mb-4">Notifications</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-base-content">Enable Notifications</div>
              <div className="text-sm text-base-content/60">Receive task and system alerts</div>
            </div>
            <input
              type="checkbox"
              className="toggle toggle-primary"
              checked={notifications}
              onChange={(e) => {
                setNotifications(e.target.checked);
                // Auto-save on change
                localStorage.setItem(SETTINGS_KEY, JSON.stringify({
                  notifications: e.target.checked,
                  soundEnabled,
                  autoSync,
                  darkMode,
                }));
              }}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-base-content">Sound Alerts</div>
              <div className="text-sm text-base-content/60">Play sound for notifications</div>
            </div>
            <input
              type="checkbox"
              className="toggle toggle-primary"
              checked={soundEnabled}
              onChange={(e) => {
                setSoundEnabled(e.target.checked);
                localStorage.setItem(SETTINGS_KEY, JSON.stringify({
                  notifications,
                  soundEnabled: e.target.checked,
                  autoSync,
                  darkMode,
                }));
              }}
            />
          </div>
        </div>
      </div>

      {/* Sync Settings */}
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <h3 className="font-bold text-base-content mb-4">Sync</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-base-content">Auto Sync</div>
              <div className="text-sm text-base-content/60">Automatically sync data</div>
            </div>
            <input
              type="checkbox"
              className="toggle toggle-primary"
              checked={autoSync}
              onChange={(e) => {
                setAutoSync(e.target.checked);
                localStorage.setItem(SETTINGS_KEY, JSON.stringify({
                  notifications,
                  soundEnabled,
                  autoSync: e.target.checked,
                  darkMode,
                }));
              }}
            />
          </div>
          <button className="btn btn-outline btn-sm w-full">
            <span className="material-symbols-outlined">sync</span>
            Sync Now
          </button>
        </div>
      </div>

      {/* Appearance */}
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <h3 className="font-bold text-base-content mb-4">Appearance</h3>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-semibold text-base-content">Dark Mode</div>
            <div className="text-sm text-base-content/60">Toggle dark theme</div>
          </div>
          <input
            type="checkbox"
            className="toggle toggle-primary"
            checked={darkMode}
            onChange={(e) => {
              setDarkMode(e.target.checked);
              localStorage.setItem(SETTINGS_KEY, JSON.stringify({
                notifications,
                soundEnabled,
                autoSync,
                darkMode: e.target.checked,
              }));
              // Apply dark mode immediately
              if (e.target.checked) {
                document.documentElement.setAttribute("data-theme", "dark");
              } else {
                document.documentElement.setAttribute("data-theme", "light");
              }
            }}
          />
        </div>
      </div>

      {/* Account Info */}
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <h3 className="font-bold text-base-content mb-4">Account</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-base-200 rounded-lg">
            <div>
              <div className="text-sm text-base-content/60">Worker ID</div>
              <div className="font-semibold text-base-content">{worker?.workerId || "N/A"}</div>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 bg-base-200 rounded-lg">
            <div>
              <div className="text-sm text-base-content/60">Warehouse</div>
              <div className="font-semibold text-base-content">{worker?.warehouse || "N/A"}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <button className="btn btn-primary w-full" onClick={handleSave}>
          <span className="material-symbols-outlined">save</span>
          Save Settings
        </button>
        <button className="btn btn-outline w-full">
          <span className="material-symbols-outlined">help</span>
          Help & Support
        </button>
        <button 
          className="btn btn-error w-full"
          onClick={async () => {
            const { authApi } = await import("@/lib/api/auth");
            await authApi.logout();
            window.location.href = "/worker/login";
          }}
        >
          <span className="material-symbols-outlined">logout</span>
          Logout
        </button>
      </div>
    </div>
  );
}

