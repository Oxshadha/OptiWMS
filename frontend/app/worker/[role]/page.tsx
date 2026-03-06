"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { useWorker } from "@/contexts/WorkerContext";
import {
  filterOperationsByRole,
  OPERATIONS,
  isValidRole,
} from "@/lib/worker-roles";

export default function RoleBasedWorkerHome() {
  const router = useRouter();
  const params = useParams();
  const { role, isLoading } = useWorker();
  const urlRole = params.role as string;
  const [showUnauthorizedMessage, setShowUnauthorizedMessage] = useState(false);

  // Redirect if role in URL doesn't match current role
  useEffect(() => {
    if (!isLoading && role) {
      // If URL role doesn't match current role, update URL
      if (urlRole !== role) {
        router.replace(`/worker/${role}`);
      }
    } else if (!isLoading && !role) {
      // If no role, redirect to login
      router.replace("/worker/login");
    }
  }, [role, urlRole, isLoading, router]);

  // If role in URL is invalid, redirect to base worker page
  useEffect(() => {
    if (urlRole && !isValidRole(urlRole)) {
      router.replace("/worker");
    }
  }, [urlRole, router]);

  useEffect(() => {
    // Check for unauthorized error in URL
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("error") === "unauthorized") {
      setShowUnauthorizedMessage(true);
      // Clear the error parameter from URL
      const newUrl = window.location.pathname;
      window.history.replaceState({}, "", newUrl);
    }
  }, []);

  const allWidgets = [
    // Row 1
    {
      id: 1,
      header: "RECEIVING",
      title: "Receiving",
      subtitle: "Tap to open",
      icon: "input",
      href: "/worker/receiving",
      operation: OPERATIONS.RECEIVING,
    },
    {
      id: 2,
      header: "PUTAWAY",
      title: "Putaway",
      subtitle: "Tap to open",
      icon: "inventory_2",
      href: "/worker/putaway",
      operation: OPERATIONS.PUTAWAY,
    },
    // Row 2
    {
      id: 3,
      header: "PICKING",
      title: "Picking",
      subtitle: "Tap to open",
      icon: "shopping_cart",
      href: "/worker/picking",
      operation: OPERATIONS.PICKING,
    },
    {
      id: 4,
      header: "CYCLE COUNT",
      title: "Cycle Count",
      subtitle: "Tap to open",
      icon: "autorenew",
      href: "/worker/cycle-count",
      operation: OPERATIONS.CYCLE_COUNT,
    },
    // Row 3
    {
      id: 5,
      header: "STOCK TRANSFER",
      title: "Stock Transfer",
      subtitle: "Tap to open",
      icon: "swap_horiz",
      href: "/worker/stock-transfer",
      operation: OPERATIONS.STOCK_TRANSFER,
    },
    {
      id: 6,
      header: "PACKING",
      title: "Packing",
      subtitle: "Tap to open",
      icon: "inventory",
      href: "/worker/packing",
      operation: OPERATIONS.PACKING,
    },
    // Row 4
    {
      id: 7,
      header: "SHIPMENTS",
      title: "Shipments",
      subtitle: "Tap to open",
      icon: "local_shipping",
      href: "/worker/shipments",
      operation: OPERATIONS.SHIPMENTS,
    },
    {
      id: 8,
      header: "RETURNS",
      title: "Returns",
      subtitle: "Tap to open",
      icon: "keyboard_return",
      href: "/worker/returns",
      operation: OPERATIONS.RETURNS,
    },
  ];

  // Filter widgets based on worker role
  const widgets = isLoading
    ? []
    : filterOperationsByRole(allWidgets, role || null);

  // Show loading while checking
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  // If role doesn't match, show loading while redirecting
  if (role && urlRole !== role) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div className="w-full px-2 py-3 md:px-4 md:py-4 lg:px-6 lg:py-6 box-border bg-base-200">
      {showUnauthorizedMessage && (
        <div className="alert alert-error mb-4 max-w-4xl mx-auto">
          <span className="material-symbols-outlined">error</span>
          <span>You don't have permission to access that operation.</span>
        </div>
      )}
      {widgets.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-center p-4">
          <span className="material-symbols-outlined text-6xl text-base-content/30 mb-4">
            lock
          </span>
          <h3 className="text-lg font-semibold text-base-content mb-2">
            No Operations Available
          </h3>
          <p className="text-sm text-base-content/60">
            {role
              ? "You don't have permission to access any operations. Please contact your administrator."
              : "Please log in to access operations."}
          </p>
        </div>
      ) : (
        <div className="max-w-6xl mx-auto">
          <div
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
            style={{
              gap: "0.75rem",
            }}
          >
            {widgets.map((widget) => (
              <Link
                key={widget.id}
                href={widget.href}
                className="active:scale-95 transition-all hover:scale-105 rounded-xl p-3 bg-base-100 border border-base-300 text-base-content cursor-pointer relative flex flex-col aspect-square no-underline box-border shadow-sm hover:shadow-lg"
                style={{
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                <div
                  className="text-[0.5rem] md:text-xs text-base-content/60"
                  style={{
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    marginBottom: "0.5rem",
                    fontWeight: 600,
                    lineHeight: "1.2",
                  }}
                >
                  {widget.header}
                </div>
                <div
                  className="flex items-center justify-center flex-1"
                  style={{
                    marginBottom: "0.25rem",
                    color: "#CF0F47",
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{
                      fontSize: "clamp(1.5rem, 4vw, 2.5rem)",
                    }}
                  >
                    {widget.icon}
                  </span>
                </div>
                <div style={{ marginTop: "auto" }}>
                  <div
                    className="text-xs md:text-sm text-base-content"
                    style={{
                      fontWeight: 700,
                      lineHeight: "1.2",
                    }}
                  >
                    {widget.title}
                  </div>
                  <div
                    className="text-[0.5rem] md:text-xs text-base-content/50"
                    style={{
                      marginTop: "0.125rem",
                      lineHeight: "1.2",
                    }}
                  >
                    {widget.subtitle}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
