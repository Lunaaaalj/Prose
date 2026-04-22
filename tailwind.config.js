import typography from "@tailwindcss/typography";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        fg: "var(--fg)",
        sidebar: "var(--sidebar-bg)",
        "sidebar-fg": "var(--sidebar-fg)",
        "sidebar-active": "var(--sidebar-active-bg)",
        "sidebar-active-fg": "var(--sidebar-active-fg)",
        "border-muted": "var(--border)",
        accent: "var(--accent)",
        status: "var(--status-bg)",
        "status-fg": "var(--status-fg)",
        muted: "var(--muted)",
      },
    },
  },
  plugins: [typography],
};
