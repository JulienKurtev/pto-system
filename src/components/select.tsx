"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { CheckIcon, ChevronDownIcon } from "./icons";

export type SelectOption = { value: string; label: string };

/**
 * Styled replacement for <select>. Submits through a hidden input named
 * `name` (omitted when disabled, like a native select). Uncontrolled with
 * `defaultValue`, or controlled with `value` + `onChange`.
 */
export function Select({
  name,
  options,
  defaultValue,
  value: controlled,
  onChange,
  disabled,
  small,
  className,
  "aria-label": ariaLabel,
}: {
  name?: string;
  options: SelectOption[];
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  /** Compact trigger (h-10, small text) for toolbars. */
  small?: boolean;
  className?: string;
  "aria-label"?: string;
}) {
  const id = useId();
  const initial = defaultValue ?? options[0]?.value ?? "";
  const [uncontrolled, setUncontrolled] = useState(initial);
  const value = controlled ?? uncontrolled;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [dropUp, setDropUp] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  // Go back to the default when the surrounding form resets.
  useEffect(() => {
    const form = buttonRef.current?.form;
    if (!form) return;
    const onReset = () => setUncontrolled(initial);
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [initial]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    listRef.current
      ?.querySelector(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function openList() {
    // Open upwards when there's no room below.
    const r = buttonRef.current!.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    setDropUp(below < 300 && r.top > below);
    setActive(selectedIndex);
    setOpen(true);
  }

  function choose(i: number) {
    const next = options[i]!.value;
    if (controlled === undefined) setUncontrolled(next);
    if (next !== value) onChange?.(next);
    setOpen(false);
    buttonRef.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!open) {
      // Enter falls through to the button's own click.
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === " ") {
        e.preventDefault();
        openList();
      }
      return;
    }
    const last = options.length - 1;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActive((a) => Math.min(a + 1, last));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
        break;
      case "Home":
        e.preventDefault();
        setActive(0);
        break;
      case "End":
        e.preventDefault();
        setActive(last);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        choose(active);
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
      case "Tab":
        setOpen(false);
        break;
      default: {
        // Type-ahead: next option starting with the typed letter.
        if (e.key.length !== 1) return;
        const key = e.key.toLowerCase();
        const order = [...options.keys()].map(
          (k) => (active + 1 + k) % options.length,
        );
        const hit = order.find((i) =>
          options[i]!.label.toLowerCase().startsWith(key),
        );
        if (hit !== undefined) setActive(hit);
      }
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className ?? ""}`}>
      {name && !disabled && <input type="hidden" name={name} value={value} />}
      <button
        ref={buttonRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        // Space activates buttons on keyup; we handle it on keydown.
        onKeyUp={(e) => e.key === " " && e.preventDefault()}
        className={`input flex w-full cursor-pointer items-center justify-between gap-2 text-left disabled:cursor-default disabled:opacity-60 ${
          small ? "h-10 text-sm" : ""
        } ${open ? "border-primary shadow-[inset_0_0_0_1px_var(--primary)]" : ""}`}
      >
        <span className="truncate">{options[selectedIndex]?.label}</span>
        <ChevronDownIcon
          className={`size-4 shrink-0 text-on-surface-variant transition-transform duration-200 ease-emphasized ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <ul
          ref={listRef}
          id={`${id}-list`}
          role="listbox"
          tabIndex={-1}
          // Inside a <label>, a click here would re-click the trigger.
          onClick={(e) => e.preventDefault()}
          className={`absolute left-0 z-30 max-h-72 min-w-full overflow-y-auto rounded-2xl border border-outline-variant/40 bg-card p-1.5 shadow-(--shadow-1) transition-[opacity,translate] duration-150 ease-emphasized dark:bg-surface-container-high starting:opacity-0 ${
            dropUp
              ? "bottom-full mb-1.5 starting:translate-y-1"
              : "top-full mt-1.5 starting:-translate-y-1"
          }`}
        >
          {options.map((o, i) => {
            const selected = o.value === value;
            return (
              <li
                key={o.value}
                id={`${id}-${i}`}
                role="option"
                aria-selected={selected}
                data-index={i}
                onPointerEnter={() => setActive(i)}
                // Keep focus on the trigger so keyboard handling continues.
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => choose(i)}
                className={`flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-sm whitespace-nowrap transition-colors duration-100 ${
                  i === active ? "bg-on-surface/8" : ""
                } ${selected ? "font-medium text-primary" : "text-on-surface"}`}
              >
                <CheckIcon
                  className={`size-4 shrink-0 ${selected ? "" : "invisible"}`}
                />
                {o.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
