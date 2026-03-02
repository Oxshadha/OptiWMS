export type PreferenceScope =
  | "adminDashboardSettings"
  | "workerSettings"
  | "workerAppSettings";

type RawSettings = string | Record<string, any> | null | undefined;

const KNOWN_SCOPES: PreferenceScope[] = [
  "adminDashboardSettings",
  "workerSettings",
  "workerAppSettings",
];

export function parseSettingsContainer(raw: RawSettings): Record<string, any> {
  if (!raw) {
    return {};
  }

  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  return typeof raw === "object" ? raw : {};
}

function isScopedContainer(value: Record<string, any>) {
  return KNOWN_SCOPES.some((scope) => {
    const scopedValue = value[scope];
    return scopedValue && typeof scopedValue === "object" && !Array.isArray(scopedValue);
  });
}

export function getScopedSettings<T extends Record<string, any>>(
  raw: RawSettings,
  scope: PreferenceScope
): Partial<T> {
  const parsed = parseSettingsContainer(raw);
  const scopedValue = parsed[scope];

  if (scopedValue && typeof scopedValue === "object" && !Array.isArray(scopedValue)) {
    return scopedValue as Partial<T>;
  }

  if (!isScopedContainer(parsed)) {
    return parsed as Partial<T>;
  }

  return {};
}

export function setScopedSettings<T extends Record<string, any>>(
  raw: RawSettings,
  scope: PreferenceScope,
  value: T
): Record<string, any> {
  const parsed = parseSettingsContainer(raw);
  const next = isScopedContainer(parsed) ? { ...parsed } : {};

  if (!isScopedContainer(parsed) && Object.keys(parsed).length > 0) {
    next[scope] = { ...parsed };
  }

  next[scope] = value;
  return next;
}
