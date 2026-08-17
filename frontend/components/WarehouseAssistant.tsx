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
  Clock,
  ArrowRight
} from "lucide-react";
import {
  askWarehouseAI,
  askWarehouseAIStream,
  askInventoryIntelligence,
  getChatHistory,
  getSessionMessages,
  deleteChatSession,
  WarehouseAIRole,
  WarehouseAISource,
  normalizeSources,
  downloadReport,
  getSuggestions,
  checkAIHealth,
} from "@/services/aiService";
import { useDesignTokens, SHARED_KEYFRAMES, TypingDots } from "./designTokens";
import { tours } from "@/lib/tours/tourConfig";
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
  confidence?: number;
  response_type?: "FACT" | "INSIGHT" | "RECOMMENDATION";
  actions?: Array<{ type: string; label: string; payload?: any }>;
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
  const T = useDesignTokens();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      const status = await checkAIHealth();
      if (mounted) setIsOnline(status);
    };
    check();
    const interval = setInterval(check, 10000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // Chat History states
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>(undefined);
  const [showHistory, setShowHistory] = useState(false);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen && chatHistory.length === 0 && suggestions.length === 0) {
      getSuggestions(window.location.pathname).then(setSuggestions).catch(console.error);
    }
  }, [isOpen, chatHistory.length]);

  useEffect(() => {
    if (chatHistory.length > 0) {
      const lastMsg = chatHistory[chatHistory.length - 1];
      if (lastMsg.role === "assistant" && lastMsg.action === "START_TOUR" && lastMsg.tourId) {
        const tourConfig = tours[lastMsg.tourId as keyof typeof tours];
        if (tourConfig && tourConfig.path && window.location.pathname !== tourConfig.path) {
          router.push(tourConfig.path);
          // Allow time for route to change before starting tour
          setTimeout(() => {
            startProductTour(lastMsg.tourId!);
          }, 800);
        } else {
          startProductTour(lastMsg.tourId);
        }
        setIsOpen(false);
      }
    }
  }, [chatHistory]);

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

      setChatHistory(formattedHistory);
      setCurrentSessionId(sessionId);
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
    getSuggestions(window.location.pathname).then(setSuggestions).catch(console.error);
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
      const msgId = `assistant-${Date.now()}`;
      setChatHistory((prev) => [
        ...prev,
        {
          id: msgId,
          role: "assistant",
          content: "",
          timestamp: new Date().toISOString(),
        },
      ]);

      let response = await askWarehouseAIStream(trimmedQuery, userRole, currentSessionId, (textChunk) => {
        setChatHistory((prev) =>
          prev.map((msg) =>
            msg.id === msgId ? { ...msg, content: msg.content + textChunk } : msg
          )
        );
      });

      // Generated-SQL analytics is limited to elevated roles. Everyone else can
      // still get live figures through the typed, read-only Spring tools.
      if (response.mode === "DENIED") {
        response = await askInventoryIntelligence(trimmedQuery);
      }

      // Final update of the message bubble with all metadata
      const content = response.error
        ? response.error
        : response.answer
          ? response.answer
          : response.chart || (response.data && response.data.length > 0)
            ? ""
            : "";

      setChatHistory((prev) =>
        prev.map((msg) =>
          msg.id === msgId ? {
            ...msg,
            content: content || msg.content,
            sources: response.sources,
            sql: response.sql,
            data: response.data,
            chart: response.chart,
            error: response.error,
            download_url: response.download_url,
            action: response.action,
            tourId: response.tourId,
          } : msg
        )
      );

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
          background: T.accentBg,
          border: `1px solid rgba(207, 15, 71, 0.14)`,
          borderRadius: 10,
          fontSize: 11.5,
          color: T.textDim,
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

  // â”€â”€ Full page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (fullPage) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "calc(100vh - 73px)",
          overflow: "hidden",
          background: T.aiBubble,
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
            background: "transparent",
            color: T.text,
            overflow: "hidden",
            position: "relative",
          }}
        >
          <AssistantHeader
            title="Warehouse Copilot"
            subtitle="Your AI operations assistant"
            onClose={() => router.back()}
            userId={userId}
            onToggleHistory={() => setShowHistory(!showHistory)}
            isPopUp={false}
            isHistoryOpen={showHistory}
            isOnline={isOnline}
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
                  onSuggestionClick={handleSuggestionClick}
                />
              </div>
              <div style={{ flexShrink: 0, background: T.bg }}>
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

  // â”€â”€ Manager drawer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
              background: T.panel,
              color: T.text,
              boxShadow: "0 32px 80px rgba(207, 15, 71, 0.12), 0 8px 32px rgba(0,0,0,0.08)",
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
              title="Warehouse Copilot"
              subtitle="Your AI operations assistant"
              onClose={() => setIsOpen(false)}
              userId={userId}
              onToggleHistory={() => setShowHistory(!showHistory)}
              isPopUp={true}
              isHistoryOpen={showHistory}
              isOnline={isOnline}
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
                    Warehouse Copilot
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
                    Full screen â†—
                  </Link>
                </div>

                <ContextBanner />

                <div style={{ flex: "1 1 0%", minHeight: 0, overflowY: "auto", background: T.bg }}>
                  <AssistantBody
                    userRole={userRole}
                    chatHistory={chatHistory}
                    loading={loading}
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

  // â”€â”€ Worker overlay â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
            title="Warehouse Copilot"
            subtitle="Your AI operations assistant"
            onClose={() => setIsOpen(false)}
            userId={userId}
            onToggleHistory={() => setShowHistory(!showHistory)}
            isPopUp={true}
            isHistoryOpen={showHistory}
            isOnline={isOnline}
          />

          <div
            style={{
              display: "flex",
              flex: "1 1 0%",
              minHeight: 0,
              position: "relative",
              background: T.panel,
              border: `1px solid ${T.border}`,
              borderTop: `2px solid ${T.accent}`,
              borderRadius: 16,
              boxShadow: "0 32px 80px rgba(207, 15, 71, 0.12), 0 8px 32px rgba(0,0,0,0.08)",
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
                  Full screen â†—
                </Link>
              </div>

              <ContextBanner />

              <div style={{ flex: "1 1 0%", minHeight: 0, overflowY: "auto", background: T.bg }}>
                <AssistantBody
                  userRole={userRole}
                  chatHistory={chatHistory}
                  loading={loading}
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

// â”€â”€ Sub-components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function AssistantHeader({
  title,
  subtitle,
  onClose,
  userId,
  onToggleHistory,
  isPopUp = false,
  isHistoryOpen = false,
  isOnline = true,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  userId?: string;
  onToggleHistory?: () => void;
  isPopUp?: boolean;
  isHistoryOpen?: boolean;
  isOnline?: boolean;
}) {
  const T = useDesignTokens();
  return (
    <div
      style={{
        flexShrink: 0,
        borderBottom: `1px solid ${T.border}`,
        background: T.glassHeader,
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.03)",
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
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: isOnline ? T.ok : T.warn,
                boxShadow: isOnline ? `0 0 6px ${T.ok}` : "none",
              }}
              title={isOnline ? "AI Agent Online" : "AI Agent Offline"}
            />
            <p
              style={{
                fontSize: 11,
                fontWeight: 400,
                color: T.textMuted,
                margin: 0,
                lineHeight: 1.3,
              }}
            >
              {subtitle} â€¢ {isOnline ? "Online" : "Offline"}
            </p>
          </div>
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
              background: isHistoryOpen ? T.accentBg : T.bg,
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
            background: T.bg,
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
  const T = useDesignTokens();
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
            background: T.bg,
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
  onSuggestionClick,
}: {
  userRole: WarehouseAIRole;
  chatHistory: ChatMessage[];
  loading: boolean;
  onSuggestionClick: (suggestion: string) => void;
}) {
  const T = useDesignTokens();
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, loading]);

  let contextualLoadingText = "Thinking";
  if (loading && chatHistory.length > 0) {
    const lastUserMsg = [...chatHistory].reverse().find(m => m.role === "user");
    if (lastUserMsg) {
      const q = lastUserMsg.content.toLowerCase();
      if (q.includes("report") || q.includes("analysis") || q.includes("chart")) contextualLoadingText = "Generating report";
      else if (q.includes("inventory") || q.includes("stock") || q.includes("order") || q.includes("data") || q.includes("how many") || q.includes("low")) contextualLoadingText = "Retrieving data";
      else if (q.includes("sop") || q.includes("policy") || q.includes("procedure") || q.includes("rule")) contextualLoadingText = "Searching documents";
      else if (q.includes("tour") || q.includes("how to") || q.includes("walkthrough") || q.includes("show me")) contextualLoadingText = "Finding workflow";
      else contextualLoadingText = "Analyzing";
    }
  }

  return (
    <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 24, background: T.bg }}>
      {chatHistory.length === 0 && !loading && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "30px 16px", width: "100%", maxWidth: 640, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 48, height: 48, borderRadius: 16, background: "linear-gradient(135deg, rgba(207, 15, 71, 0.1), rgba(207, 15, 71, 0.05))", color: T.accent, marginBottom: 16 }}>
              <Sparkles style={{ width: 24, height: 24 }} />
            </div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: T.text, margin: "0 0 6px 0", letterSpacing: "-0.01em" }}>
              Warehouse Copilot
            </h2>
            <p style={{ fontSize: 13, color: T.accent, fontWeight: 600, margin: "0 0 12px 0" }}>
              Your AI operations assistant
            </p>
            <p style={{ fontSize: 13, color: T.textMuted, margin: 0, lineHeight: 1.5 }}>
              Ask questions about your warehouse, inventory, orders, SOPs and reports.
            </p>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", marginBottom: 32, width: "100%" }}>
            {[
              { icon: "ðŸ“¦", title: "Inventory & Orders", desc: "Check stock, shortages & status" },
              { icon: "ðŸ“‹", title: "SOPs & Policies", desc: "Ask about procedures & rules" },
              { icon: "ðŸ“„", title: "Reports & Analysis", desc: "Generate on-the-fly PDF reports" },
              { icon: "ðŸ§­", title: "Guided Tours", desc: "Walkthroughs of how to use WMS" }
            ].map((item, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  textAlign: "left",
                  padding: 14,
                  background: T.bg,
                  border: `1px solid ${T.border}`,
                  borderRadius: 12,
                  width: "calc(50% - 6px)",
                  minWidth: 160,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 16 }}>{item.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>{item.title}</span>
                </div>
                <span style={{ fontSize: 12, color: T.textMuted }}>{item.desc}</span>
              </div>
            ))}

            {/* Forecast Intelligence Doorway */}
            <Link
              href="/admin/forecasts?open_assistant=true"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 20px",
                background: "linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(139, 92, 246, 0.02) 100%)",
                border: "1px solid rgba(139, 92, 246, 0.3)",
                borderRadius: 12,
                width: "100%",
                textDecoration: "none",
                cursor: "pointer",
                transition: "all 0.2s ease"
              }}
              onMouseOver={(e) => (e.currentTarget.style.borderColor = "rgba(139, 92, 246, 0.6)")}
              onMouseOut={(e) => (e.currentTarget.style.borderColor = "rgba(139, 92, 246, 0.3)")}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 18 }}>âœ¨</span>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#7c3aed" }}>Forecast Intelligence</span>
                  <span style={{ fontSize: 12, color: T.textMuted }}>Understand ML predictions & demand</span>
                </div>
              </div>
              <ArrowRight style={{ width: 16, height: 16, color: "#7c3aed" }} />
            </Link>
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
            animation: "fcb-message-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
          }}
        >

          <div style={{ display: "flex", flexDirection: "column", maxWidth: "80%", alignItems: message.role === "user" ? "flex-end" : "flex-start" }}>
            <div
              style={
                message.role === "user"
                  ? {
                    background: T.userBubbleGradient,
                    color: T.userText,
                    borderRadius: "16px 16px 4px 16px",
                    boxShadow: "0 4px 12px rgba(207, 15, 71, 0.25)",
                    fontSize: 13,
                    lineHeight: 1.6,
                    padding: "9px 13px",
                    wordBreak: "break-word",
                    whiteSpace: "pre-wrap",
                  }
                  : {
                    background: T.aiBubble,
                    color: T.text,
                    borderRadius: "4px 16px 16px 16px",
                    border: `1px solid ${T.border}`,
                    boxShadow: T.aiBubbleShadow,
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
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, padding: "0 4px" }}>
              {message.timestamp && (
                <span style={{ fontSize: 10, color: T.textFaint }}>
                  {formatMessageTime(message.timestamp)}
                </span>
              )}
              {message.response_type && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    padding: "2px 6px",
                    borderRadius: 4,
                    color: message.response_type === "FACT" ? T.ok : message.response_type === "INSIGHT" ? "#3b82f6" : "#f59e0b",
                    background: message.response_type === "FACT" ? "#dcfce7" : message.response_type === "INSIGHT" ? "#dbeafe" : "#fef3c7",
                    border: `1px solid ${
                      message.response_type === "FACT" ? "#bbf7d0" : message.response_type === "INSIGHT" ? "#bfdbfe" : "#fde68a"
                    }`,
                  }}
                >
                  {message.response_type} {message.confidence ? `(${(message.confidence * 100).toFixed(0)}%)` : ""}
                </span>
              )}
            </div>
            
            {message.actions && message.actions.length > 0 && (
              <div style={{ marginTop: 6, padding: "0 4px", display: "flex", gap: 6, flexWrap: "wrap", justifyContent: message.role === "user" ? "flex-end" : "flex-start" }}>
                {message.actions.map((action, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      if (action.type === "START_TOUR" && action.payload?.tourId) {
                        onSuggestionClick(`Start tour: ${action.payload.tourId}`);
                      } else {
                        onSuggestionClick(action.label);
                      }
                    }}
                    style={{
                      padding: "5px 10px",
                      fontSize: 11,
                      fontWeight: 600,
                      borderRadius: 6,
                      border: `1px solid ${T.accentBorder}`,
                      background: T.accentBg,
                      color: T.accent,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = T.accent;
                      e.currentTarget.style.color = "#ffffff";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = T.accentBg;
                      e.currentTarget.style.color = T.accent;
                    }}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
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
              padding: "8px 14px",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
              display: "flex",
              alignItems: "center",
              gap: 12,
              height: 38,
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 500, color: T.textDim }}>{contextualLoadingText}</span>
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
  onQueryChange,
  onSubmit,
}: {
  inputRef: React.RefObject<HTMLTextAreaElement>;
  query: string;
  loading: boolean;
  placeholder: string;
  mobile?: boolean;
  onQueryChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
}) {
  const T = useDesignTokens();
  return (
    <form
      onSubmit={(event) => void onSubmit(event)}
      style={{
        borderTop: `1px solid ${T.border}`,
        background: T.glassHeader,
        backdropFilter: "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
        padding: "10px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 8,
          background: "transparent",
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
        to send Â·{" "}
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
  const T = useDesignTokens();
  return <WarehouseAssistant userRole={userRole} fullPage userId={userId} />;
}
