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
          "base-content": "#1F2937",
          "status-badge": "#EEEEEE",
          info: "#4AA8FF",
          success: "#39BE7D",
          warning: "#F4C542",
          error: "#E34E4E",
          "--rounded-box": "1rem",
          "--rounded-btn": "0.75rem",
          "--rounded-badge": "1rem",
          "--tab-radius": "0.75rem",
        },
      },
    ],
  },
};

export default config;


