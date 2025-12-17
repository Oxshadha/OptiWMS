"use client";

import { useState } from "react";

export default function SettingsPage() {
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);

  const settingsCategories = [
    {
      title: "Appearance",
      icon: "palette",
      settings: [
        {
          name: "Dark mode",
          desc: "Toggle dark/light theme",
          value: darkMode,
          onChange: setDarkMode,
          type: "toggle"
        },
      ]
    },
    {
      title: "Notifications",
      icon: "notifications",
      settings: [
        {
          name: "Enable Notifications",
          desc: "Enable email and in-app alerts",
          value: notifications,
          onChange: setNotifications,
          type: "toggle"
        },
        {
          name: "Email Alerts",
          desc: "Receive notifications via email",
          value: emailAlerts,
          onChange: setEmailAlerts,
          type: "toggle"
        },
        {
          name: "SMS Alerts",
          desc: "Receive notifications via SMS",
          value: smsAlerts,
          onChange: setSmsAlerts,
          type: "toggle"
        },
      ]
    },
    {
      title: "Dashboard",
      icon: "dashboard",
      settings: [
        {
          name: "Auto-refresh dashboards",
          desc: "Refresh KPIs every 60 seconds",
          value: autoRefresh,
          onChange: setAutoRefresh,
          type: "toggle"
        },
      ]
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-base-content">Settings</h1>
        <p className="text-sm text-base-content/60 mt-1">Manage your account preferences and system settings</p>
      </div>

      {/* Settings Categories */}
      <div className="space-y-6">
        {settingsCategories.map((category) => (
          <div key={category.title} className="card bg-base-100 border border-base-300 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <span className="material-symbols-outlined text-primary">{category.icon}</span>
              </div>
              <h2 className="text-xl font-bold text-base-content">{category.title}</h2>
            </div>
            <div className="space-y-4">
              {category.settings.map((setting, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-base-200 rounded-lg">
                  <div className="flex-1">
                    <div className="font-semibold text-base-content">{setting.name}</div>
                    <div className="text-sm text-base-content/60 mt-1">{setting.desc}</div>
                  </div>
                  {setting.type === "toggle" && (
                    <input
                      type="checkbox"
                      className="toggle toggle-primary"
                      checked={setting.value}
                      onChange={(e) => setting.onChange(e.target.checked)}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Account Settings */}
      <div className="card bg-base-100 border border-base-300 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-info/10 rounded-lg flex items-center justify-center">
            <span className="material-symbols-outlined text-info">account_circle</span>
          </div>
          <h2 className="text-xl font-bold text-base-content">Account</h2>
        </div>
        <div className="space-y-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Email</span>
            </label>
            <input type="email" className="input input-bordered" defaultValue="admin@optiwms.com" />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Full Name</span>
            </label>
            <input type="text" className="input input-bordered" defaultValue="Henry Kaul" />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Role</span>
            </label>
            <input type="text" className="input input-bordered" defaultValue="Administrator" disabled />
          </div>
          <button className="btn btn-primary">
            <span className="material-symbols-outlined">save</span>
            Save Changes
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="card bg-base-100 border border-error/20 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-error/10 rounded-lg flex items-center justify-center">
            <span className="material-symbols-outlined text-error">warning</span>
          </div>
          <h2 className="text-xl font-bold text-error">Danger Zone</h2>
        </div>
        <div className="space-y-4">
          <div className="p-4 bg-base-200 rounded-lg">
            <div className="font-semibold text-base-content mb-2">Reset All Settings</div>
            <div className="text-sm text-base-content/60 mb-4">Reset all settings to their default values</div>
            <button className="btn btn-outline btn-error btn-sm">
              <span className="material-symbols-outlined">restart_alt</span>
              Reset Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
