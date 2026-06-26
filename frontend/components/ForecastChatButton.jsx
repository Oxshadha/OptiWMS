"use client";
import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { T, SHARED_KEYFRAMES, TypingDots } from "./designTokens";


// ─── Quick action suggestions ────────────────────────────────────────────────
const QUICK_ACTIONS = [
  {
    icon: "🧠",
    label: "Explain this forecast",
    msg: "Explain why the model predicted this forecast value. What are the main drivers?",
  },
  {
    icon: "📈",
    label: "Show demand trend",
    msg: "Describe the demand trend for the last 6 months and what's driving it.",
  },
  {
    icon: "⚠️",
    label: "Why did the forecast spike?",
    msg: "Why is there a spike or unusual jump in the forecast? What factors caused it?",
  },
  {
    icon: "📦",
    label: "Recommended reorder qty",
    msg: "Based on this forecast and current inventory levels, what is the recommended reorder quantity?",
  },
  {
    icon: "🔮",
    label: "What-if demand +20%?",
    msg: "What happens to inventory and replenishment if actual demand increases by 20% above this forecast?",
  },
];

// ─── Simple markdown-lite renderer ──────────────────────────────────────────
function renderMarkdownLite(text) {
  if (!text) return "";
  // Bold
  let html = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // Newlines
  html = html.replace(/\n/g, "<br/>");
  return html;
}


// ─── Message bubble ──────────────────────────────────────────────────────────
function Bubble({ msg, isLast }) {
  const isUser = msg.role === "user";
  const isEmpty = !msg.content;

  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
        animation: "fcb-fadein 0.22s ease",
      }}
    >
      {!isUser}
      {/* && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16, // Bumped slightly from 11 since there's no bounding box now
            flexShrink: 0,
            marginRight: 7,
            marginTop: 2,
          }}
        >
          🤖
        </div>
      )} */}
      <div
        style={{
          maxWidth: "80%",
          padding: isUser ? "9px 13px" : "10px 14px",
          borderRadius: isUser ? "14px 14px 3px 14px" : "3px 14px 14px 14px",
          fontSize: 13,
          lineHeight: 1.6,
          color: isUser ? T.userText : T.text,
          background: isUser ? T.userBubble : T.aiBubble,
          border: isUser
            ? `1px solid ${T.userBubble}`
            : `1px solid ${T.borderSub}`,
          borderLeft: isUser ? undefined : `2px solid ${T.accent}`,
          boxShadow: isUser ? undefined : "inset 0 1px 0 rgba(255,255,255,0.06)",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {isEmpty && isLast ? (
          <TypingDots />
        ) : (
          <span
            dangerouslySetInnerHTML={{
              __html: renderMarkdownLite(msg.content),
            }}
          />
        )}
      </div>
    </div>
  );
}

// ─── Quick action chip ───────────────────────────────────────────────────────
function QuickChip({ icon, label, onClick, disabled }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "5px 11px",
        borderRadius: 20,
        border: `1px solid ${hovered ? "#fecdd3" : "transparent"}`,
        background: hovered ? "rgba(207, 15, 71, 0.08)" : "#f8f9fa",
        color: hovered ? T.accent : T.text,
        fontSize: 12,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "background 0.15s ease, border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease",
        whiteSpace: "nowrap",
        boxShadow: hovered ? `0 0 8px ${T.accentGlow}` : "none",
        fontFamily: "inherit",
        fontWeight: 600,
        outline: "none",
      }}
    >
      <span style={{ fontSize: 13 }}>{icon}</span>
      {label}
    </button>
  );
}

const formatMonthLabel = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return d.toLocaleString("default", { month: "short", year: "2-digit" });
  }
  if (dateStr.startsWith("H+")) {
    return `Month +${dateStr.substring(2)}`;
  }
  return dateStr;
};

