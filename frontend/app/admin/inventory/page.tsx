"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";

const inventory = [
  {
    sku: "SKU-1001",
    name: "Wireless Earbuds",
    qty: 240,
    location: "A1",
    status: "Available",
    category: "Electronics",
  },
  {
    sku: "SKU-1002",
    name: "Smart Projector",
    qty: 56,
    location: "B3",
    status: "Available",
    category: "Electronics",
  },
  {
    sku: "SKU-1003",
    name: "Smart Mug",
    qty: 18,
    location: "C2",
    status: "Low",
    category: "Home",
  },
  {
    sku: "SKU-1004",
    name: "Instant Pot",
    qty: 90,
    location: "D4",
    status: "Available",
    category: "Appliances",
  },
  {
    sku: "SKU-1005",
    name: "Yoga Mat",
    qty: 5,
    location: "E1",
    status: "Out of Stock",
    category: "Sports",
  },
  {
    sku: "SKU-1006",
    name: "Bluetooth Speaker",
    qty: 120,
    location: "A5",
    status: "Available",
    category: "Electronics",
  },
];

const statusClass = (s: string) => {
  if (s === "Available") return "badge-success";
  if (s === "Low") return "badge-warning";
  if (s === "Out of Stock") return "badge-error";
  return "badge-outline";
};

const categories = ["All", "Electronics", "Home", "Appliances", "Sports"];

export default function InventoryPage() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredInventory = inventory.filter((item) => {
    const matchesCategory =
      activeCategory === "All" || item.category === activeCategory;
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const totalItems = inventory.reduce((sum, item) => sum + item.qty, 0);
  const lowStockItems = inventory.filter(
    (item) => item.status === "Low" || item.status === "Out of Stock"
  ).length;
  const availableItems = inventory.filter(
    (item) => item.status === "Available"
  ).length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-base-content">Inventory</h1>
        <div className="flex gap-3">
          <button className="btn btn-sm btn-ghost">
            <span className="material-symbols-outlined">swap_vert</span>
            <span>Sort by</span>
          </button>
          <Link
            href="/admin/inventory/create"
            className="btn btn-sm btn-primary"
          >
            <span className="material-symbols-outlined">add</span>
            <span>Add Item</span>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card bg-base-100 border border-base-300 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-base-content/60">Total Items</div>
              <div className="text-2xl font-bold text-base-content">
                {totalItems.toLocaleString()}
              </div>
            </div>
            <span className="material-symbols-outlined text-3xl text-primary">
              inventory
            </span>
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-base-content/60">Available</div>
              <div className="text-2xl font-bold text-success">
                {availableItems}
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
              <div className="text-sm text-base-content/60">Low Stock</div>
              <div className="text-2xl font-bold text-warning">
                {lowStockItems}
              </div>
            </div>
            <span className="material-symbols-outlined text-3xl text-warning">
              warning
            </span>
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-base-content/60">Categories</div>
              <div className="text-2xl font-bold text-base-content">
                {categories.length - 1}
              </div>
            </div>
            <span className="material-symbols-outlined text-3xl text-info">
              category
            </span>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-4 items-center">
        <div className="flex-1">
          <label className="input input-bordered flex items-center gap-2 w-full">
            <span className="material-symbols-outlined text-base-content/60">
              search
            </span>
            <input
              type="text"
              className="grow"
              placeholder="Search by SKU or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </label>
        </div>
        <div className="flex gap-2 bg-base-100 p-1 rounded-xl border border-base-300">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={clsx(
                "px-4 py-2 rounded-lg text-sm transition-all",
                activeCategory === cat
                  ? "bg-neutral text-neutral-content font-medium"
                  : "text-base-content/60 hover:text-base-content"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Inventory Table */}
      <div className="card bg-base-100 border border-base-300 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead className="bg-base-200">
              <tr>
                <th className="font-semibold text-base-content">SKU</th>
                <th className="font-semibold text-base-content">Item Name</th>
                <th className="font-semibold text-base-content">Category</th>
                <th className="font-semibold text-base-content">Quantity</th>
                <th className="font-semibold text-base-content">Location</th>
                <th className="font-semibold text-base-content">Status</th>
                <th className="font-semibold text-base-content">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInventory.map((item) => (
                <tr key={item.sku} className="hover:bg-base-200/50">
                  <td className="font-semibold text-primary">{item.sku}</td>
                  <td>{item.name}</td>
                  <td>
                    <span className="badge badge-outline">{item.category}</span>
                  </td>
                  <td className="font-semibold">{item.qty}</td>
                  <td>
                    <span className="badge badge-ghost">{item.location}</span>
                  </td>
                  <td>
                    <span className={`badge ${statusClass(item.status)}`}>
                      {item.status}
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
