"use client";

import { useState } from "react";
import Image from "next/image";

export default function ProfilePage() {
  const [formData, setFormData] = useState({
    firstName: "Henry",
    lastName: "Kaul",
    email: "henry.kaul@optiwms.com",
    phone: "+1-555-0100",
    role: "Admin",
    department: "Operations",
    avatar: "/assets/avatars/Henry Kual.jpg",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: API call to update profile
    console.log("Updating profile:", formData);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold text-base-content">Profile</h1>
        <p className="text-sm text-base-content/60 mt-1">Manage your account information</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Card */}
        <div className="lg:col-span-1">
          <div className="card bg-base-100 border border-base-300 p-6">
            <div className="flex flex-col items-center">
              <div className="w-32 h-32 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden mb-4">
                <Image
                  src={formData.avatar}
                  alt={`${formData.firstName} ${formData.lastName}`}
                  width={128}
                  height={128}
                  className="rounded-full object-cover"
                />
              </div>
              <h2 className="text-2xl font-bold text-base-content">
                {formData.firstName} {formData.lastName}
              </h2>
              <p className="text-sm text-base-content/60 mt-1">{formData.role}</p>
              <p className="text-sm text-base-content/60">{formData.department}</p>
              <button className="btn btn-sm btn-ghost mt-4">
                <span className="material-symbols-outlined">camera_alt</span>
                Change Photo
              </button>
            </div>
          </div>
        </div>

        {/* Profile Form */}
        <div className="lg:col-span-2">
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

              <div className="grid grid-cols-2 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Role</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    value={formData.role}
                    disabled
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text font-medium">Department</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered w-full"
                    value={formData.department}
                    disabled
                  />
                </div>
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
        </div>
      </div>
    </div>
  );
}

