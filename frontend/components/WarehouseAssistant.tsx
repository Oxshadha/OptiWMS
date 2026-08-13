"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
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
} from "lucide-react";
import {
  askWarehouseAI,
  askInventoryIntelligence,
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
  const [loading, setLoading] = useState<{ sop: boolean; data: boolean }>({
    sop: false,
    data: false,
  });
  const [currentTab, setCurrentTab] = useState<"sop" | "data">("sop");
  const [chatHistories, setChatHistories] = useState<{
    sop: ChatMessage[];
    data: ChatMessage[];
  }>({
    sop: [
      {
        id: "assistant-welcome-sop",
        role: "assistant",
        content:
          userRole === "manager"
            ? "Hello! I can help with SOP lookups, operational summaries, and source-backed answers. What would you like to know?"
            : "Hello! Ask me about tasks, SOP steps, or SKU locations.",
      },
    ],
    data: [
      {
        id: "assistant-welcome-data",
        role: "assistant",
        content:
          "I can explain a SKU outlook, list inventory risks, explain a recommendation, or report a planning-cycle status using authorized business tools.",
      },
    ],
  });
  const inputRef = useRef<HTMLInputElement | null>(null);

  const chatHistory = chatHistories[currentTab];

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
    if (!trimmedQuery || loading[currentTab]) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmedQuery,
    };

    setChatHistories((prev) => ({
      ...prev,
      [currentTab]: [...prev[currentTab], userMessage],
    }));
    setQuery("");
    setLoading((prev) => ({ ...prev, [currentTab]: true }));

    try {
      if (currentTab === "sop") {
        const response = await askWarehouseAI(trimmedQuery, userRole);
        setChatHistories((prev) => ({
          ...prev,
          sop: [
            ...prev.sop,
            {
              id: `assistant-${Date.now()}`,
              role: "assistant",
              content: response.answer,
              sources: response.sources,
            },
          ],
        }));
      } else {
        const response = await askInventoryIntelligence(trimmedQuery);

        setChatHistories((prev) => ({
          ...prev,
          data: [
            ...prev.data,
            {
              id: `assistant-${Date.now()}`,
              role: "assistant",
              content: response.answer,
              sources: response.sources,
            },
          ],
        }));
      }
    } catch (error) {
      setChatHistories((prev) => ({
        ...prev,
        [currentTab]: [
          ...prev[currentTab],
          {
            id: `assistant-error-${Date.now()}`,
            role: "assistant",
            content:
              error instanceof Error
                ? error.message
                : "Something went wrong. Please try again.",
          },
        ],
      }));
    } finally {
      setLoading((prev) => ({ ...prev, [currentTab]: false }));
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submitQuery(query);
  };

  // ── Full page ─────────────────────────────────────────────────────────────
  if (fullPage) {
    return (
      <div className="flex flex-col h-full overflow-hidden bg-base-100 p-6">
        <div className="flex flex-col flex-1 min-h-0 rounded-2xl border border-base-200 bg-white shadow-lg overflow-hidden">
          <AssistantHeader
            title="Warehouse Assist"
            subtitle="Full-screen assistant"
            icon={<Warehouse className="h-5 w-5" />}
            onClose={() => router.back()}
            currentTab={currentTab}
            onTabChange={setCurrentTab}
          />
          <div className="flex-1 min-h-0 overflow-y-auto">
            <AssistantBody
              userRole={userRole}
              chatHistory={chatHistory}
              loading={loading[currentTab]}
              currentTab={currentTab}
            />
          </div>
          <div className="shrink-0">
            <AssistantComposer
              inputRef={inputRef}
              query={query}
              loading={loading[currentTab]}
              placeholder={
                currentTab === "sop"
                  ? "Ask about SOPs, safety checks, or warehouse exceptions…"
                  : "Ask about a SKU, risk, recommendation, or planning cycle…"
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
          "btn btn-ghost btn-circle border border-base-300 bg-base-100/80 text-base-content shadow-sm backdrop-blur",
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
              "fixed bottom-6 right-6 z-50 hidden w-[26rem] max-w-[calc(100vw-3rem)] overflow-hidden rounded-[2rem] border border-base-300 bg-base-100 text-base-content shadow-[0_24px_80px_rgba(15,23,42,0.18)] lg:flex lg:h-[42rem] lg:flex-col",
              managerOffsetClassName,
            )}
          >
            <AssistantHeader
              title="Warehouse Assist"
              subtitle="SOP and warehouse queries"
              icon={<Warehouse className="h-5 w-5" />}
              onClose={() => setIsOpen(false)}
              currentTab={currentTab}
              onTabChange={setCurrentTab}
            />
            <div className="shrink-0 px-4 pt-2 pb-1">
              <Link
                href="/admin/assistant"
                className="text-xs text-primary hover:underline"
              >
                Open full screen ↗
              </Link>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <AssistantBody
                userRole={userRole}
                chatHistory={chatHistory}
                loading={loading[currentTab]}
                currentTab={currentTab}
              />
            </div>
            <div className="shrink-0">
              <AssistantComposer
                inputRef={inputRef}
                query={query}
                loading={loading[currentTab]}
                placeholder="Ask about SOPs, safety checks, or warehouse exceptions…"
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
        className="fixed bottom-24 right-4 z-[60] flex h-16 w-16 items-center justify-center rounded-full border border-primary/20 bg-gradient-to-br from-primary to-accent text-white shadow-[0_18px_40px_rgba(207,15,71,0.32)] ring-4 ring-white/30 transition-transform active:scale-95"
      >
        <MessageSquare className="h-7 w-7" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[70] flex flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(207,15,71,0.10),_transparent_35%),linear-gradient(180deg,_#fff6f8_0%,_#fff1f4_100%)] text-base-content">
          <AssistantHeader
            title="Warehouse Assist"
            subtitle="SOP and warehouse queries"
            icon={<Bot className="h-5 w-5" />}
            onClose={() => setIsOpen(false)}
            currentTab={currentTab}
            onTabChange={setCurrentTab}
          />
          <div className="shrink-0 flex items-center gap-3 px-4 pt-2 pb-1">
            <button
              type="button"
              className="flex h-12 flex-1 items-center justify-center gap-3 rounded-2xl border border-primary/20 bg-primary/10 text-primary font-semibold shadow"
            >
              <Mic className="h-5 w-5" />
              Voice input
            </button>
            <Link
              href="/admin/assistant"
              className="text-sm text-primary font-medium hover:underline whitespace-nowrap"
            >
              Full screen ↗
            </Link>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <AssistantBody
              userRole={userRole}
              chatHistory={chatHistory}
              loading={loading[currentTab]}
              currentTab={currentTab}
            />
          </div>
          <div className="shrink-0">
            <AssistantComposer
              inputRef={inputRef}
              query={query}
              loading={loading[currentTab]}
              placeholder="Ask about SKU location, SOP steps, or a task…"
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
  currentTab,
  onTabChange,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  onClose: () => void;
  currentTab: "sop" | "data";
  onTabChange: (tab: "sop" | "data") => void;
}) {
  return (
    <div className="shrink-0 border-b border-base-200 bg-white/85 px-4 py-4 backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
            {icon}
          </div>
          <div>
            <h2 className="text-base font-semibold">{title}</h2>
            <p className="text-xs text-slate-500">{subtitle}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => onTabChange("sop")}
          className={clsx(
            "rounded-lg px-3 py-1 text-sm font-medium transition",
            currentTab === "sop"
              ? "bg-primary text-primary-content"
              : "bg-base-200 text-base-content hover:bg-base-300",
          )}
        >
          SOP Assistant
        </button>
        <button
          onClick={() => onTabChange("data")}
          className={clsx(
            "rounded-lg px-3 py-1 text-sm font-medium transition",
            currentTab === "data"
              ? "bg-primary text-primary-content"
              : "bg-base-200 text-base-content hover:bg-base-300",
          )}
        >
          Inventory Intelligence
        </button>
      </div>
    </div>
  );
}

