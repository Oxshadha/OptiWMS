import React from "react";

// Design tokens (Light mode palette)
export const T = {
  // Backgrounds
  bg: "#ffffff",
  bgSub: "#f8f9fa",
  bgMuted: "#f0f2f5",

  // Borders
  border: "#eef0f2",
  borderSub: "#e4e4e7",

  // Brand / Accent
  accent: "#CF0F47",
  accentHover: "#B00D3E",
  accentGlow: "rgba(207, 15, 71, 0.18)",
  accentBg: "#fff1f5",
  accentBorder: "#fecdd3",

  // Status
  ok: "#16a34a",
  okBg: "#f0fdf4",
  warn: "#d97706",
  error: "#dc2626",
  errorBg: "#fef2f2",

  // Text
  text: "#111827",
  textDim: "#374151",
  textMuted: "#6b7280",
  textFaint: "#9ca3af",

  // Bubbles
  userBubble: "#CF0F47",
  userText: "#ffffff",
  aiBubble: "#f0f2f5",

  // Input
  inputBg: "#ffffff",
  inputBorder: "#d1d5db",
};

export const SHARED_KEYFRAMES = `
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
    0%   { box-shadow: 0 0 0 0 rgba(207, 15, 71, 0.5); }
    70%  { box-shadow: 0 0 0 10px rgba(207, 15, 71, 0); }
    100% { box-shadow: 0 0 0 0 rgba(207, 15, 71, 0); }
  }

  /* ── Quick action chips ── */
  .wa-quick-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #f8f9fa;
    border: 1px solid transparent;
    color: #111827;
    font-size: 12px;
    padding: 5px 11px;
    border-radius: 20px;
    cursor: pointer;
    font-weight: 600;
    transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
    font-family: inherit;
    white-space: nowrap;
  }
  .wa-quick-chip:hover {
    background: rgba(207, 15, 71, 0.08);
    border-color: #fecdd3;
    color: #CF0F47;
    box-shadow: 0 0 8px rgba(207, 15, 71, 0.18);
  }
  .wa-quick-chip:not(:hover) {
    border-color: transparent;
    box-shadow: none;
  }
  .wa-quick-chip:focus,
  .wa-quick-chip:focus-visible {
    outline: none;
  }
  .wa-quick-chip:active {
    transform: scale(0.97);
  }

  /* ── Source pills ── */
  .wa-source-pill:hover {
    background: #fecdd3;
  }

  /* ── Ghost buttons ── */
  .wa-ghost-btn:hover {
    background: #fff1f5;
    border-color: #fecdd3;
    color: #CF0F47;
  }
  .wa-ghost-btn:active {
    transform: scale(0.97);
  }

  /* ── Voice button ── */
  .wa-voice-btn:hover {
    background: #fecdd3;
  }
  .wa-voice-btn:active {
    transform: scale(0.97);
  }

  /* ── Send button ── */
  .wa-send-btn:not(:disabled):hover {
    transform: scale(1.05);
  }
  .wa-send-btn:not(:disabled):active {
    transform: scale(0.95);
  }

  /* ── Data table rows ── */
  .wa-table-row:hover {
    background-color: #fff1f5;
  }

  /* ── Download button ── */
  .wa-download-btn:hover {
    transform: scale(1.02);
  }
  .wa-download-btn:active {
    transform: scale(0.97);
  }

  /* ── Inline links ── */
  .wa-link:hover {
    text-decoration: underline;
    color: #B00D3E;
  }

  /* ── History sidebar items ── */
  .wa-history-item {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    border-radius: 12px;
    padding: 10px;
    cursor: pointer;
    user-select: none;
    transition: background 0.2s ease, color 0.2s ease;
    background: transparent;
    color: #111827;
    border: none;
    text-align: left;
  }
  .wa-history-item:hover {
    background: #fff1f5;
    color: #CF0F47;
  }
  .wa-history-item.active {
    background: #CF0F47;
    color: #ffffff;
    font-weight: 600;
  }
  .wa-history-item .wa-delete-btn {
    opacity: 0;
    transition: opacity 0.15s ease, color 0.15s ease;
    color: #6b7280;
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .wa-history-item:hover .wa-delete-btn {
    opacity: 1;
  }
  .wa-delete-btn:hover {
    color: #dc2626;
  }
`;

export function TypingDots() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <style>{`
        @keyframes fcb-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "#CF0F47",
            display: "inline-block",
            animation: `fcb-bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
    </div>
  );
}