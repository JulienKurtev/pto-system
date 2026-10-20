"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";

/**
 * Pill-style tab links with a highlight that slides to the active item.
 * It moves on click, before the navigation finishes.
 */
export function SegmentedNav({
  items,
  active,
  label,
}: {
  items: { href: string; label: string }[];
  /** Index of the item matching the current URL. */
  active: number;
  label: string;
}) {
  const [clicked, setClicked] = useState<number | null>(null);
  // Once the URL catches up, follow it again (e.g. back/forward).
  const [prevActive, setPrevActive] = useState(active);
  if (active !== prevActive) {
    setPrevActive(active);
    setClicked(null);
  }
  const shown = clicked ?? active;

  const navRef = useRef<HTMLElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  const linkRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  useLayoutEffect(() => {
    const nav = navRef.current;
    const pill = pillRef.current;
    if (!nav || !pill) return;
    function place() {
      const link = linkRefs.current[shown];
      if (!link || !pill) return;
      pill.style.width = `${link.offsetWidth}px`;
      pill.style.transform = `translateX(${link.offsetLeft}px)`;
    }
    place();
    // Animate only after the first placement, so it doesn't slide in on load.
    requestAnimationFrame(() => (pill.dataset.ready = ""));
    // Widths can change (fonts loading, resizing).
    const observer = new ResizeObserver(place);
    observer.observe(nav);
    return () => observer.disconnect();
  }, [shown]);

  return (
    <nav
      ref={navRef}
      aria-label={label}
      className="relative flex w-fit max-w-full gap-1 overflow-x-auto rounded-full border border-outline p-1"
    >
      <span
        ref={pillRef}
        aria-hidden="true"
        className="absolute inset-y-1 left-0 rounded-full bg-secondary-container data-ready:transition-[transform,width] data-ready:duration-300 data-ready:ease-emphasized motion-reduce:transition-none"
      />
      {items.map((item, i) => (
        <Link
          key={item.href}
          ref={(el) => {
            linkRefs.current[i] = el;
          }}
          href={item.href}
          onClick={(e) => {
            // Opening in a new tab doesn't navigate here.
            if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return;
            setClicked(i);
          }}
          aria-current={i === shown ? "page" : undefined}
          className={`state-layer z-10 inline-flex h-8 shrink-0 items-center rounded-full px-4 text-sm font-medium transition-colors duration-300 ${
            i === shown
              ? "text-on-secondary-container"
              : "text-on-surface-variant"
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
