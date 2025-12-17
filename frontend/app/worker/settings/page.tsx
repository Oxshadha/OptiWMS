"use client";

import { useState } from "react";

export default function SettingsPage() {
  const [notifications, setNotifications] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoSync, setAutoSync] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

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
              onChange={(e) => setNotifications(e.target.checked)}
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
              onChange={(e) => setSoundEnabled(e.target.checked)}
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
              onChange={(e) => setAutoSync(e.target.checked)}
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
            onChange={(e) => setDarkMode(e.target.checked)}
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
              <div className="font-semibold text-base-content">EMP-2045</div>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 bg-base-200 rounded-lg">
            <div>
              <div className="text-sm text-base-content/60">Warehouse</div>
              <div className="font-semibold text-base-content">Warehouse 1</div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <button className="btn btn-outline w-full">
          <span className="material-symbols-outlined">help</span>
          Help & Support
        </button>
        <button className="btn btn-error w-full">
          <span className="material-symbols-outlined">logout</span>
          Logout
        </button>
      </div>
    </div>
  );
}

