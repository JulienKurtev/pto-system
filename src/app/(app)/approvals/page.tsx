import { and, asc, count, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Avatar } from "@/components/avatar";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
} from "@/components/icons";
import { PageSkeleton, Reveal } from "@/components/reveal";
import { SegmentedNav } from "@/components/segmented-nav";
import { StatusBadge } from "@/components/status-badge";
import { db } from "@/db";
import { leaveRequest, team, user, type LeaveStatus } from "@/db/schema";
import { formatRange } from "@/lib/dates";
import { getBalance, LEAVE_TYPE_LABEL, visibleUsers } from "@/lib/leave";
import { requireRole, type CurrentUser } from "@/lib/session";
import { decideLeave } from "../actions";

export const metadata: Metadata = { title: "Approvals" };

const ARCHIVE_FILTERS = ["all", "approved", "rejected", "cancelled"] as const;
type ArchiveFilter = (typeof ARCHIVE_FILTERS)[number];
const PAGE_SIZE = 20;

const DONE_BY: Record<ArchiveFilter & LeaveStatus, string> = {
  approved: "Approved by",
  rejected: "Rejected by",
  cancelled: "Cancelled by",
};

export default function ApprovalsPage({
  searchParams,
}: PageProps<"/approvals">) {
  return (
    <>
      <h1 className="text-[32px] leading-tight text-on-surface">Approvals</h1>
      <Reveal fallback={<PageSkeleton />}>
        <Approvals searchParams={searchParams} />
      </Reveal>
    </>
  );
}

async function Approvals({
  searchParams,
}: {
  searchParams: PageProps<"/approvals">["searchParams"];
}) {
  const me = await requireRole("manager", "superadmin");
  const params = await searchParams;
  const archive = params.tab === "archive";
  const filter: ArchiveFilter = ARCHIVE_FILTERS.includes(
    params.status as ArchiveFilter,
  )
    ? (params.status as ArchiveFilter)
    : "all";
  const page =
    typeof params.page === "string" && /^[1-9]\d*$/.test(params.page)
      ? Number(params.page)
      : 1;

  return (
    <>
      <SegmentedNav
        label="Approvals"
        items={[
          { href: "/approvals", label: "Pending" },
          { href: "/approvals?tab=archive", label: "Archive" },
        ]}
        active={archive ? 1 : 0}
      />
      {archive ? (
        <Archive me={me} filter={filter} page={page} />
      ) : (
        <PendingList me={me} />
      )}
    </>
  );
}

