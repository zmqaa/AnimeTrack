import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "var(--border)",
        input: "var(--border)",
        ring: "var(--accent)",
        background: "var(--bg-page)",
        foreground: "var(--text-primary)",
        primary: {
          DEFAULT: "var(--accent)",
          foreground: "#fff",
        },
        secondary: {
          DEFAULT: "var(--text-secondary)",
          foreground: "var(--bg-card)",
        },
        destructive: {
          DEFAULT: "#7f1d1d",
          foreground: "#fafafa",
        },
        muted: {
          DEFAULT: "var(--tag-bg)",
          foreground: "var(--text-muted)",
        },
        accent: {
          DEFAULT: "var(--accent-light)",
          foreground: "var(--accent)",
        },
        popover: {
          DEFAULT: "var(--bg-card)",
          foreground: "var(--text-primary)",
        },
        card: {
          DEFAULT: "var(--bg-card)",
          foreground: "var(--text-primary)",
        },
      },
    },
  },
  plugins: [],
};
export default config;
