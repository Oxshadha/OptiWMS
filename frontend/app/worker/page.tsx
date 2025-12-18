"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWorker } from "@/contexts/WorkerContext";
import { filterOperationsByRole, OPERATIONS } from "@/lib/worker-roles";

export default function WorkerHome() {
  const { role, isLoading } = useWorker();
  const [showUnauthorizedMessage, setShowUnauthorizedMessage] = useState(false);

  // Debug: Log role changes
  useEffect(() => {
    console.log("[WorkerHome] Current role:", role);
  }, [role]);

  useEffect(() => {
    // Check for unauthorized error in URL
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("error") === "unauthorized") {
      setShowUnauthorizedMessage(true);
      // Clear the error parameter from URL
      window.history.replaceState({}, "", "/worker");
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

  return (
    <div
      className="w-full px-2 py-3 md:px-4 md:py-4 lg:px-6 lg:py-6"
      style={{
        background: "oklch(98% 0 0)",
        boxSizing: "border-box",
      }}
    >
      {showUnauthorizedMessage && (
        <div className="alert alert-error mb-4 max-w-4xl mx-auto">
          <span className="material-symbols-outlined">error</span>
          <span>You don't have permission to access that operation.</span>
        </div>
      )}
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : widgets.length === 0 ? (
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
                className="active:scale-95 transition-transform hover:scale-105"
                style={{
                  borderRadius: "0.75rem",
                  padding: "0.75rem",
                  background: "rgb(238, 238, 238)",
                  color: "oklch(21% 0.006 285.885)",
                  cursor: "pointer",
                  transition: "transform 0.15s, box-shadow 0.15s",
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  aspectRatio: "1",
                  textDecoration: "none",
                  boxSizing: "border-box",
                  WebkitTapHighlightColor: "transparent",
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.1)";
                }}
              >
                <div
                  className="text-[0.5rem] md:text-xs"
                  style={{
                    textTransform: "uppercase",
                    letterSpacing: "0.5px",
                    opacity: 0.6,
                    marginBottom: "0.5rem",
                    fontWeight: 600,
                    color: "oklch(21% 0.006 285.885)",
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
                    className="text-xs md:text-sm"
                    style={{
                      fontWeight: 700,
                      color: "oklch(21% 0.006 285.885)",
                      lineHeight: "1.2",
                    }}
                  >
                    {widget.title}
                  </div>
                  <div
                    className="text-[0.5rem] md:text-xs"
                    style={{
                      opacity: 0.5,
                      marginTop: "0.125rem",
                      color: "oklch(21% 0.006 285.885)",
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
