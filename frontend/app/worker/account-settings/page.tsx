"use client";

import { useState, useEffect } from "react";
import { accountApi, UserProfile } from "@/lib/api/account";
import { showToast } from "@/lib/utils/toast";
import { logger } from "@/lib/utils/logger";

export default function WorkerAccountSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
  });
  
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  // Load user profile on mount
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const data = await accountApi.getCurrentUser();
      setProfile(data);
      setFormData({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone || "",
      });
    } catch (error) {
      logger.error("[WorkerAccountSettings] Failed to load profile:", error);
      showToast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      await accountApi.updateProfile(formData);
      showToast.success("Profile updated successfully");
      await loadProfile(); // Reload to get updated data
    } catch (error: any) {
      logger.error("[WorkerAccountSettings] Failed to update profile:", error);
      showToast.error(error.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate passwords match
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showToast.error("New passwords do not match");
      return;
    }
    
    // Validate password length
    if (passwordData.newPassword.length < 6) {
      showToast.error("Password must be at least 6 characters");
      return;
    }
    
    try {
      setChangingPassword(true);
      await accountApi.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      showToast.success("Password changed successfully");
      
      // Clear password fields
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    } catch (error: any) {
      logger.error("[WorkerAccountSettings] Failed to change password:", error);
      showToast.error(error.message || "Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading || !profile) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <h2 className="text-xl font-bold text-base-content mb-4">Account Settings</h2>
        <p className="text-sm text-base-content/60">
          Manage your account information and security.
        </p>
      </div>

      {/* Profile Section */}
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
            {/* Display user initials */}
            <div className="text-3xl font-bold text-primary">
              {profile.firstName?.[0]?.toUpperCase() || ''}{profile.lastName?.[0]?.toUpperCase() || ''}
            </div>
          </div>
          <div>
            <h3 className="font-bold text-base-content">
              {profile.firstName && profile.lastName ? `${profile.firstName} ${profile.lastName}` : profile.username}
            </h3>
            <p className="text-sm text-base-content/60 capitalize">
              {profile.role.replace('_', ' ')}
            </p>
          </div>
        </div>
      </div>

      {/* Personal Information */}
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <h3 className="font-bold text-base-content mb-4">Personal Information</h3>
        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">First Name</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              disabled={saving}
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Last Name</span>
            </label>
            <input
              type="text"
              className="input input-bordered w-full"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              disabled={saving}
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Email</span>
            </label>
            <input
              type="email"
              className="input input-bordered w-full"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              disabled={saving}
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Phone</span>
            </label>
            <input
              type="tel"
              className="input input-bordered w-full"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              disabled={saving}
            />
          </div>
          <div className="flex items-center justify-between p-3 bg-base-200 rounded-lg">
            <div>
              <div className="text-sm text-base-content/60">Username</div>
              <div className="font-semibold text-base-content">{profile.username}</div>
            </div>
          </div>
          <button type="submit" className="btn btn-primary w-full" disabled={saving}>
            {saving ? <span className="loading loading-spinner loading-sm"></span> : null}
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </div>

      {/* Security */}
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <h3 className="font-bold text-base-content mb-4">Security</h3>
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Current Password</span>
            </label>
            <input
              type="password"
              className="input input-bordered w-full"
              value={passwordData.currentPassword}
              onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
              required
              disabled={changingPassword}
            />
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">New Password</span>
            </label>
            <input
              type="password"
              className="input input-bordered w-full"
              value={passwordData.newPassword}
              onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
              required
              minLength={6}
              disabled={changingPassword}
            />
            <label className="label">
              <span className="label-text-alt">Minimum 6 characters</span>
            </label>
          </div>
          <div className="form-control">
            <label className="label">
              <span className="label-text font-medium">Confirm New Password</span>
            </label>
            <input
              type="password"
              className="input input-bordered w-full"
              value={passwordData.confirmPassword}
              onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
              required
              minLength={6}
              disabled={changingPassword}
            />
          </div>
          <button type="submit" className="btn btn-primary w-full" disabled={changingPassword}>
            {changingPassword ? <span className="loading loading-spinner loading-sm"></span> : null}
            {changingPassword ? "Updating..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
