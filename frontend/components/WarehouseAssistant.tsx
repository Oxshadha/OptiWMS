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
  AlertCircle,
  Trash2,
  PanelLeftClose,
  Clock
} from "lucide-react";
import {
  askWarehouseAI,
  getChatHistory,
  getSessionMessages,
  deleteChatSession,
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
  timestamp?: string | Date;
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
  userId?: string;
};

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatMessageTime(timestamp?: string | Date) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getGroupedSessions(sessions: any[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const groups: { [key: string]: any[] } = {
    "Today": [],
    "Yesterday": [],
    "Last 7 Days": [],
    "Older": []
  };

  sessions.forEach((s) => {
    const date = new Date(s.created_at);
    if (date >= today) {
      groups["Today"].push(s);
    } else if (date >= yesterday) {
      groups["Yesterday"].push(s);
    } else if (date >= sevenDaysAgo) {
      groups["Last 7 Days"].push(s);
    } else {
      groups["Older"].push(s);
    }
  });

  return Object.entries(groups).filter(([_, items]) => items.length > 0);
}

export function WarehouseAssistant({
  userRole,
  managerOffsetClassName,
  onManagerOpenChange,
  fullPage = false,
  userId,
}: WarehouseAssistantProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Chat History states
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>(undefined);
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

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

  // Load chat session history when history drawer is opened
  useEffect(() => {
    if (userId && showHistory) {
      const loadHistory = async () => {
        try {
          setLoadingHistory(true);
          const history = await getChatHistory(userId);
          setHistoryList(history);
        } catch (err) {
          console.error("Failed to load chat history", err);
        } finally {
          setLoadingHistory(false);
        }
      };
      void loadHistory();
    }
  }, [userId, showHistory, currentSessionId]);

  const handleSelectSession = async (sessionId: string) => {
    try {
      setLoading(true);
      const messages = await getSessionMessages(sessionId);

      const formattedHistory = messages.map((m: any) => {
        const metadata = m.metadata || {};
        return {
          id: m.id,
          role: m.sender === "user" ? ("user" as const) : ("assistant" as const),
          content: m.text_content || "",
          sources: metadata.sources,
          sql: metadata.sql,
          data: metadata.data,
          chart: metadata.chart,
          error: metadata.error,
          download_url: metadata.download_url,
          timestamp: m.timestamp,
        };
      });

      setChatHistory(formattedHistory);
      setCurrentSessionId(sessionId);
      setShowHistory(false);
    } catch (err) {
      console.error("Failed to load session messages", err);
    } finally {
      setLoading(false);
    }
  };

  const handleNewChat = () => {
    setChatHistory([]);
    setCurrentSessionId(undefined);
    setShowHistory(false);
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      await deleteChatSession(sessionId);
      setHistoryList((prev) => prev.filter((s) => s.id !== sessionId));
      if (currentSessionId === sessionId) {
        handleNewChat();
      }
    } catch (err) {
      console.error("Failed to delete chat session", err);
    }
  };

  const submitQuery = async (nextQuery: string) => {
    const trimmedQuery = nextQuery.trim();
    if (!trimmedQuery || loading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmedQuery,
      timestamp: new Date().toISOString(),
    };

    setChatHistory((prev) => [...prev, userMessage]);
    setQuery("");
    setLoading(true);

    try {
      const response = await askWarehouseAI(trimmedQuery, userRole, userId, currentSessionId);

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
          timestamp: new Date().toISOString(),
        },
      ]);

      if (response.session_id) {
        setCurrentSessionId(response.session_id);
      }
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
          timestamp: new Date().toISOString(),
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
      <div className="flex flex-col h-full overflow-hidden bg-[#F8F7F7] p-6 relative">
        <div className="flex flex-col flex-1 min-h-0 rounded-2xl border border-[#EBEBEB] bg-white text-[#1A1A1A] shadow-2xl overflow-hidden relative">
          <AssistantHeader
            title="Warehouse Assistant"
            subtitle="Unified SOP & Data Analytics"
            icon={<Warehouse className="h-5 w-5 text-[#CF0F47]" />}
            onClose={() => router.back()}
            userId={userId}
            onToggleHistory={() => setShowHistory(!showHistory)}
            isPopUp={false}
            isHistoryOpen={showHistory}
          />

          <div className="flex flex-1 min-h-0 relative">
            <HistorySidebar
              isOpen={showHistory}
              onClose={() => setShowHistory(false)}
              loading={loadingHistory}
              historyList={historyList}
              currentSessionId={currentSessionId}
              onSelectSession={handleSelectSession}
              onNewChat={handleNewChat}
              onDeleteSession={handleDeleteSession}
              isPopUp={false}
            />

            <div className="flex flex-col flex-1 min-h-0 bg-white">
              <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-[#EBEBEB] scrollbar-track-transparent">
                <AssistantBody
                  userRole={userRole}
                  chatHistory={chatHistory}
                  loading={loading}
                  onSuggestionClick={handleSuggestionClick}
                />
              </div>
              <div className="shrink-0 bg-white">
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
        className="btn btn-ghost btn-circle border border-[#EBEBEB] bg-white text-[#1A1A1A] shadow-sm transition-all duration-200 hover:scale-105 active:scale-95 hover:bg-[#FFF0F4] hover:text-[#CF0F47] hover:border-[#FFCCD8]"
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
            className="fixed inset-0 z-40 hidden bg-[#1A1A1A]/10 backdrop-blur-[1px] lg:block"
            onClick={() => setIsOpen(false)}
          />
          <div
            className={clsx(
              "fixed bottom-6 right-6 z-50 hidden max-w-[calc(100vw-3rem)] overflow-hidden rounded-2xl border border-[#EBEBEB] bg-white text-[#1A1A1A] shadow-[0_24px_60px_rgba(0,0,0,0.12)] lg:flex lg:h-[44rem] lg:flex-col transition-all duration-300 ease-in-out",
              showHistory ? "w-[42rem]" : "w-[28rem]",
              managerOffsetClassName,
            )}
          >
            <AssistantHeader
              title="Warehouse Assistant"
              subtitle="Unified SOP & Data Analytics"
              icon={<Warehouse className="h-5 w-5 text-[#CF0F47]" />}
              onClose={() => setIsOpen(false)}
              userId={userId}
              onToggleHistory={() => setShowHistory(!showHistory)}
              isPopUp={true}
              isHistoryOpen={showHistory}
            />

            <div className="flex flex-1 min-h-0 relative">
              <HistorySidebar
                isOpen={showHistory}
                onClose={() => setShowHistory(false)}
                loading={loadingHistory}
                historyList={historyList}
                currentSessionId={currentSessionId}
                onSelectSession={handleSelectSession}
                onNewChat={handleNewChat}
                onDeleteSession={handleDeleteSession}
                isPopUp={true}
              />

              <div className="flex flex-col flex-1 min-h-0 bg-white">
                <div className="shrink-0 px-5 pt-3 pb-1 bg-[#FAFAFA] flex justify-between items-center border-b border-[#EBEBEB]">
                  <span className="text-[11px] text-[#A0A0A0] font-semibold uppercase tracking-widest">AI Operations Hub</span>
                  <Link
                    href="/admin/assistant"
                    className="text-xs font-semibold text-[#CF0F47] hover:text-[#B00D3E] transition-colors hover:underline"
                  >
                    Full screen ↗
                  </Link>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-[#EBEBEB] scrollbar-track-transparent">
                  <AssistantBody
                    userRole={userRole}
                    chatHistory={chatHistory}
                    loading={loading}
                    onSuggestionClick={handleSuggestionClick}
                  />
                </div>
                <div className="shrink-0 bg-white">
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
        className="fixed bottom-24 right-4 z-[60] flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-[#CF0F47] to-[#FF6B6B] text-white shadow-[0_18px_40px_rgba(207,15,71,0.32)] ring-4 ring-white/30 transition-transform hover:scale-105 active:scale-95"
      >
        <MessageSquare className="h-7 w-7" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[70] flex flex-col overflow-hidden bg-[#F8F7F7] text-[#1A1A1A] relative">
          <AssistantHeader
            title="Warehouse Assistant"
            subtitle="Unified SOP & Data Analytics"
            icon={<Bot className="h-5 w-5 text-[#CF0F47]" />}
            onClose={() => setIsOpen(false)}
            userId={userId}
            onToggleHistory={() => setShowHistory(!showHistory)}
            isPopUp={true}
            isHistoryOpen={showHistory}
          />

          <div className="flex flex-1 min-h-0 relative bg-white border border-[#EBEBEB] rounded-2xl shadow-2xl">
            <HistorySidebar
              isOpen={showHistory}
              onClose={() => setShowHistory(false)}
              loading={loadingHistory}
              historyList={historyList}
              currentSessionId={currentSessionId}
              onSelectSession={handleSelectSession}
              onNewChat={handleNewChat}
              onDeleteSession={handleDeleteSession}
              isPopUp={true}
            />

            <div className="flex flex-col flex-1 min-h-0">
              <div className="shrink-0 flex items-center justify-between px-5 pt-3 pb-1 border-b border-[#EBEBEB] bg-[#FAFAFA] backdrop-blur">
                <span className="text-xs font-semibold text-[#CF0F47] uppercase tracking-wider">Worker Support</span>
                <Link
                  href="/admin/assistant"
                  className="text-sm font-semibold text-[#CF0F47] hover:underline"
                >
                  Full screen ↗
                </Link>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-[#EBEBEB] scrollbar-track-transparent">
                <AssistantBody
                  userRole={userRole}
                  chatHistory={chatHistory}
                  loading={loading}
                  onSuggestionClick={handleSuggestionClick}
                />
              </div>
              <div className="shrink-0 bg-white pb-safe">
                <div className="px-4 pt-2">
                  <button
                    type="button"
                    className="flex h-12 w-full items-center justify-center gap-3 rounded-2xl border border-[#FFCCD8] bg-[#FFF0F4] text-[#CF0F47] font-semibold shadow-sm hover:bg-[#FFCCD8]/30 transition duration-200 active:scale-95 transition-transform"
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
  userId,
  onToggleHistory,
  isPopUp = false,
  isHistoryOpen = false,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  onClose: () => void;
  userId?: string;
  onToggleHistory?: () => void;
  isPopUp?: boolean;
  isHistoryOpen?: boolean;
}) {
  return (
    <div className="shrink-0 border-b border-[#EBEBEB] bg-white px-5 py-4 shadow-sm flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF0F4] text-[#CF0F47] shrink-0 shadow-inner">
          {icon}
        </div>
        <div>
          <h2 className="text-base font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[#CF0F47] to-[#FF6B6B]">
            {title}
          </h2>
          <p className="text-xs text-[#6B6B6B] font-medium">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        {userId && onToggleHistory && (
          <button
            onClick={onToggleHistory}
            className={clsx(
              "flex h-9 w-9 items-center justify-center rounded-lg border border-[#EBEBEB] bg-white text-[#6B6B6B] shadow-sm transition hover:bg-[#FFF0F4] hover:border-[#FFCCD8] hover:text-[#CF0F47] hover:scale-105 active:scale-95 p-1.5",
              isHistoryOpen && "bg-[#FFF0F4] border-[#FFCCD8] text-[#CF0F47]"
            )}
            title="Chat History"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#EBEBEB] bg-white text-[#6B6B6B] shadow-sm transition hover:bg-[#FFF0F4] hover:border-[#FFCCD8] hover:text-[#CF0F47] hover:scale-105 active:scale-95 p-1.5"
        >
          <X className="h-4.5 w-4.5" />
        </button>
      </div>
    </div>
  );
}

function HistorySidebar({
  isOpen,
  onClose,
  loading,
  historyList,
  currentSessionId,
  onSelectSession,
  onNewChat,
  onDeleteSession,
  isPopUp,
}: {
  isOpen: boolean;
  onClose: () => void;
  loading: boolean;
  historyList: any[];
  currentSessionId?: string;
  onSelectSession: (id: string) => void;
  onNewChat: () => void;
  onDeleteSession: (id: string) => Promise<void>;
  isPopUp: boolean;
}) {
  const grouped = getGroupedSessions(historyList);

  const sidebarContent = (
    <div className="w-[260px] flex flex-col h-full shrink-0 bg-[#FAFAFA] border-r border-[#EBEBEB]">
      {/* Sticky Sidebar Header */}
      <div className="shrink-0 px-4 py-3 flex items-center justify-between border-b border-[#EBEBEB] bg-[#FAFAFA] sticky top-0 z-10">
        <span className="text-[#A0A0A0] text-[10px] font-semibold uppercase tracking-widest">
          Chat History
        </span>
        <button
          onClick={onClose}
          className="text-[#A0A0A0] hover:text-[#CF0F47] hover:bg-[#FFF0F4] transition-all duration-200 p-1 rounded-lg"
          title="Collapse Sidebar"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      {/* New Chat Button */}
      <div className="px-4 py-3 shrink-0">
        <button
          onClick={onNewChat}
          className="flex w-full items-center justify-center gap-2 border border-[#EBEBEB] text-[#1A1A1A] hover:bg-[#FFF0F4] hover:border-[#FFCCD8] hover:text-[#CF0F47] rounded-lg text-sm font-medium px-3 py-2 active:scale-95 transition-all duration-200"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Chat
        </button>
      </div>

      {/* Session List */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-4 space-y-4 scrollbar-thin scrollbar-thumb-[#EBEBEB] scrollbar-track-transparent">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-2">
            <Loader2 className="h-6 w-6 animate-spin text-[#CF0F47]" />
            <span className="text-xs text-[#A0A0A0] font-semibold">Loading history...</span>
          </div>
        ) : historyList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-2">
            <Clock className="w-8 h-8 text-[#D4D4D4]" />
            <span className="text-sm text-[#A0A0A0] text-center font-medium">No conversations yet</span>
          </div>
        ) : (
          grouped.map(([groupName, sessions]) => (
            <div key={groupName} className="space-y-1">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-[#A0A0A0] pb-1 border-b border-[#EBEBEB] mb-1">
                {groupName}
              </div>
              <div className="space-y-1">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className={clsx(
                      "group relative flex items-center justify-between w-full rounded-xl p-2.5 transition-all duration-200 cursor-pointer select-none",
                      currentSessionId === session.id
                        ? "bg-[#CF0F47] text-white font-semibold"
                        : "hover:bg-[#FFF0F4] text-[#1A1A1A]"
                    )}
                    onClick={() => onSelectSession(session.id)}
                  >
                    <div className="flex-1 min-w-0 pr-6">
                      <p className="truncate text-sm font-medium">{session.title}</p>
                      <p className={clsx(
                        "text-[11px] mt-0.5",
                        currentSessionId === session.id ? "text-white/80" : "text-[#A0A0A0]"
                      )}>
                        {formatRelativeTime(session.created_at)}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm("Are you sure you want to delete this conversation?")) {
                          void onDeleteSession(session.id);
                        }
                      }}
                      className={clsx(
                        "absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 p-1.5 rounded",
                        currentSessionId === session.id
                          ? "text-white/70 hover:text-white hover:bg-white/20"
                          : "text-[#A0A0A0] hover:text-[#DC2626] hover:bg-red-50"
                      )}
                      title="Delete Conversation"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  if (isPopUp) {
    return (
      <>
        {isOpen && (
          <div
            onClick={onClose}
            className="absolute inset-0 bg-[#1A1A1A]/10 backdrop-blur-[1px] z-30 transition-opacity duration-300"
          />
        )}
        <div
          className={clsx(
            "absolute top-0 bottom-0 left-0 z-40 flex flex-col w-[260px] bg-[#FAFAFA] border-r border-[#EBEBEB] transition-transform duration-300 ease-in-out",
            isOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {sidebarContent}
        </div>
      </>
    );
  }

  return (
    <div
      className={clsx(
        "flex flex-col bg-[#FAFAFA] border-[#EBEBEB] transition-all duration-300 ease-in-out overflow-hidden shrink-0",
        isOpen ? "w-[260px] opacity-100 border-r" : "w-0 opacity-0 border-r-0 pointer-events-none"
      )}
    >
      {sidebarContent}
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
    <div className="px-5 py-5 space-y-6 bg-white">
      {chatHistory.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
          <Bot className="w-12 h-12 text-[#D4D4D4] mb-4" />
          <h3 className="text-base font-semibold text-[#1A1A1A] mb-1">
            How can I help you today?
          </h3>
          <p className="text-sm text-[#6B6B6B] mb-6 max-w-sm">
            {userRole === "manager"
              ? "Ask about SOPs, inventory counts, pending orders, or request reports."
              : "Ask about SKU locations, safety protocols, or task steps."}
          </p>
          <div className="flex flex-col gap-2 w-full max-w-sm">
            {suggestions.map((suggestion, i) => (
              <button
                key={i}
                onClick={() => onSuggestionClick(suggestion)}
                className="text-left text-xs text-[#1A1A1A] font-semibold hover:bg-[#FFF0F4] hover:border-[#FFCCD8] hover:text-[#CF0F47] bg-white border border-[#EBEBEB] px-3.5 py-2.5 rounded-xl transition-all duration-200 shadow-sm active:scale-[0.99]"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {chatHistory.map((message) => (
        <div
          key={message.id}
          className={clsx(
            "flex gap-3 items-start",
            message.role === "user" ? "justify-end" : "justify-start"
          )}
        >
          {message.role === "assistant" && (
            <div className="w-7 h-7 rounded-full bg-[#FFF0F4] text-[#CF0F47] flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
              <Bot className="h-4.5 w-4.5 text-[#CF0F47]" />
            </div>
          )}
          <div className={clsx("flex flex-col max-w-[80%]", message.role === "user" ? "items-end" : "items-start")}>
            <div
              className={clsx(
                "rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm transition-all duration-200",
                message.role === "user"
                  ? "bg-[#CF0F47] text-white rounded-br-sm font-medium"
                  : "bg-[#F5F5F5] border border-[#EBEBEB] text-[#1A1A1A] rounded-bl-sm"
              )}
            >
              {/* Text content */}
              {message.content &&
                (message.role === "assistant" ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ children }) => (
                        <p className="mb-2.5 last:mb-0 whitespace-pre-wrap text-[#1A1A1A]/90 font-medium">
                          {children}
                        </p>
                      ),
                      ul: ({ children }) => (
                        <ul className="mb-2.5 list-disc space-y-1 pl-5 last:mb-0 text-[#6B6B6B]">
                          {children}
                        </ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="mb-2.5 list-decimal space-y-1 pl-5 last:mb-0 text-[#6B6B6B]">
                          {children}
                        </ol>
                      ),
                      li: ({ children }) => <li className="pl-0.5">{children}</li>,
                      strong: ({ children }) => (
                        <strong className="text-[#CF0F47] bg-[#FFF0F4] px-1 rounded font-semibold">
                          {children}
                        </strong>
                      ),
                      code: ({ children }) => (
                        <code className="bg-[#F5F5F5] text-[#1A1A1A] font-mono text-xs px-1 py-0.5 rounded border border-[#EBEBEB]">
                          {children}
                        </code>
                      ),
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                ) : (
                  <p className="whitespace-pre-wrap">{message.content}</p>
                ))}

              {/* Citations/Sources */}
              {message.sources && message.sources.length > 0 && (
                <div className="mt-4 border-t border-[#EBEBEB] pt-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-[#A0A0A0]">
                    Verifiable SOP Documents
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {message.sources.map((source) =>
                      source.href ? (
                        <Link
                          key={`${message.id}-${source.label}`}
                          href={source.href}
                          className="inline-flex items-center gap-1 rounded-full bg-[#FFF0F4] border border-[#FFCCD8] text-[#CF0F47] hover:bg-[#FFCCD8] px-2.5 py-1 text-xs font-semibold transition hover:opacity-90"
                        >
                          {source.label}
                        </Link>
                      ) : (
                        <span
                          key={`${message.id}-${source.label}`}
                          className="rounded-full bg-[#F5F5F5] border border-[#EBEBEB] text-[#6B6B6B] px-2.5 py-1 text-xs font-semibold"
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
                <details className="group mt-4 border-t border-[#EBEBEB] pt-3">
                  <summary className="flex cursor-pointer items-center justify-between text-[11px] font-semibold text-[#A0A0A0] hover:text-[#CF0F47] select-none">
                    <span>WMS DATABASE QUERY LOG</span>
                    <span className="transition-transform duration-200 group-open:rotate-180">
                      <ChevronRight className="h-3.5 w-3.5" />
                    </span>
                  </summary>
                  <div className="mt-2 overflow-x-auto rounded-xl border border-[#EBEBEB] bg-[#FAFAFA] text-[#1A1A1A] p-3.5">
                    <pre className="font-mono text-xs whitespace-pre">
                      <code>{message.sql}</code>
                    </pre>
                  </div>
                </details>
              )}

              {/* Database Output Records Table */}
              {message.data && message.data.length > 0 && (
                <div className="mt-4 border-t border-[#EBEBEB] pt-3">
                  <div className="mb-2 flex items-center gap-1.5">
                    <FileSpreadsheet className="h-4.5 w-4.5 text-[#A0A0A0]" />
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[#A0A0A0]">
                      WMS Database Records ({message.data.length} rows)
                    </p>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-[#EBEBEB] bg-white">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-[#EBEBEB] text-xs">
                        <thead className="bg-[#FAFAFA]">
                          <tr>
                            {Object.keys(message.data[0]).map((key) => (
                              <th
                                key={key}
                                className="px-3 py-2 text-left font-semibold text-[#A0A0A0] uppercase tracking-wider"
                              >
                                {key}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#EBEBEB] bg-white">
                          {message.data.slice(0, 8).map((row, index) => (
                            <tr key={index} className="hover:bg-[#FFF8F9] transition-colors">
                              {Object.values(row).map((value, i) => (
                                <td key={i} className="px-3 py-2 text-[#1A1A1A]/85 font-medium">
                                  {value === null ? (
                                    <span className="text-[#D4D4D4]">null</span>
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
                      <div className="border-t border-[#EBEBEB] bg-[#FAFAFA] px-3 py-1.5 text-center">
                        <p className="text-[10px] font-semibold text-[#A0A0A0]">
                          Showing top 8 of {message.data.length} records.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Auto Generated Charts */}
              {message.chart && (
                <div className="mt-4 border-t border-[#EBEBEB] pt-3">
                  <div className="overflow-hidden rounded-xl border border-[#EBEBEB] bg-white p-1">
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
                <div className="mt-4 border-t border-red-200 pt-3 flex gap-2 items-start bg-red-50 p-2.5 rounded-xl border">
                  <AlertCircle className="h-4.5 w-4.5 text-red-650 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-semibold text-red-600 uppercase tracking-widest">Operational Error</p>
                    <p className="text-xs text-red-700 font-semibold">{message.error}</p>
                  </div>
                </div>
              )}

              {/* Report PDF download widget */}
              {message.download_url && (
                <div className="mt-4 border-t border-[#EBEBEB] pt-3">
                  <a
                    href={`${getBaseUrl()}${message.download_url}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className="inline-flex items-center gap-2 rounded-xl bg-[#16A34A] text-white hover:bg-[#15803D] px-4 py-2.5 text-xs font-bold shadow-md transition-all duration-200 active:scale-95"                    >
                    <Download className="h-4 w-4" />
                    Download
                  </a>
                </div>
              )}
            </div>
            {message.timestamp && (
              <span className="text-[10px] text-[#A0A0A0] mt-1 px-1">
                {formatMessageTime(message.timestamp)}
              </span>
            )}
          </div>
        </div>
      ))}

      {loading && (
        <div className="flex justify-start items-end gap-2">
          <div className="w-7 h-7 rounded-full bg-[#FFF0F4] text-[#CF0F47] flex items-center justify-center shrink-0 mb-1 shadow-sm">
            <Bot className="h-4.5 w-4.5 text-[#CF0F47]" />
          </div>
          <div className="bg-[#F5F5F5] border border-[#EBEBEB] rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm flex items-center gap-1 h-8">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#CF0F47]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#CF0F47] [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#CF0F47] [animation-delay:300ms]" />
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
  inputRef: React.RefObject<HTMLInputElement | null>;
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
      className="border-t border-[#EBEBEB] bg-white px-4 py-3 flex flex-col gap-1.5"
    >
      <div className="flex items-center gap-3 rounded-xl border border-[#EBEBEB] bg-[#FAFAFA] p-2 shadow-sm focus-within:ring-2 focus-within:ring-[#CF0F47]/25 focus-within:border-[#FFCCD8] transition-all duration-200">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          disabled={loading}
          placeholder={placeholder}
          className="w-full bg-transparent px-3.5 py-2 text-sm text-[#1A1A1A] outline-none placeholder:text-[#C4C4C4] font-medium"
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#CF0F47] text-white hover:bg-[#B00D3E] shadow transition-all duration-200 disabled:opacity-40 disabled:scale-100 disabled:cursor-not-allowed active:scale-95"
        >
          <SendHorizonal className="h-4.5 w-4.5 text-white" />
        </button>
      </div>
      <div className="flex justify-between items-center text-[10px] text-[#C4C4C4] px-1 select-none">
        <span>Press Enter to send</span>
        <span>{query.length} chars</span>
      </div>
    </form>
  );
}

export function WarehouseAssistantFullPage({
  userRole,
  userId,
}: {
  userRole: WarehouseAIRole;
  userId?: string;
}) {
  return <WarehouseAssistant userRole={userRole} fullPage userId={userId} />;
}
