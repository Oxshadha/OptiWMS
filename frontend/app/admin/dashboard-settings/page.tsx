"use client";

import { useEffect, useState } from "react";
import { logger } from "@/lib/utils/logger";
import { useAdmin } from "@/contexts/AdminContext";
import { usersApi } from "@/lib/api/users";
import { showToast } from "@/lib/utils/toast";
import { getScopedSettings, setScopedSettings } from "@/lib/user-preferences";

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
  language: "en",
};

export default function DashboardSettingsPage() {
  const { admin } = useAdmin();
  const [settings, setSettings] = useState(defaultSettings);
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

  const handleSave = async () => {
    if (!admin?.id) {
      showToast.error("Admin session not ready");
      return;
    }
    setSaving(true);
    try {
      const user = await usersApi.getById(admin.id);
      const nextSettings = setScopedSettings(
        user.dashboardSettings,
        "adminDashboardSettings",
        settings
      );
      await usersApi.updatePreferences(admin.id, { dashboardSettings: nextSettings });
      showToast.success("Dashboard settings saved");
    } catch (error) {
      logger.error("Failed to save dashboard settings:", error);
      showToast.error(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setSettings(defaultSettings);
    if (admin?.id) {
      try {
        const user = await usersApi.getById(admin.id);
        const nextSettings = setScopedSettings(
          user.dashboardSettings,
          "adminDashboardSettings",
          defaultSettings
        );
        await usersApi.updatePreferences(admin.id, { dashboardSettings: nextSettings });
        showToast.success("Settings reset to defaults");
      } catch (error) {
        logger.error("Failed to reset dashboard settings:", error);
      }
    }
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
                  onChange={(e) => setSettings({ ...settings, darkMode: e.target.checked })}
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
                <span className="label-text">Show Notification Badge</span>
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