function AssistantBody({
  userRole,
  chatHistory,
  loading,
  currentTab,
}: {
  userRole: WarehouseAIRole;
  chatHistory: ChatMessage[];
  loading: boolean;
  currentTab: "sop" | "data";
}) {
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, loading]);

  return (
    <div className="px-4 py-4 space-y-4">
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
              "max-w-[90%] rounded-3xl px-4 py-3 text-sm leading-6 shadow-sm",
              message.role === "user"
                ? "bg-primary text-primary-content"
                : "border border-base-200 bg-base-100 text-base-content",
            )}
          >
            {/* Text content — skip if empty (chart/data-only messages) */}
            {message.content &&
              (message.role === "assistant" ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => (
                      <p className="mb-2 last:mb-0 whitespace-pre-wrap">
                        {children}
                      </p>
                    ),
                    ul: ({ children }) => (
                      <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => <li>{children}</li>,
                    strong: ({ children }) => (
                      <strong className="font-semibold text-slate-900">
                        {children}
                      </strong>
                    ),
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              ) : (
                <p className="whitespace-pre-wrap">{message.content}</p>
              ))}

            {/* Sources */}
            {message.sources && message.sources.length > 0 && (
              <div
                className={clsx(
                  "border-t border-slate-100 pt-3",
                  message.content && "mt-3",
                )}
              >
                <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-slate-500">
                  Sources
                </p>
                <div className="flex flex-wrap gap-2">
                  {message.sources.map((source) =>
                    source.href ? (
                      <Link
                        key={`${message.id}-${source.label}`}
                        href={source.href}
                        className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary transition hover:bg-primary/15"
                      >
                        {source.label}
                      </Link>
                    ) : (
                      <span
                        key={`${message.id}-${source.label}`}
                        className="rounded-full border border-base-200 bg-base-200 px-3 py-1 text-xs font-medium text-base-content"
                      >
                        {source.label}
                      </span>
                    ),
                  )}
                </div>
              </div>
            )}

            {/* Data table */}
            {message.data && message.data.length > 0 && (
              <div
                className={clsx(
                  "border-t border-slate-100 pt-3",
                  message.content && "mt-3",
                )}
              >
                <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-slate-500">
                  Results
                </p>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="bg-base-200">
                        {Object.keys(message.data[0]).map((key) => (
                          <th
                            key={key}
                            className="px-2 py-1 text-left font-medium"
                          >
                            {key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {message.data.slice(0, 10).map((row, index) => (
                        <tr key={index} className="border-t border-base-200">
                          {Object.values(row).map((value, i) => (
                            <td key={i} className="px-2 py-1">
                              {String(value)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {message.data.length > 10 && (
                    <p className="mt-2 text-xs text-slate-500">
                      Showing 10 of {message.data.length} rows.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Chart */}
            {message.chart && (
              <div
                className={clsx(
                  "border-t border-slate-100 pt-3",
                  message.content && "mt-3",
                )}
              >
                <div className="overflow-hidden rounded-2xl border border-base-200 bg-base-200 p-2">
                  <img
                    src={message.chart}
                    alt="Analytics chart"
                    className="w-full rounded-lg"
                  />
                </div>
              </div>
            )}

            {/* Error */}
            {message.error && (
              <div
                className={clsx(
                  "border-t border-red-200 pt-3",
                  message.content && "mt-3",
                )}
              >
                <p className="text-xs text-red-600">{message.error}</p>
              </div>
            )}
          </div>
        </div>
      ))}

      {loading && (
        <div className="flex justify-start">
          <div className="flex items-center gap-3 rounded-3xl border border-base-200 bg-base-100 px-4 py-3 text-sm text-slate-500 shadow-sm">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <div className="flex gap-1">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary [animation-delay:120ms]" />
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary [animation-delay:240ms]" />
            </div>
            <span>
              {currentTab === "sop"
                ? "Looking through the SOPs…"
                : "Reading authorized facts…"}
            </span>
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
        "border-t border-base-200 bg-base-100/90 p-4 backdrop-blur",
        mobile && "bg-base-100/95",
      )}
    >
      <div className="flex items-center gap-3 rounded-3xl border border-base-200 bg-base-200 p-2 shadow-sm">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          disabled={loading}
          placeholder={placeholder}
          className="w-full bg-transparent px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-content shadow transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          <SendHorizonal className="h-4 w-4" />
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
