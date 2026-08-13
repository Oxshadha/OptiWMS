import { apiClient } from "@/lib/api/client";

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

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_AI_ENDPOINT = process.env.NEXT_PUBLIC_WAREHOUSE_AI_URL || "http://localhost:8000/ask";

function normalizeSources(rawSources: unknown, role: WarehouseAIRole): WarehouseAISource[] {
  if (!Array.isArray(rawSources)) return [];
  return rawSources.map((source): WarehouseAISource | null => {
    if (typeof source === "string") {
      return { label: source, href: /^https?:\/\//i.test(source) ? source : role === "manager" ? `/admin/sops?search=${encodeURIComponent(source)}` : undefined };
    }
    if (source && typeof source === "object") {
      const row = source as Record<string, unknown>;
      const label = [row.label, row.title, row.source].find((value) => typeof value === "string") as string | undefined;
      return label ? { label, href: typeof row.href === "string" ? row.href : undefined } : null;
    }
    return null;
  }).filter((source): source is WarehouseAISource => source !== null);
}

export async function askWarehouseAI(query: string, role: WarehouseAIRole): Promise<WarehouseAIResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
  try {
    const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    const response = await fetch(DEFAULT_AI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ message: query, context: role, timestamp: new Date() }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(response.status >= 500 ? "The SOP assistant is temporarily unavailable." : (await response.text().catch(() => "")) || "The SOP request could not be completed.");
    const data = await response.json() as Record<string, unknown>;
    const answer = [data.answer, data.response, data.message].find((value) => typeof value === "string") as string | undefined;
    return { answer: answer || "No source-grounded answer was returned.", sources: normalizeSources(data.sources ?? data.citations, role), raw: data };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw new Error("The SOP assistant timed out.");
    throw error instanceof Error ? error : new Error("Unexpected SOP assistant error.");
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
