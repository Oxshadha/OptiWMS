"use client";

import { Toaster } from "react-hot-toast";

export function ToasterProvider() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 3000,
        // Default style for info/loading toasts
        style: {
          background: "#FFFFFF",
          color: "#1F2937",
          border: "1px solid #E5E7EB",
          padding: "16px",
          fontSize: "14px",
          fontWeight: "500",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
        },
        // Success toasts - green background, white text
        success: {
          style: {
            background: "#39BE7D",
            color: "#FFFFFF",
            border: "none",
            padding: "16px",
            fontSize: "14px",
            fontWeight: "500",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
          },
          iconTheme: {
            primary: "#FFFFFF",
            secondary: "#39BE7D",
          },
        },
        // Error toasts - red background, white text
        error: {
          style: {
            background: "#E34E4E",
            color: "#FFFFFF",
            border: "none",
            padding: "16px",
            fontSize: "14px",
            fontWeight: "500",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
          },
          iconTheme: {
            primary: "#FFFFFF",
            secondary: "#E34E4E",
          },
        },
        // Loading toasts - blue background, white text
        loading: {
          style: {
            background: "#4AA8FF",
            color: "#FFFFFF",
            border: "none",
            padding: "16px",
            fontSize: "14px",
            fontWeight: "500",
            boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
          },
          iconTheme: {
            primary: "#FFFFFF",
            secondary: "#4AA8FF",
          },
        },
      }}
    />
  );
}

