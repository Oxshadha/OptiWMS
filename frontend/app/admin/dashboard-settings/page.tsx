"use client";

import { useEffect, useState } from "react";
import { logger } from "@/lib/utils/logger";
import { useAdmin } from "@/contexts/AdminContext";
import { usersApi } from "@/lib/api/users";
import { showToast } from "@/lib/utils/toast";
import { getScopedSettings, setScopedSettings } from "@/lib/user-preferences";
import { applyAppTheme, getStoredAppTheme } from "@/lib/theme";

const defaultSettings = {
  darkMode: false,
  autoRefresh: true,
  refreshInterval: "30",
  itemsPerPage: "10",
  defaultView: "grid",
  showCharts: true,
  showNotifications: true,
  dateFormat: "MM/DD/YYYY",
  timeFormat: "12h",
};

export default function DashboardSettingsPage() {
  const { admin } = useAdmin();
  const [settings, setSettings] = useState(() => ({
    ...defaultSettings,
    darkMode: getStoredAppTheme() === "optiwms-dark",
  }));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      if (!admin?.id) return;
      try {
        const user = await usersApi.getById(admin.id);
        if (!user.dashboardSettings) return;
        const parsed = getScopedSettings<typeof defaultSettings>(
          user.dashboardSettings,
          "adminDashboardSettings"
        );
        setSettings((prev) => ({ ...prev, ...parsed }));
      } catch (error) {
        logger.error("Failed to load dashboard settings:", error);
      }
    };
    void loadSettings();
  }, [admin?.id]);

  useEffect(() => {
    applyAppTheme(settings.darkMode);
  }, [settings.darkMode]);

  const persistSettings = async (nextSettings: typeof defaultSettings, successMessage?: string) => {
    if (!admin?.id) {
      if (successMessage) {
        showToast.error("Admin session not ready");
      }
      return;
    }

    setSaving(true);
    try {
      const user = await usersApi.getById(admin.id);
      const nextPayload = setScopedSettings(
        user.dashboardSettings,
        "adminDashboardSettings",
        nextSettings
      );
      await usersApi.updatePreferences(admin.id, { dashboardSettings: nextPayload });
      if (successMessage) {
        showToast.success(successMessage);
      }
    } catch (error) {
      logger.error("Failed to persist dashboard settings:", error);
      showToast.error(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    await persistSettings(settings, "Dashboard settings saved");
  };

  const handleReset = async () => {
    setSettings(defaultSettings);
    await persistSettings(defaultSettings, "Settings reset to defaults");
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-base-content">Dashboard Settings</h1>
        <p className="text-sm text-base-content/60 mt-1">Customize your dashboard appearance and behavior</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Appearance */}
        <div className="card bg-base-100 border border-base-300 p-6">
          <h3 className="text-xl font-bold text-base-content mb-6">Appearance</h3>
          <div className="space-y-4">
            <div className="form-control">
              <label className="label cursor-pointer justify-start gap-3">
                <input
                  type="checkbox"
                  className="checkbox checkbox-primary"
                  checked={settings.darkMode}
                  onChange={(e) => {
                    const nextSettings = { ...settings, darkMode: e.target.checked };
                    setSettings(nextSettings);
                    void persistSettings(nextSettings);
                  }}
                />
                <span className="label-text">Dark Mode</span>
              </label>
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Date Format</span>
              </label>
              <select
                className="select select-bordered w-full"
                value={settings.dateFormat}
                onChange={(e) => setSettings({ ...settings, dateFormat: e.target.value })}
              >
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
              </select>
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Time Format</span>
              </label>
              <select
                className="select select-bordered w-full"
                value={settings.timeFormat}
                onChange={(e) => setSettings({ ...settings, timeFormat: e.target.value })}
              >
                <option value="12h">12-hour</option>
                <option value="24h">24-hour</option>
              </select>
            </div>
          </div>
        </div>

        {/* Dashboard Behavior */}
        <div className="card bg-base-100 border border-base-300 p-6">
          <h3 className="text-xl font-bold text-base-content mb-6">Dashboard Behavior</h3>
          <div className="space-y-4">
            <div className="form-control">
              <label className="label cursor-pointer justify-start gap-3">
                <input
                  type="checkbox"
                  className="checkbox checkbox-primary"
                  checked={settings.autoRefresh}
                  onChange={(e) => setSettings({ ...settings, autoRefresh: e.target.checked })}
                />
                <span className="label-text">Auto Refresh</span>
              </label>
            </div>
            {settings.autoRefresh && (
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Refresh Interval (seconds)</span>
                </label>
                <select
                  className="select select-bordered w-full"
                  value={settings.refreshInterval}
                  onChange={(e) => setSettings({ ...settings, refreshInterval: e.target.value })}
                >
                  <option value="10">10 seconds</option>
                  <option value="30">30 seconds</option>
                  <option value="60">1 minute</option>
                  <option value="300">5 minutes</option>
                </select>
              </div>
            )}
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Items Per Page</span>
              </label>
              <select
                className="select select-bordered w-full"
                value={settings.itemsPerPage}
                onChange={(e) => setSettings({ ...settings, itemsPerPage: e.target.value })}
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
            <div className="form-control">
              <label className="label">
                <span className="label-text font-medium">Default View</span>
              </label>
              <select
                className="select select-bordered w-full"
                value={settings.defaultView}
                onChange={(e) => setSettings({ ...settings, defaultView: e.target.value })}
              >
                <option value="grid">Grid</option>
                <option value="list">List</option>
                <option value="table">Table</option>
              </select>
            </div>
          </div>
        </div>

        {/* Display Options */}
        <div className="card bg-base-100 border border-base-300 p-6">
          <h3 className="text-xl font-bold text-base-content mb-6">Display Options</h3>
          <div className="space-y-4">
            <div className="form-control">
              <label className="label cursor-pointer justify-start gap-3">
                <input
                  type="checkbox"
                  className="checkbox checkbox-primary"
                  checked={settings.showCharts}
                  onChange={(e) => setSettings({ ...settings, showCharts: e.target.checked })}
                />
                <span className="label-text">Show Charts on Dashboard</span>
              </label>
            </div>
            <div className="form-control">
              <label className="label cursor-pointer justify-start gap-3">
                <input
                  type="checkbox"
                  className="checkbox checkbox-primary"
                  checked={settings.showNotifications}
                  onChange={(e) => setSettings({ ...settings, showNotifications: e.target.checked })}
                />
                <span className="label-text">Show Dashboard Notices</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <button className="btn btn-ghost" onClick={() => void handleReset()}>
          Reset to Defaults
        </button>
        <button className="btn btn-primary" onClick={() => void handleSave()} disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
