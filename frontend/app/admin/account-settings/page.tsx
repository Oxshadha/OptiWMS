"use client";

import { useState } from "react";
import Image from "next/image";

export default function AccountSettingsPage() {
  const [formData, setFormData] = useState({
    firstName: "Henry",
    lastName: "Kaul",
    email: "henry.kaul@optiwms.com",
    phone: "+1-555-0100",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    twoFactorEnabled: false,
    emailNotifications: true,
    smsNotifications: false,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: API call to update account settings
    console.log("Updating account settings:", formData);
  };

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
                {formData.firstName} {formData.lastName}
              </h2>
              <p className="text-sm text-base-content/60 mt-1">Admin</p>
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
            <form onSubmit={handleSubmit} className="space-y-4">
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
                <button type="button" className="btn btn-ghost">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>

          {/* Security Settings */}
          <div className="card bg-base-100 border border-base-300 p-6">
            <h3 className="text-xl font-bold text-base-content mb-6">Security</h3>
            <div className="space-y-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Current Password</span>
                </label>
                <input
                  type="password"
                  className="input input-bordered w-full"
                  value={formData.currentPassword}
                  onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">New Password</span>
                </label>
                <input
                  type="password"
                  className="input input-bordered w-full"
                  value={formData.newPassword}
                  onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                />
              </div>

              <div className="form-control">
                <label className="label">
                  <span className="label-text font-medium">Confirm New Password</span>
                </label>
                <input
                  type="password"
                  className="input input-bordered w-full"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                />
              </div>

              <div className="form-control">
                <label className="label cursor-pointer justify-start gap-3">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-primary"
                    checked={formData.twoFactorEnabled}
                    onChange={(e) => setFormData({ ...formData, twoFactorEnabled: e.target.checked })}
                  />
                  <span className="label-text">Enable Two-Factor Authentication</span>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button className="btn btn-primary">
                  Update Password
                </button>
              </div>
            </div>
          </div>

          {/* Notification Preferences */}
          <div className="card bg-base-100 border border-base-300 p-6">
            <h3 className="text-xl font-bold text-base-content mb-6">Notification Preferences</h3>
            <div className="space-y-4">
              <div className="form-control">
                <label className="label cursor-pointer justify-start gap-3">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-primary"
                    checked={formData.emailNotifications}
                    onChange={(e) => setFormData({ ...formData, emailNotifications: e.target.checked })}
                  />
                  <span className="label-text">Email Notifications</span>
                </label>
              </div>
              <div className="form-control">
                <label className="label cursor-pointer justify-start gap-3">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-primary"
                    checked={formData.smsNotifications}
                    onChange={(e) => setFormData({ ...formData, smsNotifications: e.target.checked })}
                  />
                  <span className="label-text">SMS Notifications</span>
                </label>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button className="btn btn-primary">
                  Save Preferences
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

