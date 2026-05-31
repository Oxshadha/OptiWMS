export type WarehouseAIRole = "manager" | "worker";

export interface WarehouseAISource {
  label: string;
  href?: string;
}

export interface WarehouseAIResponse {
  answer: string;
  sources: WarehouseAISource[];
  raw?: unknown;
}

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_DATA_TIMEOUT_MS = 45000; // Data analytics needs more time
const DEFAULT_AI_ENDPOINT =
  process.env.NEXT_PUBLIC_WAREHOUSE_AI_URL || "http://localhost:8000/ask";

function normalizeSources(rawSources: unknown, role: WarehouseAIRole): WarehouseAISource[] {
  if (!Array.isArray(rawSources)) {
    return [];
  }

  const normalized: Array<WarehouseAISource | null> = rawSources
    .map((source) => {
      if (typeof source === "string") {
        const isUrl = /^https?:\/\//i.test(source);
        return {
          label: source,
          href: isUrl
            ? source
            : role === "manager"
            ? `/admin/sops?search=${encodeURIComponent(source)}`
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
  role: WarehouseAIRole
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
      answer,
      sources: normalizeSources(data.sources ?? data.citations, role),
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

export interface DataAnalyticsResponse {
  sql?: string;
  data?: Record<string, unknown>[];
  chart?: string;
  error?: string;
}

const DEFAULT_DATA_ENDPOINT =
  process.env.NEXT_PUBLIC_WAREHOUSE_DATA_URL || "http://localhost:8000/ask-data";

const DEFAULT_QUERY_ENDPOINT =
  process.env.NEXT_PUBLIC_WAREHOUSE_QUERY_URL || "http://localhost:8000/query-sql";

export async function askDataAnalytics(
  query: string
): Promise<DataAnalyticsResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_DATA_TIMEOUT_MS);

  try {
    const response = await fetch(DEFAULT_DATA_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: query,
        timestamp: new Date(),
      }),
      signal: controller.signal,
    });

    if (response.status >= 500) {
      throw new Error(
        "The data analytics service is temporarily unavailable. Please try again shortly."
      );
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(
        errorText || "The data analytics request could not be completed."
      );
    }

    const data = (await response.json()) as Record<string, unknown>;
    return {
      sql: typeof data.sql === "string" ? data.sql : undefined,
      data: Array.isArray(data.data) ? data.data : undefined,
      chart: typeof data.chart === "string" ? data.chart : undefined,
      error: typeof data.error === "string" ? data.error : undefined,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(
        "The data analytics request timed out. Please check the service and try again."
      );
    }

    if (error instanceof TypeError) {
      throw new Error(
        "Network error while contacting the data analytics service."
      );
    }

    throw error instanceof Error
      ? error
      : new Error("Unexpected error while contacting the data analytics service.");
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function queryWmsDatabase(
  sql: string
): Promise<DataAnalyticsResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_DATA_TIMEOUT_MS);

  try {
    const response = await fetch(DEFAULT_QUERY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sql }),
      signal: controller.signal,
    });

    if (response.status >= 500) {
      throw new Error(
        "The SQL query service is temporarily unavailable. Please try again shortly."
      );
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(errorText || "The SQL query request could not be completed.");
    }

    const data = (await response.json()) as Record<string, unknown>;
    return {
      sql: typeof data.sql === "string" ? data.sql : undefined,
      data: Array.isArray(data.data) ? data.data : undefined,
      chart: typeof data.chart === "string" ? data.chart : undefined,
      error: typeof data.error === "string" ? data.error : undefined,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(
        "The SQL query request timed out. Please check the service and try again."
      );
    }

    if (error instanceof TypeError) {
      throw new Error("Network error while contacting the SQL query service.");
    }

    throw error instanceof Error ? error : new Error("Unexpected SQL query error.");
  } finally {
    clearTimeout(timeoutId);
  }
}
