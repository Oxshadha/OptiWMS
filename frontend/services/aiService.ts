export type WarehouseAIRole = "manager" | "worker";

export interface WarehouseAISource {
  label: string;
  href?: string;
}

export interface WarehouseAIResponse {
  mode?: "SOP" | "DATA";
  answer: string;
  sources: WarehouseAISource[];
  sql?: string;
  data?: Record<string, unknown>[];
  chart?: string;
  error?: string;
  download_url?: string;
  session_id?: string;
  raw?: unknown;
}

const DEFAULT_TIMEOUT_MS = 45000;
const DEFAULT_AI_ENDPOINT =
  process.env.NEXT_PUBLIC_WAREHOUSE_AI_URL || "http://localhost:8094/ask";
const DB_SOP_TITLES = [
  "SOP - Forklift Operation and Safety",
  "SOP - Powered Pallet Truck (PPT) Operations",
  "SOP - Empty Pallet Purchasing Instructions",
  "SOP - Stacker Operation Instructions",
  "SOP - Material Unloading Procedures",
  "SOP - Warehouse Safekeeping Procedure",
  "SOP - Vehicle Inspection Record",
  "SOP - Conducting Cycle Counts"
];

const SOP_NAME_MAPPINGS: Record<string, string> = {
  "vehicle inspection": "SOP - Vehicle Inspection Record",
  "operating stacker": "SOP - Stacker Operation Instructions",
  "operating forklift": "SOP - Forklift Operation and Safety",
  "operating powered pallet truck": "SOP - Powered Pallet Truck (PPT) Operations",
  "pallet truck": "SOP - Powered Pallet Truck (PPT) Operations",
  "ppt": "SOP - Powered Pallet Truck (PPT) Operations",
  "unloading": "SOP - Material Unloading Procedures",
  "safekeeping": "SOP - Warehouse Safekeeping Procedure",
  "purchasing": "SOP - Empty Pallet Purchasing Instructions",
  "cycle counts": "SOP - Conducting Cycle Counts",
};

function matchDbSopTitle(source: string): string {
  const normalized = source.toLowerCase();
  
  for (const [key, value] of Object.entries(SOP_NAME_MAPPINGS)) {
    if (normalized.includes(key)) {
      return value;
    }
  }

  const clean = (str: string) =>
    str
      .toLowerCase()
      .replace(/\.(pdf|txt|md)$/i, "")
      .replace(/[^a-z0-9]/g, "");

  const sourceKey = clean(source);
  for (const dbTitle of DB_SOP_TITLES) {
    if (clean(dbTitle) === sourceKey) {
      return dbTitle;
    }
  }

  let formatted = source.replace(/\.(pdf|txt|md)$/i, "");
  if (formatted.includes("-") && !formatted.includes(" - ")) {
    formatted = formatted
      .replace(/^sop-/i, "SOP - ")
      .replace(/-/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  return formatted;
}

export function normalizeSources(rawSources: unknown, role: WarehouseAIRole): WarehouseAISource[] {
  if (!Array.isArray(rawSources)) {
    return [];
  }

  const normalized: Array<WarehouseAISource | null> = rawSources
    .map((source) => {
      if (typeof source === "string") {
        const isUrl = /^https?:\/\//i.test(source);
        const resolvedLabel = isUrl ? source : matchDbSopTitle(source);
        return {
          label: resolvedLabel,
          href: isUrl
            ? source
            : role === "manager"
              ? `/admin/sops?search=${encodeURIComponent(resolvedLabel)}`
              : undefined,
        };
      }

      if (source && typeof source === "object") {
        const candidate = source as Record<string, unknown>;
        const label =
          typeof candidate.label === "string"
            ? candidate.label
            : typeof candidate.title === "string"
              ? candidate.title
              : typeof candidate.source === "string"
                ? candidate.source
                : null;

        if (!label) {
          return null;
        }

        return {
          label,
          href: typeof candidate.href === "string" ? candidate.href : undefined,
        };
      }

      return null;
    });

  return normalized.filter(
    (source): source is WarehouseAISource => source !== null
  );
}

export async function askWarehouseAI(
  query: string,
  role: WarehouseAIRole,
  user_id?: string,
  session_id?: string
): Promise<WarehouseAIResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(DEFAULT_AI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: query,
        context: role,
        timestamp: new Date(),
        user_id,
        session_id,
      }),
      signal: controller.signal,
    });

    if (response.status >= 500) {
      throw new Error(
        "The warehouse AI service is temporarily unavailable. Please try again shortly."
      );
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(
        errorText || "The warehouse AI request could not be completed."
      );
    }

    const data = (await response.json()) as Record<string, unknown>;
    const answer =
      typeof data.answer === "string"
        ? data.answer
        : typeof data.response === "string"
          ? data.response
          : typeof data.message === "string"
            ? data.message
            : "I couldn't read a valid answer from the AI service.";

    return {
      mode: typeof data.mode === "string" ? (data.mode as "SOP" | "DATA") : undefined,
      answer,
      sources: normalizeSources(data.sources ?? data.citations, role),
      sql: typeof data.sql === "string" ? data.sql : undefined,
      data: Array.isArray(data.data) ? (data.data as Record<string, unknown>[]) : undefined,
      chart: typeof data.chart === "string" ? data.chart : undefined,
      error: typeof data.error === "string" ? data.error : undefined,
      download_url: typeof data.download_url === "string" ? data.download_url : undefined,
      session_id: typeof data.session_id === "string" ? data.session_id : undefined,
      raw: data,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(
        "The warehouse AI request timed out. Please check the service and try again."
      );
    }

    if (error instanceof TypeError) {
      throw new Error(
        "Network error while contacting the warehouse AI service."
      );
    }

    throw error instanceof Error
      ? error
      : new Error("Unexpected error while contacting the warehouse AI service.");
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function getChatHistory(userId: string): Promise<any[]> {
  const urlUrl = DEFAULT_AI_ENDPOINT.substring(0, DEFAULT_AI_ENDPOINT.lastIndexOf("/"));
  const response = await fetch(`${urlUrl}/history/${encodeURIComponent(userId)}`);
  if (!response.ok) {
    throw new Error("Failed to fetch chat history.");
  }
  return response.json();
}

export async function getSessionMessages(sessionId: string): Promise<any[]> {
  const urlUrl = DEFAULT_AI_ENDPOINT.substring(0, DEFAULT_AI_ENDPOINT.lastIndexOf("/"));
  const response = await fetch(`${urlUrl}/history/session/${encodeURIComponent(sessionId)}`);
  if (!response.ok) {
    throw new Error("Failed to fetch session messages.");
  }
  return response.json();
}

export async function deleteChatSession(sessionId: string): Promise<void> {
  const urlUrl = DEFAULT_AI_ENDPOINT.substring(0, DEFAULT_AI_ENDPOINT.lastIndexOf("/"));
  const response = await fetch(`${urlUrl}/history/session/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("Failed to delete chat session.");
  }
}
