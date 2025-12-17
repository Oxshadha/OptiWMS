"use client";

import { useState } from "react";

export default function WorkerAppSettingsPage() {
  const [settings, setSettings] = useState({
    notifications: true,
    soundEnabled: true,
    vibrationEnabled: true,
    autoSync: true,
    syncInterval: "30",
    darkMode: false,
    fontSize: "medium",
    language: "en",
    offlineMode: true,
    qrScannerSound: true,
    hapticFeedback: true,
  });

  const handleSave = () => {
    // TODO: API call to save app settings
    console.log("Saving app settings:", settings);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <h2 className="text-xl font-bold text-base-content mb-4">App Settings</h2>
        <p className="text-sm text-base-content/60">
          Customize your PWA app preferences and behavior.
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
              checked={settings.notifications}
              onChange={(e) => setSettings({ ...settings, notifications: e.target.checked })}
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
              checked={settings.soundEnabled}
              onChange={(e) => setSettings({ ...settings, soundEnabled: e.target.checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-base-content">Vibration</div>
              <div className="text-sm text-base-content/60">Vibrate on notifications</div>
            </div>
            <input
              type="checkbox"
              className="toggle toggle-primary"
              checked={settings.vibrationEnabled}
              onChange={(e) => setSettings({ ...settings, vibrationEnabled: e.target.checked })}
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
              <div className="text-sm text-base-content/60">Automatically sync data when online</div>
            </div>
            <input
              type="checkbox"
              className="toggle toggle-primary"
              checked={settings.autoSync}
              onChange={(e) => setSettings({ ...settings, autoSync: e.target.checked })}
            />
          </div>
          {settings.autoSync && (
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Sync Interval (seconds)</span>
              </label>
              <select
                className="select select-bordered w-full"
                value={settings.syncInterval}
                onChange={(e) => setSettings({ ...settings, syncInterval: e.target.value })}
              >
                <option value="10">10 seconds</option>
                <option value="30">30 seconds</option>
                <option value="60">1 minute</option>
                <option value="300">5 minutes</option>
              </select>
            </div>
          )}
          <button className="btn btn-outline btn-sm w-full">
            <span className="material-symbols-outlined">sync</span>
            Sync Now
          </button>
        </div>
      </div>

      {/* Offline Mode */}
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <h3 className="font-bold text-base-content mb-4">Offline Mode</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-base-content">Enable Offline Mode</div>
              <div className="text-sm text-base-content/60">Work without internet connection</div>
            </div>
            <input
              type="checkbox"
              className="toggle toggle-primary"
              checked={settings.offlineMode}
              onChange={(e) => setSettings({ ...settings, offlineMode: e.target.checked })}
            />
          </div>
          <div className="p-3 bg-base-200 rounded-lg">
            <div className="text-sm text-base-content/60">
              When offline mode is enabled, all data is stored locally and synced when connection is restored.
            </div>
          </div>
        </div>
      </div>

      {/* Scanner Settings */}
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <h3 className="font-bold text-base-content mb-4">Scanner</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-base-content">QR Scanner Sound</div>
              <div className="text-sm text-base-content/60">Play sound when scanning QR codes</div>
            </div>
            <input
              type="checkbox"
              className="toggle toggle-primary"
              checked={settings.qrScannerSound}
              onChange={(e) => setSettings({ ...settings, qrScannerSound: e.target.checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-base-content">Haptic Feedback</div>
              <div className="text-sm text-base-content/60">Vibrate on successful scan</div>
            </div>
            <input
              type="checkbox"
              className="toggle toggle-primary"
              checked={settings.hapticFeedback}
              onChange={(e) => setSettings({ ...settings, hapticFeedback: e.target.checked })}
            />
          </div>
        </div>
      </div>

      {/* Appearance */}
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <h3 className="font-bold text-base-content mb-4">Appearance</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-base-content">Dark Mode</div>
              <div className="text-sm text-base-content/60">Toggle dark theme</div>
            </div>
            <input
              type="checkbox"
              className="toggle toggle-primary"
              checked={settings.darkMode}
              onChange={(e) => setSettings({ ...settings, darkMode: e.target.checked })}
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Font Size</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={settings.fontSize}
              onChange={(e) => setSettings({ ...settings, fontSize: e.target.value })}
            >
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Language</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={settings.language}
              onChange={(e) => setSettings({ ...settings, language: e.target.value })}
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button className="btn btn-ghost">
          Reset to Defaults
        </button>
        <button className="btn btn-primary" onClick={handleSave}>
          Save Settings
        </button>
      </div>
    </div>
  );
}

