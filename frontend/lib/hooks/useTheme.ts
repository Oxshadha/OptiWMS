"use client";

import { useState, useEffect } from "react";

type Theme = "optiwms" | "optiwms-dark";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("optiwms");
  const [mounted, setMounted] = useState(false);

  // Load theme from localStorage on mount
  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem("theme") as Theme | null;
    if (savedTheme && (savedTheme === "optiwms" || savedTheme === "optiwms-dark")) {
      setTheme(savedTheme);
      document.documentElement.setAttribute("data-theme", savedTheme);
    } else {
      // Default to light mode
      document.documentElement.setAttribute("data-theme", "optiwms");
    }
  }, []);

  const toggleTheme = () => {
    const newTheme: Theme = theme === "optiwms" ? "optiwms-dark" : "optiwms";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  const isDark = theme === "optiwms-dark";

  return {
    theme,
    isDark,
    toggleTheme,
    mounted, // To prevent hydration mismatch
  };
}
