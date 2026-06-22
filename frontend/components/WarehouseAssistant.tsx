"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Bot,
  ChevronRight,
  Loader2,
  MessageSquare,
  Mic,
  SendHorizonal,
  Sparkles,
  Warehouse,
  X,
  FileSpreadsheet,
  Download,
  AlertCircle
} from "lucide-react";
import {
  askWarehouseAI,
  WarehouseAIRole,
  WarehouseAISource,
} from "@/services/aiService";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: WarehouseAISource[];
  sql?: string;
  data?: Record<string, unknown>[];
  chart?: string;
  error?: string;
  answer?: string;       // Conversational summary or download-link markdown
  download_url?: string; // Report mode: PDF link
};

const getBaseUrl = () => {
  const envUrl = process.env.NEXT_PUBLIC_WAREHOUSE_AI_URL;
  if (envUrl) {
    try {
      const urlObj = new URL(envUrl);
      return `${urlObj.protocol}//${urlObj.host}`;
    } catch (e) {
      // fallback
    }
  }
  return "http://localhost:8000";
};

type WarehouseAssistantProps = {
  userRole: WarehouseAIRole;
  managerOffsetClassName?: string;
  onManagerOpenChange?: (isOpen: boolean) => void;
  fullPage?: boolean;
};

export function WarehouseAssistant({
  userRole,
  managerOffsetClassName,
  onManagerOpenChange,
  fullPage = false,
}: WarehouseAssistantProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>(() => [
    {
      id: "assistant-welcome",
      role: "assistant",
      content:
        userRole === "manager"
          ? "Hello! I can assist you with SOP lookups, standard operating procedures, WMS inventory/order analytics, or PDF report generation. What would you like to ask?"
          : "Hello! I can guide you through warehouse SOPs, find item/SKU locations, and list safety checklist steps. What do you need help with?",
    },
  ]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (userRole === "manager") {
      onManagerOpenChange?.(isOpen);
    }
  }, [isOpen, onManagerOpenChange, userRole]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const submitQuery = async (nextQuery: string) => {
    const trimmedQuery = nextQuery.trim();
    if (!trimmedQuery || loading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmedQuery,
    };

    setChatHistory((prev) => [...prev, userMessage]);
    setQuery("");
    setLoading(true);

    try {
      const response = await askWarehouseAI(trimmedQuery, userRole);

      // Derive text content for message bubble
      const content = response.error
        ? response.error
        : response.answer
          ? response.answer
          : response.chart || (response.data && response.data.length > 0)
            ? ""
            : "No details returned.";

      setChatHistory((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content,
          sources: response.sources,
          sql: response.sql,
          data: response.data,
          chart: response.chart,
          error: response.error,
          download_url: response.download_url,
        },
      ]);
    } catch (error) {
      setChatHistory((prev) => [
        ...prev,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          content:
            error instanceof Error
              ? error.message
              : "Something went wrong. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submitQuery(query);
  };

  const handleSuggestionClick = async (suggestion: string) => {
    await submitQuery(suggestion);
  };

  // ── Full page ─────────────────────────────────────────────────────────────
  if (fullPage) {
    return (
      <div className="flex flex-col h-full overflow-hidden bg-slate-50 p-6">
        <div className="flex flex-col flex-1 min-h-0 rounded-2xl border border-slate-200 bg-white shadow-lg overflow-hidden">
          <AssistantHeader
            title="Warehouse Assistant"
            subtitle="Unified SOP & Data Analytics"
            icon={<Warehouse className="h-5 w-5 text-primary" />}
            onClose={() => router.back()}
          />
          <div className="flex-1 min-h-0 overflow-y-auto bg-slate-50/50">
            <AssistantBody
              userRole={userRole}
              chatHistory={chatHistory}
              loading={loading}
              onSuggestionClick={handleSuggestionClick}
            />
          </div>
          <div className="shrink-0 bg-white border-t border-slate-100">
            <AssistantComposer
              inputRef={inputRef}
              query={query}
              loading={loading}
              placeholder={
                userRole === "manager"
                  ? "Ask about SOPs, inventory counts, pending orders, or request reports..."
                  : "Ask about SKU locations, safety protocols, or task steps..."
              }
              onQueryChange={setQuery}
              onSubmit={handleSubmit}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Manager drawer ────────────────────────────────────────────────────────
  const managerDrawer = (
    <>
      <button
        type="button"
        aria-label="Open warehouse assistant"
        onClick={() => setIsOpen((current) => !current)}
        className={clsx(
          "btn btn-ghost btn-circle border border-base-300 bg-base-100/80 text-base-content shadow-sm backdrop-blur transition-all duration-300 hover:scale-105 active:scale-95",
          isOpen && "border-primary/40 bg-primary/10 text-primary",
        )}
        title="Warehouse assistant"
      >
        {isOpen ? (
          <ChevronRight className="h-5 w-5" />
        ) : (
          <Sparkles className="h-5 w-5" />
        )}
      </button>

      {isOpen && (
        <>
          <button
            type="button"
            aria-label="Close warehouse assistant overlay"
            className="fixed inset-0 z-40 hidden bg-neutral/10 backdrop-blur-[1px] lg:block"
            onClick={() => setIsOpen(false)}
          />
          <div
            className={clsx(
              "fixed bottom-6 right-6 z-50 hidden w-[28rem] max-w-[calc(100vw-3rem)] overflow-hidden rounded-[2rem] border border-slate-200 bg-white text-base-content shadow-[0_24px_80px_rgba(15,23,42,0.18)] lg:flex lg:h-[44rem] lg:flex-col transition-all duration-300",
              managerOffsetClassName,
            )}
          >
            <AssistantHeader
              title="Warehouse Assistant"
              subtitle="Unified SOP & Data Analytics"
              icon={<Warehouse className="h-5 w-5 text-primary" />}
              onClose={() => setIsOpen(false)}
            />
            <div className="shrink-0 px-5 pt-3 pb-1 bg-white flex justify-between items-center border-b border-slate-100">
              <span className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">AI Operations Hub</span>
              <Link
                href="/admin/assistant"
                className="text-xs font-semibold text-primary hover:text-primary-focus transition hover:underline"
              >
                Full screen ↗
              </Link>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto bg-slate-50/50">
              <AssistantBody
                userRole={userRole}
                chatHistory={chatHistory}
                loading={loading}
                onSuggestionClick={handleSuggestionClick}
              />
            </div>
            <div className="shrink-0 bg-white border-t border-slate-100">
              <AssistantComposer
                inputRef={inputRef}
                query={query}
                loading={loading}
                placeholder="Ask about SOPs, database metrics, or reports..."
                onQueryChange={setQuery}
                onSubmit={handleSubmit}
              />
            </div>
          </div>
        </>
      )}
    </>
  );

  // ── Worker overlay ────────────────────────────────────────────────────────
  const workerOverlay = (
    <>
      <button
        type="button"
        aria-label="Open warehouse assistant"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-4 z-[60] flex h-16 w-16 items-center justify-center rounded-full border border-primary/20 bg-gradient-to-br from-primary to-accent text-white shadow-[0_18px_40px_rgba(207,15,71,0.32)] ring-4 ring-white/30 transition-transform hover:scale-105 active:scale-95"
      >
        <MessageSquare className="h-7 w-7" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[70] flex flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(207,15,71,0.10),_transparent_35%),linear-gradient(180deg,_#fff6f8_0%,_#fff1f4_100%)] text-base-content">
          <AssistantHeader
            title="Warehouse Assistant"
            subtitle="Unified SOP & Data Analytics"
            icon={<Bot className="h-5 w-5 text-primary" />}
            onClose={() => setIsOpen(false)}
          />
          <div className="shrink-0 flex items-center justify-between px-5 pt-3 pb-1 border-b border-rose-100/50 bg-white/50 backdrop-blur">
            <span className="text-xs font-semibold text-rose-500 uppercase tracking-wider">Worker Support</span>
            <Link
              href="/admin/assistant"
              className="text-sm font-semibold text-primary hover:underline"
            >
              Full screen ↗
            </Link>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto bg-slate-50/30">
            <AssistantBody
              userRole={userRole}
              chatHistory={chatHistory}
              loading={loading}
              onSuggestionClick={handleSuggestionClick}
            />
          </div>
          <div className="shrink-0 bg-white border-t border-slate-100 pb-safe">
            <div className="px-4 pt-2">
              <button
                type="button"
                className="flex h-12 w-full items-center justify-center gap-3 rounded-2xl border border-primary/20 bg-primary/10 text-primary font-semibold shadow-sm hover:bg-primary/15 transition duration-200"
              >
                <Mic className="h-5 w-5" />
                Voice input
              </button>
            </div>
            <AssistantComposer
              inputRef={inputRef}
              query={query}
              loading={loading}
              placeholder="Ask about SKU locations, protocols..."
              onQueryChange={setQuery}
              onSubmit={handleSubmit}
              mobile
            />
          </div>
        </div>
      )}
    </>
  );

  return userRole === "manager" ? managerDrawer : workerOverlay;
}

// ── Sub-components ───────────────────────────────────────────────────────────

function AssistantHeader({
  title,
  subtitle,
  icon,
  onClose,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="shrink-0 border-b border-slate-200 bg-white/95 px-5 py-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 ring-1 ring-slate-200/50">
            {icon}
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800 tracking-tight">{title}</h2>
            <p className="text-xs text-slate-500 font-medium">{subtitle}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-700 hover:scale-105 active:scale-95"
        >
          <X className="h-4.5 w-4.5" />
        </button>
      </div>
    </div>
  );
}

function AssistantBody({
  userRole,
  chatHistory,
  loading,
  onSuggestionClick,
}: {
  userRole: WarehouseAIRole;
  chatHistory: ChatMessage[];
  loading: boolean;
  onSuggestionClick: (suggestion: string) => void;
}) {
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, loading]);

  const managerSuggestions = [
    "Show me current stock levels for SKU-001",
    "List products with stock below reorder level",
    "Generate report for top 10 products by movement",
    "What is the safety SOP for chemical handling?",
  ];

  const workerSuggestions = [
    "Where is SKU-001 stored?",
    "What is the damaged product SOP?",
    "What are the steps for shift handover?",
  ];

  const suggestions = userRole === "manager" ? managerSuggestions : workerSuggestions;

  return (
    <div className="px-5 py-5 space-y-5">
      {chatHistory.map((message) => (
        <div
          key={message.id}
          className={clsx(
            "flex",
            message.role === "user" ? "justify-end" : "justify-start",
          )}
        >
          <div
            className={clsx(
              "max-w-[92%] rounded-[1.5rem] px-5 py-4 text-[13.5px] leading-relaxed shadow-sm transition-all duration-200",
              message.role === "user"
                ? "bg-primary text-primary-content rounded-tr-none"
                : "border border-slate-200/80 bg-white text-slate-800 rounded-tl-none",
            )}
          >
            {/* Text content */}
            {message.content &&
              (message.role === "assistant" ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => (
                      <p className="mb-3 last:mb-0 whitespace-pre-wrap text-slate-700">
                        {children}
                      </p>
                    ),
                    ul: ({ children }) => (
                      <ul className="mb-3 list-disc space-y-1.5 pl-5 last:mb-0 text-slate-600">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="mb-3 list-decimal space-y-1.5 pl-5 last:mb-0 text-slate-600">
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => <li className="pl-0.5">{children}</li>,
                    strong: ({ children }) => (
                      <strong className="font-bold text-slate-900 bg-slate-50 px-1 rounded">
                        {children}
                      </strong>
                    ),
                    code: ({ children }) => (
                      <code className="bg-slate-100 text-slate-800 px-1 py-0.5 rounded font-mono text-xs font-semibold">
                        {children}
                      </code>
                    ),
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              ) : (
                <p className="whitespace-pre-wrap font-medium">{message.content}</p>
              ))}

            {/* Citations/Sources */}
            {message.sources && message.sources.length > 0 && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Verifiable SOP Documents
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {message.sources.map((source) =>
                    source.href ? (
                      <Link
                        key={`${message.id}-${source.label}`}
                        href={source.href}
                        className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-xs font-semibold text-primary transition hover:bg-primary/10"
                      >
                        {source.label}
                      </Link>
                    ) : (
                      <span
                        key={`${message.id}-${source.label}`}
                        className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600"
                      >
                        {source.label}
                      </span>
                    ),
                  )}
                </div>
              </div>
            )}

            {/* Generated SQL Accordion */}
            {message.sql && (
              <details className="group mt-4 border-t border-slate-100 pt-3">
                <summary className="flex cursor-pointer items-center justify-between text-[11px] font-semibold text-slate-400 hover:text-slate-600 select-none">
                  <span>WMS DATABASE QUERY LOG</span>
                  <span className="transition-transform duration-200 group-open:rotate-180">
                    <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                </summary>
                <div className="mt-2 overflow-x-auto rounded-xl border border-slate-100 bg-slate-50 p-3.5">
                  <pre className="font-mono text-xs text-slate-600 whitespace-pre">
                    <code>{message.sql}</code>
                  </pre>
                </div>
              </details>
            )}

            {/* Database Output Records Table */}
            {message.data && message.data.length > 0 && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <div className="mb-2 flex items-center gap-1.5">
                  <FileSpreadsheet className="h-4.5 w-4.5 text-slate-400" />
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    WMS Database Records ({message.data.length} rows)
                  </p>
                </div>
                <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-100 text-xs">
                      <thead className="bg-slate-50">
                        <tr>
                          {Object.keys(message.data[0]).map((key) => (
                            <th
                              key={key}
                              className="px-3 py-2 text-left font-bold text-slate-500 uppercase tracking-wider"
                            >
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {message.data.slice(0, 8).map((row, index) => (
                          <tr key={index} className="hover:bg-slate-50/50">
                            {Object.values(row).map((value, i) => (
                              <td key={i} className="px-3 py-2 text-slate-600 font-medium">
                                {value === null ? (
                                  <span className="text-slate-300">null</span>
                                ) : (
                                  String(value)
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {message.data.length > 8 && (
                    <div className="border-t border-slate-100 bg-slate-50 px-3 py-1.5 text-center">
                      <p className="text-[10px] font-semibold text-slate-400">
                        Showing top 8 of {message.data.length} records.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Auto Generated Charts */}
            {message.chart && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 p-1">
                  <img
                    src={message.chart}
                    alt="Auto-generated WMS Analytics Chart"
                    className="w-full rounded-lg shadow-inner"
                  />
                </div>
              </div>
            )}

            {/* Report Build error block */}
            {message.error && (
              <div className="mt-4 border-t border-rose-100 pt-3 flex gap-2 items-start bg-rose-50/50 p-2.5 rounded-xl border border-rose-100">
                <AlertCircle className="h-4.5 w-4.5 text-rose-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wider">Operational Error</p>
                  <p className="text-xs text-rose-700 font-semibold">{message.error}</p>
                </div>
              </div>
            )}

            {/* Report PDF download widget */}
            {message.download_url && (
              <div className="mt-4 border-t border-indigo-100 pt-3">
                <a
                  href={`${getBaseUrl()}${message.download_url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-indigo-700 active:scale-95 transition-all duration-200"
                >
                  <Download className="h-4 w-4" />
                  Download PDF Report
                </a>
              </div>
            )}
          </div>
        </div>
      ))}

      {chatHistory.length === 1 && !loading && (
        <div className="bg-slate-50 border border-slate-200/50 p-4.5 rounded-2xl">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">Suggested Questions</p>
          <div className="flex flex-col gap-2">
            {suggestions.map((suggestion, i) => (
              <button
                key={i}
                onClick={() => onSuggestionClick(suggestion)}
                className="text-left text-xs text-slate-600 font-semibold hover:text-primary bg-white hover:bg-slate-100/50 border border-slate-200 px-3.5 py-2.5 rounded-xl transition duration-150 shadow-sm active:scale-[0.99]"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="flex justify-start">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-[13px] text-slate-500 shadow-sm">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <div className="flex gap-0.5">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:120ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary [animation-delay:240ms]" />
            </div>
            <span className="font-semibold text-slate-400">Processing requests...</span>
          </div>
        </div>
      )}

      <div ref={messageEndRef} />
    </div>
  );
}

function AssistantComposer({
  inputRef,
  query,
  loading,
  placeholder,
  mobile = false,
  onQueryChange,
  onSubmit,
}: {
  inputRef: React.RefObject<HTMLInputElement>;
  query: string;
  loading: boolean;
  placeholder: string;
  mobile?: boolean;
  onQueryChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
}) {
  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      className={clsx(
        "border-t border-slate-200 bg-slate-50/80 p-4.5 backdrop-blur",
        mobile && "bg-white",
      )}
    >
      <div className="flex items-center gap-3 rounded-[1.5rem] border border-slate-200 bg-white p-2 shadow-sm focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary transition-all duration-200">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          disabled={loading}
          placeholder={placeholder}
          className="w-full bg-transparent px-3.5 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 font-medium"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-content shadow transition-all duration-200 hover:scale-105 active:scale-95 disabled:scale-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <SendHorizonal className="h-4.5 w-4.5" />
        </button>
      </div>
    </form>
  );
}

export function WarehouseAssistantFullPage({
  userRole,
}: {
  userRole: WarehouseAIRole;
}) {
  return <WarehouseAssistant userRole={userRole} fullPage />;
}
