"use client";

import { useState, useEffect } from "react";
import { showToast } from "@/lib/utils/toast";

const SETTINGS_KEY = "worker_app_settings";

const defaultSettings = {
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
};

export default function WorkerAppSettingsPage() {
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);

  // Load settings from localStorage and backend
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // First, try to load from backend
        try {
          const { authApi } = await import("@/lib/api/auth");
          const { useOffline } = await import("@/hooks/useOffline");
          const { isOnline } = useOffline();
          
          if (isOnline) {
            const userInfo = await authApi.getCurrentUser();
            // Try to get user preferences from backend
            try {
              const { usersApi } = await import("@/lib/api/users");
              const user = await usersApi.getById(userInfo.userId);
              // If user has appSettings in preferences, use it
              // For now, we'll use localStorage as primary source
            } catch (err) {
              // Workers may not have permission - use localStorage
            }
          }
        } catch (err) {
          // Backend load failed - use localStorage
        }
        
        // Load from localStorage (primary source for now)
        const saved = localStorage.getItem(SETTINGS_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          setSettings({ ...defaultSettings, ...parsed });
          
          // Apply settings immediately
          if (parsed.darkMode) {
            document.documentElement.setAttribute("data-theme", "dark");
          }
          if (parsed.fontSize) {
            document.documentElement.style.fontSize = 
              parsed.fontSize === "small" ? "14px" :
              parsed.fontSize === "large" ? "18px" : "16px";
          }
        }
      } catch (error) {
        console.error("Failed to load settings:", error);
      } finally {
        setLoading(false);
      }
    };
    
    loadSettings();
  }, []);

  const handleSave = async () => {
    try {
      // Settings are already saved to localStorage on change
      // Just show success message and try backend sync
      showToast.success("Settings saved successfully");
      
      // Try to sync to backend (if online) - optional
      // For now, settings are stored in localStorage which is sufficient
    } catch (error) {
      console.error("Failed to save settings:", error);
      showToast.error("Failed to save settings");
    }
  };

  const handleReset = () => {
    setSettings(defaultSettings);
    localStorage.removeItem(SETTINGS_KEY);
    showToast.success("Settings reset to defaults");
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
              onChange={(e) => {
                const newSettings = { ...settings, notifications: e.target.checked };
                setSettings(newSettings);
                // Auto-save on change
                localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
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
              checked={settings.soundEnabled}
              onChange={(e) => {
                const newSettings = { ...settings, soundEnabled: e.target.checked };
                setSettings(newSettings);
                localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
              }}
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
              onChange={(e) => {
                const newSettings = { ...settings, vibrationEnabled: e.target.checked };
                setSettings(newSettings);
                localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
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
              <div className="text-sm text-base-content/60">Automatically sync data when online</div>
            </div>
            <input
              type="checkbox"
              className="toggle toggle-primary"
              checked={settings.autoSync}
              onChange={(e) => {
                const newSettings = { ...settings, autoSync: e.target.checked };
                setSettings(newSettings);
                localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
              }}
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
                onChange={(e) => {
                  const newSettings = { ...settings, syncInterval: e.target.value };
                  setSettings(newSettings);
                  localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
                }}
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
              onChange={(e) => {
                const newSettings = { ...settings, offlineMode: e.target.checked };
                setSettings(newSettings);
                localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
              }}
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
              onChange={(e) => {
                const newSettings = { ...settings, qrScannerSound: e.target.checked };
                setSettings(newSettings);
                localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
              }}
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
              onChange={(e) => {
                const newSettings = { ...settings, hapticFeedback: e.target.checked };
                setSettings(newSettings);
                localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
              }}
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
              onChange={(e) => {
                const newSettings = { ...settings, darkMode: e.target.checked };
                setSettings(newSettings);
                localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
                // Apply dark mode immediately
                if (e.target.checked) {
                  document.documentElement.setAttribute("data-theme", "dark");
                } else {
                  document.documentElement.setAttribute("data-theme", "light");
                }
              }}
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Font Size</span>
            </label>
            <select
              className="select select-bordered w-full"
              value={settings.fontSize}
              onChange={(e) => {
                const newSettings = { ...settings, fontSize: e.target.value };
                setSettings(newSettings);
                localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
                // Apply font size immediately
                document.documentElement.style.fontSize = 
                  e.target.value === "small" ? "14px" :
                  e.target.value === "large" ? "18px" : "16px";
              }}
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
              onChange={(e) => {
                const newSettings = { ...settings, language: e.target.value };
                setSettings(newSettings);
                localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
              }}
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button className="btn btn-ghost" onClick={handleReset}>
          Reset to Defaults
        </button>
        <button className="btn btn-primary" onClick={handleSave}>
          Save Settings
        </button>
      </div>
    </div>
  );
}

