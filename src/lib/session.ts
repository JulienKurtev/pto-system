import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Role } from "@/db/schema";
import { auth } from "./auth";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  teamId: string | null;
};

/**
 * Data Access Layer entry point: the signed-in user, or a redirect to /login.
 * Deduplicated per request. Every page AND every Server Action must go
 * through this (or requireRole) — UI checks alone don't protect data.
 */
export const requireUser = cache(async (): Promise<CurrentUser> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const u = session.user;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role as Role,
    teamId: u.teamId ?? null,
  };
});

export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/");
  return user;
}

/**
 * Can `actor` approve/reject a request owned by `owner`? Superadmin: any.
 * Manager: employees of their own team only (not other managers/admins).
 */
export function canDecide(
  actor: CurrentUser,
  owner: { id: string; teamId: string | null; role: Role },
): boolean {
  if (actor.role === "superadmin") return true;
  return (
    actor.role === "manager" &&
    owner.role === "employee" &&
    actor.teamId !== null &&
    actor.teamId === owner.teamId
  );
}
