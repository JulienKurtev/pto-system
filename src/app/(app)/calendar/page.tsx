import { and, eq, gte, inArray, lte } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { ViewTransition, type CSSProperties } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { Reveal } from "@/components/reveal";
import { SegmentedNav } from "@/components/segmented-nav";
import { StatusBadge } from "@/components/status-badge";
import { db } from "@/db";
import { leaveRequest, user } from "@/db/schema";
import {
  addDays,
  addMonths,
  eachDay,
  formatRange,
  isWeekend,
  mondayOf,
  monthEnd,
  parseIso,
  sundayOf,
  toIso,
  type IsoDate,
} from "@/lib/dates";
import {
  ACTIVE_STATUSES,
  calendarUsers,
  getHolidays,
  LEAVE_TYPE_LABEL,
} from "@/lib/leave";
import { requireUser, type CurrentUser } from "@/lib/session";
import { HoverCard } from "./hover-card";
import { PeriodPicker } from "./period-picker";

export const metadata: Metadata = { title: "Calendar" };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const VIEWS = ["month", "week", "year", "list", "timeline"] as const;
type View = (typeof VIEWS)[number];
const VIEW_LABEL: Record<View, string> = {
  month: "Month",
  week: "Week",
  year: "Year",
  list: "List",
  timeline: "Timeline",
};

/**
 * Per-person colors; dark enough for white text in both themes. No greens,
 * ambers or reds — those are reserved for status (see StatusBadge).
 */
const PALETTE = [
  "#2563eb", // blue
  "#7c3aed", // violet
  "#0e7490", // cyan
  "#be185d", // pink
  "#4f46e5", // indigo
  "#a21caf", // fuchsia
  "#475569", // slate
  "#0369a1", // sky
];

/** Side arrows (xl+): big round buttons, vertically centred on the calendar. */
const ARROW_SIDE =
  "absolute top-1/2 hidden size-12 -translate-y-1/2 bg-card shadow-(--shadow-card) xl:inline-flex";

/** Slide periods left/right depending on which way the user paged. */
const SLIDE = {
  "nav-forward": "nav-forward",
  "nav-back": "nav-back",
  default: "none",
};

function monthTitle(first: IsoDate): string {
  return parseIso(first).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Date range shown, paging targets and title for a view around `d`. */
function period(view: View, d: IsoDate) {
  const first = `${d.slice(0, 7)}-01`;
  switch (view) {
    case "week": {
      const start = mondayOf(d);
      const end = addDays(start, 6);
      return {
        anchor: d,
        start,
        end,
        prev: addDays(d, -7),
        next: addDays(d, 7),
        title: formatRange(start, end),
      };
    }
    case "year": {
      const y = Number(d.slice(0, 4));
      return {
        anchor: `${y}-01-01`,
        start: `${y}-01-01`,
        end: `${y}-12-31`,
        prev: `${y - 1}-01-01`,
        next: `${y + 1}-01-01`,
        title: String(y),
      };
    }
    case "month":
      // Grid runs Monday..Sunday covering the whole month.
      return {
        anchor: first,
        start: mondayOf(first),
        end: sundayOf(monthEnd(first)),
        prev: addMonths(first, -1),
        next: addMonths(first, 1),
        title: monthTitle(first),
      };
    default:
      return {
        anchor: first,
        start: first,
        end: monthEnd(first),
        prev: addMonths(first, -1),
        next: addMonths(first, 1),
        title: monthTitle(first),
      };
  }
}

function getLeaves(me: CurrentUser, start: IsoDate, end: IsoDate) {
  return db
    .select({
      id: leaveRequest.id,
      userId: user.id,
      name: user.name,
      type: leaveRequest.type,
      status: leaveRequest.status,
      startDate: leaveRequest.startDate,
      endDate: leaveRequest.endDate,
    })
    .from(leaveRequest)
    .innerJoin(user, eq(user.id, leaveRequest.userId))
    .where(
      and(
        inArray(leaveRequest.status, ACTIVE_STATUSES),
        lte(leaveRequest.startDate, end),
        gte(leaveRequest.endDate, start),
        calendarUsers(me),
      ),
    )
    .orderBy(user.name, leaveRequest.startDate);
}
type Leave = Awaited<ReturnType<typeof getLeaves>>[number];

/** Shared per-render context for the views. */
type Ctx = {
  today: IsoDate;
  showType: boolean;
  leaves: Leave[];
  holidayByDate: Map<IsoDate, string>;
  colorOf: Map<string, string>;
};

function isOff(ctx: Ctx, day: IsoDate) {
  return isWeekend(day) || ctx.holidayByDate.has(day);
}
/** Leave isn't counted on weekends/holidays, so don't show it there. */
function leavesOn(ctx: Ctx, day: IsoDate) {
  return isOff(ctx, day)
    ? []
    : ctx.leaves.filter((l) => l.startDate <= day && l.endDate >= day);
}
function describe(ctx: Ctx, l: Leave) {
  return ctx.showType
    ? `${l.name} · ${LEAVE_TYPE_LABEL[l.type]} · ${l.status}`
    : `${l.name} · ${l.status}`;
}
/** Approved: solid in the person's color; pending: dashed outline + tint. */
function leaveStyle(ctx: Ctx, l: Leave): CSSProperties {
  const c = ctx.colorOf.get(l.userId) ?? PALETTE[0];
  return l.status === "approved"
    ? { backgroundColor: c, color: "#fff" }
    : {
        border: `1px dashed ${c}`,
        backgroundColor: `color-mix(in srgb, ${c} 3%, transparent)`,
      };
}

export default function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  return (
    <Reveal fallback={<CalendarSkeleton />}>
      <Calendar searchParams={searchParams} />
    </Reveal>
  );
}

function CalendarSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="skeleton h-10 w-64" />
      <div className="skeleton h-[36rem]" />
    </div>
  );
}

async function Calendar({
  searchParams,
}: {
  searchParams: PageProps<"/calendar">["searchParams"];
}) {
  const me = await requireUser();
  // Leave type (e.g. sick) is private; only approvers see it.
  const showType = me.role === "manager" || me.role === "superadmin";
  const params = await searchParams;

  // ?view=month|week|year|list|timeline&d=YYYY-MM-DD, default month/today.
  const today = toIso(new Date());
  const view: View = VIEWS.includes(params.view as View)
    ? (params.view as View)
    : "month";
  const d =
    typeof params.d === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(params.d) &&
    toIso(parseIso(params.d)) === params.d
      ? params.d
      : today;
  const p = period(view, d);
  const todayAnchor = period(view, today).anchor;

  const [holidays, leaves, people] = await Promise.all([
    getHolidays(p.start, p.end),
    getLeaves(me, p.start, p.end),
    // Ordered by join date so existing people keep their color when
    // someone new joins the team.
    db
      .select({ id: user.id, name: user.name })
      .from(user)
      .where(calendarUsers(me))
      .orderBy(user.createdAt, user.id),
  ]);
  const ctx: Ctx = {
    today,
    showType,
    leaves,
    holidayByDate: new Map(holidays.map((h) => [h.date, h.name])),
    colorOf: new Map(
      people.map((person, i) => [person.id, PALETTE[i % PALETTE.length]]),
    ),
  };
  const peopleByName = people.toSorted((a, b) => a.name.localeCompare(b.name));

  const thisYear = Number(today.slice(0, 4));
  const shownYear = Number(p.anchor.slice(0, 4));
  const years = Array.from({ length: 6 }, (_, i) => thisYear - 3 + i);
  if (!years.includes(shownYear)) years.push(shownYear);
  years.sort((a, b) => a - b);

  const href = (v: View, date: IsoDate) => `/calendar?view=${v}&d=${date}`;
  const arrow = (dir: "prev" | "next", className: string) => (
    <Link
      href={href(view, dir === "prev" ? p.prev : p.next)}
      transitionTypes={[dir === "prev" ? "nav-back" : "nav-forward"]}
      aria-label={dir === "prev" ? "Previous" : "Next"}
      className={`icon-btn ${className}`}
    >
      {dir === "prev" ? (
        <ChevronLeftIcon className="size-7" />
      ) : (
        <ChevronRightIcon className="size-7" />
      )}
    </Link>
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/calendar?view=${view}`}
          transitionTypes={[
            todayAnchor > p.anchor ? "nav-forward" : "nav-back",
          ]}
          className="btn-secondary"
        >
          Today
        </Link>
        <PeriodPicker view={view} anchor={p.anchor} years={years} />
        <div className="ml-auto flex gap-2 text-xs">
          <span className="rounded-md bg-on-surface-variant px-2 py-1 text-surface">
            Approved
          </span>
          <span className="rounded-md border border-dashed border-on-surface-variant px-2 py-1 text-on-surface-variant">
            Pending
          </span>
        </div>
      </div>

      <SegmentedNav
        label="Calendar view"
        items={VIEWS.map((v) => ({ href: href(v, d), label: VIEW_LABEL[v] }))}
        active={VIEWS.indexOf(view)}
      />

      <div className="flex flex-col gap-3">
        {/* Below xl there's no room outside the calendar for the arrows. */}
        <div className="flex items-center justify-center gap-2">
          {arrow("prev", "size-11 xl:hidden")}
          <h1 className="text-center text-[22px] text-on-surface">{p.title}</h1>
          {arrow("next", "size-11 xl:hidden")}
        </div>

        {/* Arrows hang outside the calendar so it keeps the full width. */}
        <div className="relative">
          {arrow("prev", `${ARROW_SIDE} right-full mr-4`)}
          <ViewTransition
            key={`${view}-${p.start}`}
            enter={SLIDE}
            exit={SLIDE}
            default="none"
          >
            <div>
              {view === "month" && (
                <DayGrid
                  ctx={ctx}
                  days={eachDay(p.start, p.end)}
                  month={p.anchor.slice(0, 7)}
                />
              )}
              {view === "week" && (
                <DayGrid ctx={ctx} days={eachDay(p.start, p.end)} tall />
              )}
              {view === "year" && <YearView ctx={ctx} year={shownYear} />}
              {view === "list" && <ListView ctx={ctx} />}
              {view === "timeline" && (
                <TimelineView
                  ctx={ctx}
                  days={eachDay(p.start, p.end)}
                  people={peopleByName}
                />
              )}
            </div>
          </ViewTransition>
          {arrow("next", `${ARROW_SIDE} left-full ml-4`)}
        </div>
      </div>
    </>
  );
}

function DayGrid({
  ctx,
  days,
  month,
  tall,
}: {
  ctx: Ctx;
  days: IsoDate[];
  /** YYYY-MM; days outside it are dimmed. */
  month?: string;
  tall?: boolean;
}) {
  return (
    <div className="card overflow-x-auto p-0">
      <div className="grid min-w-[56rem] grid-cols-7">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="py-3 text-center text-xs font-medium tracking-wide text-on-surface-variant uppercase"
          >
            {w}
          </div>
        ))}
        {days.map((day, i) => {
          const holidayName = ctx.holidayByDate.get(day);
          const inMonth = month === undefined || day.startsWith(month);
          return (
            <div
              key={day}
              className={`flex ${tall ? "min-h-72" : "min-h-28"} flex-col gap-1 border-t border-surface-container-high p-1.5 ${
                i % 7 !== 0 ? "border-l" : ""
              } ${isOff(ctx, day) ? "bg-surface-container-low dark:bg-surface" : ""}`}
            >
              <span
                className={`mx-auto flex size-7 items-center justify-center rounded-full text-xs font-medium ${
                  day === ctx.today
                    ? "bg-primary text-on-primary"
                    : inMonth
                      ? "text-on-surface"
                      : "text-on-surface-variant/50"
                }`}
              >
                {Number(day.slice(8))}
              </span>
              {holidayName && (
                <span
                  title={holidayName}
                  className="truncate px-1 text-center text-[11px] text-on-surface-variant"
                >
                  {holidayName}
                </span>
              )}
              {leavesOn(ctx, day).map((l) => (
                <span
                  key={l.id}
                  title={describe(ctx, l)}
                  style={leaveStyle(ctx, l)}
                  className={`truncate rounded-md px-2 py-0.5 text-xs font-medium text-on-surface ${
                    inMonth ? "" : "opacity-50"
                  }`}
                >
                  {l.name}
                  {ctx.showType && l.type !== "paid" && ` (${l.type})`}
                </span>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function YearView({ ctx, year }: { ctx: Ctx; year: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 12 }, (_, m) => {
        const first = `${year}-${String(m + 1).padStart(2, "0")}-01`;
        const month = first.slice(0, 7);
        return (
          <div key={first} className="card p-4">
            <Link
              href={`/calendar?view=month&d=${first}`}
              className="mb-2 block text-sm font-medium text-on-surface hover:text-primary"
            >
              {parseIso(first).toLocaleDateString("en-GB", {
                month: "long",
                timeZone: "UTC",
              })}
            </Link>
            <div className="grid grid-cols-7 gap-0.5 text-center text-[11px]">
              {WEEKDAYS.map((w) => (
                <span key={w} className="text-on-surface-variant">
                  {w[0]}
                </span>
              ))}
              {eachDay(mondayOf(first), sundayOf(monthEnd(first))).map(
                (day) => {
                  if (!day.startsWith(month)) return <span key={day} />;
                  const on = leavesOn(ctx, day);
                  const cell = `relative flex aspect-square items-center justify-center rounded-md ${
                    day === ctx.today ? "ring-2 ring-primary" : ""
                  }`;
                  if (on.length === 0) {
                    return (
                      <span
                        key={day}
                        title={ctx.holidayByDate.get(day)}
                        className={`${cell} ${
                          isOff(ctx, day)
                            ? "text-on-surface-variant/50"
                            : "text-on-surface"
                        }`}
                      >
                        {Number(day.slice(8))}
                      </span>
                    );
                  }
                  return (
                    <HoverCard
                      key={day}
                      className={`${cell} bg-surface-container-high text-on-surface`}
                      content={
                        <>
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="font-medium text-on-surface">
                              {parseIso(day).toLocaleDateString("en-GB", {
                                weekday: "short",
                                day: "numeric",
                                month: "long",
                                timeZone: "UTC",
                              })}
                            </span>
                            <span className="text-on-surface-variant">
                              {on.length} on leave
                            </span>
                          </span>
                          <span className="flex flex-col gap-1.5">
                            {on.map((l) => (
                              <LeaveRow key={l.id} ctx={ctx} l={l} />
                            ))}
                          </span>
                        </>
                      }
                    >
                      {Number(day.slice(8))}
                      <span className="absolute top-0 right-0 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-primary px-0.5 text-[9px] leading-none font-semibold text-on-primary">
                        {on.length}
                      </span>
                      {/* One dot per person (first 4); count badge covers the rest. */}
                      <span className="absolute inset-x-0 bottom-0.5 flex justify-center gap-px">
                        {on.slice(0, 4).map((l) => (
                          <span
                            key={l.id}
                            style={leaveStyle(ctx, l)}
                            className="size-1.5 rounded-full"
                          />
                        ))}
                      </span>
                    </HoverCard>
                  );
                },
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** One person's line in a hover popup: color, name, type, status. */
function LeaveRow({ ctx, l }: { ctx: Ctx; l: Leave }) {
  return (
    <span className="flex items-center gap-2">
      <span
        style={leaveStyle(ctx, l)}
        className="size-2.5 shrink-0 rounded-full"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-on-surface">{l.name}</span>
        {ctx.showType && (
          <span className="block text-on-surface-variant">
            {LEAVE_TYPE_LABEL[l.type]}
          </span>
        )}
      </span>
      <StatusBadge status={l.status} />
    </span>
  );
}

function ListView({ ctx }: { ctx: Ctx }) {
  if (ctx.leaves.length === 0) {
    return (
      <div className="card text-center text-on-surface-variant">
        No time off in this period.
      </div>
    );
  }
  // Leaves are ordered by name, so groups come out alphabetical.
  const groups = new Map<string, Leave[]>();
  for (const l of ctx.leaves) {
    groups.set(l.userId, [...(groups.get(l.userId) ?? []), l]);
  }
  return (
    <div className="card flex flex-col divide-y divide-surface-container-high p-0">
      {[...groups.values()].map((ls) => (
        <div key={ls[0].userId} className="flex flex-col gap-2 p-4 sm:flex-row">
          <span className="flex items-center gap-2 font-medium text-on-surface sm:w-48">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: ctx.colorOf.get(ls[0].userId) }}
            />
            {ls[0].name}
          </span>
          <ul className="flex flex-1 flex-col gap-1.5">
            {ls.map((l) => (
              <li
                key={l.id}
                className="flex flex-wrap items-center gap-2 text-sm"
              >
                <span className="text-on-surface">
                  {formatRange(l.startDate, l.endDate)}
                </span>
                <StatusBadge status={l.status} />
                {ctx.showType && (
                  <span className="text-xs text-on-surface-variant">
                    {LEAVE_TYPE_LABEL[l.type]}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function TimelineView({
  ctx,
  days,
  people,
}: {
  ctx: Ctx;
  days: IsoDate[];
  people: { id: string; name: string }[];
}) {
  const cols = {
    gridTemplateColumns: `10rem repeat(${days.length}, minmax(1.75rem, 1fr))`,
  };
  return (
    <div className="card overflow-x-auto p-0">
      <div className="grid min-w-[64rem] text-xs" style={cols}>
        <span />
        {days.map((day) => (
          <span
            key={day}
            title={ctx.holidayByDate.get(day)}
            className={`py-2 text-center font-medium ${
              day === ctx.today
                ? "text-primary"
                : isOff(ctx, day)
                  ? "text-on-surface-variant/50"
                  : "text-on-surface-variant"
            }`}
          >
            {Number(day.slice(8))}
          </span>
        ))}
        {people.map((person) => (
          <div key={person.id} className="contents">
            <span className="truncate border-t border-surface-container-high px-3 py-2 text-sm text-on-surface">
              {person.name}
            </span>
            {days.map((day) => {
              const l = leavesOn(ctx, day).find((x) => x.userId === person.id);
              return (
                <span
                  key={day}
                  className={`border-t border-l border-surface-container-high p-0.5 ${
                    isOff(ctx, day)
                      ? "bg-surface-container-low dark:bg-surface"
                      : ""
                  }`}
                >
                  {l && (
                    <HoverCard
                      className="flex h-full min-h-6 rounded"
                      content={<LeaveRow ctx={ctx} l={l} />}
                    >
                      <span
                        style={leaveStyle(ctx, l)}
                        className="block w-full rounded"
                      />
                    </HoverCard>
                  )}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
