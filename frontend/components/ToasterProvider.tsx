"use client";

import { Toaster } from "react-hot-toast";

export function ToasterProvider() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 3000,
        style: {
          background: "hsl(var(--b2))",
          color: "hsl(var(--bc))",
          border: "1px solid hsl(var(--b3))",
        },
        success: {
          iconTheme: {
            primary: "hsl(var(--su))",
            secondary: "hsl(var(--b2))",
          },
        },
        error: {
          iconTheme: {
            primary: "hsl(var(--er))",
            secondary: "hsl(var(--b2))",
          },
        },
      }}
    />
  );
}

