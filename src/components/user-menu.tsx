"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { signOut } from "@/app/login/actions";
import { Avatar } from "./avatar";
import { LogOutIcon, UserIcon } from "./icons";
import { ThemeToggle } from "./theme-toggle";

/** Avatar button opening a menu with profile, theme and sign out. */
export function UserMenu({ name, email }: { name: string; email: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    // Close on outside click or Escape.
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

  const item =
    "state-layer flex h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-sm text-on-surface";

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label="Account menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className={`state-layer flex cursor-pointer rounded-full border border-outline p-1 transition-colors duration-200 ease-emphasized ${
          open ? "bg-secondary-container" : ""
        }`}
      >
        <Avatar name={name} />
      </button>
      {open && (
        <div
          id={id}
          className="absolute right-0 z-20 mt-2 flex w-72 flex-col gap-1 rounded-3xl border border-surface-container-high bg-card p-2 shadow-(--shadow-1) dark:bg-surface-container-high"
        >
          <div className="flex items-center gap-3 px-3 py-2">
            <Avatar name={name} size={40} />
            <div className="min-w-0">
              <p className="truncate font-medium text-on-surface">{name}</p>
              <p className="truncate text-sm text-on-surface-variant">
                {email}
              </p>
            </div>
          </div>
          <hr className="my-1 border-surface-container-high" />
          <Link href="/profile" onClick={() => setOpen(false)} className={item}>
            <UserIcon className="size-5 text-on-surface-variant" />
            Profile
          </Link>
          <div className="flex items-center justify-between gap-3 px-3 py-1.5 text-sm text-on-surface">
            Theme
            <ThemeToggle />
          </div>
          <hr className="my-1 border-surface-container-high" />
          <form action={signOut}>
            <button type="submit" className={item}>
              <LogOutIcon className="size-5 text-on-surface-variant" />
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
