import { apiClient } from "@/lib/api/client";

export type WarehouseAIRole = "manager" | "worker";

import type { PageContext } from "@/lib/pageContext";

export interface WarehouseAISource {
  label: string;
  href?: string;
}

export interface ChartSpec {
  type: "line" | "bar";
  title: string;
  xKey: string;
  yKey: string;
  data: Record<string, unknown>[];
}

/** One step the assistant actually took, for showing its working. */
export interface AIToolCall {
  name: string;
  /** "tool" ran a reviewed query, "llm" called a model, "rule" cost nothing. */
  kind?: "tool" | "llm" | "rule" | "cache" | "mode";
  ms?: number;
  outcome?: string;
  detail?: string;
}

export interface AITimings {
  total_ms?: number;
  llm_calls?: number;
  tool_calls?: number;
}

export interface WarehouseAIResponse {
  mode?: "SOP" | "DATA" | "TOUR" | "CHAT" | "DENIED";
  answer: string;
  sources: WarehouseAISource[];
  sql?: string;
  data?: Record<string, unknown>[];
  chart?: ChartSpec;
  error?: string;
  download_url?: string;
  session_id?: string;
  raw?: unknown;
  action?: string;
  tourId?: string;
  toolCalls?: AIToolCall[];
  timings?: AITimings;
  /** Where an instant answer came from -- shown so it does not appear from nowhere. */
  evidenceSource?: string;
  /** True when the answer came from stored evidence with no model call. */
  fastPath?: boolean;
}

interface ToolEnvelope {
  asOf: string;
  warehouse: string;
  dataset: string;
  datasetVersion: string;
  modelName: string;
  facts: Record<string, unknown>;
  warnings: string[];
  sourceRecordReferences: string[];
  correlationId: string;
}

// Data queries and PDF report generation are slower than SOP lookups.
const DEFAULT_TIMEOUT_MS = 45000;
const rawEndpoint = process.env.NEXT_PUBLIC_WAREHOUSE_AI_URL || "http://127.0.0.1:8094/ask";
const DEFAULT_AI_ENDPOINT = rawEndpoint.replace("localhost", "127.0.0.1");
const AI_SERVICE_BASE = DEFAULT_AI_ENDPOINT.substring(0, DEFAULT_AI_ENDPOINT.lastIndexOf("/"));

const DB_SOP_TITLES = [
  "SOP - Forklift Operation and Safety",
  "SOP - Powered Pallet Truck (PPT) Operations",
  "SOP - Empty Pallet Purchasing Instructions",
  "SOP - Stacker Operation Instructions",
  "SOP - Material Unloading Procedures",
  "SOP - Warehouse Safekeeping Procedure",
  "SOP - Vehicle Inspection Record",
  "SOP - Conducting Cycle Counts",
];

const SOP_NAME_MAPPINGS: Record<string, string> = {
  "vehicle inspection": "SOP - Vehicle Inspection Record",
  "operating stacker": "SOP - Stacker Operation Instructions",
  "operating forklift": "SOP - Forklift Operation and Safety",
  "operating powered pallet truck": "SOP - Powered Pallet Truck (PPT) Operations",
  "pallet truck": "SOP - Powered Pallet Truck (PPT) Operations",
  ppt: "SOP - Powered Pallet Truck (PPT) Operations",
  unloading: "SOP - Material Unloading Procedures",
  safekeeping: "SOP - Warehouse Safekeeping Procedure",
  purchasing: "SOP - Empty Pallet Purchasing Instructions",
  "cycle counts": "SOP - Conducting Cycle Counts",
};

/**
 * A 429 can mean two different things: the caller is going too fast, or every
 * upstream model provider is out of quota. Only the first is the user's doing,
 * so they get different wording.
 */
async function describeRateLimit(response: Response): Promise<string> {
  const fallback = "You have reached the assistant request limit. Please wait a moment.";
  try {
    const body = await response.json();
    const detail = body?.detail;
    if (detail && typeof detail === "object") {
      if (detail.code === "AI_QUOTA_EXCEEDED") {
        return (
          detail.message ||
          "AI quota exceeded. The assistant is temporarily out of capacity — please try again in a few minutes."
        );
      }
      if (typeof detail.message === "string") return detail.message;
    }
    if (typeof detail === "string") return detail;
    return fallback;
  } catch {
    return fallback;
  }
}

function isChartSpec(value: unknown): value is ChartSpec {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    (v.type === "line" || v.type === "bar") &&
    typeof v.title === "string" &&
    typeof v.xKey === "string" &&
    typeof v.yKey === "string" &&
    Array.isArray(v.data)
  );
}

function authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

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

  const normalized: Array<WarehouseAISource | null> = rawSources.map((source) => {
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

  return normalized.filter((source): source is WarehouseAISource => source !== null);
}

/**
 * Unified assistant call. The agent derives the acting user from the bearer
 * token, so no user id is sent from the browser; only the conversation thread
 * is passed through.
 */
/**
 * Prompts worth offering for the page the user is on.
 *
 * Server-side and deterministic, so opening the assistant costs no model call and
 * cannot advertise a capability it does not have. Falls back to the caller's own
 * defaults on any failure -- an empty panel is worse than a generic prompt.
 */
export interface AISuggestion {
  title: string;
  text: string;
}

export async function fetchSuggestions(
  role: WarehouseAIRole,
  pageContext?: PageContext
): Promise<AISuggestion[]> {
  try {
    const base = DEFAULT_AI_ENDPOINT.replace(/\/ask$/, "");
    const response = await fetch(`${base}/suggestions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ context: role, page_context: pageContext }),
    });
    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data?.suggestions)) return [];
    return data.suggestions.filter(
      (s: unknown): s is AISuggestion =>
        !!s && typeof (s as AISuggestion).title === "string" &&
        typeof (s as AISuggestion).text === "string"
    );
  } catch {
    return [];
  }
}

export async function askWarehouseAI(
  query: string,
  role: WarehouseAIRole,
  session_id?: string,
  pageContext?: PageContext
): Promise<WarehouseAIResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(DEFAULT_AI_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(),
      },
      body: JSON.stringify({
        message: query,
        context: role,
        timestamp: new Date(),
        session_id,
        // What the user is looking at. Lets "why is this one low?" resolve without
        // making them retype a material code that is already on screen.
        page_context: pageContext && Object.keys(pageContext).length ? pageContext : undefined,
      }),
      signal: controller.signal,
    });

    if (response.status === 401) {
      throw new Error("Your session has expired. Please sign in again.");
    }

    if (response.status === 403) {
      throw new Error("Your account does not have access to this assistant capability.");
    }

    if (response.status === 429) {
      throw new Error(await describeRateLimit(response));
    }

    if (response.status >= 500) {
      throw new Error(
        "The warehouse AI service is temporarily unavailable. Please try again shortly."
      );
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(errorText || "The warehouse AI request could not be completed.");
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
      mode: typeof data.mode === "string" ? (data.mode as WarehouseAIResponse["mode"]) : undefined,
      answer,
      sources: normalizeSources(data.sources ?? data.citations, role),
      sql: typeof data.sql === "string" ? data.sql : undefined,
      data: Array.isArray(data.data) ? (data.data as Record<string, unknown>[]) : undefined,
      chart: isChartSpec(data.chart) ? data.chart : undefined,
      toolCalls: Array.isArray(data.toolCalls) ? (data.toolCalls as AIToolCall[]) : undefined,
      timings: (data.timings as AITimings) ?? undefined,
      evidenceSource: typeof data.evidenceSource === "string" ? data.evidenceSource : undefined,
      fastPath: Boolean(data.fastPath),
      error: typeof data.error === "string" ? data.error : undefined,
      download_url: typeof data.download_url === "string" ? data.download_url : undefined,
      session_id: typeof data.session_id === "string" ? data.session_id : undefined,
      action: typeof data.action === "string" ? data.action : undefined,
      tourId: typeof data.tourId === "string" ? data.tourId : undefined,
      raw: data,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("The warehouse AI request timed out. Please try again.");
    }
    if (error instanceof TypeError) {
      throw new Error("Network error while contacting the warehouse AI service.");
    }
    throw error instanceof Error
      ? error
      : new Error("Unexpected error while contacting the warehouse AI service.");
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Read-only operational assistant. This deliberately chooses among Spring-owned,
 * authenticated business tools; it never sends generated SQL or a database schema.
 */
export async function askInventoryIntelligence(query: string): Promise<WarehouseAIResponse> {
  const normalized = query.trim();
  const uuid = normalized.match(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i)?.[0];
  const sku = normalized.match(/\b(?:(?:RM|PM|FG)-?\d{3,}|\d{6})\b/i)?.[0]?.toUpperCase();
  let envelope: ToolEnvelope;

  if (uuid && /cycle|planning/i.test(normalized)) {
    envelope = await apiClient.get<ToolEnvelope>(`/v1/assistant/tools/planning-cycles/${uuid}`);
  } else if (uuid && /recommend|why|explain/i.test(normalized)) {
    envelope = await apiClient.get<ToolEnvelope>(`/v1/assistant/tools/recommendations/${uuid}/explanation`);
  } else if (sku) {
    envelope = await apiClient.get<ToolEnvelope>(`/v1/assistant/tools/sku-outlook?sku=${encodeURIComponent(sku)}&horizon=12`);
  } else if (/risk|stockout|reorder|attention|high/i.test(normalized)) {
    envelope = await apiClient.get<ToolEnvelope>("/v1/assistant/tools/inventory-risks?severity=HIGH&limit=10");
  } else {
    return {
      answer: "I can explain a SKU outlook (include its warehouse material code), list high inventory risks, explain a recommendation ID, or report a planning-cycle UUID. Live facts come only from authenticated business tools.",
      sources: [{ label: "Inventory Intelligence", href: "/admin/inventory-intelligence" }],
    };
  }

  return {
    answer: renderToolFacts(envelope),
    sources: [
      ...envelope.sourceRecordReferences.map((label) => ({ label })),
      { label: `${envelope.datasetVersion} · ${envelope.modelName}`, href: deepLink(envelope.facts) },
    ],
    raw: envelope,
  };
}

// ── Chat history ─────────────────────────────────────────────────────────────
async function historyRequest(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(`${AI_SERVICE_BASE}${path}`, {
    ...init,
    headers: { ...(init?.headers ?? {}), ...authHeaders() },
  });
  if (response.status === 401) {
    throw new Error("Your session has expired. Please sign in again.");
  }
  if (response.status === 403) {
    throw new Error("You do not have access to this chat history.");
  }
  return response;
}

export async function getChatHistory(userId: string): Promise<any[]> {
  const response = await historyRequest(`/history/${encodeURIComponent(userId)}`);
  if (!response.ok) {
    throw new Error("Failed to fetch chat history.");
  }
  return response.json();
}

export async function getSessionMessages(sessionId: string): Promise<any[]> {
  const response = await historyRequest(`/history/session/${encodeURIComponent(sessionId)}`);
  if (!response.ok) {
    throw new Error("Failed to fetch session messages.");
  }
  return response.json();
}

export async function deleteChatSession(sessionId: string): Promise<void> {
  const response = await historyRequest(`/history/session/${encodeURIComponent(sessionId)}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("Failed to delete chat session.");
  }
}

/**
 * Generated reports are served only through the authenticated download route,
 * so they are fetched as a blob rather than linked to directly.
 */
export async function downloadReport(downloadUrl: string): Promise<Blob> {
  const response = await historyRequest(downloadUrl);
  if (!response.ok) {
    throw new Error("Failed to download the report.");
  }
  return response.blob();
}

// ── Policy explanation (XAI) ──────────────────────────────────────────────────
export interface PolicyExplanationResult {
  explanation: string;
  cached: boolean;
}

/**
 * Plain-language "why" for an inventory policy recommendation, synthesized
 * by the LLM from the MILP engine's own numbers and rationale (never
 * invented). Cached server-side per policy line version, so re-opening the
 * same recommendation is instant and costs no additional LLM tokens.
 */
export async function explainPolicyLine(
  materialCode: string,
  reasonCodes: string[] = [],
): Promise<PolicyExplanationResult> {
  const response = await fetch("/api/explain/policy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ materialCode, reasonCodes }),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.detail || "Failed to generate the policy explanation.");
  }
  return response.json();
}

function renderToolFacts(envelope: ToolEnvelope): string {
  const lines = Object.entries(envelope.facts).flatMap(([key, value]) => {
    if (key === "deepLink") return [];
    if (Array.isArray(value)) return [`**${humanize(key)}:** ${value.length} record${value.length === 1 ? "" : "s"}`];
    if (value && typeof value === "object") return [`**${humanize(key)}:** ${Object.entries(value as Record<string, unknown>).filter(([name]) => name !== "deepLink").map(([name, item]) => `${humanize(name)} ${format(item)}`).join("; ")}`];
    return [`**${humanize(key)}:** ${format(value)}`];
  });
  if (envelope.warnings.length) lines.push(`\n**Warnings:** ${envelope.warnings.join(" ")}`);
  lines.push(`\n_As of ${new Date(envelope.asOf).toLocaleString()} · correlation ${envelope.correlationId}_`);
  return lines.join("\n\n");
}

function deepLink(facts: Record<string, unknown>): string | undefined {
  if (typeof facts.deepLink === "string") return facts.deepLink;
  const recommendation = facts.recommendation;
  return recommendation && typeof recommendation === "object" && typeof (recommendation as Record<string, unknown>).deepLink === "string"
    ? (recommendation as Record<string, unknown>).deepLink as string
    : "/admin/inventory-intelligence";
}

function humanize(value: string) { return value.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ").replace(/^./, (char) => char.toUpperCase()); }
function format(value: unknown) { if (value === null || value === undefined || value === "") return "not available"; if (typeof value === "number") return new Intl.NumberFormat().format(value); return String(value); }
