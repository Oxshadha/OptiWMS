"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

export default function WorkerProfilePage() {
  const worker = {
    name: "John Doe",
    id: "EMP-2045",
    warehouse: "Warehouse 1",
    status: "Online",
    deviceId: "e8b5d4",
    avatar: "/assets/avatars/Jhon Doe.jpg",
    email: "john.doe@optiwms.com",
    phone: "+1-555-0100",
    joinDate: "2023-01-15",
    shift: "Day Shift (8:00 AM - 5:00 PM)",
    department: "Warehouse Operations",
  };

  const stats = [
    { label: "Tasks Completed", value: "1,234", icon: "task_alt" },
    { label: "Tasks Today", value: "12", icon: "today" },
    { label: "Avg Task Time", value: "15 min", icon: "schedule" },
    { label: "Accuracy Rate", value: "98.5%", icon: "verified" },
  ];

  return (
    <div className="p-4 space-y-4">
      {/* Profile Header */}
      <div className="bg-base-100 rounded-xl p-6 border border-base-300">
        <div className="flex flex-col items-center">
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden mb-4">
            <Image
              src="/assets/avatars/Jhon Doe.jpg"
              alt={worker.name}
              width={96}
              height={96}
              className="rounded-full object-cover"
            />
          </div>
          <h2 className="text-2xl font-bold text-base-content">{worker.name}</h2>
          <p className="text-sm text-base-content/60 mt-1">Worker ID: {worker.id}</p>
          <div className="flex items-center gap-2 mt-2">
            <div className="w-2 h-2 bg-success rounded-full"></div>
            <span className="text-sm text-base-content/60">{worker.status}</span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-base-100 rounded-xl p-4 border border-base-300">
            <div className="flex items-center justify-between mb-2">
              <span className="material-symbols-outlined text-2xl text-primary">{stat.icon}</span>
            </div>
            <div className="text-2xl font-bold text-base-content">{stat.value}</div>
            <div className="text-xs text-base-content/60 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Personal Information */}
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <h3 className="font-bold text-base-content mb-4">Personal Information</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-base-200 rounded-lg">
            <div>
              <div className="text-sm text-base-content/60">Email</div>
              <div className="font-semibold text-base-content">{worker.email}</div>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 bg-base-200 rounded-lg">
            <div>
              <div className="text-sm text-base-content/60">Phone</div>
              <div className="font-semibold text-base-content">{worker.phone}</div>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 bg-base-200 rounded-lg">
            <div>
              <div className="text-sm text-base-content/60">Warehouse</div>
              <div className="font-semibold text-base-content">{worker.warehouse}</div>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 bg-base-200 rounded-lg">
            <div>
              <div className="text-sm text-base-content/60">Shift</div>
              <div className="font-semibold text-base-content">{worker.shift}</div>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 bg-base-200 rounded-lg">
            <div>
              <div className="text-sm text-base-content/60">Department</div>
              <div className="font-semibold text-base-content">{worker.department}</div>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 bg-base-200 rounded-lg">
            <div>
              <div className="text-sm text-base-content/60">Join Date</div>
              <div className="font-semibold text-base-content">{worker.joinDate}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <Link 
          href="/worker/account-settings"
          className="btn btn-outline w-full"
        >
          <span className="material-symbols-outlined">edit</span>
          Edit Profile
        </Link>
        <button 
          className="btn btn-outline w-full"
          onClick={() => {
            // TODO: Open help & support modal or navigate to help page
            // For now, show a simple message
            if (confirm("Need help? Contact support at support@optiwms.com or call +1-555-0100")) {
              // Could open email client or phone dialer
              window.location.href = "mailto:support@optiwms.com";
            }
          }}
        >
          <span className="material-symbols-outlined">help</span>
          Help & Support
        </button>
      </div>
    </div>
  );
}

