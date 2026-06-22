"use client";
import React, { useState, useRef, useEffect, useCallback } from "react";

// ─── Design tokens (Light mode palette) ────────────────────────
const T = {
  bg: "rgba(255, 255, 255, 0.97)",
  panel: "#ffffff",
  border: "#eef0f2",
  borderSub: "#f2f2f2",
  accent: "#CF0F47", //"#0b74de",
  accentGlow: "rgba(11, 116, 222, 0.25)",
  accent2: "#ff6b35",
  ok: "#00b27b",
  warn: "#f59e0b",
  text: "#222222",
  textDim: "#555555",
  textMuted: "#888888",
  userBubble: "#CF0F47", //"#0b74de",
  userText: "#ffffff",
  aiBubble: "#f0f2f5",
  inputBg: "#ffffff",
  chipBg: "#f8f9fa",
  chipBorder: "#dcdcdc",
  bannerBg: "#fff1f5", //"#f1f7fd",
};

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

// ─── Typing indicator ────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: T.accent,
            display: "inline-block",
            animation: `fcb-bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes fcb-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
        @keyframes fcb-fadein {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fcb-slide-up {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes fcb-pulse-ring {
          0% { box-shadow: 0 0 0 0 rgba(11,116,222,0.5); }
          70% { box-shadow: 0 0 0 10px rgba(11,116,222,0); }
          100% { box-shadow: 0 0 0 0 rgba(11,116,222,0); }
        }
      `}</style>
    </div>
  );
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
        border: `1px solid ${hovered ? T.accent : T.chipBorder}`,
        background: hovered ? "rgba(11, 116, 222, 0.08)" : T.chipBg,
        color: hovered ? T.accent : T.text,
        fontSize: 12,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "all 0.15s ease",
        whiteSpace: "nowrap",
        boxShadow: hovered ? `0 0 8px ${T.accentGlow}` : "none",
        fontFamily: "inherit",
      }}
    >
      <span style={{ fontSize: 13 }}>{icon}</span>
      {label}
    </button>
  );
}

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

  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Keep activeSku in sync when parent changes selectedSku
  useEffect(() => {
    setActiveSku(sku || "");
  }, [sku]);

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

  // Inject greeting on first open
  useEffect(() => {
    if (open && messages.length === 0) {
      if (typeof onOpen === "function") onOpen();
      const skuLabel = activeSku || "all combined SKUs";
      const monthLabel = selectedMonth || "the next forecast period";
      const unitsLabel =
        predictedUnits != null
          ? `${predictedUnits.toLocaleString()} units`
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
        predictedUnits != null
          ? `${predictedUnits.toLocaleString()} units`
          : "—";
      const monthLabel = selectedMonth || "the next forecast period";
      setMessages([
        {
          role: "assistant",
          content: `Context switched to **${newSku || "all combined SKUs"}**.\n\nForecast: **${unitsLabel}** for ${monthLabel}.\n\nWhat would you like to know?`,
        },
      ]);
      setQuickActionsShown(true);
    },
    [onSkuChange, predictedUnits, selectedMonth],
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
            selectedMonth,
            predictedUnits: predictedUnits ?? null,
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
              const last = copy[copy.length - 1];
              if (last?.role === "assistant") {
                last.content = (last.content || "") + chunk;
              }
              return copy;
            });
          }
        }
      } catch (err) {
        setMessages((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last?.role === "assistant" && last.content === "") {
            last.content =
              "Sorry, I couldn't reach the forecast explainer service. Please try again in a moment.";
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
      selectedMonth,
      predictedUnits,
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
            : `linear-gradient(135deg, #0b74de 0%, #00d4ff 100%)`,
          border: `1.5px solid ${open ? T.border : "transparent"}`,
          color: open ? "#666" : "white",
          boxShadow: open
            ? `0 4px 20px rgba(0,0,0,0.15)`
            : `0 6px 24px rgba(11, 116, 222, 0.35)`,
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
            boxShadow: `0 24px 60px rgba(0,0,0,0.12), 0 0 40px rgba(11, 116, 222, 0.04)`,
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
              background: T.bannerBg,
              border: `1px solid rgba(11, 116, 222, 0.14)`,
              borderRadius: 9,
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
            {selectedMonth && (
              <span>
                <span style={{ color: T.textMuted }}>Month: </span>
                <strong style={{ color: T.text }}>{selectedMonth}</strong>
              </span>
            )}
            {predictedUnits != null && (
              <span>
                <span style={{ color: T.textMuted }}>Forecast: </span>
                <strong style={{ color: T.ok }}>
                  {predictedUnits.toLocaleString()} units
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
                (e.target.style.borderColor = "rgba(11, 116, 222, 0.45)")
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
                    ? "rgba(11, 116, 222, 0.08)"
                    : `linear-gradient(135deg, ${T.accent}, #0b74de)`,
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
