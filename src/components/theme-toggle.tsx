"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [theme, setTheme] = useState("light");
  useEffect(() => {
    const sync = () =>
      setTheme(document.documentElement.dataset.theme ?? "light");
    sync();
    const system = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem("minglo-theme");
      } catch {}
      document.documentElement.dataset.theme =
        saved === "light" || saved === "dark"
          ? saved
          : system.matches
            ? "dark"
            : "light";
      sync();
    };
    window.addEventListener("storage", update);
    system.addEventListener("change", update);
    return () => {
      window.removeEventListener("storage", update);
      system.removeEventListener("change", update);
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
      {dark ? <Sun size={18} /> : <Moon size={18} />}
      <span>{dark ? "Light mode" : "Dark mode"}</span>
    </button>
  );
}
