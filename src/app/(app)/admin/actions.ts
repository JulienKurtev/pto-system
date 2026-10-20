"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/components/action-form";
import { db } from "@/db";
import { allowance, holiday, roleEnum, session, team, user } from "@/db/schema";
import { createUserWithPassword, setPassword } from "@/db/users";
import { bulgarianHolidays } from "@/lib/dates";
import { requireRole } from "@/lib/session";

// Every action re-checks the role: Server Actions are public endpoints.

const teamId = z
  .string()
  .transform((v) => v || null)
  .pipe(z.uuid().nullable());
const password = z.string().min(10, "Password must be at least 10 characters.");

function firstError(error: z.ZodError): FormState {
  return { error: error.issues[0]!.message };
}

export async function createTeam(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole("superadmin");
  const name = z
    .string()
    .trim()
    .min(1)
    .max(100)
    .safeParse(formData.get("name"));
  if (!name.success) return { error: "Enter a team name." };
  const inserted = await db
    .insert(team)
    .values({ name: name.data })
    .onConflictDoNothing()
    .returning();
  if (inserted.length === 0) return { error: "That team already exists." };
  refresh();
  return { ok: `Team “${name.data}” created.` };
}

const createUserSchema = z.object({
  name: z.string().trim().min(1, "Enter a name.").max(200),
  email: z.email("Enter a valid email."),
  password,
  role: z.enum(roleEnum.enumValues),
  teamId,
});

export async function createUser(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole("superadmin");
  const parsed = createUserSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return firstError(parsed.error);

  const exists = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, parsed.data.email.toLowerCase()));
  if (exists.length > 0) return { error: "A user with that email exists." };

  await createUserWithPassword(parsed.data);
  refresh();
  return { ok: `${parsed.data.name} can now sign in.` };
}

const updateUserSchema = z.object({
  id: z.string().min(1),
  role: z.enum(roleEnum.enumValues),
  teamId,
  year: z.coerce.number().int().min(2000).max(2100),
  allowance: z.coerce.number().int().min(0).max(366),
});

export async function updateUser(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const me = await requireRole("superadmin");
  const parsed = updateUserSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return firstError(parsed.error);
  const { id, role, teamId, year, allowance: days } = parsed.data;

  // Prevents the only superadmin from locking themselves out.
  if (id === me.id && role !== "superadmin") {
    return { error: "You can't change your own role." };
  }

  await db.transaction(async (tx) => {
    await tx.update(user).set({ role, teamId }).where(eq(user.id, id));
    await tx
      .insert(allowance)
      .values({ userId: id, year, days })
      .onConflictDoUpdate({
        target: [allowance.userId, allowance.year],
        set: { days },
      });
  });
  refresh();
  return { ok: "Saved." };
}

export async function resetPassword(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole("superadmin");
  const id = z.string().min(1).parse(formData.get("id"));
  const parsed = password.safeParse(formData.get("password"));
  if (!parsed.success) return firstError(parsed.error);

  await setPassword(id, parsed.data);
  // Sign the user out everywhere.
  await db.delete(session).where(eq(session.userId, id));
  return { ok: "Password changed." };
}

const holidaySchema = z.object({
  date: z.iso.date("Pick a date."),
  name: z.string().trim().min(1, "Enter a name.").max(100),
});

export async function addHoliday(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole("superadmin");
  const parsed = holidaySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return firstError(parsed.error);
  await db
    .insert(holiday)
    .values(parsed.data)
    .onConflictDoUpdate({
      target: holiday.date,
      set: { name: parsed.data.name },
    });
  refresh();
  return { ok: "Holiday saved." };
}

export async function deleteHoliday(formData: FormData) {
  await requireRole("superadmin");
  const date = z.iso.date().parse(formData.get("date"));
  await db.delete(holiday).where(eq(holiday.date, date));
  refresh();
}

export async function fillHolidays(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole("superadmin");
  const year = z.coerce
    .number()
    .int()
    .min(2000)
    .max(2099)
    .safeParse(formData.get("year"));
  if (!year.success) return { error: "Enter a year between 2000 and 2099." };
  const added = await db
    .insert(holiday)
    .values(bulgarianHolidays(year.data))
    .onConflictDoNothing()
    .returning();
  refresh();
  return { ok: `Added ${added.length} holidays for ${year.data}.` };
}
