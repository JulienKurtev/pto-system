"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { startTransition, useEffect, useId, useRef, useState } from "react";
import { markNotificationsRead } from "@/app/(app)/actions";
import type { LeaveStatus } from "@/db/schema";
import { BellIcon } from "./icons";
import { StatusBadge } from "./status-badge";

export type NotificationItem = {
  id: string;
  read: boolean;
  title: string;
  detail: string;
  status: LeaveStatus;
};

const POLL_MS = 60_000;

/** Header bell for approvers: unread count, recent requests, marks read on open. */
export function NotificationBell({
  items,
  unread,
}: {
  items: NotificationItem[];
  unread: number;
}) {
  const id = useId();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // Unread at the moment of opening, so they stay highlighted after marking.
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Pick up new requests while the app sits open.
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [router]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function toggle() {
    if (!open && unread > 0) {
      setFresh(new Set(items.filter((n) => !n.read).map((n) => n.id)));
      startTransition(() => markNotificationsRead());
    }
    setOpen(!open);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={
          unread > 0 ? `Notifications, ${unread} unread` : "Notifications"
        }
        aria-expanded={open}
        aria-controls={id}
        onClick={toggle}
        className={`icon-btn ${open ? "bg-secondary-container text-on-secondary-container" : ""}`}
      >
        <BellIcon className="size-5" />
        {unread > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] leading-none font-semibold text-surface">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          id={id}
          className="absolute right-0 z-20 mt-2 flex w-80 max-w-[calc(100vw-2rem)] flex-col rounded-3xl border border-surface-container-high bg-card p-2 shadow-(--shadow-1)"
        >
          <p className="px-3 py-2 font-medium text-on-surface">Notifications</p>
          {items.length === 0 ? (
            <p className="px-3 pb-3 text-sm text-on-surface-variant">
              No requests yet.
            </p>
          ) : (
            <ul className="flex max-h-96 flex-col overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <Link
                    href="/approvals"
                    onClick={() => setOpen(false)}
                    className={`state-layer flex items-center gap-3 rounded-xl px-3 py-2.5 ${
                      fresh.has(n.id) ? "bg-secondary-container/50" : ""
                    }`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-on-surface">
                        {n.title}
                      </span>
                      <span className="block text-xs text-on-surface-variant">
                        {n.detail}
                      </span>
                    </span>
                    <StatusBadge status={n.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
