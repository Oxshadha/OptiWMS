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
  askInventoryIntelligence,
  getChatHistory,
  getSessionMessages,
  deleteChatSession,
  WarehouseAIRole,
  WarehouseAISource,
  normalizeSources,
  downloadReport,
} from "@/services/aiService";
import { T, SHARED_KEYFRAMES, TypingDots } from "./designTokens";
import { startProductTour } from "@/lib/tours/tourEngine";

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
  action?: string;
  tourId?: string;
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
  return "http://localhost:8094";
};

/**
 * Reports are behind the authenticated /download route, so the file is fetched
 * with the bearer token and handed to the browser as an object URL.
 */
async function handleDownloadReport(downloadUrl: string) {
  try {
    const blob = await downloadReport(downloadUrl);
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = downloadUrl.split("/").pop() || "report.pdf";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  } catch (error) {
    console.error("Report download failed", error);
  }
}

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
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Chat History states
  // The popup and the full-page view are separate component instances, so the
  // active thread is kept in storage. Without this, opening full screen while
  // mid-conversation silently started a new chat.
  const sessionStorageKey = userId ? `optiwms:assistant-session:${userId}` : null;
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>(() => {
    if (typeof window === "undefined" || !sessionStorageKey) return undefined;
    return window.localStorage.getItem(sessionStorageKey) ?? undefined;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !sessionStorageKey) return;
    if (currentSessionId) window.localStorage.setItem(sessionStorageKey, currentSessionId);
    else window.localStorage.removeItem(sessionStorageKey);
  }, [currentSessionId, sessionStorageKey]);
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // A tour must run once, when the assistant actually asks for it. Restored
  // history ends on the same START_TOUR message, so without tracking which
  // message already fired, every reload replayed the last tour.
  const firedTourFor = useRef<string | null>(null);

  useEffect(() => {
    if (chatHistory.length === 0) return;
    const lastMsg = chatHistory[chatHistory.length - 1];
    if (lastMsg.role !== "assistant" || lastMsg.action !== "START_TOUR" || !lastMsg.tourId) return;
    if (firedTourFor.current === lastMsg.id) return;
    firedTourFor.current = lastMsg.id;
    // Task tours navigate between pages, so they need the app router.
    startProductTour(lastMsg.tourId, (path) => router.push(path));
  }, [chatHistory, router]);

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
          sources: normalizeSources(metadata.sources, userRole),
          sql: metadata.sql,
          data: metadata.data,
          chart: metadata.chart,
          error: metadata.error,
          download_url: metadata.download_url,
          timestamp: m.timestamp,
          action: metadata.action,
          tourId: metadata.tourId,
        };
      });

      // Messages loaded from history are a record of tours already given, not a
      // request for one. Mark the newest as handled before rendering it.
      const newest = formattedHistory[formattedHistory.length - 1];
      if (newest) firedTourFor.current = newest.id;

      setChatHistory(formattedHistory);
      setCurrentSessionId(sessionId);
    } catch (err) {
      console.error("Failed to load session messages", err);
    } finally {
      setLoading(false);
    }
  };

  // Restore the thread that was open in the other view. Runs once, and only
  // when there is a stored session but nothing rendered yet, so it never
  // clobbers a conversation already in progress.
  const restoredSession = useRef(false);
  useEffect(() => {
    if (restoredSession.current || !currentSessionId || chatHistory.length > 0) return;
    restoredSession.current = true;
    void handleSelectSession(currentSessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentSessionId]);

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
      let response = await askWarehouseAI(trimmedQuery, userRole, currentSessionId);

      // Generated-SQL analytics is limited to elevated roles. Everyone else can
      // still get live figures through the typed, read-only Spring tools.
      if (response.mode === "DENIED") {
        response = await askInventoryIntelligence(trimmedQuery);
      }

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
          action: response.action,
          tourId: response.tourId,
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

  // Shared context banner layout helper
  const ContextBanner = () => {
    const activeSession = historyList.find((s) => s.id === currentSessionId);
    const sessionTitle = activeSession ? activeSession.title : "New Chat";
    return (
      <div
        style={{
          margin: "10px 14px 0",
          padding: "9px 12px",
          background: T.bgSub,
          border: `1px solid ${T.borderSub}`,
          borderRadius: 10,
          fontSize: 11.5,
          color: T.textMuted,
          display: "flex",
          flexWrap: "wrap",
          gap: "4px 16px",
          flexShrink: 0,
        }}
      >
        <span>
          <span style={{ color: T.textMuted }}>Mode: </span>
          <strong style={{ color: T.accent, textTransform: "capitalize" }}>
            {userRole}
          </strong>
        </span>
        <span>
          <span style={{ color: T.textMuted }}>Session: </span>
          <strong style={{ color: T.text }}>{sessionTitle}</strong>
        </span>
      </div>
    );
  };

  // ── Full page ─────────────────────────────────────────────────────────────
  if (fullPage) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "calc(100vh - 73px)",
          overflow: "hidden",
          background: T.bg,
          padding: 0,
          margin: "-24px",
          position: "relative",
          fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
          fontSize: 13,
        }}
      >
        <style dangerouslySetInnerHTML={{ __html: SHARED_KEYFRAMES }} />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: "1 1 0%",
            minHeight: 0,
            background: T.bg,
            color: T.text,
            overflow: "hidden",
            position: "relative",
          }}
        >
          <AssistantHeader
            title="Warehouse Assistant"
            subtitle="Operations Copilot & Analytics"
            onClose={() => router.back()}
            userId={userId}
            onToggleHistory={() => setShowHistory(!showHistory)}
            isPopUp={false}
            isHistoryOpen={showHistory}
          />

          <div style={{ display: "flex", flex: "1 1 0%", minHeight: 0, position: "relative" }}>
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

            <div style={{ display: "flex", flexDirection: "column", flex: "1 1 0%", minHeight: 0, background: T.bg }}>
              <ContextBanner />
              <div
                style={{
                  flex: "1 1 0%",
                  minHeight: 0,
                  overflowY: "auto",
                }}
              >
                <AssistantBody
                  userRole={userRole}
                  chatHistory={chatHistory}
                  loading={loading}
                  fullPage={fullPage}
                  onSuggestionClick={handleSuggestionClick}
                />
              </div>
              <div style={{ flexShrink: 0, background: T.bg, paddingBottom: (chatHistory.length === 0 && !loading && fullPage) ? "10vh" : 0, transition: "padding 0.4s cubic-bezier(0.4, 0, 0.2, 1)" }}>
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
                  fullPage={fullPage}
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
      <style dangerouslySetInnerHTML={{ __html: SHARED_KEYFRAMES }} />
      <button
        type="button"
        aria-label={isOpen ? "Close warehouse assistant" : "Open warehouse assistant"}
        onClick={() => setIsOpen((current) => !current)}
        data-tour-target="ai-assistant-btn"
        style={{
          position: "fixed",
          right: 22,
          bottom: 22,
          width: 54,
          height: 54,
          borderRadius: "50%",
          border: `1.5px solid ${isOpen ? T.border : "transparent"}`,
          color: isOpen ? T.textMuted : "white",
          background: isOpen
            ? "#ffffff"
            : `linear-gradient(135deg, ${T.accent} 0%, #ff6b35 100%)`,
          boxShadow: isOpen
            ? `0 4px 20px rgba(0,0,0,0.15)`
            : `0 6px 24px rgba(207,15,71,0.35)`,
          cursor: "pointer",
          zIndex: 1100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.25s cubic-bezier(0.34,1.56,0.64,1)",
          transform: isOpen ? "rotate(45deg)" : "scale(1)",
          animation: !isOpen ? "fcb-pulse-ring 2.5s ease infinite" : "none",
        }}
        title="Warehouse assistant"
      >
        {isOpen ? (
          <X style={{ width: 18, height: 18 }} />
        ) : (
          <Sparkles style={{ width: 22, height: 22 }} />
        )}
      </button>

      {isOpen && (
        <>
          <button
            type="button"
            aria-label="Close warehouse assistant overlay"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 1090,
              background: "rgba(17, 24, 39, 0.1)",
              backdropFilter: "blur(1px)",
              border: "none",
              cursor: "default",
            }}
            onClick={() => setIsOpen(false)}
          />
          <div
            className={managerOffsetClassName}
            style={{
              position: "fixed",
              bottom: 90,
              right: 22,
              zIndex: 1099,
              overflow: "hidden",
              borderRadius: 16,
              border: `1px solid ${T.border}`,
              borderTop: `2px solid ${T.accent}`,
              background: T.bg,
              color: T.text,
              boxShadow: "0 24px 60px rgba(0,0,0,0.10), 0 4px 16px rgba(0,0,0,0.06)",
              display: "flex",
              height: "44rem",
              maxHeight: "78vh",
              flexDirection: "column",
              transition: "width 0.3s ease-in-out",
              width: showHistory ? "42rem" : "28rem",
              maxWidth: "calc(100vw - 44px)",
              fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
              animation: "fcb-slide-up 0.28s cubic-bezier(0.34,1.56,0.64,1)",
            }}
          >
            <AssistantHeader
              title="Warehouse Assistant"
              subtitle="Operations Copilot & Analytics"
              onClose={() => setIsOpen(false)}
              userId={userId}
              onToggleHistory={() => setShowHistory(!showHistory)}
              isPopUp={true}
              isHistoryOpen={showHistory}
            />

            <div style={{ display: "flex", flex: "1 1 0%", minHeight: 0, position: "relative" }}>
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

              <div style={{ display: "flex", flexDirection: "column", flex: "1 1 0%", minHeight: 0, background: T.bg }}>
                <div
                  style={{
                    flexShrink: 0,
                    padding: "10px 16px 6px",
                    background: T.bgSub,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderBottom: `1px solid ${T.border}`,
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: T.textFaint,
                    }}
                  >
                    AI Operations Hub
                  </span>
                  <Link
                    href="/admin/assistant"
                    onClick={() => setIsOpen(false)}
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: T.accent,
                      textDecoration: "none",
                    }}
                    className="wa-link"
                  >
                    Full screen ↗
                  </Link>
                </div>

                <ContextBanner />

                <div style={{ flex: "1 1 0%", minHeight: 0, overflowY: "auto", background: T.bg }}>
                  <AssistantBody
                    userRole={userRole}
                    chatHistory={chatHistory}
                    loading={loading}
                    fullPage={false}
                    onSuggestionClick={handleSuggestionClick}
                  />
                </div>
                <div style={{ flexShrink: 0, background: T.bg }}>
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
      <style dangerouslySetInnerHTML={{ __html: SHARED_KEYFRAMES }} />
      <button
        type="button"
        aria-label={isOpen ? "Close warehouse assistant" : "Open warehouse assistant"}
        onClick={() => setIsOpen((current) => !current)}
        data-tour-target="ai-assistant-btn"
        style={{
          position: "fixed",
          right: 22,
          bottom: 22,
          width: 54,
          height: 54,
          borderRadius: "50%",
          border: `1.5px solid ${isOpen ? T.border : "transparent"}`,
          color: isOpen ? T.textMuted : "white",
          background: isOpen
            ? "#ffffff"
            : `linear-gradient(135deg, ${T.accent} 0%, #ff6b35 100%)`,
          boxShadow: isOpen
            ? `0 4px 20px rgba(0,0,0,0.15)`
            : `0 6px 24px rgba(207,15,71,0.35)`,
          cursor: "pointer",
          zIndex: 1100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.25s cubic-bezier(0.34,1.56,0.64,1)",
          transform: isOpen ? "rotate(45deg)" : "scale(1)",
          animation: !isOpen ? "fcb-pulse-ring 2.5s ease infinite" : "none",
        }}
      >
        {isOpen ? (
          <X style={{ width: 18, height: 18 }} />
        ) : (
          <MessageSquare style={{ width: 22, height: 22 }} />
        )}
      </button>

      {isOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1099,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            background: T.bgSub,
            fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif",
            fontSize: 13,
          }}
        >
          <AssistantHeader
            title="Warehouse Assistant"
            subtitle="Operations Copilot & Analytics"
            onClose={() => setIsOpen(false)}
            userId={userId}
            onToggleHistory={() => setShowHistory(!showHistory)}
            isPopUp={true}
            isHistoryOpen={showHistory}
          />

          <div
            style={{
              display: "flex",
              flex: "1 1 0%",
              minHeight: 0,
              position: "relative",
              background: T.bg,
              border: `1px solid ${T.border}`,
              borderTop: `2px solid ${T.accent}`,
              borderRadius: 16,
              boxShadow: "0 24px 60px rgba(0,0,0,0.10)",
              margin: 10,
              overflow: "hidden",
            }}
          >
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

            <div style={{ display: "flex", flexDirection: "column", flex: "1 1 0%", minHeight: 0 }}>
              <div
                style={{
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 16px 6px",
                  borderBottom: `1px solid ${T.border}`,
                  background: T.bgSub,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: T.accent,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  Worker Support
                </span>
                <Link
                  href="/admin/assistant"
                  onClick={() => setIsOpen(false)}
                  style={{
                    fontSize: 12,
                    fontWeight: 605,
                    color: T.accent,
                    textDecoration: "none",
                  }}
                  className="wa-link"
                >
                  Full screen ↗
                </Link>
              </div>

              <ContextBanner />

              <div style={{ flex: "1 1 0%", minHeight: 0, overflowY: "auto", background: T.bg }}>
                <AssistantBody
                  userRole={userRole}
                  chatHistory={chatHistory}
                  loading={loading}
                  fullPage={false}
                  onSuggestionClick={handleSuggestionClick}
                />
              </div>
              <div style={{ flexShrink: 0, background: T.bg, paddingBottom: "env(safe-area-inset-bottom)" }}>
                <div style={{ padding: "8px 16px 0" }}>
                  <button
                    type="button"
                    style={{
                      display: "flex",
                      height: 40,
                      width: "100%",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      borderRadius: 9,
                      border: `1px solid ${T.accentBorder}`,
                      background: T.accentBg,
                      color: T.accent,
                      fontWeight: 600,
                      fontSize: 12,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                    className="wa-voice-btn"
                  >
                    <Mic style={{ width: 18, height: 18 }} />
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
  onClose,
  userId,
  onToggleHistory,
  isPopUp = false,
  isHistoryOpen = false,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  userId?: string;
  onToggleHistory?: () => void;
  isPopUp?: boolean;
  isHistoryOpen?: boolean;
}) {
  return (
    <div
      style={{
        flexShrink: 0,
        borderBottom: `1px solid ${T.border}`,
        background: "#ffffff",
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div>
          <h2
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: T.text,
              margin: 0,
              lineHeight: 1.3,
            }}
          >
            {title}
          </h2>
          <p
            style={{
              fontSize: 11,
              fontWeight: 400,
              color: T.textMuted,
              margin: "2px 0 0",
              lineHeight: 1.3,
            }}
          >
            {subtitle}
          </p>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {userId && onToggleHistory && (
          <button
            onClick={onToggleHistory}
            style={{
              display: "flex",
              width: 34,
              height: 34,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 6,
              border: `1px solid ${isHistoryOpen ? T.accentBorder : T.border}`,
              background: isHistoryOpen ? T.accentBg : "#ffffff",
              color: isHistoryOpen ? T.accent : T.textMuted,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
            className="wa-ghost-btn"
            title="Chat History"
          >
            <svg xmlns="http://www.w3.org/2000/svg" style={{ width: 18, height: 18 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          style={{
            display: "flex",
            width: 34,
            height: 34,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 6,
            border: `1px solid ${T.border}`,
            background: "#ffffff",
            color: T.textMuted,
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          className="wa-ghost-btn"
        >
          <X style={{ width: 16, height: 16 }} />
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
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const grouped = getGroupedSessions(historyList);

  const sidebarContent = (
    <div
      style={{
        width: 260,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        flexShrink: 0,
        background: T.bgSub,
        borderRight: `1px solid ${T.border}`,
        position: "relative",
      }}
    >
      {/* Sidebar Header */}
      <div
        style={{
          flexShrink: 0,
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: `1px solid ${T.border}`,
          background: T.bgSub,
        }}
      >
        <span
          style={{
            color: T.textFaint,
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          CHAT HISTORY
        </span>
        <button
          onClick={onClose}
          style={{
            background: "transparent",
            border: "none",
            color: T.textMuted,
            cursor: "pointer",
            display: "flex",
            padding: 4,
            borderRadius: 4,
          }}
          title="Collapse Sidebar"
        >
          <PanelLeftClose style={{ width: 16, height: 16 }} />
        </button>
      </div>

      {/* New Chat Button */}
      <div style={{ padding: "12px 16px", flexShrink: 0 }}>
        <button
          onClick={onNewChat}
          style={{
            display: "flex",
            width: "100%",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            background: "#ffffff",
            border: `1px solid ${T.border}`,
            color: T.textMuted,
            borderRadius: 9,
            fontSize: 12,
            fontWeight: 600,
            padding: "8px 12px",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          className="wa-ghost-btn"
        >
          <svg xmlns="http://www.w3.org/2000/svg" style={{ width: 16, height: 16 }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New Chat
        </button>
      </div>

      {/* Session List */}
      <div
        style={{
          flex: "1 1 0%",
          minHeight: 0,
          overflowY: "auto",
          padding: "0 16px 16px",
        }}
      >
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 0", gap: 8 }}>
            <Loader2 style={{ width: 24, height: 24, color: T.accent }} className="animate-spin" />
            <span style={{ fontSize: 11, color: T.textFaint, fontWeight: 600 }}>Loading history...</span>
          </div>
        ) : historyList.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 0", gap: 8 }}>
            <Clock style={{ width: 32, height: 32, color: T.textFaint }} />
            <span style={{ fontSize: 12, color: T.textFaint, textAlign: "center", fontWeight: 500 }}>No conversations yet</span>
          </div>
        ) : (
          grouped.map(([groupName, sessions]) => (
            <div key={groupName} style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: T.textFaint,
                  paddingBottom: 4,
                  borderBottom: `1px solid ${T.border}`,
                  marginBottom: 8,
                }}
              >
                {groupName}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className={clsx("wa-history-item", currentSessionId === session.id && "active")}
                    onClick={() => onSelectSession(session.id)}
                  >
                    <div style={{ flex: "1 1 0%", minWidth: 0, paddingRight: 24 }}>
                      <p style={{ margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13 }}>
                        {session.title}
                      </p>
                      <p
                        style={{
                          margin: "2px 0 0",
                          fontSize: 10,
                          color: currentSessionId === session.id ? "rgba(255,255,255,0.8)" : T.textFaint,
                        }}
                      >
                        {formatRelativeTime(session.created_at)}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingSessionId(session.id);
                      }}
                      style={{
                        position: "absolute",
                        right: 8,
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        padding: 6,
                        borderRadius: 4,
                      }}
                      className="wa-delete-btn"
                      title="Delete Conversation"
                    >
                      <Trash2 style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {deletingSessionId && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "rgba(0, 0, 0, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            backdropFilter: "blur(2px)",
            animation: "fcb-fadein 0.2s ease-out",
          }}
          onClick={(e) => {
            e.stopPropagation();
            setDeletingSessionId(null);
          }}
        >
          <div
            style={{
              backgroundColor: T.bg,
              border: `1px solid ${T.borderSub}`,
              borderRadius: 12,
              padding: 20,
              width: "85%",
              maxWidth: 280,
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
              animation: "fcb-slide-up 0.2s ease-out",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <AlertCircle style={{ width: 22, height: 22, color: T.error }} />
              <span style={{ fontWeight: 600, fontSize: 15, color: T.text, fontFamily: "'Inter', sans-serif" }}>Delete Chat?</span>
            </div>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: T.textMuted, lineHeight: "1.4", fontFamily: "'Inter', sans-serif" }}>
              Are you sure you want to delete this conversation? This action cannot be undone.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                onClick={() => setDeletingSessionId(null)}
                style={{
                  background: "transparent",
                  border: `1px solid ${T.borderSub}`,
                  borderRadius: 8,
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: T.textDim,
                  cursor: "pointer",
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (deletingSessionId) {
                    await onDeleteSession(deletingSessionId);
                    setDeletingSessionId(null);
                  }
                }}
                style={{
                  background: T.error,
                  border: "none",
                  borderRadius: 8,
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#ffffff",
                  cursor: "pointer",
                  fontFamily: "'Inter', sans-serif",
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  if (isPopUp) {
    return (
      <>
        {isOpen && (
          <div
            onClick={onClose}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(17, 24, 39, 0.1)",
              backdropFilter: "blur(1px)",
              zIndex: 30,
              transition: "opacity 0.3s",
            }}
          />
        )}
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: 0,
            zIndex: 40,
            display: "flex",
            flexDirection: "column",
            width: 260,
            background: T.bgSub,
            borderRight: `1px solid ${T.border}`,
            transition: "transform 0.3s ease-in-out",
            transform: isOpen ? "translateX(0)" : "translateX(-100%)",
          }}
        >
          {sidebarContent}
        </div>
      </>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: T.bgSub,
        transition: "width 0.3s ease-in-out, opacity 0.3s ease-in-out",
        overflow: "hidden",
        width: isOpen ? 260 : 0,
        opacity: isOpen ? 1 : 0,
        borderRight: isOpen ? `1px solid ${T.border}` : "none",
      }}
    >
      {sidebarContent}
    </div>
  );
}

function AssistantBody({
  userRole,
  chatHistory,
  loading,
  fullPage,
  onSuggestionClick,
}: {
  userRole: WarehouseAIRole;
  chatHistory: ChatMessage[];
  loading: boolean;
  fullPage: boolean;
  onSuggestionClick: (suggestion: string) => void;
}) {
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, loading]);

  const managerSuggestions = [
    { icon: "inventory_2", title: "Stock Levels", text: "Show me current stock levels for SKU-300001" },
    { icon: "warning", title: "Reorder Alerts", text: "List products with stock below reorder level" },
    { icon: "bar_chart", title: "Generate Report", text: "Generate report for top 10 products by movement" },
    { icon: "security", title: "Safety SOPs", text: "What are the safety SOPs for forklift operating?" },
  ];

  const workerSuggestions = [
    { icon: "location_on", title: "Find Item", text: "Where is SKU-001 stored?" },
    { icon: "inventory_2", title: "Damage Control", text: "What is the damaged product SOP?" },
    { icon: "autorenew", title: "Shift Handover", text: "What are the steps for shift handover?" },
  ];

  const suggestions = userRole === "manager" ? managerSuggestions : workerSuggestions;

  return (
    <div style={{ padding: chatHistory.length === 0 ? 0 : 20, display: "flex", flexDirection: "column", gap: 24, background: "#ffffff", height: chatHistory.length === 0 ? "100%" : "auto" }}>
      {chatHistory.length === 0 && !loading && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "16px", textAlign: "center", flex: 1 }}>
          <style dangerouslySetInnerHTML={{ __html: `
            .wa-bot-avatar {
              transition: transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            .wa-bot-container {
              transition: transform 0.2s ease, box-shadow 0.2s ease;
            }
            .wa-bot-container:hover {
              transform: translateY(-2px);
              box-shadow: 0 0 0 6px ${T.accent}40, 0 16px 32px rgba(207,15,71,0.2), inset 0 4px 6px rgba(255,255,255,1), inset 0 -6px 8px rgba(0,0,0,0.05), inset 0 0 0 1px #d1d5db !important;
            }
            .wa-bot-container:hover .wa-bot-avatar {
              transform: rotate(45deg) scale(1.15);
            }
          `}} />
          <div style={{ position: "relative", marginBottom: fullPage ? 24 : 16 }}>
            <div 
              className="wa-bot-container"
              style={{
                width: fullPage ? 88 : 64,
                height: fullPage ? 88 : 64,
                borderRadius: fullPage ? 28 : 20,
                background: "linear-gradient(135deg, #ffffff 0%, #f3f4f6 50%, #e5e7eb 100%)",
                border: "1px solid rgba(255,255,255,0.8)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: `
                  0 0 0 4px ${T.accent}20,
                  0 12px 24px rgba(207,15,71,0.08), 
                  0 4px 8px rgba(207,15,71,0.04), 
                  inset 0 4px 6px rgba(255,255,255,1), 
                  inset 0 -6px 8px rgba(0,0,0,0.05),
                  inset 0 0 0 1px #d1d5db
                `,
                position: "relative",
                cursor: "pointer",
              }}
            >
              <Bot 
                className="wa-bot-avatar"
                style={{ 
                  width: fullPage ? 42 : 30, 
                  height: fullPage ? 42 : 30, 
                  color: "#475569",
                  filter: "drop-shadow(0px 3px 4px rgba(0,0,0,0.15))"
                }} 
              />
            </div>
          </div>
          <h3 style={{ fontSize: fullPage ? 24 : 18, fontWeight: 500, color: T.textMuted, margin: "0 0 4px 0" }}>
            Hello there,
          </h3>
          <h4 style={{ fontSize: fullPage ? 36 : 22, fontWeight: 700, color: T.text, margin: "0 0 24px 0", letterSpacing: "-0.02em" }}>
            How can I assist you today?
          </h4>
          <div style={{ display: "flex", flexWrap: "wrap", gap: fullPage ? 16 : 8, justifyContent: "center", maxWidth: fullPage ? 900 : 380, width: "100%" }}>
            {suggestions.map((suggestion, i) => (
              <button
                key={i}
                onClick={() => onSuggestionClick(suggestion.text)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  textAlign: "left",
                  padding: fullPage ? "20px" : "12px",
                  borderRadius: fullPage ? "16px" : "12px",
                  border: `1px solid ${T.border}`,
                  background: T.bgSub,
                  width: fullPage ? "240px" : "calc(50% - 4px)",
                  cursor: "pointer",
                  transition: "all 0.2s ease"
                }}
                className="hover:border-primary hover:shadow-md wa-card"
              >
                <span className="material-symbols-outlined" style={{ fontSize: fullPage ? 24 : 20, color: T.textMuted, marginBottom: 8 }}>{suggestion.icon}</span>
                <span style={{ fontSize: fullPage ? 14 : 13, fontWeight: 600, color: T.text, marginBottom: 4 }}>{suggestion.title}</span>
                <span style={{ fontSize: fullPage ? 13 : 11, color: T.textMuted, lineHeight: 1.3, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{suggestion.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {chatHistory.map((message) => (
        <div
          key={message.id}
          style={{
            display: "flex",
            gap: 12,
            alignItems: "flex-start",
            justifyContent: message.role === "user" ? "flex-end" : "flex-start",
            animation: "fcb-fadein 0.22s ease",
          }}
        >

          <div style={{ display: "flex", flexDirection: "column", maxWidth: "80%", alignItems: message.role === "user" ? "flex-end" : "flex-start" }}>
            <div
              style={
                message.role === "user"
                  ? {
                    background: T.userBubble,
                    color: T.userText,
                    borderRadius: "14px 14px 3px 14px",
                    fontSize: 13,
                    lineHeight: 1.6,
                    padding: "9px 13px",
                    wordBreak: "break-word",
                    whiteSpace: "pre-wrap",
                  }
                  : {
                    background: T.aiBubble,
                    color: T.text,
                    borderRadius: "3px 14px 14px 14px",
                    borderLeft: `2px solid ${T.accent}`,
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
                    fontSize: 13,
                    lineHeight: 1.6,
                    padding: "10px 14px",
                    wordBreak: "break-word",
                  }
              }
            >
              {/* Text content */}
              {message.content &&
                (message.role === "assistant" ? (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ children }) => (
                        <p style={{ margin: "0 0 10px 0", fontSize: 13, lineHeight: 1.6, color: T.text }} className="last:mb-0">
                          {children}
                        </p>
                      ),
                      ul: ({ children }) => (
                        <ul style={{ margin: "0 0 10px 0", paddingLeft: 20, listStyleType: "disc", color: T.textDim }}>
                          {children}
                        </ul>
                      ),
                      ol: ({ children }) => (
                        <ol style={{ margin: "0 0 10px 0", paddingLeft: 20, listStyleType: "decimal", color: T.textDim }}>
                          {children}
                        </ol>
                      ),
                      li: ({ children }) => <li style={{ marginBottom: 4 }}>{children}</li>,
                      strong: ({ children }) => (
                        <strong style={{ color: T.accent, background: T.accentBg, padding: "0 4px", borderRadius: 4, fontWeight: 650 }}>
                          {children}
                        </strong>
                      ),
                      code: ({ children }) => (
                        <code style={{ background: T.bgMuted, color: T.text, fontFamily: "monospace", fontSize: 12, padding: "2px 4px", borderRadius: 4, border: `1px solid ${T.border}` }}>
                          {children}
                        </code>
                      ),
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                ) : (
                  <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{message.content}</p>
                ))}

              {/* Citations/Sources */}
              {message.sources && message.sources.length > 0 && (
                <div style={{ marginTop: 12, borderTop: `1px solid ${T.border}`, paddingTop: 10 }}>
                  <p style={{ margin: "0 0 8px 0", fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: T.textFaint }}>
                    Verifiable SOP Documents
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {message.sources.map((source) =>
                      source.href ? (
                        <Link
                          key={`${message.id}-${source.label}`}
                          href={source.href}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            borderRadius: 999,
                            background: T.accentBg,
                            border: `1px solid ${T.accentBorder}`,
                            color: T.accent,
                            padding: "4px 10px",
                            fontSize: 11,
                            fontWeight: 600,
                            textDecoration: "none",
                            transition: "all 0.15s ease",
                          }}
                          className="wa-source-pill"
                        >
                          {source.label}
                        </Link>
                      ) : (
                        <span
                          key={`${message.id}-${source.label}`}
                          style={{
                            borderRadius: 999,
                            background: T.bgSub,
                            border: `1px solid ${T.borderSub}`,
                            color: T.textMuted,
                            padding: "4px 10px",
                            fontSize: 11,
                            fontWeight: 600,
                          }}
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
                <details
                  className="group"
                  style={{
                    marginTop: 12,
                    borderRadius: 10,
                    border: `1px solid ${T.border}`,
                    background: T.bgSub,
                    overflow: "hidden",
                  }}
                >
                  <summary
                    style={{
                      display: "flex",
                      cursor: "pointer",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: T.textFaint,
                      userSelect: "none",
                      background: T.bgSub,
                      borderBottom: `1px solid ${T.border}`,
                    }}
                  >
                    <span>WMS DATABASE QUERY LOG</span>
                    <ChevronRight
                      style={{
                        width: 14,
                        height: 14,
                        transition: "transform 0.2s",
                      }}
                      className="group-open:rotate-90"
                    />
                  </summary>
                  <div style={{ padding: 12, overflowX: "auto" }}>
                    <pre
                      style={{
                        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                        fontSize: 12,
                        color: T.text,
                        margin: 0,
                        whiteSpace: "pre",
                      }}
                    >
                      <code>{message.sql}</code>
                    </pre>
                  </div>
                </details>
              )}

              {/* Database Output Records Table */}
              {message.data && message.data.length > 0 && (
                <div
                  style={{
                    marginTop: 12,
                    borderRadius: 10,
                    border: `1px solid ${T.border}`,
                    background: T.bgSub,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "8px 12px",
                      background: T.bgSub,
                      borderBottom: `1px solid ${T.border}`,
                    }}
                  >
                    <FileSpreadsheet style={{ width: 14, height: 14, color: T.textFaint }} />
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: T.textFaint,
                      }}
                    >
                      WMS Database Records ({message.data.length} rows)
                    </span>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ minWidth: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead style={{ background: T.bgSub }}>
                        <tr>
                          {Object.keys(message.data?.[0] || {}).map((key) => (
                            <th
                              key={key}
                              style={{
                                padding: "6px 12px",
                                textAlign: "left",
                                fontWeight: 650,
                                textTransform: "uppercase",
                                fontSize: 10,
                                color: T.textFaint,
                                borderBottom: `1px solid ${T.border}`,
                              }}
                            >
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(message.data || []).slice(0, 8).map((row, index) => (
                          <tr
                            key={index}
                            className="wa-table-row"
                            style={{
                              borderBottom: index === Math.min(message.data?.length || 0, 8) - 1 ? "none" : `1px solid ${T.border}`,
                              transition: "background-color 0.15s",
                            }}
                          >
                            {Object.values(row).map((value, i) => (
                              <td key={i} style={{ padding: "6px 12px", color: T.textDim }}>
                                {value === null ? (
                                  <span style={{ color: T.textFaint }}>null</span>
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
                  {(message.data?.length || 0) > 8 && (
                    <div
                      style={{
                        borderTop: `1px solid ${T.border}`,
                        background: T.bgSub,
                        padding: "6px 12px",
                        textAlign: "center",
                        fontSize: 10,
                        color: T.textFaint,
                      }}
                    >
                      Showing top 8 of {message.data.length} records.
                    </div>
                  )}
                </div>
              )}

              {/* Auto Generated Charts */}
              {message.chart && (
                <div
                  style={{
                    marginTop: 12,
                    borderRadius: 10,
                    border: `1px solid ${T.border}`,
                    background: T.bgSub,
                    overflow: "hidden",
                    padding: 8,
                  }}
                >
                  <img
                    src={message.chart}
                    alt="Auto-generated WMS Analytics Chart"
                    style={{
                      width: "100%",
                      borderRadius: 8,
                      display: "block",
                    }}
                  />
                </div>
              )}

              {/* Report Build error block */}
              {message.error && (
                <div
                  style={{
                    marginTop: 12,
                    display: "flex",
                    gap: 8,
                    alignItems: "flex-start",
                    background: T.errorBg,
                    border: "1px solid #fecaca",
                    borderLeft: `3px solid ${T.error}`,
                    borderRadius: 10,
                    padding: "10px 12px",
                  }}
                >
                  <AlertCircle style={{ width: 16, height: 16, color: T.error, flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: 10,
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: T.error,
                      }}
                    >
                      Operational Error
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 12, color: T.error, fontWeight: 500 }}>
                      {message.error}
                    </p>
                  </div>
                </div>
              )}

              {/* Report PDF download widget */}
              {message.download_url && (
                <div style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    onClick={() => handleDownloadReport(message.download_url!)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      borderRadius: 9,
                      background: `linear-gradient(135deg, #16a34a, #22c55e)`,
                      color: "#ffffff",
                      border: "none",
                      padding: "8px 16px",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      boxShadow: "0 4px 14px rgba(22, 163, 74, 0.18)",
                      transition: "all 0.15s",
                    }}
                    className="wa-download-btn"
                  >
                    <Download style={{ width: 14, height: 14 }} />
                    Download
                  </button>
                </div>
              )}
            </div>
            {message.timestamp && (
              <span style={{ fontSize: 10, color: T.textFaint, marginTop: 4, padding: "0 4px" }}>
                {formatMessageTime(message.timestamp)}
              </span>
            )}
          </div>
        </div>
      ))}

      {loading && (
        <div style={{ display: "flex", justifyContent: "flex-start", alignItems: "flex-end", gap: 12 }}>

          <div
            style={{
              background: T.aiBubble,
              border: `1px solid ${T.borderSub}`,
              borderLeft: `2px solid ${T.accent}`,
              borderRadius: "3px 14px 14px 14px",
              padding: "10px 14px",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
              display: "flex",
              alignItems: "center",
              height: 38,
            }}
          >
            <TypingDots />
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
  fullPage = false,
  onQueryChange,
  onSubmit,
}: {
  inputRef: React.RefObject<HTMLTextAreaElement>;
  query: string;
  loading: boolean;
  placeholder: string;
  mobile?: boolean;
  fullPage?: boolean;
  onQueryChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
}) {
  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      style={fullPage ? {
        background: T.bg,
        padding: "0 24px 24px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      } : {
        borderTop: `1px solid ${T.border}`,
        background: "#ffffff",
        padding: "10px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div
        style={fullPage ? {
          display: "flex",
          alignItems: "flex-end",
          gap: 12,
          background: T.bgSub,
          border: `1px solid ${T.border}`,
          borderRadius: 24,
          padding: "8px 16px",
          width: "100%",
          maxWidth: 900,
          boxShadow: "0 12px 40px rgba(0,0,0,0.06)",
        } : {
          display: "flex",
          alignItems: "flex-end",
          gap: 8,
          background: "#ffffff",
        }}
      >
        <textarea
          ref={inputRef}
          rows={1}
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            onQueryChange(e.target.value);
            // Auto-grow
            e.target.style.height = "auto";
            e.target.style.height =
              Math.min(e.target.scrollHeight, 96) + "px";
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              const form = e.currentTarget.form;
              if (form) {
                const event = new Event("submit", { cancelable: true, bubbles: true });
                form.dispatchEvent(event);
              }
            }
          }}
          disabled={loading}
          style={{
            flex: 1,
            resize: "none",
            background: T.inputBg,
            border: `1px solid ${T.inputBorder}`,
            borderRadius: 9,
            color: T.text,
            fontSize: 13,
            padding: "8px 12px",
            outline: "none",
            fontFamily: "inherit",
            lineHeight: 1.5,
            transition: "border-color 0.15s",
            height: 38,
            overflow: "hidden",
          }}
          className="wa-textarea"
          onFocus={(e) =>
            (e.target.style.borderColor = "rgba(207, 15, 71, 0.45)")
          }
          onBlur={(e) => (e.target.style.borderColor = T.inputBorder)}
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          title="Send (Enter)"
          style={{
            width: 38,
            height: 38,
            borderRadius: 9,
            background:
              loading || !query.trim()
                ? T.accentBg
                : `linear-gradient(135deg, ${T.accent}, #ff6b35)`,
            border: "none",
            color: loading || !query.trim() ? T.textMuted : "#ffffff",
            cursor: loading || !query.trim() ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "all 0.15s",
          }}
          className="wa-send-btn"
        >
          <SendHorizonal style={{ width: 16, height: 16 }} />
        </button>
      </div>

      <div
        style={{
          padding: "5px 14px 2px",
          textAlign: "center",
          fontSize: 10,
          color: T.textMuted,
          flexShrink: 0,
        }}
      >
        Press{" "}
        <kbd
          style={{
            background: T.inputBg,
            border: `1px solid ${T.borderSub}`,
            borderRadius: 3,
            padding: "0 3px",
            fontSize: 9,
          }}
        >
          Enter
        </kbd>{" "}
        to send ·{" "}
        <kbd
          style={{
            background: T.inputBg,
            border: `1px solid ${T.borderSub}`,
            borderRadius: 3,
            padding: "0 3px",
            fontSize: 9,
          }}
        >
          Shift+Enter
        </kbd>{" "}
        for new line
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
