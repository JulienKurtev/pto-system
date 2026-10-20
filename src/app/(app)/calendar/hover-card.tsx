"use client";

import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * Hover/focus popup positioned against the viewport, so it isn't clipped by
 * scrolling containers (e.g. the timeline). Opens above the trigger, or
 * below it when the sticky header would cover it.
 */
export function HoverCard({
  content,
  className,
  children,
}: {
  content: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  const id = useId();
  const triggerRef = useRef<HTMLSpanElement>(null);
  const cardRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    const card = cardRef.current;
    if (!open || !trigger || !card) return;
    const gap = 8;
    const r = trigger.getBoundingClientRect();
    const headerBottom =
      document.querySelector("header")?.getBoundingClientRect().bottom ?? 0;
    let top = r.top - card.offsetHeight - gap;
    if (top < headerBottom + gap) top = r.bottom + gap;
    const left = Math.min(
      Math.max(r.left + r.width / 2 - card.offsetWidth / 2, gap),
      window.innerWidth - card.offsetWidth - gap,
    );
    card.style.top = `${top}px`;
    card.style.left = `${left}px`;
    card.style.visibility = "visible";

    // The position goes stale on scroll, so just close.
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    return () => window.removeEventListener("scroll", close, true);
  }, [open]);

  return (
    <span
      ref={triggerRef}
      tabIndex={0}
      aria-describedby={open ? id : undefined}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      className={`outline-none focus-visible:ring-2 focus-visible:ring-primary ${className ?? ""}`}
    >
      {children}
      {open && (
        <span
          ref={cardRef}
          id={id}
          role="tooltip"
          style={{ position: "fixed", top: 0, left: 0, visibility: "hidden" }}
          className="pointer-events-none z-30 flex w-60 flex-col gap-2 rounded-2xl border border-surface-container-high bg-card p-3 text-left text-xs shadow-(--shadow-1)"
        >
          {content}
        </span>
      )}
    </span>
  );
}
