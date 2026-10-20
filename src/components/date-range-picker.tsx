"use client";

import { useEffect, useRef, useState } from "react";
import {
  addMonths,
  countWorkingDays,
  eachDay,
  formatRange,
  isWeekend,
  mondayOf,
  monthEnd,
  parseIso,
  sundayOf,
  type IsoDate,
} from "@/lib/dates";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "./icons";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const fieldFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const monthFmt = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * Airline-style range picker: first click picks the start, second the end
 * (hover previews the range). Submits as hidden `startDate` / `endDate`
 * inputs; a single click means a one-day request.
 */
export function DateRangePicker({
  today,
  holidays,
}: {
  today: IsoDate;
  holidays: { date: IsoDate; name: string }[];
}) {
  const [start, setStart] = useState<IsoDate | null>(null);
  const [end, setEnd] = useState<IsoDate | null>(null);
  const [hover, setHover] = useState<IsoDate | null>(null);
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(`${today.slice(0, 7)}-01`);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const holidayByDate = new Map(holidays.map((h) => [h.date, h.name]));
  const holidaySet = new Set(holidayByDate.keys());

  // Clear when the surrounding form resets after a successful submit.
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    function onReset() {
      setStart(null);
      setEnd(null);
      setHover(null);
    }
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function pick(day: IsoDate) {
    if (!start || end) {
      setStart(day);
      setEnd(null);
    } else if (day < start) {
      setStart(day);
    } else {
      setEnd(day);
    }
  }

  // End of the highlighted range: the picked end, or a hover preview.
  const rangeEnd = end ?? (start && hover && hover > start ? hover : null);
  const last = end ?? start;
  const workingDays =
    start && last ? countWorkingDays(start, last, holidaySet) : 0;

  return (
    <div ref={rootRef} className="relative">
      <input
        ref={inputRef}
        type="hidden"
        name="startDate"
        value={start ?? ""}
      />
      <input type="hidden" name="endDate" value={last ?? ""} />

      <span className="label mb-1.5">Dates</span>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`grid w-full cursor-pointer grid-cols-2 rounded-lg border text-left transition-[border-color,box-shadow] duration-200 ease-emphasized hover:border-on-surface ${
          open
            ? "border-primary shadow-[inset_0_0_0_1px_var(--primary)]"
            : "border-outline"
        }`}
      >
        {(
          [
            ["From", start],
            ["To", last],
          ] as const
        ).map(([label, value], i) => (
          <span
            key={label}
            className={`flex items-center gap-3 px-3 py-2 ${i === 1 ? "border-l border-outline" : ""}`}
          >
            {i === 0 && (
              <CalendarIcon className="size-5 shrink-0 text-on-surface-variant" />
            )}
            <span className="min-w-0">
              <span className="block text-xs text-on-surface-variant">
                {label}
              </span>
              <span
                className={`block truncate ${value ? "text-on-surface" : "text-on-surface-variant/70"}`}
              >
                {value ? fieldFmt.format(parseIso(value)) : "Add date"}
              </span>
            </span>
          </span>
        ))}
      </button>

      {open && (
        <div className="absolute top-full left-0 z-30 mt-2 w-[min(40rem,calc(100vw-2rem))] rounded-3xl border border-surface-container-high bg-card p-4 shadow-(--shadow-1) sm:p-5">
          <div className="relative grid gap-6 sm:grid-cols-2">
            <div className="absolute -top-1 right-0 left-0 flex justify-between">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => setShown(addMonths(shown, -1))}
                className="icon-btn size-8"
              >
                <ChevronLeftIcon className="size-5" />
              </button>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => setShown(addMonths(shown, 1))}
                className="icon-btn size-8"
              >
                <ChevronRightIcon className="size-5" />
              </button>
            </div>
            {[shown, addMonths(shown, 1)].map((first, m) => {
              const month = first.slice(0, 7);
              return (
                <div key={first} className={m === 1 ? "hidden sm:block" : ""}>
                  <p className="mb-3 text-center text-sm font-medium text-on-surface">
                    {monthFmt.format(parseIso(first))}
                  </p>
                  <div
                    className="grid grid-cols-7 gap-y-1 text-center text-sm"
                    onPointerLeave={() => setHover(null)}
                  >
                    {WEEKDAYS.map((w) => (
                      <span
                        key={w}
                        className="pb-1 text-xs font-medium text-on-surface-variant"
                      >
                        {w}
                      </span>
                    ))}
                    {eachDay(mondayOf(first), sundayOf(monthEnd(first))).map(
                      (day) => {
                        if (!day.startsWith(month)) return <span key={day} />;
                        const holiday = holidayByDate.get(day);
                        const off = isWeekend(day) || holiday !== undefined;
                        const isEdge = day === start || day === rangeEnd;
                        const hasRange =
                          start !== null &&
                          rangeEnd !== null &&
                          rangeEnd !== start;
                        const band = !hasRange
                          ? ""
                          : day === start
                            ? "left-1/2 right-0"
                            : day === rangeEnd
                              ? "left-0 right-1/2"
                              : day > start && day < rangeEnd
                                ? "inset-x-0"
                                : "";
                        return (
                          <span
                            key={day}
                            className="relative flex justify-center"
                          >
                            {band && (
                              <span
                                className={`absolute inset-y-0 bg-primary-container ${band}`}
                              />
                            )}
                            <button
                              type="button"
                              title={holiday}
                              aria-label={`${fieldFmt.format(parseIso(day))}${holiday ? `, ${holiday}` : ""}`}
                              aria-pressed={isEdge}
                              onClick={() => pick(day)}
                              onPointerEnter={() => setHover(day)}
                              className={`state-layer relative flex size-9 cursor-pointer flex-col items-center justify-center rounded-full ${
                                isEdge
                                  ? "bg-primary font-medium text-on-primary"
                                  : band
                                    ? "text-on-primary-container"
                                    : off
                                      ? "text-on-surface-variant/60"
                                      : "text-on-surface"
                              } ${day === today && !isEdge ? "ring-1 ring-primary ring-inset" : ""}`}
                            >
                              {Number(day.slice(8))}
                              {holiday && (
                                <span
                                  className={`absolute bottom-1 size-1 rounded-full ${isEdge ? "bg-on-primary" : "bg-error"}`}
                                />
                              )}
                            </button>
                          </span>
                        );
                      },
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-surface-container-high pt-4">
            <p className="min-w-0 flex-1 text-sm">
              {start && last ? (
                <>
                  <span className="text-on-surface">
                    {formatRange(start, last)}
                  </span>
                  <span className="text-on-surface-variant">
                    {" "}
                    · {workingDays} working {workingDays === 1 ? "day" : "days"}
                  </span>
                </>
              ) : (
                <span className="text-on-surface-variant">
                  Pick your first day off
                </span>
              )}
              {start && !end && (
                <span className="block text-xs text-on-surface-variant">
                  Now pick the last day, or Done for a single day
                </span>
              )}
            </p>
            <button
              type="button"
              disabled={!start}
              onClick={() => {
                setStart(null);
                setEnd(null);
              }}
              className="btn-text"
            >
              Clear
            </button>
            <button
              type="button"
              disabled={!start}
              onClick={() => {
                setOpen(false);
                triggerRef.current?.focus();
              }}
              className="btn"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
