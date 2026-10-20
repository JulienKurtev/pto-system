import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { db } from ".";
import { account, user, type Role } from "./schema";

// Mirrors how Better Auth's email sign-up stores credentials (a `user` row
// plus a `credential` account holding the hash), so these users can log in
// normally. Kept outside src/lib/auth.ts so the seed script can use it.

export async function createUserWithPassword(input: {
  name: string;
  email: string;
  password: string;
  role: Role;
  teamId: string | null;
}) {
  const id = crypto.randomUUID();
  const hash = await hashPassword(input.password);
  await db.transaction(async (tx) => {
    await tx.insert(user).values({
      id,
      name: input.name,
      email: input.email.toLowerCase(),
      emailVerified: true,
      role: input.role,
      teamId: input.teamId,
    });
    await tx.insert(account).values({
      id: crypto.randomUUID(),
      accountId: id,
      providerId: "credential",
      userId: id,
      password: hash,
    });
  });
  return id;
}

export async function setPassword(userId: string, password: string) {
  await db
    .update(account)
    .set({ password: await hashPassword(password) })
    .where(
      and(eq(account.userId, userId), eq(account.providerId, "credential")),
    );
}
