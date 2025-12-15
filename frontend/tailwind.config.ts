import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Pendex Color Palette
        background: "#0A0A0B",
        card: "#141414",
        "card-hover": "#1a1a1a",
        border: "#2a2a2a",

        // Brand Colors - Teal/Turquoise
        gold: {
          DEFAULT: "#2DD4BF",
          50: "#F0FDFA",
          100: "#CCFBF1",
          200: "#99F6E4",
          300: "#5EEAD4",
          400: "#2DD4BF",
          500: "#14B8A6",
          600: "#0D9488",
          700: "#0F766E",
          800: "#115E59",
          900: "#134E4A",
        },

        // Status Colors
        success: {
          DEFAULT: "#10B981",
          light: "#34D399",
          dark: "#059669",
        },
        danger: {
          DEFAULT: "#EF4444",
          light: "#F87171",
          dark: "#DC2626",
        },
        warning: {
          DEFAULT: "#F59E0B",
          light: "#FBBF24",
          dark: "#D97706",
        },
        info: {
          DEFAULT: "#3B82F6",
          light: "#60A5FA",
          dark: "#2563EB",
        },

        // Text Colors
        "text-primary": "#FFFFFF",
        "text-secondary": "#A0A0A0",
        "text-muted": "#6B7280",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      boxShadow: {
        "gold-glow": "0 0 20px rgba(45, 212, 191, 0.3)",
        "gold-glow-sm": "0 0 10px rgba(45, 212, 191, 0.2)",
        "success-glow": "0 0 15px rgba(16, 185, 129, 0.3)",
        "danger-glow": "0 0 15px rgba(239, 68, 68, 0.3)",
      },
      backgroundImage: {
        "gold-gradient": "linear-gradient(135deg, #2DD4BF 0%, #14B8A6 100%)",
        "dark-gradient": "linear-gradient(180deg, #141414 0%, #0A0A0B 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
