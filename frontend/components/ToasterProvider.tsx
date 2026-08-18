"use client";

import { Toaster } from "react-hot-toast";

export function ToasterProvider() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 3000,
        // Default modern style
        style: {
          background: "var(--fallback-b1,oklch(var(--b1)))",
          color: "var(--fallback-bc,oklch(var(--bc)))",
          border: "1px solid var(--fallback-b3,oklch(var(--b3)))",
          padding: "16px",
          fontSize: "14px",
          fontWeight: "500",
          boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
          borderRadius: "0.75rem",
        },
        success: {
          iconTheme: {
            primary: "#39BE7D",
            secondary: "var(--fallback-b1,oklch(var(--b1)))",
          },
        },
        error: {
          iconTheme: {
            primary: "#E34E4E",
            secondary: "var(--fallback-b1,oklch(var(--b1)))",
          },
        },
        loading: {
          iconTheme: {
            primary: "#4AA8FF",
            secondary: "var(--fallback-b1,oklch(var(--b1)))",
          },
        },
      }}
    />
  );
}

