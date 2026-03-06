"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdmin } from "@/contexts/AdminContext";
import { ADMIN_ROUTES } from "@/lib/admin-roles";
import { accountApi } from "@/lib/api/account";
import { showToast } from "@/lib/utils/toast";
import { logger } from "@/lib/utils/logger";
import { applyAppTheme } from "@/lib/theme";

const ADMIN_SETTINGS_KEY = "admin_settings";

const defaultUiSettings = {
  darkMode: false,
  notifications: true,
  autoRefresh: true,
  emailAlerts: true,
  smsAlerts: false,
};

export default function SettingsPage() {
  const router = useRouter();
  const { canAccessRoute, isLoading } = useAdmin();
  const [uiSettings, setUiSettings] = useState(defaultUiSettings);
  const [profileLoading, setProfileLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [accountData, setAccountData] = useState({
    email: "",
    fullName: "",
    role: "",
  });

  useEffect(() => {
    if (!isLoading && !canAccessRoute(ADMIN_ROUTES.SETTINGS)) {
      router.push("/admin/dashboard?error=unauthorized");
    }
  }, [isLoading, canAccessRoute, router]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(ADMIN_SETTINGS_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved);
      setUiSettings((prev) => ({ ...prev, ...parsed }));
    } catch (error) {
      logger.error("[AdminSettings] Failed to load UI settings:", error);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(ADMIN_SETTINGS_KEY, JSON.stringify(uiSettings));
    applyAppTheme(uiSettings.darkMode);
  }, [uiSettings]);

  useEffect(() => {
    if (!canAccessRoute(ADMIN_ROUTES.SETTINGS)) {
      setProfileLoading(false);
      return;
    }

    const loadProfile = async () => {
      try {
        setProfileLoading(true);
        const profile = await accountApi.getCurrentUser();
        const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(" ").trim();
        setAccountData({
          email: profile.email,
          fullName: fullName || profile.username,
          role: profile.role.replace(/_/g, " "),
        });
      } catch (error) {
        logger.error("[AdminSettings] Failed to load account settings:", error);
        showToast.error("Failed to load account settings");
      } finally {
        setProfileLoading(false);
      }
    };

    void loadProfile();
  }, [canAccessRoute]);

  const updateUiSetting = (key: keyof typeof defaultUiSettings, value: boolean) => {
    setUiSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleAccountSave = async () => {
    const trimmedName = accountData.fullName.trim();
    const [firstName, ...rest] = trimmedName.split(/\s+/).filter(Boolean);
    const lastName = rest.join(" ");

    if (!firstName) {
      showToast.error("Full name is required");
      return;
    }

    try {
      setSavingProfile(true);
      await accountApi.updateProfile({
        firstName,
        lastName,
        email: accountData.email.trim(),
      });
      showToast.success("Account settings updated");
    } catch (error: any) {
      logger.error("[AdminSettings] Failed to save account settings:", error);
      showToast.error(error.message || "Failed to save account settings");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleResetSettings = () => {
    setUiSettings(defaultUiSettings);
    showToast.success("Settings reset to defaults");
  };

  if (isLoading || profileLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (!canAccessRoute(ADMIN_ROUTES.SETTINGS)) {
    return null;
  }

  const settingsCategories = [
    {
      title: "Appearance",
      icon: "palette",
      settings: [
        {
          name: "Dark mode",
          desc: "Toggle dark/light theme",
          value: uiSettings.darkMode,
          onChange: (value: boolean) => updateUiSetting("darkMode", value),
        },
      ],
    },
    {
      title: "Notifications",
      icon: "notifications",
      settings: [
        {
          name: "Enable Notifications",
          desc: "Enable email and in-app alerts",
          value: uiSettings.notifications,
          onChange: (value: boolean) => updateUiSetting("notifications", value),
        },
        {
          name: "Email Alerts",
          desc: "Receive notifications via email",
          value: uiSettings.emailAlerts,
          onChange: (value: boolean) => updateUiSetting("emailAlerts", value),
        },
        {
          name: "SMS Alerts",
          desc: "Receive notifications via SMS",
          value: uiSettings.smsAlerts,
          onChange: (value: boolean) => updateUiSetting("smsAlerts", value),
        },
      ],
    },
    {
      title: "Dashboard",
      icon: "dashboard",
      settings: [
        {
          name: "Auto-refresh dashboards",
          desc: "Refresh KPIs every 60 seconds",
          value: uiSettings.autoRefresh,
          onChange: (value: boolean) => updateUiSetting("autoRefresh", value),
        },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-base-content">Settings</h1>
        <p className="text-sm text-base-content/60 mt-1">Manage your account preferences and system settings</p>
      </div>

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
              {category.settings.map((setting) => (
                <div key={setting.name} className="flex items-center justify-between p-4 bg-base-200 rounded-lg">
                  <div className="flex-1">
                    <div className="font-semibold text-base-content">{setting.name}</div>
                    <div className="text-sm text-base-content/60 mt-1">{setting.desc}</div>
                  </div>
                  <input
                    type="checkbox"
                    className="toggle toggle-primary"
                    checked={setting.value}
                    onChange={(e) => setting.onChange(e.target.checked)}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

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
            <input
              type="email"
              className="input input-bordered"
              value={accountData.email}
              onChange={(e) => setAccountData((prev) => ({ ...prev, email: e.target.value }))}
              disabled={savingProfile}
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Full Name</span>
            </label>
            <input
              type="text"
              className="input input-bordered"
              value={accountData.fullName}
              onChange={(e) => setAccountData((prev) => ({ ...prev, fullName: e.target.value }))}
              disabled={savingProfile}
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Role</span>
            </label>
            <input type="text" className="input input-bordered" value={accountData.role} disabled />
          </div>
          <button className="btn btn-primary" onClick={() => void handleAccountSave()} disabled={savingProfile}>
            <span className="material-symbols-outlined">save</span>
            {savingProfile ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

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
            <div className="text-sm text-base-content/60 mb-4">Reset all UI settings to their default values</div>
            <button className="btn btn-outline btn-error btn-sm" onClick={handleResetSettings}>
              <span className="material-symbols-outlined">restart_alt</span>
              Reset Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