// ─── Main component ──────────────────────────────────────────────────────────
export default function ForecastChatButton({
  sku,
  skuOptions = [],
  forecastPoints = [],
  selectedMonth,
  predictedUnits,
  confidence,
  mape,
  onSkuChange,
  onOpen,
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [quickActionsShown, setQuickActionsShown] = useState(true);
  const [activeSku, setActiveSku] = useState(sku || "");
  const [activeMonth, setActiveMonth] = useState(selectedMonth || "");

  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Keep activeSku in sync when parent changes selectedSku
  useEffect(() => {
    setActiveSku(sku || "");
  }, [sku]);

  // Keep activeMonth in sync when parent changes selectedMonth
  useEffect(() => {
    setActiveMonth(selectedMonth || "");
  }, [selectedMonth]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [open]);

  // Deduplicate and filter months by active SKU for the dropdown options
  const filteredPoints = useMemo(() => {
    const pool = activeSku
      ? forecastPoints.filter((p) => p.sku === activeSku)
      : forecastPoints;
    const seen = new Set();
    return pool.filter((p) => {
      if (!p.month || seen.has(p.month)) return false;
      seen.add(p.month);
      return true;
    });
  }, [forecastPoints, activeSku]);

  // Automatically switch activeMonth if it is not valid for the current SKU options
  useEffect(() => {
    if (filteredPoints.length > 0) {
      const exists = filteredPoints.some((p) => p.month === activeMonth);
      if (!exists) {
        setActiveMonth(filteredPoints[0].month);
      }
    }
  }, [filteredPoints, activeMonth]);

  // Match forecast point and aggregate demand value for the active SKU and selected month
  const displayUnits = useMemo(() => {
    const pool = activeSku
      ? forecastPoints.filter((p) => p.sku === activeSku)
      : forecastPoints;
    const matched = pool.filter((p) => p.month === activeMonth);
    if (matched.length === 0) return predictedUnits;
    return matched.reduce((sum, p) => sum + p.p50, 0);
  }, [forecastPoints, activeSku, activeMonth, predictedUnits]);

  // Inject greeting on first open
  useEffect(() => {
    if (open && messages.length === 0) {
      if (typeof onOpen === "function") onOpen();
      const skuLabel = activeSku || "all combined SKUs";
      const monthLabel = activeMonth ? formatMonthLabel(activeMonth) : "the next forecast period";
      const unitsLabel =
        displayUnits != null
          ? `${displayUnits.toLocaleString()} units`
          : "—";
      setMessages([
        {
          role: "assistant",
          content: `Hi! I'm your **Forecast Explanation Assistant**.\n\nCurrently analyzing **${skuLabel}** — forecast **${unitsLabel}** for ${monthLabel}.\n\nAsk me anything about this prediction, or tap a quick action below.`,
        },
      ]);
    }
  }, [open]);

  // Reset quick actions + greeting when SKU changes inside chat
  const handleSkuSwitch = useCallback(
    (newSku) => {
      setActiveSku(newSku);
      if (typeof onSkuChange === "function") onSkuChange(newSku);
      const unitsLabel =
        displayUnits != null
          ? `${displayUnits.toLocaleString()} units`
          : "—";
      const monthLabel = activeMonth ? formatMonthLabel(activeMonth) : "the next forecast period";
      setMessages([
        {
          role: "assistant",
          content: `Context switched to **${newSku || "all combined SKUs"}**.\n\nForecast: **${unitsLabel}** for ${monthLabel}.\n\nWhat would you like to know?`,
        },
      ]);
      setQuickActionsShown(true);
    },
    [onSkuChange, displayUnits, activeMonth],
  );

  const handleMonthSwitch = useCallback(
    (newMonth) => {
      setActiveMonth(newMonth);
      const matched = forecastPoints.find((p) => p.month === newMonth);
      const unitsVal = matched ? matched.p50 : null;
      const unitsLabel =
        unitsVal !== null ? `${unitsVal.toLocaleString()} units` : "—";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Month context switched to **${formatMonthLabel(newMonth)}**.\n\nForecast: **${unitsLabel}** for ${formatMonthLabel(newMonth)}.\n\nWhat would you like to know?`,
        },
      ]);
    },
    [forecastPoints],
  );

  const sendMessage = useCallback(
    async (overrideMsg) => {
      const userMessage = (overrideMsg ?? input).trim();
      if (!userMessage || loading) return;
      setInput("");
      setQuickActionsShown(false);
      setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
      setLoading(true);

      // Add empty placeholder for streaming
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      try {
        const res = await fetch("/api/explain/forecast/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sku: activeSku || "all",
            forecastPoints,
            selectedMonth: activeMonth,
            predictedUnits: displayUnits ?? null,
            confidence: confidence ?? null,
            mape: mape ?? null,
            userMessage,
          }),
        });

        if (!res.ok) throw new Error(`Server error ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let done = false;

        while (!done) {
          const { value, done: d } = await reader.read();
          done = d;
          if (value) {
            const chunk = decoder.decode(value, { stream: true });
            setMessages((prev) => {
              const copy = [...prev];
              const lastIndex = copy.length - 1;
              if (lastIndex >= 0 && copy[lastIndex].role === "assistant") {
                copy[lastIndex] = {
                  ...copy[lastIndex],
                  content: (copy[lastIndex].content || "") + chunk,
                };
              }
              return copy;
            });
          }
        }
      } catch (err) {
        setMessages((prev) => {
          const copy = [...prev];
          const lastIndex = copy.length - 1;
          if (lastIndex >= 0 && copy[lastIndex].role === "assistant" && copy[lastIndex].content === "") {
            copy[lastIndex] = {
              ...copy[lastIndex],
              content: "Sorry, I couldn't reach the forecast explainer service. Please try again in a moment.",
            };
          }
          return copy;
        });
      } finally {
        setLoading(false);
      }
    },
    [
      input,
      loading,
      activeSku,
      forecastPoints,
      activeMonth,
      displayUnits,
      confidence,
      mape,
    ],
  );

  const togglePanel = () => {
    setOpen((prev) => !prev);
  };

  const hasContext = !!(activeSku || forecastPoints.length > 0);
  const confPct =
    confidence != null ? `${Math.round(confidence * 100)}%` : null;
  const mapeStr = mape != null ? `${mape.toFixed(1)}%` : null;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: SHARED_KEYFRAMES }} />
      {/* ── Floating Action Button ─────────────────────────────────────── */}
      <button
        aria-label={
          open ? "Close forecast assistant" : "Open forecast assistant"
        }
        title="Forecast Assistant"
        onClick={togglePanel}
        style={{
          position: "fixed",
          right: 22,
          bottom: 22,
          width: 54,
          height: 54,
          borderRadius: "50%",
          background: open
            ? "rgba(255,255,255,0.95)"
            : `linear-gradient(135deg, ${T.accent} 0%, #ff6b35 100%)`,
          border: `1.5px solid ${open ? T.border : "transparent"}`,
          color: open ? "#666" : "white",
          boxShadow: open
            ? `0 4px 20px rgba(0,0,0,0.15)`
            : `0 6px 24px rgba(207, 15, 71, 0.35)`,
          cursor: "pointer",
          zIndex: 1100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.25s cubic-bezier(0.34,1.56,0.64,1)",
          transform: open ? "rotate(45deg)" : "scale(1)",
          animation:
            hasContext && !open ? "fcb-pulse-ring 2.5s ease infinite" : "none",
        }}
      >
        {open ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
          </svg>
        )}
      </button>

      {/* ── Sliding Panel ─────────────────────────────────────────────── */}
      {open && (
        <div
          role="dialog"
          aria-label="Forecast assistant"
          style={{
            position: "fixed",
            right: 22,
            bottom: 90,
            width: 400,
            maxWidth: "calc(100vw - 44px)",
            height: 560,
            maxHeight: "78vh",
            background: T.panel,
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            borderRadius: 16,
            border: `1px solid ${T.border}`,
            borderTop: `2px solid ${T.accent}`,
            boxShadow: "0 24px 60px rgba(0,0,0,0.10), 0 4px 16px rgba(0,0,0,0.06)",
            zIndex: 1099,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            fontFamily:
              "'Inter', 'system-ui', '-apple-system', 'Segoe UI', sans-serif",
            animation: "fcb-slide-up 0.28s cubic-bezier(0.34,1.56,0.64,1)",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "12px 16px",
              borderBottom: `1px solid ${T.borderSub}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              {/* <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: `linear-gradient(135deg, ${T.accent}, #0b74de)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 15,
                  flexShrink: 0,
                }}
              >
                🔮
              </div> */}
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: T.text,
                    letterSpacing: 0.2,
                  }}
                >
                  Forecast Assistant
                </div>
                <div style={{ fontSize: 10, color: T.textDim, marginTop: 1 }}>
                  AI-powered explainability engine
                </div>
              </div>
            </div>

            {/* SKU Switcher */}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {skuOptions.length > 0 && (
                <select
                  value={activeSku}
                  onChange={(e) => handleSkuSwitch(e.target.value)}
                  title="Switch analysis SKU"
                  style={{
                    background: T.inputBg,
                    border: `1px solid ${T.chipBorder}`,
                    borderRadius: 7,
                    color: T.accent,
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "4px 8px",
                    cursor: "pointer",
                    outline: "none",
                    maxWidth: 120,
                    fontFamily: "monospace",
                  }}
                >
                  <option
                    value=""
                    style={{ background: T.panel, color: T.text }}
                  >
                    All SKUs
                  </option>
                  {skuOptions.map((s) => (
                    <option
                      key={s}
                      value={s}
                      style={{ background: T.panel, color: T.text }}
                    >
                      {s}
                    </option>
                  ))}
                </select>
              )}
              {filteredPoints.length > 0 && (
                <select
                  value={activeMonth}
                  onChange={(e) => handleMonthSwitch(e.target.value)}
                  title="Switch analysis Month"
                  style={{
                    background: T.inputBg,
                    border: `1px solid ${T.chipBorder}`,
                    borderRadius: 7,
                    color: T.text,
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "4px 8px",
                    cursor: "pointer",
                    outline: "none",
                    maxWidth: 100,
                  }}
                >
                  {filteredPoints.map((p) => (
                    <option
                      key={p.month}
                      value={p.month}
                      style={{ background: T.panel, color: T.text }}
                    >
                      {formatMonthLabel(p.month)}
                    </option>
                  ))}
                </select>
              )}
              <button
                onClick={togglePanel}
                aria-label="Close"
                style={{
                  background: "transparent",
                  border: "none",
                  color: T.textDim,
                  cursor: "pointer",
                  fontSize: 18,
                  lineHeight: 1,
                  padding: 2,
                  display: "flex",
                }}
              >
                ×
              </button>
            </div>
          </div>

          {/* Context Banner */}
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
              <span style={{ color: T.textMuted }}>SKU: </span>
              <strong style={{ color: T.accent, fontFamily: "monospace" }}>
                {activeSku || "All Combined"}
              </strong>
            </span>
            {activeMonth && (
              <span>
                <span style={{ color: T.textMuted }}>Month: </span>
                <strong style={{ color: T.text }}>{formatMonthLabel(activeMonth)}</strong>
              </span>
            )}
            {displayUnits != null && (
              <span>
                <span style={{ color: T.textMuted }}>Forecast: </span>
                <strong style={{ color: T.ok }}>
                  {displayUnits.toLocaleString()} units
                </strong>
              </span>
            )}
            {confPct && (
              <span>
                <span style={{ color: T.textMuted }}>Confidence: </span>
                <strong style={{ color: T.warn }}>{confPct}</strong>
              </span>
            )}
            {mapeStr && (
              <span>
                <span style={{ color: T.textMuted }}>MAPE: </span>
                <strong style={{ color: T.text }}>{mapeStr}</strong>
              </span>
            )}
          </div>

          {/* Messages area */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "12px 14px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {messages.map((msg, i) => (
              <Bubble key={i} msg={msg} isLast={i === messages.length - 1} />
            ))}

            {/* Typing indicator when loading but last message already has content */}
            {loading &&
              messages.length > 0 &&
              messages[messages.length - 1].content !== "" && (
                <div style={{ display: "flex", justifyContent: "flex-start" }}>
                  <div
                    style={{
                      background: T.aiBubble,
                      border: `1px solid ${T.borderSub}`,
                      borderLeft: `2px solid ${T.accent}`,
                      borderRadius: "3px 14px 14px 14px",
                      padding: "10px 14px",
                    }}
                  >
                    <TypingDots />
                  </div>
                </div>
              )}

            {/* Quick actions — shown after greeting, before first user message */}
            {quickActionsShown && messages.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  paddingTop: 4,
                }}
              >
                {QUICK_ACTIONS.map((qa) => (
                  <QuickChip
                    key={qa.label}
                    icon={qa.icon}
                    label={qa.label}
                    disabled={loading}
                    onClick={() => sendMessage(qa.msg)}
                  />
                ))}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input bar */}
          <div
            style={{
              padding: "10px 14px",
              borderTop: `1px solid ${T.borderSub}`,
              display: "flex",
              gap: 8,
              alignItems: "flex-end",
              flexShrink: 0,
            }}
          >
            <textarea
              ref={inputRef}
              rows={1}
              placeholder="Ask about this forecast…"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                // Auto-grow
                e.target.style.height = "auto";
                e.target.style.height =
                  Math.min(e.target.scrollHeight, 96) + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              disabled={loading}
              style={{
                flex: 1,
                resize: "none",
                background: T.inputBg,
                border: `1px solid ${T.borderSub}`,
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
              onFocus={(e) =>
                (e.target.style.borderColor = "rgba(207, 15, 71, 0.45)")
              }
              onBlur={(e) => (e.target.style.borderColor = T.borderSub)}
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              title="Send (Enter)"
              style={{
                width: 38,
                height: 38,
                borderRadius: 9,
                background:
                  loading || !input.trim()
                    ? T.accentBg
                    : `linear-gradient(135deg, ${T.accent}, #ff6b35)`,
                border: `1px solid ${T.border}`,
                color: loading || !input.trim() ? T.textMuted : "#fff",
                cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transition: "all 0.15s",
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>

          {/* Footer hint */}
          <div
            style={{
              padding: "5px 14px 8px",
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
        </div>
      )}
    </>
  );
}
