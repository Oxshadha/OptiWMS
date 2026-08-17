import React from "react";

import { useTheme } from "@/lib/hooks/useTheme";

export const LIGHT_T = {
  // Backgrounds
  bg: "#ffffff",
  bgSub: "#f8f9fa",
  bgMuted: "#f0f2f5",
  panel: "#ffffff",

  // Borders
  border: "#eef0f2",
  borderSub: "#e4e4e7",
  chipBorder: "#e4e4e7",

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
  userBubbleGradient: "linear-gradient(135deg, #CF0F47 0%, #E6175C 100%)",
  userText: "#ffffff",
  aiBubble: "#ffffff", // Make it white for pop against grey background
  aiBubbleShadow: "0 4px 15px rgba(0, 0, 0, 0.05)",

  // Input & Header
  inputBg: "#ffffff",
  inputBorder: "#e5e7eb",
  glassHeader: "rgba(255, 255, 255, 0.85)",
};

export const DARK_T = {
  // Backgrounds
  bg: "#111827",       // gray-900
  bgSub: "#1f2937",    // gray-800
  bgMuted: "#374151",  // gray-700
  panel: "#1f2937",

  // Borders
  border: "#374151",
  borderSub: "#4b5563",
  chipBorder: "#4b5563",

  // Brand / Accent
  accent: "#F43F5E",    // lighter rose for dark mode visibility
  accentHover: "#E11D48",
  accentGlow: "rgba(244, 63, 94, 0.18)",
  accentBg: "rgba(244, 63, 94, 0.1)",
  accentBorder: "rgba(244, 63, 94, 0.3)",

  // Status
  ok: "#22c55e",
  okBg: "rgba(34, 197, 94, 0.1)",
  warn: "#f59e0b",
  error: "#ef4444",
  errorBg: "rgba(239, 68, 68, 0.1)",

  // Text
  text: "#f9fafb",      // gray-50
  textDim: "#e5e7eb",   // gray-200
  textMuted: "#9ca3af", // gray-400
  textFaint: "#6b7280", // gray-500

  // Bubbles
  userBubble: "#F43F5E",
  userBubbleGradient: "linear-gradient(135deg, #F43F5E 0%, #E11D48 100%)",
  userText: "#ffffff",
  aiBubble: "#374151",  // gray-700
  aiBubbleShadow: "0 4px 15px rgba(0, 0, 0, 0.2)",

  // Input & Header
  inputBg: "#374151",
  inputBorder: "#4b5563",
  glassHeader: "rgba(17, 24, 39, 0.85)",
};

// Deprecated: Only export for legacy direct usages.
export const T = LIGHT_T;

export function useDesignTokens() {
  const { isDark } = useTheme();
  return isDark ? DARK_T : LIGHT_T;
}

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
  @keyframes fcb-message-pop {
    from { opacity: 0; transform: translateY(10px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
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