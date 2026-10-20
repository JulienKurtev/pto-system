"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { z } from "zod";
import type { FormState } from "@/components/action-form";
import { auth } from "@/lib/auth";
import { requireUser } from "@/lib/session";

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: z
      .string()
      .min(10, "New password must be at least 10 characters.")
      .max(128, "New password must be at most 128 characters."),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "New passwords don't match.",
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    message: "New password must differ from the current one.",
  });

export async function changePassword(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  const { currentPassword, newPassword } = parsed.data;

  try {
    await auth.api.changePassword({
      // Signs out every other device; this one gets a fresh session.
      body: { currentPassword, newPassword, revokeOtherSessions: true },
      headers: await headers(),
    });
  } catch (e) {
    if (e instanceof APIError) {
      return { error: "Current password is incorrect." };
    }
    throw e;
  }
  return { ok: "Password changed. Other devices have been signed out." };
}
