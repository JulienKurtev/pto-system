"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { FormState } from "@/components/action-form";
import { auth } from "@/lib/auth";

export async function signIn(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  try {
    await auth.api.signInEmail({
      body: {
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
      },
      headers: await headers(),
    });
  } catch (e) {
    if (e instanceof APIError) return { error: "Invalid email or password." };
    throw e;
  }
  redirect("/");
}

export async function signOut() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/login");
}
