"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { accountApi, UserProfile } from "@/lib/api/account";
import { showToast } from "@/lib/utils/toast";
import { logger } from "@/lib/utils/logger";
import { useAdmin } from "@/contexts/AdminContext";

export default function AccountSettingsPage() {
  const { admin } = useAdmin();
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
      logger.error("[AccountSettings] Failed to load profile:", error);
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
      logger.error("[AccountSettings] Failed to update profile:", error);
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
      logger.error("[AccountSettings] Failed to change password:", error);
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
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-base-content">Account Settings</h1>
        <p className="text-sm text-base-content/60 mt-1">Manage your account information and security</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="lg:col-span-1">
          <div className="card bg-base-100 border border-base-300 p-6">
            <div className="flex flex-col items-center">
              <div className="w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden mb-4">
                <Image
                  src="/assets/avatars/Henry Kual.jpg"
                  alt="Henry Kaul"
                  width={128}
                  height={128}
                  className="rounded-full object-cover"
                />
              </div>
              <h2 className="text-2xl font-bold text-base-content">
                {profile.firstName && profile.lastName ? `${profile.firstName} ${profile.lastName}` : profile.username}
              </h2>
              <p className="text-sm text-base-content/60 mt-1 capitalize">
                {profile.role.replace('_', ' ')}
              </p>
              <button className="btn btn-sm btn-ghost mt-4">
                <span className="material-symbols-outlined">camera_alt</span>
                Change Photo
              </button>
            </div>
          </div>
        </div>

        {/* Account Settings Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Information */}
          <div className="card bg-base-100 border border-base-300 p-6">
            <h3 className="text-xl font-bold text-base-content mb-6">Personal Information</h3>
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">First Name</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
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
                  />
                </div>
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
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button 
                  type="button" 
                  className="btn btn-ghost"
                  onClick={() => setFormData({
                    firstName: profile.firstName,
                    lastName: profile.lastName,
                    email: profile.email,
                    phone: profile.phone || "",
                  })}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <span className="loading loading-spinner loading-sm"></span> : null}
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>

          {/* Security Settings */}
          <div className="card bg-base-100 border border-base-300 p-6">
            <h3 className="text-xl font-bold text-base-content mb-6">Security</h3>
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

              <div className="flex justify-end gap-3 pt-4">
                <button type="submit" className="btn btn-primary" disabled={changingPassword}>
                  {changingPassword ? <span className="loading loading-spinner loading-sm"></span> : null}
                  {changingPassword ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
}

