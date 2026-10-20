"use server";

import { and, eq, isNull, ne, or } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/components/action-form";
import { db } from "@/db";
import { leaveRequest, leaveTypeEnum, notification, user } from "@/db/schema";
import { countWorkingDays } from "@/lib/dates";
import { getBalances, getHolidaySet, hasOverlap } from "@/lib/leave";
import { canDecide, requireUser } from "@/lib/session";

const isoDate = z.iso.date("Pick your dates.");

const submitSchema = z
  .object({
    type: z.enum(leaveTypeEnum.enumValues),
    startDate: isoDate,
    endDate: isoDate,
    note: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.startDate <= v.endDate, {
    message: "End date must be on or after the start date.",
  })
  .refine((v) => v.startDate.slice(0, 4) === v.endDate.slice(0, 4), {
    message: "A request can't span two years — split it in two.",
  });

export async function submitLeave(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireUser();
  const parsed = submitSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  const { type, startDate, endDate, note } = parsed.data;

  const holidays = await getHolidaySet(startDate, endDate);
  const days = countWorkingDays(startDate, endDate, holidays);
  if (days === 0) {
    return { error: "Those dates are all weekends or holidays." };
  }
  if (await hasOverlap(me.id, startDate, endDate)) {
    return { error: "You already have leave on some of those dates." };
  }
  if (type === "paid") {
    // These days can also be ones later years were counting on (carry-over),
    // so check every year they could still reach.
    const year = Number(startDate.slice(0, 4));
    const [before, after] = await Promise.all([
      getBalances(me.id, year, year + 2),
      getBalances(me.id, year, year + 2, { year, days }),
    ]);
    const short = [...after].find(
      ([y, b]) => b.remaining < 0 && b.remaining < before.get(y)!.remaining,
    );
    if (short) {
      const [y] = short;
      return {
        error:
          y === year
            ? `That's ${days} working days but you have ${before.get(year)!.remaining} left.`
            : `Not enough days: your ${y} leave already uses days carried over from ${year}.`,
      };
    }
  }

  const [created] = await db
    .insert(leaveRequest)
    .values({
      userId: me.id,
      type,
      startDate,
      endDate,
      days,
      note: note || null,
    })
    .returning({ id: leaveRequest.id });

  // Notify whoever can decide on it (mirrors canDecide()).
  const approvers = await db
    .select({ id: user.id })
    .from(user)
    .where(
      and(
        ne(user.id, me.id),
        or(
          eq(user.role, "superadmin"),
          me.role === "employee" && me.teamId
            ? and(eq(user.role, "manager"), eq(user.teamId, me.teamId))
            : undefined,
        ),
      ),
    );
  if (approvers.length > 0) {
    await db
      .insert(notification)
      .values(
        approvers.map((a) => ({ userId: a.id, leaveRequestId: created!.id })),
      );
  }
  refresh();
  return { ok: `Requested ${days} working day${days === 1 ? "" : "s"}.` };
}

export async function cancelLeave(formData: FormData) {
  const me = await requireUser();
  const id = z.uuid().parse(formData.get("id"));
  // Only the owner, and only while still pending.
  await db
    .update(leaveRequest)
    .set({ status: "cancelled", decidedById: me.id, decidedAt: new Date() })
    .where(
      and(
        eq(leaveRequest.id, id),
        eq(leaveRequest.userId, me.id),
        eq(leaveRequest.status, "pending"),
      ),
    );
  refresh();
}

export async function markNotificationsRead() {
  const me = await requireUser();
  await db
    .update(notification)
    .set({ readAt: new Date() })
    .where(and(eq(notification.userId, me.id), isNull(notification.readAt)));
  refresh();
}

const decideSchema = z.object({
  id: z.uuid(),
  decision: z.enum(["approved", "rejected"]),
  comment: z.string().trim().max(500).optional(),
});

export async function decideLeave(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireUser();
  const parsed = decideSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Invalid request." };
  const { id, decision, comment } = parsed.data;

  const [row] = await db
    .select({ status: leaveRequest.status, owner: user })
    .from(leaveRequest)
    .innerJoin(user, eq(user.id, leaveRequest.userId))
    .where(eq(leaveRequest.id, id));
  if (!row) return { error: "Request not found." };
  if (!canDecide(me, row.owner)) {
    return { error: "You can't decide on this request." };
  }

  // Status guard in the WHERE prevents double decisions.
  const updated = await db
    .update(leaveRequest)
    .set({
      status: decision,
      decidedById: me.id,
      decidedAt: new Date(),
      decisionComment: comment || null,
    })
    .where(and(eq(leaveRequest.id, id), eq(leaveRequest.status, "pending")))
    .returning({ id: leaveRequest.id });
  if (updated.length === 0) return { error: "Already decided or cancelled." };

  refresh();
  return { ok: decision === "approved" ? "Approved." : "Rejected." };
}
