"use client";

import { useSyncExternalStore } from "react";
import { CheckIcon, CloseIcon } from "./icons";

type Toast = {
  id: number;
  kind: "success" | "error";
  message: string;
  leaving?: boolean;
};

// Tiny module-level store: any client code can call toast().
let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const EMPTY: Toast[] = [];
const MAX_SHOWN = 3;
const LEAVE_MS = 200;

function update(next: Toast[]) {
  toasts = next;
  for (const l of listeners) l();
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function toast(kind: Toast["kind"], message: string) {
  const id = nextId++;
  update([...toasts, { id, kind, message }].slice(-MAX_SHOWN));
  // Errors stay a little longer: they usually need reading.
  setTimeout(() => dismiss(id), kind === "error" ? 6000 : 4000);
}

function dismiss(id: number) {
  if (!toasts.some((t) => t.id === id && !t.leaving)) return;
  // Play the exit animation, then remove.
  update(toasts.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
  setTimeout(() => update(toasts.filter((t) => t.id !== id)), LEAVE_MS);
}

/** Renders toasts bottom-centre on phones, bottom-right on larger screens. */
export function Toaster() {
  const list = useSyncExternalStore(
    subscribe,
    () => toasts,
    () => EMPTY,
  );
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6">
      {list.map((t) => (
        <div
          key={t.id}
          role={t.kind === "error" ? "alert" : "status"}
          className={`pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border border-outline-variant/40 bg-card py-2.5 pr-2 pl-3 shadow-(--shadow-1) transition-[opacity,translate] duration-200 ease-emphasized motion-reduce:transition-none dark:bg-surface-container-high starting:translate-y-3 starting:opacity-0 ${
            t.leaving ? "translate-y-3 opacity-0" : ""
          }`}
        >
          <span
            aria-hidden="true"
            className={`flex size-7 shrink-0 items-center justify-center rounded-full ${
              t.kind === "error"
                ? "bg-error-container text-on-error-container"
                : "bg-success-container text-on-success-container"
            }`}
          >
            {t.kind === "error" ? (
              <CloseIcon className="size-4" />
            ) : (
              <CheckIcon className="size-4" />
            )}
          </span>
          <p className="flex-1 text-sm text-on-surface">{t.message}</p>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => dismiss(t.id)}
            className="icon-btn size-8 shrink-0"
          >
            <CloseIcon className="size-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
