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
        // Fondos
        "bg-base":        "#FFFFFF",
        "bg-card":        "#FFFFFF",
        "bg-subtle":      "#F4F7F4",

        // Marca — verde oscuro
        "brand-dark":     "#1A3327",
        "brand-medium":   "#2D5A43",
        "brand-light":    "#3A7A5A",

        // Acento — verde brillante
        "accent-green":   "#22C55E",
        "accent-green-dark": "#16A34A",

        // Textos
        "text-primary":   "#0F172A",
        "text-secondary": "#64748B",

        // Bordes
        "border-default": "#E2E8F0",

        // Estados
        "status-success": "#16A34A",
        "status-warning": "#D97706",
        "status-danger":  "#DC2626",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Menlo", "monospace"],
      },
      boxShadow: {
        card:       "0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04)",
        "card-hover":"0 4px 12px 0 rgba(0,0,0,0.10)",
      },
    },
  },
  plugins: [],
};

export default config;
