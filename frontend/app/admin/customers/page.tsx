"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";

const customers = [
  {
    id: "CUST-001",
    name: "Acme Corp",
    contact: "alice@acme.com",
    phone: "+1 234-567-8900",
    orders: 42,
    totalSpent: "$45,230",
    status: "Active",
    joinDate: "2023-01-15",
  },
  {
    id: "CUST-002",
    name: "Bright Retail",
    contact: "ops@bright.com",
    phone: "+1 234-567-8901",
    orders: 18,
    totalSpent: "$18,500",
    status: "Active",
    joinDate: "2023-03-22",
  },
  {
    id: "CUST-003",
    name: "Delta Mart",
    contact: "supply@delta.com",
    phone: "+1 234-567-8902",
    orders: 9,
    totalSpent: "$9,200",
    status: "On Hold",
    joinDate: "2023-06-10",
  },
  {
    id: "CUST-004",
    name: "Echo Stores",
    contact: "contact@echo.com",
    phone: "+1 234-567-8903",
    orders: 25,
    totalSpent: "$32,100",
    status: "Active",
    joinDate: "2023-02-08",
  },
];

const statusClass = (s: string) => {
  if (s === "Active") return "badge-success";
  if (s === "On Hold") return "badge-warning";
  return "badge-outline";
};

export default function CustomersPage() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.contact.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalCustomers = customers.length;
  const activeCustomers = customers.filter((c) => c.status === "Active").length;
  const totalOrders = customers.reduce((sum, c) => sum + c.orders, 0);
  const totalRevenue = customers.reduce((sum, c) => {
    const amount = parseFloat(c.totalSpent.replace(/[^0-9.]/g, ""));
    return sum + amount;
  }, 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-base-content">
          Customers ({totalCustomers})
        </h1>
        <div className="flex gap-3">
          <button className="btn btn-sm btn-ghost">
            <span className="material-symbols-outlined">swap_vert</span>
            <span>Sort by</span>
          </button>
          <button className="btn btn-sm btn-ghost">
            <span className="material-symbols-outlined">filter_list</span>
            <span>Filter</span>
          </button>
          <Link
            href="/admin/customers/create"
            className="btn btn-sm btn-primary"
          >
            <span className="material-symbols-outlined">add</span>
            <span>Add Customer</span>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card bg-base-100 border border-base-300 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-base-content/60">
                Total Customers
              </div>
              <div className="text-2xl font-bold text-base-content">
                {totalCustomers}
              </div>
            </div>
            <span className="material-symbols-outlined text-3xl text-primary">
              group
            </span>
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-base-content/60">Active</div>
              <div className="text-2xl font-bold text-success">
                {activeCustomers}
              </div>
            </div>
            <span className="material-symbols-outlined text-3xl text-success">
              check_circle
            </span>
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-base-content/60">Total Orders</div>
              <div className="text-2xl font-bold text-base-content">
                {totalOrders}
              </div>
            </div>
            <span className="material-symbols-outlined text-3xl text-info">
              inventory_2
            </span>
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-base-content/60">Total Revenue</div>
              <div className="text-2xl font-bold text-base-content">
                ${totalRevenue.toLocaleString()}
              </div>
            </div>
            <span className="material-symbols-outlined text-3xl text-warning">
              payments
            </span>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-4 items-center">
        <div className="flex-1">
          <label className="input input-bordered flex items-center gap-2 w-full">
            <span className="material-symbols-outlined text-base-content/60">
              search
            </span>
            <input
              type="text"
              className="grow"
              placeholder="Search customers by name, email, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </label>
        </div>
      </div>

      {/* Customers Table */}
      <div className="card bg-base-100 border border-base-300 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead className="bg-base-200">
              <tr>
                <th className="font-semibold text-base-content">Customer ID</th>
                <th className="font-semibold text-base-content">Name</th>
                <th className="font-semibold text-base-content">Contact</th>
                <th className="font-semibold text-base-content">Phone</th>
                <th className="font-semibold text-base-content">Orders</th>
                <th className="font-semibold text-base-content">Total Spent</th>
                <th className="font-semibold text-base-content">Status</th>
                <th className="font-semibold text-base-content">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.map((c) => (
                <tr key={c.id} className="hover:bg-base-200/50">
                  <td className="font-semibold text-primary">{c.id}</td>
                  <td className="font-medium">{c.name}</td>
                  <td className="text-base-content/70">{c.contact}</td>
                  <td className="text-base-content/70">{c.phone}</td>
                  <td>{c.orders}</td>
                  <td className="font-semibold">{c.totalSpent}</td>
                  <td>
                    <span className={`badge ${statusClass(c.status)}`}>
                      {c.status}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn btn-ghost btn-xs" title="View">
                        <span className="material-symbols-outlined text-sm">
                          visibility
                        </span>
                      </button>
                      <button className="btn btn-ghost btn-xs" title="Edit">
                        <span className="material-symbols-outlined text-sm">
                          edit
                        </span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
