"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
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
  WarehouseAIRole,
  WarehouseAISource,
} from "@/services/aiService";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: WarehouseAISource[];
};

type WarehouseAssistantProps = {
  userRole: WarehouseAIRole;
  managerOffsetClassName?: string;
  onManagerOpenChange?: (isOpen: boolean) => void;
};

const MANAGER_STARTERS = [
  "Summarize forklift safety SOP",
  "Which SOP covers unloading best practices?",
  "Show warehouse safekeeping controls",
];

const WORKER_STARTERS = ["Where is SKU?", "Check SOP", "Report issue"];

export function WarehouseAssistant({
  userRole,
  managerOffsetClassName,
  onManagerOpenChange,
}: WarehouseAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    {
      id: "assistant-welcome",
      role: "assistant",
      content:
        userRole === "manager"
          ? "Warehouse AI is ready for SOP lookups, operational summaries, and source-backed answers."
          : "Ask about tasks, SOP steps, or SKU help. Quick actions are ready below.",
    },
  ]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const quickActions = useMemo(
    () => (userRole === "manager" ? MANAGER_STARTERS : WORKER_STARTERS),
    [userRole]
  );

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
    if (!trimmedQuery || loading) {
      return;
    }

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
      setChatHistory((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: response.answer,
          sources: response.sources,
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
              : "The warehouse assistant could not complete that request.",
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

  const managerDrawer = (
    <>
      <button
        type="button"
        aria-label="Open warehouse assistant"
        onClick={() => setIsOpen((current) => !current)}
        className={clsx(
          "btn btn-ghost btn-circle border border-base-300 bg-base-100/80 text-base-content shadow-sm backdrop-blur",
          isOpen && "border-cyan-500/40 bg-cyan-500/10 text-cyan-700"
        )}
        title="Warehouse assistant"
      >
        {isOpen ? <ChevronRight className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
      </button>

      {isOpen && (
        <>
          <button
            type="button"
            aria-label="Close warehouse assistant overlay"
            className="fixed inset-0 z-40 hidden bg-slate-950/10 backdrop-blur-[1px] lg:block"
            onClick={() => setIsOpen(false)}
          />
          <div
            className={clsx(
              "fixed bottom-6 right-6 z-50 hidden w-[26rem] max-w-[calc(100vw-3rem)] overflow-hidden rounded-[2rem] border border-sky-100 bg-[linear-gradient(180deg,_#f8fdff_0%,_#eef8ff_100%)] text-slate-900 shadow-[0_24px_80px_rgba(15,23,42,0.18)] lg:flex lg:h-[42rem] lg:flex-col",
              managerOffsetClassName
            )}
          >
          <AssistantHeader
            title="Warehouse Assist"
            subtitle="Quick SOP and warehouse help"
            icon={<Warehouse className="h-5 w-5" />}
            onClose={() => setIsOpen(false)}
          />
          <AssistantBody
            userRole={userRole}
            chatHistory={chatHistory}
            loading={loading}
            quickActions={quickActions}
            onQuickAction={submitQuery}
          />
          <AssistantComposer
            inputRef={inputRef}
            query={query}
            loading={loading}
            placeholder="Ask about SOPs, safety checks, or warehouse exceptions"
            onQueryChange={setQuery}
            onSubmit={handleSubmit}
          />
          </div>
        </>
      )}
    </>
  );

  const workerOverlay = (
    <>
      <button
        type="button"
        aria-label="Open warehouse assistant"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-4 z-[60] flex h-16 w-16 items-center justify-center rounded-full border border-cyan-200/30 bg-gradient-to-br from-cyan-400 via-sky-500 to-blue-700 text-white shadow-[0_18px_40px_rgba(14,116,144,0.45)] ring-4 ring-white/30 transition-transform active:scale-95"
      >
        <MessageSquare className="h-7 w-7" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[70] flex flex-col bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.10),_transparent_35%),linear-gradient(180deg,_#f8fdff_0%,_#edf7ff_100%)] text-slate-900">
          <AssistantHeader
            title="Warehouse Assist"
            subtitle="Quick SOP and warehouse help"
            icon={<Bot className="h-5 w-5" />}
            onClose={() => setIsOpen(false)}
          />
          <div className="flex items-center gap-3 px-4 pt-2">
            <button
              type="button"
              className="flex h-16 flex-1 items-center justify-center gap-3 rounded-2xl border border-cyan-300 bg-cyan-100 text-base font-semibold text-cyan-950 shadow-lg"
            >
              <Mic className="h-7 w-7" />
              Voice / Mic
            </button>
          </div>
          <AssistantBody
            userRole={userRole}
            chatHistory={chatHistory}
            loading={loading}
            quickActions={quickActions}
            onQuickAction={submitQuery}
          />
          <AssistantComposer
            inputRef={inputRef}
            query={query}
            loading={loading}
            placeholder="Ask about SKU location, SOP steps, or a task"
            onQueryChange={setQuery}
            onSubmit={handleSubmit}
            mobile
          />
        </div>
      )}
    </>
  );

  return userRole === "manager" ? managerDrawer : workerOverlay;
}

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
    <div className="border-b border-sky-100 bg-white/80 px-4 py-4 backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-700 ring-1 ring-sky-200">
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
    </div>
  );
}

