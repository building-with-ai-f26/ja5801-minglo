"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [theme, setTheme] = useState("light");
  useEffect(() => {
    const sync = () =>
      setTheme(document.documentElement.dataset.theme ?? "light");
    sync();
    const update = () => {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem("minglo-theme");
      } catch {}
      document.documentElement.dataset.theme =
        saved === "dark" ? "dark" : "light";
      sync();
    };
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("storage", update);
    };
  }, []);
  const dark = theme === "dark";
  return (
    <button
      type="button"
      className="theme-toggle"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => {
        const next = dark ? "light" : "dark";
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem("minglo-theme", next);
        } catch {}
        setTheme(next);
      }}
    >
      <span className="theme-toggle-track" aria-hidden="true">
        <Sun className="theme-toggle-sun" size={14} strokeWidth={1.8} />
        <Moon className="theme-toggle-moon" size={14} strokeWidth={1.8} />
      </span>
    </button>
  );
}