async function Archive({
  me,
  filter,
  page,
}: {
  me: CurrentUser;
  filter: ArchiveFilter;
  page: number;
}) {
  const decider = alias(user, "decider");
  const where = and(
    filter === "all"
      ? inArray(leaveRequest.status, ["approved", "rejected", "cancelled"])
      : eq(leaveRequest.status, filter),
    visibleUsers(me),
  );
  const [rows, [{ total }]] = await Promise.all([
    db
      .select({
        request: leaveRequest,
        owner: { id: user.id, name: user.name },
        teamName: team.name,
        deciderName: decider.name,
      })
      .from(leaveRequest)
      .innerJoin(user, eq(user.id, leaveRequest.userId))
      .leftJoin(team, eq(team.id, user.teamId))
      .leftJoin(decider, eq(decider.id, leaveRequest.decidedById))
      .where(where)
      // Most recently handled first; old cancellations have no decidedAt.
      .orderBy(
        desc(
          sql`coalesce(${leaveRequest.decidedAt}, ${leaveRequest.createdAt})`,
        ),
        desc(leaveRequest.id),
      )
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ total: count() })
      .from(leaveRequest)
      .innerJoin(user, eq(user.id, leaveRequest.userId))
      .where(where),
  ]);

  const href = (f: ArchiveFilter, p: number) => {
    const q = new URLSearchParams({ tab: "archive" });
    if (f !== "all") q.set("status", f);
    if (p > 1) q.set("page", String(p));
    return `/approvals?${q}`;
  };
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = from + rows.length - 1;

  return (
    <section className="card p-0" aria-label="Archive">
      <nav
        aria-label="Filter by status"
        className="flex gap-2 overflow-x-auto p-4"
      >
        {ARCHIVE_FILTERS.map((f) => (
          <Link
            key={f}
            href={href(f, 1)}
            scroll={false}
            aria-current={f === filter ? "page" : undefined}
            className={`state-layer inline-flex h-8 shrink-0 items-center rounded-lg border px-3 text-sm font-medium capitalize ${
              f === filter
                ? "border-transparent bg-secondary-container text-on-secondary-container"
                : "border-outline text-on-surface-variant"
            }`}
          >
            {f}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <p className="px-4 pb-6 text-sm text-on-surface-variant">
          {page > 1 ? "No more requests." : "Nothing in the archive yet."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-surface-container-high border-t border-surface-container-high">
          {rows.map(({ request: r, owner, teamName, deciderName }) => {
            const status = r.status as Exclude<LeaveStatus, "pending">;
            // Only the requester could cancel before cancellations were
            // recorded, so a missing canceller is the requester.
            const by =
              deciderName ?? (status === "cancelled" ? owner.name : null);
            return (
              <li
                key={r.id}
                className="flex flex-wrap items-start gap-x-6 gap-y-2 px-4 py-4"
              >
                <div className="flex min-w-64 flex-1 gap-3">
                  <Avatar name={owner.name} size={36} />
                  <div className="min-w-0">
                    <p className="font-medium text-on-surface">
                      {owner.name}
                      <span className="ml-2 text-sm font-normal text-on-surface-variant">
                        {teamName ?? "No team"}
                      </span>
                    </p>
                    <p className="text-sm text-on-surface">
                      {formatRange(r.startDate, r.endDate)}
                    </p>
                    <p className="text-sm text-on-surface-variant">
                      {LEAVE_TYPE_LABEL[r.type]} · {r.days}{" "}
                      {r.days === 1 ? "day" : "days"}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-start gap-1 sm:items-end sm:text-right">
                  <StatusBadge status={status} />
                  <p className="text-sm text-on-surface-variant">
                    {DONE_BY[status]}{" "}
                    <span className="text-on-surface">
                      {by ?? "a deleted user"}
                    </span>
                    {r.decidedAt &&
                      ` · ${r.decidedAt.toLocaleString("en-GB", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}`}
                  </p>
                  {r.decisionComment && (
                    <p className="text-sm text-on-surface-variant italic">
                      “{r.decisionComment}”
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {total > 0 && (
        <div className="flex items-center justify-between gap-4 border-t border-surface-container-high px-4 py-3 text-sm text-on-surface-variant">
          <span>
            {rows.length > 0 ? `${from}–${to} of ${total}` : `${total} total`}
          </span>
          <div className="flex">
            {page > 1 ? (
              <Link
                href={href(filter, page - 1)}
                aria-label="Previous page"
                className="icon-btn"
              >
                <ChevronLeftIcon className="size-5" />
              </Link>
            ) : (
              <span className="size-10" />
            )}
            {page * PAGE_SIZE < total ? (
              <Link
                href={href(filter, page + 1)}
                aria-label="Next page"
                className="icon-btn"
              >
                <ChevronRightIcon className="size-5" />
              </Link>
            ) : (
              <span className="size-10" />
            )}
          </div>
        </div>
      )}
    </section>
  );
}

async function PendingList({ me }: { me: CurrentUser }) {
  const rows = await db
    .select({ request: leaveRequest, owner: user, teamName: team.name })
    .from(leaveRequest)
    .innerJoin(user, eq(user.id, leaveRequest.userId))
    .leftJoin(team, eq(team.id, user.teamId))
    .where(
      and(
        eq(leaveRequest.status, "pending"),
        visibleUsers(me),
        // Managers never approve their own requests.
        me.role === "superadmin" ? undefined : ne(user.id, me.id),
      ),
    )
    .orderBy(asc(leaveRequest.startDate));

  if (rows.length === 0) {
    return (
      <div className="card flex flex-col items-center gap-3 py-16 text-center">
        <span className="flex size-14 items-center justify-center rounded-full bg-success-container text-on-success-container">
          <CheckIcon className="size-7" />
        </span>
        <p className="text-lg text-on-surface">Nothing waiting for you.</p>
        <p className="text-sm text-on-surface-variant">
          New requests from your team will appear here.
        </p>
      </div>
    );
  }

  const balances = await Promise.all(
    rows.map((r) =>
      r.request.type === "paid"
        ? getBalance(r.owner.id, Number(r.request.startDate.slice(0, 4)))
        : null,
    ),
  );

  return (
    <ul className="flex flex-col gap-3">
      {rows.map(({ request: r, owner, teamName }, i) => (
        <li
          key={r.id}
          className="card flex flex-wrap items-start gap-x-6 gap-y-4"
        >
          <div className="flex min-w-64 flex-1 gap-4">
            <Avatar name={owner.name} size={40} />
            <div className="min-w-0">
              <p className="font-medium text-on-surface">
                {owner.name}
                <span className="ml-2 text-sm font-normal text-on-surface-variant">
                  {teamName ?? "No team"}
                </span>
              </p>
              <p className="mt-0.5 text-on-surface">
                {formatRange(r.startDate, r.endDate)}
              </p>
              <p className="text-sm text-on-surface-variant">
                {LEAVE_TYPE_LABEL[r.type]} · {r.days}{" "}
                {r.days === 1 ? "day" : "days"}
                {balances[i] &&
                  ` · ${balances[i].remaining} of ${balances[i].total} remaining after pending`}
              </p>
              {r.note && (
                <p className="mt-2 rounded-xl bg-surface-container-low px-3 py-2 text-sm text-on-surface-variant">
                  {r.note}
                </p>
              )}
            </div>
          </div>
          <ActionForm
            action={decideLeave}
            className="flex w-full flex-col gap-2 sm:w-auto"
          >
            <input type="hidden" name="id" value={r.id} />
            <input
              name="comment"
              placeholder="Comment (optional)"
              maxLength={500}
              className="input"
            />
            <div className="flex justify-end gap-2">
              <button
                type="submit"
                name="decision"
                value="rejected"
                className="btn-secondary"
              >
                <CloseIcon className="size-4" />
                Reject
              </button>
              <button
                type="submit"
                name="decision"
                value="approved"
                className="btn"
              >
                <CheckIcon className="size-4" />
                Approve
              </button>
            </div>
          </ActionForm>
        </li>
      ))}
    </ul>
  );
}
