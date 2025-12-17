"use client";

import Image from "next/image";
import Link from "next/link";

export default function WorkerProfilePage() {
  const worker = {
    name: "John Doe",
    id: "EMP-2045",
    warehouse: "Warehouse 1",
    status: "Online",
    deviceId: "e8b5d4",
    avatar: "/assets/avatars/placeholder.svg",
    email: "john.doe@optiwms.com",
    phone: "+1 234-567-8900",
    joinDate: "2023-01-15",
    totalTasks: 1247,
    completedTasks: 1189,
    completionRate: 95.3,
  };

  const stats = [
    { label: "Total Tasks", value: worker.totalTasks, icon: "task" },
    { label: "Completed", value: worker.completedTasks, icon: "check_circle" },
    { label: "Success Rate", value: `${worker.completionRate}%`, icon: "trending_up" },
  ];

  return (
    <div className="p-4 space-y-4">
      {/* Profile Header */}
      <div className="bg-base-100 rounded-xl p-6 border border-base-300 text-center">
        <div className="flex justify-center mb-4">
          <Image
            src={worker.avatar}
            alt={worker.name}
            width={100}
            height={100}
            className="rounded-full border-4 border-primary"
          />
        </div>
        <h2 className="text-2xl font-bold text-base-content mb-1">{worker.name}</h2>
        <div className="text-sm text-base-content/60 mb-3">{worker.id}</div>
        <div className="flex items-center justify-center gap-2">
          <div className="w-2 h-2 bg-success rounded-full"></div>
          <span className="text-sm text-success font-medium">{worker.status}</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-base-100 rounded-xl p-4 border border-base-300 text-center">
            <div className="text-2xl mb-2">
              <span className="material-symbols-outlined text-primary">{stat.icon}</span>
            </div>
            <div className="text-xl font-bold text-base-content">{stat.value}</div>
            <div className="text-xs text-base-content/60 mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Personal Information */}
      <div className="bg-base-100 rounded-xl p-4 border border-base-300">
        <h3 className="font-bold text-base-content mb-4">Personal Information</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-base-200 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-base-content/60">email</span>
              <span className="text-sm text-base-content/60">Email</span>
            </div>
            <span className="font-medium text-base-content">{worker.email}</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-base-200 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-base-content/60">phone</span>
              <span className="text-sm text-base-content/60">Phone</span>
            </div>
            <span className="font-medium text-base-content">{worker.phone}</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-base-200 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-base-content/60">warehouse</span>
              <span className="text-sm text-base-content/60">Warehouse</span>
            </div>
            <span className="font-medium text-base-content">{worker.warehouse}</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-base-200 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-base-content/60">calendar_today</span>
              <span className="text-sm text-base-content/60">Join Date</span>
            </div>
            <span className="font-medium text-base-content">{worker.joinDate}</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-base-200 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-base-content/60">devices</span>
              <span className="text-sm text-base-content/60">Device ID</span>
            </div>
            <span className="font-medium text-base-content">{worker.deviceId}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <button className="btn btn-outline w-full">
          <span className="material-symbols-outlined">edit</span>
          Edit Profile
        </button>
        <button className="btn btn-outline w-full">
          <span className="material-symbols-outlined">settings</span>
          Settings
        </button>
        <Link href="/worker/login" className="btn btn-error w-full">
          <span className="material-symbols-outlined">logout</span>
          Logout
        </Link>
      </div>
    </div>
  );
}

