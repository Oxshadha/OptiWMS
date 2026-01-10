import type { Config } from "tailwindcss";
import daisyui from "daisyui";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./pages/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [daisyui],
  daisyui: {
    themes: [
      {
        optiwms: {
          "color-scheme": "light",
          primary: "#CF0F47",
          "primary-content": "#F0EAF6",
          secondary: "#FFDEDE",
          "secondary-content": "#111827",
          accent: "#FF0B55",
          "accent-content": "#0F172A",
          neutral: "#111827",
          "neutral-content": "#F3F4F6",
          "base-100": "#FFFFFF",
          "base-200": "#F7F7F7",
          "base-300": "#EFEFEF",
          "base-content": "#1F2937", // Dark text for light mode
          "status-badge": "#EEEEEE",
          info: "#4AA8FF",
          success: "#39BE7D",
          warning: "#F4C542",
          error: "#E34E4E",
          "--rounded-box": "1rem",
          "--rounded-btn": "0.75rem",
          "--rounded-badge": "1rem",
          "--tab-radius": "0.75rem",
          // SVG/Canvas colors for light mode
          "--svg-text-light": "#FFFFFF", // White text for dark backgrounds
          "--svg-text-dark": "#1F2937", // Dark text for light backgrounds
          "--svg-bg": "#FFFFFF", // Background for labels
          "--svg-border": "#D1D5DB", // Border color
        },
        "optiwms-dark": {
          "color-scheme": "dark",
          primary: "#CF0F47", // Keep primary red
          "primary-content": "#F0EAF6",
          secondary: "#FFDEDE",
          "secondary-content": "#111827",
          accent: "#FF0B55", // Keep accent red
          "accent-content": "#F0EAF6",
          neutral: "#1F2937", // Darker neutral
          "neutral-content": "#F3F4F6",
          "base-100": "#0F172A", // Dark background
          "base-200": "#1E293B", // Darker surface
          "base-300": "#334155", // Darker border
          "base-content": "#F1F5F9", // Light text (white/light gray)
          "status-badge": "#1E293B",
          info: "#4AA8FF",
          success: "#39BE7D",
          warning: "#F4C542",
          error: "#E34E4E",
          "--rounded-box": "1rem",
          "--rounded-btn": "0.75rem",
          "--rounded-badge": "1rem",
          "--tab-radius": "0.75rem",
          // SVG/Canvas colors for dark mode
          "--svg-text-light": "#F1F5F9", // Light text for dark backgrounds
          "--svg-text-dark": "#1F2937", // Dark text for light backgrounds
          "--svg-bg": "#1E293B", // Background for labels
          "--svg-border": "#334155", // Border color
        },
      },
    ],
  },
};

export default config;


