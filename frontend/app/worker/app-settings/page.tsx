"use client";

import { useState, useEffect } from "react";
import { showToast } from "@/lib/utils/toast";
import { logger } from "@/lib/utils/logger";
import { authApi } from "@/lib/api/auth";
import { getScopedSettings, parseSettingsContainer, setScopedSettings } from "@/lib/user-preferences";
import { applyAppTheme } from "@/lib/theme";

const SETTINGS_KEY = "worker_app_settings";

const defaultSettings = {
  autoSync: true,
  syncInterval: "30",
  darkMode: false,
  fontSize: "medium",
};

export default function WorkerAppSettingsPage() {
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferencesBlob, setPreferencesBlob] = useState<Record<string, any>>({});

  // Load settings from localStorage and backend
  useEffect(() => {
    const loadSettings = async () => {
      try {
        try {
          const currentUser = await authApi.getCurrentUser();
          const parsedBlob = parseSettingsContainer(currentUser.dashboardSettings);
          const backendSettings = getScopedSettings<typeof defaultSettings>(
            parsedBlob,
            "workerAppSettings"
          );

          if (Object.keys(backendSettings).length > 0) {
            const mergedSettings = { ...defaultSettings, ...backendSettings };
            setPreferencesBlob(parsedBlob);
            setSettings(mergedSettings);
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(mergedSettings));

            applyAppTheme(mergedSettings.darkMode);
            document.documentElement.style.fontSize =
              mergedSettings.fontSize === "small"
                ? "14px"
                : mergedSettings.fontSize === "large"
                ? "18px"
                : "16px";
            return;
          }
        } catch (backendError) {
          logger.error("Failed to load worker app settings from backend:", backendError);
        }

        const saved = localStorage.getItem(SETTINGS_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          setSettings({ ...defaultSettings, ...parsed });
          
          // Apply settings immediately
          applyAppTheme(!!parsed.darkMode);
          if (parsed.fontSize) {
            document.documentElement.style.fontSize = 
              parsed.fontSize === "small" ? "14px" :
              parsed.fontSize === "large" ? "18px" : "16px";
          }
        }
      } catch (error) {
        logger.error("Failed to load settings:", error);
      } finally {
        setLoading(false);
      }
    };
    
    loadSettings();
  }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = setScopedSettings(preferencesBlob, "workerAppSettings", settings);
      await authApi.updatePreferences({ dashboardSettings: payload });
      setPreferencesBlob(payload);
      showToast.success("Settings saved successfully");
    } catch (error) {
      logger.error("Failed to save settings:", error);
      showToast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSettings(defaultSettings);
    localStorage.removeItem(SETTINGS_KEY);
    applyAppTheme(false);
    document.documentElement.style.fontSize = "16px";
    try {
      setSaving(true);
      const payload = setScopedSettings(preferencesBlob, "workerAppSettings", defaultSettings);
      await authApi.updatePreferences({ dashboardSettings: payload });
      setPreferencesBlob(payload);
      showToast.success("Settings reset to defaults");
    } catch (error: any) {
      logger.error("Failed to reset backend settings:", error);
      showToast.error(error.message || "Failed to reset backend settings");
    } finally {
      setSaving(false);
    }
  };

  const handleSyncNow = () => {
    if (!navigator.onLine) {
      showToast.warning("Device is offline. Changes will stay local until connectivity returns.");
      return;
    }
    void handleSave();
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
          <button className="btn btn-outline btn-sm w-full" onClick={handleSyncNow}>
            <span className="material-symbols-outlined">sync</span>
            Sync Now
          </button>
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
                applyAppTheme(e.target.checked);
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
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button className="btn btn-ghost" onClick={() => void handleReset()} disabled={saving}>
          Reset to Defaults
        </button>
        <button className="btn btn-primary" onClick={() => void handleSave()} disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
