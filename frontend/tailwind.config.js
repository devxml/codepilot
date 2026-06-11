/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ["'JetBrains Mono'", "monospace"],
        sans: ["'Inter'", "sans-serif"],
      },
      colors: {
        bg: "#070912",
        surface: "#10131f",
        "surface-elevated": "#151927",
        border: "#242a3d",
        accent: "#8b5cf6",
        "accent-strong": "#6d5dfc",
        "accent-dim": "#27204f",
        cyan: "#22d3ee",
        muted: "#5c6684",
        text: "#eef2ff",
        "text-dim": "#97a0ba",
        green: "#34d399",
        red: "#fb7185",
        yellow: "#facc15",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease forwards",
        "slide-up": "slideUp 0.4s ease forwards",
        "soft-pulse": "softPulse 1.8s ease-in-out infinite",
        blink: "blink 1s step-end infinite",
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: "translateY(12px)" }, to: { opacity: 1, transform: "translateY(0)" } },
        softPulse: { "0%,100%": { opacity: 0.55 }, "50%": { opacity: 1 } },
        blink: { "0%,100%": { opacity: 1 }, "50%": { opacity: 0 } },
      },
    },
  },
  plugins: [],
};
