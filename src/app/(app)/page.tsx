import { and, desc, eq, gte, lte, min } from "drizzle-orm";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { DateRangePicker } from "@/components/date-range-picker";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { PageSkeleton, Reveal } from "@/components/reveal";
import { Select } from "@/components/select";
import { StatusBadge } from "@/components/status-badge";
import { db } from "@/db";
import { leaveRequest, leaveStatusEnum } from "@/db/schema";
import { formatRange, toIso } from "@/lib/dates";
import {
  CARRY_OVER_START,
  getBalance,
  getHolidays,
  LEAVE_TYPE_LABEL,
} from "@/lib/leave";
import { requireUser } from "@/lib/session";
import { cancelLeave, submitLeave } from "./actions";

const FILTERS = ["all", ...leaveStatusEnum.enumValues] as const;
type Filter = (typeof FILTERS)[number];

export default function HomePage({ searchParams }: PageProps<"/">) {
  return (
    <Reveal fallback={<PageSkeleton />}>
      <MyLeave searchParams={searchParams} />
    </Reveal>
  );
}

async function MyLeave({
  searchParams,
}: {
  searchParams: PageProps<"/">["searchParams"];
}) {
  const me = await requireUser();
  const params = await searchParams;
  const filter: Filter = FILTERS.includes(params.status as Filter)
    ? (params.status as Filter)
    : "all";
  const today = toIso(new Date());
  const thisYear = Number(today.slice(0, 4));
  // ?year=YYYY, up to next year (leave can be booked ahead).
  const year =
    typeof params.year === "string" &&
    /^\d{4}$/.test(params.year) &&
    Number(params.year) >= 2000 &&
    Number(params.year) <= thisYear + 1
      ? Number(params.year)
      : thisYear;

  const [balance, requests, holidays, [{ earliest }]] = await Promise.all([
    getBalance(me.id, year),
    // Requests can't span two years, so the start date decides the year.
    db
      .select()
      .from(leaveRequest)
      .where(
        and(
          eq(leaveRequest.userId, me.id),
          gte(leaveRequest.startDate, `${year}-01-01`),
          lte(leaveRequest.startDate, `${year}-12-31`),
        ),
      )
      .orderBy(desc(leaveRequest.startDate)),
    getHolidays(`${thisYear}-01-01`, `${thisYear + 1}-12-31`),
    db
      .select({ earliest: min(leaveRequest.startDate) })
      .from(leaveRequest)
      .where(eq(leaveRequest.userId, me.id)),
  ]);
  const firstYear = Math.min(
    CARRY_OVER_START,
    thisYear,
    earliest ? Number(earliest.slice(0, 4)) : thisYear,
  );
  const href = (y: number, f: Filter) => {
    const q = new URLSearchParams();
    if (y !== thisYear) q.set("year", String(y));
    if (f !== "all") q.set("status", f);
    return q.size > 0 ? `/?${q}` : "/";
  };
  const countOf = (f: Filter) =>
    f === "all"
      ? requests.length
      : requests.filter((r) => r.status === f).length;
  const shown =
    filter === "all" ? requests : requests.filter((r) => r.status === filter);
  const pct = (n: number) =>
    balance.total > 0 ? `${(n / balance.total) * 100}%` : "0%";

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[32px] leading-tight text-on-surface">
            Hi, {me.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-on-surface-variant">
            Request time off and track your balance.
          </p>
        </div>
        <nav aria-label="Year" className="flex items-center gap-1">
          {year > firstYear ? (
            <Link
              href={href(year - 1, filter)}
              scroll={false}
              aria-label="Previous year"
              className="icon-btn"
            >
              <ChevronLeftIcon className="size-5" />
            </Link>
          ) : (
            <span className="size-10" />
          )}
          <span className="min-w-14 text-center text-lg text-on-surface">
            {year}
          </span>
          {year <= thisYear ? (
            <Link
              href={href(year + 1, filter)}
              scroll={false}
              aria-label="Next year"
              className="icon-btn"
            >
              <ChevronRightIcon className="size-5" />
            </Link>
          ) : (
            <span className="size-10" />
          )}
        </nav>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="flex flex-col gap-6">
          <section className="card" aria-labelledby="balance-heading">
            <h2
              id="balance-heading"
              className="text-sm font-medium text-on-surface-variant"
            >
              Paid vacation {year}
            </h2>
            <p className="mt-2 flex items-baseline gap-2">
              <span className="text-6xl text-primary">{balance.remaining}</span>
              <span className="text-on-surface-variant">
                of {balance.total} days left
              </span>
            </p>
            {balance.carriedIn > 0 && (
              <p className="mt-1 text-sm text-on-surface-variant">
                {balance.allowance} for {year} + {balance.carriedIn} carried
                over
              </p>
            )}
            {balance.expiring > 0 && (
              <p className="mt-1 text-sm text-error">
                {balance.expiring} {balance.expiring === 1 ? "day" : "days"}{" "}
                from {year - 2} expire on 31 Dec {year}
              </p>
            )}
            {/* Used / reserved / free */}
            <div className="mt-5 flex h-2 overflow-hidden rounded-full bg-surface-container-high">
              <div
                className="bg-primary transition-[width] duration-500 ease-emphasized"
                style={{ width: pct(balance.approved) }}
              />
              <div
                className="bg-primary/40 transition-[width] duration-500 ease-emphasized"
                style={{ width: pct(balance.pending) }}
              />
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
              <div>
                <dt className="text-on-surface-variant">Approved</dt>
                <dd className="text-lg">{balance.approved}</dd>
              </div>
              <div>
                <dt className="text-on-surface-variant">Pending</dt>
                <dd className="text-lg">{balance.pending}</dd>
              </div>
              <div>
                <dt className="text-on-surface-variant">Remaining</dt>
                <dd className="text-lg">{balance.remaining}</dd>
              </div>
            </dl>
          </section>

          <section className="card" aria-labelledby="new-heading">
            <h2 id="new-heading" className="text-xl text-on-surface">
              New request
            </h2>
            <ActionForm
              action={submitLeave}
              className="mt-5 flex flex-col gap-4"
            >
              <label className="label">
                Type
                <Select
                  name="type"
                  defaultValue="paid"
                  options={Object.entries(LEAVE_TYPE_LABEL).map(
                    ([value, label]) => ({ value, label }),
                  )}
                />
              </label>
              <DateRangePicker today={today} holidays={holidays} />
              <label className="label">
                Note (optional)
                <textarea
                  name="note"
                  rows={2}
                  maxLength={500}
                  className="input"
                />
              </label>
              <div className="flex items-center justify-between gap-4">
                <p className="text-xs text-on-surface-variant">
                  Weekends and public holidays aren&apos;t counted.
                </p>
                <button type="submit" className="btn">
                  Submit request
                </button>
              </div>
            </ActionForm>
          </section>
        </div>

        <section className="card" aria-labelledby="requests-heading">
          <h2 id="requests-heading" className="text-xl text-on-surface">
            My requests
          </h2>
          <nav
            aria-label="Filter by status"
            className="mt-4 flex gap-2 overflow-x-auto"
          >
            {FILTERS.map((f) => (
              <Link
                key={f}
                href={href(year, f)}
                scroll={false}
                aria-current={f === filter ? "page" : undefined}
                className={`state-layer inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium capitalize ${
                  f === filter
                    ? "border-transparent bg-secondary-container text-on-secondary-container"
                    : "border-outline text-on-surface-variant"
                }`}
              >
                {f}
                <span className="text-xs opacity-70">{countOf(f)}</span>
              </Link>
            ))}
          </nav>
          {shown.length === 0 ? (
            <p className="mt-4 text-sm text-on-surface-variant">
              {filter === "all"
                ? `No requests in ${year}.`
                : `No ${filter} requests in ${year}.`}
            </p>
          ) : (
            <ul className="-mx-3 mt-3 flex flex-col">
              {shown.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-3 rounded-2xl px-3 py-3 transition-colors duration-200 hover:bg-surface-container-low"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-on-surface">
                      {formatRange(r.startDate, r.endDate)}
                    </p>
                    <p className="text-sm text-on-surface-variant">
                      {LEAVE_TYPE_LABEL[r.type]} · {r.days}{" "}
                      {r.days === 1 ? "day" : "days"}
                    </p>
                    {r.decisionComment && (
                      <p className="mt-1 text-sm text-on-surface-variant italic">
                        “{r.decisionComment}”
                      </p>
                    )}
                  </div>
                  <StatusBadge status={r.status} />
                  {r.status === "pending" && (
                    <form action={cancelLeave}>
                      <input type="hidden" name="id" value={r.id} />
                      <button type="submit" className="btn-text">
                        Cancel
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
