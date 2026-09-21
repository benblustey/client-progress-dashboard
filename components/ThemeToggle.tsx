"use client";

import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";

// No external source mutates the theme except this component's own toggle()
// below, so the "subscription" is just a listener set that toggle() notifies
// directly after it flips the class + localStorage.
const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

// Used only for the server-rendered / pre-hydration pass, so it must match
// what that HTML actually shows. The inline script in layout.tsx runs before
// paint and may add "dark" to <html>, but that happens outside React, so
// React still hydrates as if this were "light" here and useSyncExternalStore
// immediately re-syncs to the real DOM class right after mount — no visible
// mismatch, and no setState-in-an-effect (which is what the previous
// useEffect-based version did, and why eslint's react-hooks plugin flagged
// it as an error under Next 16's stricter default config).
function getServerSnapshot(): Theme {
  return "light";
}

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Private browsing / blocked storage: theme just won't persist across visits.
    }
    listeners.forEach((listener) => listener());
  }

  return (
    <button
      onClick={toggle}
      aria-label="Toggle light and dark mode"
      className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
    >
      {theme === "dark" ? "Light mode" : "Dark mode"}
    </button>
  );
}
