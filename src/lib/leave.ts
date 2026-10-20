import "server-only";
import { and, eq, gte, inArray, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { allowance, holiday, leaveRequest, user } from "@/db/schema";
import { CARRY_OVER_START, computeBalances, type Balance } from "./carry-over";
import type { IsoDate } from "./dates";
import type { CurrentUser } from "./session";

export { CARRY_OVER_START, type Balance } from "./carry-over";

export const DEFAULT_ALLOWANCE = 20;

export const LEAVE_TYPE_LABEL = {
  paid: "Paid vacation",
  unpaid: "Unpaid leave",
  sick: "Sick leave",
} as const;

/** Statuses that occupy dates and (for paid leave) consume allowance. */
export const ACTIVE_STATUSES = ["pending", "approved"] as const;

/**
 * WHERE condition on `user` limiting rows to people whose leave `me` may
 * decide on: everyone for the superadmin, own team's employees for a
 * manager. Mirrors canDecide() in session.ts.
 */
export function visibleUsers(me: CurrentUser): SQL | undefined {
  if (me.role === "superadmin") return undefined;
  if (me.role === "manager" && me.teamId) {
    return and(eq(user.teamId, me.teamId), eq(user.role, "employee"));
  }
  return sql`false`;
}

/**
 * WHERE condition on `user` for the read-only team calendar: everyone for
 * the superadmin, own team for anyone else (just themselves if teamless).
 */
export function calendarUsers(me: CurrentUser): SQL | undefined {
  if (me.role === "superadmin") return undefined;
  if (me.teamId) return eq(user.teamId, me.teamId);
  return eq(user.id, me.id);
}

export async function getHolidays(start: IsoDate, end: IsoDate) {
  return db
    .select()
    .from(holiday)
    .where(and(gte(holiday.date, start), lte(holiday.date, end)))
    .orderBy(holiday.date);
}

export async function getHolidaySet(start: IsoDate, end: IsoDate) {
  return new Set((await getHolidays(start, end)).map((h) => h.date));
}

/**
 * Paid-leave balances for fromYear..toYear, with carry-over (see
 * computeBalances). Pending days are reserved. `extra` adds hypothetical
 * pending days, to check a request before saving it.
 */
export async function getBalances(
  userId: string,
  fromYear: number,
  toYear: number,
  extra?: { year: number; days: number },
): Promise<Map<number, Balance>> {
  const start = Math.min(fromYear, CARRY_OVER_START);
  const year = sql<number>`extract(year from ${leaveRequest.startDate})::int`;
  const [allowances, used] = await Promise.all([
    db
      .select({ year: allowance.year, days: allowance.days })
      .from(allowance)
      .where(
        and(
          eq(allowance.userId, userId),
          gte(allowance.year, start),
          lte(allowance.year, toYear),
        ),
      ),
    db
      .select({
        year,
        status: leaveRequest.status,
        days: sql<number>`coalesce(sum(${leaveRequest.days}), 0)::int`,
      })
      .from(leaveRequest)
      .where(
        and(
          eq(leaveRequest.userId, userId),
          eq(leaveRequest.type, "paid"),
          inArray(leaveRequest.status, ACTIVE_STATUSES),
          gte(leaveRequest.startDate, `${start}-01-01`),
          lte(leaveRequest.startDate, `${toYear}-12-31`),
        ),
      )
      .groupBy(year, leaveRequest.status),
  ]);
  const sumOf = (y: number, status: (typeof ACTIVE_STATUSES)[number]) =>
    used.find((u) => u.year === y && u.status === status)?.days ?? 0;

  return computeBalances(
    fromYear,
    toYear,
    (y) => allowances.find((a) => a.year === y)?.days ?? DEFAULT_ALLOWANCE,
    (y) => ({
      approved: sumOf(y, "approved"),
      pending: sumOf(y, "pending") + (extra?.year === y ? extra.days : 0),
    }),
  );
}

export async function getBalance(
  userId: string,
  year: number,
): Promise<Balance> {
  return (await getBalances(userId, year, year)).get(year)!;
}

/** Does the user already have pending/approved leave touching these dates? */
export async function hasOverlap(
  userId: string,
  start: IsoDate,
  end: IsoDate,
): Promise<boolean> {
  const rows = await db
    .select({ id: leaveRequest.id })
    .from(leaveRequest)
    .where(
      and(
        eq(leaveRequest.userId, userId),
        inArray(leaveRequest.status, ACTIVE_STATUSES),
        lte(leaveRequest.startDate, end),
        gte(leaveRequest.endDate, start),
      ),
    )
    .limit(1);
  return rows.length > 0;
}
