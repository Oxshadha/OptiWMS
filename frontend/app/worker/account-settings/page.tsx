"use client";

import { useState } from "react";
import Image from "next/image";

export default function WorkerAccountSettingsPage() {
  const [formData, setFormData] = useState({
    firstName: "John",
    lastName: "Doe",
    email: "john.doe@optiwms.com",
    phone: "+1-555-0100",
    workerId: "EMP-2045",
    warehouse: "Warehouse 1",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    emailNotifications: true,
    smsNotifications: false,
  });
  const [avatar, setAvatar] = useState("/assets/avatars/Jhon Doe.jpg");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: API call to update account settings
    console.log("Updating account settings:", formData);
  };

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
            {avatar ? (
              <Image
                src={avatar}
                alt="John Doe"
                width={80}
                height={80}
                className="rounded-full object-cover"
              />
            ) : (
              <span className="material-symbols-outlined text-4xl text-base-content/30">person</span>
            )}
          </div>
          <div>
            <h3 className="font-bold text-base-content">{formData.firstName} {formData.lastName}</h3>
            <p className="text-sm text-base-content/60">Worker ID: {formData.workerId}</p>
          </div>
        </div>
        <label className="btn btn-sm btn-outline w-full cursor-pointer">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                // Validate file type
                if (!file.type.startsWith("image/")) {
                  alert("Please select an image file");
                  return;
                }
                // Validate file size (max 5MB)
                if (file.size > 5 * 1024 * 1024) {
                  alert("Image size should be less than 5MB");
                  return;
                }
                // Create preview URL
                const reader = new FileReader();
                reader.onloadend = () => {
                  setAvatar(reader.result as string);
                  // TODO: Upload to server
                  console.log("Uploading photo:", file.name);
                };
                reader.readAsDataURL(file);
              }
            }}
          />
          <span className="material-symbols-outlined">camera_alt</span>
          Change Photo
        </label>
      </div>

      {/* Personal Information */}
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <h3 className="font-bold text-base-content mb-4">Personal Information</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
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
          <div className="flex items-center justify-between p-3 bg-base-200 rounded-lg">
            <div>
              <div className="text-sm text-base-content/60">Worker ID</div>
              <div className="font-semibold text-base-content">{formData.workerId}</div>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 bg-base-200 rounded-lg">
            <div>
              <div className="text-sm text-base-content/60">Warehouse</div>
              <div className="font-semibold text-base-content">{formData.warehouse}</div>
            </div>
          </div>
          <button type="submit" className="btn btn-primary w-full">
            Save Changes
          </button>
        </form>
      </div>

      {/* Security */}
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <h3 className="font-bold text-base-content mb-4">Security</h3>
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
          <button className="btn btn-primary w-full">
            Update Password
          </button>
        </div>
      </div>

      {/* Notification Preferences */}
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <h3 className="font-bold text-base-content mb-4">Notification Preferences</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-base-content">Email Notifications</div>
              <div className="text-sm text-base-content/60">Receive notifications via email</div>
            </div>
            <input
              type="checkbox"
              className="toggle toggle-primary"
              checked={formData.emailNotifications}
              onChange={(e) => setFormData({ ...formData, emailNotifications: e.target.checked })}
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-base-content">SMS Notifications</div>
              <div className="text-sm text-base-content/60">Receive notifications via SMS</div>
            </div>
            <input
              type="checkbox"
              className="toggle toggle-primary"
              checked={formData.smsNotifications}
              onChange={(e) => setFormData({ ...formData, smsNotifications: e.target.checked })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