function AssistantBody({
  userRole,
  chatHistory,
  loading,
  quickActions,
  onQuickAction,
}: {
  userRole: WarehouseAIRole;
  chatHistory: ChatMessage[];
  loading: boolean;
  quickActions: string[];
  onQuickAction: (query: string) => void | Promise<void>;
}) {
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, loading]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      <div className="mb-4 rounded-3xl border border-sky-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
          <Sparkles className="h-4 w-4" />
          Quick Actions
        </div>
        <div className="flex flex-wrap gap-2">
          {quickActions.map((action) => (
            <button
              key={action}
              type="button"
              onClick={() => void onQuickAction(action)}
              className={clsx(
                "rounded-full border px-3 py-2 text-sm font-medium transition",
                userRole === "manager"
                  ? "border-sky-200 bg-sky-50 text-sky-800 hover:border-sky-300 hover:bg-sky-100"
                  : "border-sky-200 bg-white text-slate-700 hover:bg-sky-50"
              )}
            >
              {action}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {chatHistory.map((message) => (
          <div
            key={message.id}
            className={clsx(
              "flex",
              message.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={clsx(
                "max-w-[90%] rounded-3xl px-4 py-3 text-sm leading-6 shadow-lg",
                message.role === "user"
                  ? "bg-gradient-to-br from-cyan-400 to-blue-600 text-white"
                  : "border border-sky-100 bg-white text-slate-800 shadow-sm"
              )}
            >
              {message.role === "assistant" ? (
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
              )}
              {message.sources && message.sources.length > 0 && (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <div className="mb-2 text-[11px] uppercase tracking-[0.2em] text-slate-500">
                    Sources
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {message.sources.map((source) =>
                      source.href ? (
                        <Link
                          key={`${message.id}-${source.label}`}
                          href={source.href}
                          className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 transition hover:bg-sky-100"
                        >
                          {source.label}
                        </Link>
                      ) : (
                        <span
                          key={`${message.id}-${source.label}`}
                          className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600"
                        >
                          {source.label}
                        </span>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="flex max-w-[85%] items-center gap-3 rounded-3xl border border-sky-100 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              <div className="flex gap-1">
                <span className="h-2 w-2 animate-pulse rounded-full bg-sky-400" />
                <span className="h-2 w-2 animate-pulse rounded-full bg-sky-400 [animation-delay:120ms]" />
                <span className="h-2 w-2 animate-pulse rounded-full bg-sky-400 [animation-delay:240ms]" />
              </div>
              <span>Thinking through the SOPs...</span>
            </div>
          </div>
        )}
      </div>

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
        "border-t border-sky-100 bg-white/85 p-4 backdrop-blur",
        mobile && "bg-white/90"
      )}
    >
      <div className="flex items-center gap-3 rounded-3xl border border-sky-100 bg-slate-50 p-2 shadow-sm">
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
          className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 text-white shadow-lg transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          <SendHorizonal className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}
