"use client";

import { useState, useEffect } from "react";
import { applyAppTheme, getStoredAppTheme, type AppTheme } from "@/lib/theme";

export function useTheme() {
  const [theme, setTheme] = useState<AppTheme>("optiwms");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const syncTheme = () => {
      const savedTheme = getStoredAppTheme();
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    };

    syncTheme();

    const handleStorage = (event: StorageEvent) => {
      if (event.key === "theme") {
        syncTheme();
      }
    };

    const handleThemeChanged = () => {
      syncTheme();
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("themeChanged", handleThemeChanged);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("themeChanged", handleThemeChanged);
    };
  }, []);

  const toggleTheme = () => {
    applyAppTheme(theme === "optiwms");
  };

  const isDark = theme === "optiwms-dark";

  return {
    theme,
    isDark,
    toggleTheme,
    mounted, // To prevent hydration mismatch
  };
}
