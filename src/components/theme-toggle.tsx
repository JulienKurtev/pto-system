"use client";

import { useSyncExternalStore } from "react";
import { MonitorIcon, MoonIcon, SunIcon } from "./icons";
import { THEME_STORAGE_KEY, type ThemePreference } from "./theme";

declare global {
  interface Window {
    __applyTheme?: () => void;
  }
}

const CHANGE_EVENT = "themechange";

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange); // other tabs
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {}
  return "system";
}

function setPreference(pref: ThemePreference) {
  try {
    if (pref === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {}
  const apply = () => {
    window.__applyTheme?.();
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };
  // Crossfade the whole page where supported.
  if (
    document.startViewTransition &&
    !matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    document.startViewTransition(apply);
  } else {
    apply();
  }
}

const OPTIONS = [
  { value: "light", label: "Light", Icon: SunIcon },
  { value: "dark", label: "Dark", Icon: MoonIcon },
  { value: "system", label: "System", Icon: MonitorIcon },
] as const;

export function ThemeToggle() {
  // null on the server: no option is shown as selected until hydrated.
  const current = useSyncExternalStore(subscribe, getPreference, () => null);

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="flex rounded-full bg-surface-container p-1"
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const selected = current === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={label}
            title={label}
            onClick={() => setPreference(value)}
            className={`state-layer flex size-8 cursor-pointer items-center justify-center rounded-full transition-colors duration-200 ease-emphasized ${
              selected
                ? "bg-secondary-container text-on-secondary-container"
                : "text-on-surface-variant"
            }`}
          >
            <Icon className="size-[18px]" />
          </button>
        );
      })}
    </div>
  );
}
