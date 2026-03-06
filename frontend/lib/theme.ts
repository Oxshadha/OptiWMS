export type AppTheme = "optiwms" | "optiwms-dark";

export function getStoredAppTheme(): AppTheme {
  if (typeof window === "undefined") {
    return "optiwms";
  }

  const stored = localStorage.getItem("theme");
  return stored === "optiwms-dark" ? "optiwms-dark" : "optiwms";
}

export function applyAppTheme(isDark: boolean) {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }

  const nextTheme: AppTheme = isDark ? "optiwms-dark" : "optiwms";
  document.documentElement.setAttribute("data-theme", nextTheme);
  localStorage.setItem("theme", nextTheme);
  window.dispatchEvent(new CustomEvent("themeChanged", { detail: nextTheme }));
}
