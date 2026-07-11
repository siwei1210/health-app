"use client";

import { useEffect, useState } from "react";

type Mode = "system" | "light" | "dark";

function applyMode() {
  const m = (localStorage.getItem("theme") as Mode) || "system";
  const dark =
    m === "dark" ||
    (m === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

// Segmented Auto / Light / Dark control. Persists to localStorage and keeps
// the <html> `dark` class in sync (including live OS changes in Auto mode).
export default function ThemeToggle() {
  const [mode, setMode] = useState<Mode>("system");

  useEffect(() => {
    setMode(((localStorage.getItem("theme") as Mode) || "system"));
  }, []);

  useEffect(() => {
    applyMode();
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyMode();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mode]);

  function choose(m: Mode) {
    localStorage.setItem("theme", m);
    setMode(m);
  }

  const options: { key: Mode; label: string; icon: React.ReactNode }[] = [
    { key: "system", label: "Auto", icon: <AutoIcon /> },
    { key: "light", label: "Light", icon: <SunIcon /> },
    { key: "dark", label: "Dark", icon: <MoonIcon /> },
  ];

  return (
    <div className="flex rounded-full bg-surface p-0.5" role="group" aria-label="Theme">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => choose(o.key)}
          aria-pressed={mode === o.key}
          title={o.label}
          className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
            mode === o.key ? "bg-surface-2 text-fg" : "text-muted"
          }`}
        >
          {o.icon}
        </button>
      ))}
    </div>
  );
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function AutoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor" stroke="none" />
    </svg>
  );
}
