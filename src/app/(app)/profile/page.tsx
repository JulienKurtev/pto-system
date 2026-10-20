import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { ActionForm } from "@/components/action-form";
import { Avatar } from "@/components/avatar";
import { PageSkeleton, Reveal } from "@/components/reveal";
import { db } from "@/db";
import { team, user } from "@/db/schema";
import { requireUser } from "@/lib/session";
import { changePassword } from "./actions";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return (
    <Reveal fallback={<PageSkeleton />}>
      <Profile />
    </Reveal>
  );
}

async function Profile() {
  const me = await requireUser();
  const [row] = await db
    .select({ createdAt: user.createdAt, team: team.name })
    .from(user)
    .leftJoin(team, eq(team.id, user.teamId))
    .where(eq(user.id, me.id));

  const details = [
    ["Name", me.name],
    ["Email", me.email],
    ["Role", me.role.charAt(0).toUpperCase() + me.role.slice(1)],
    ["Team", row?.team ?? "No team"],
    [
      "Member since",
      row?.createdAt.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }) ?? "—",
    ],
  ];

  return (
    <>
      <div className="flex items-center gap-4">
        <Avatar name={me.name} size={64} />
        <div className="min-w-0">
          <h1 className="truncate text-[32px] leading-tight text-on-surface">
            {me.name}
          </h1>
          <p className="truncate text-on-surface-variant">{me.email}</p>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <section className="card" aria-labelledby="details-heading">
          <h2 id="details-heading" className="text-xl text-on-surface">
            Details
          </h2>
          <dl className="mt-4 flex flex-col divide-y divide-surface-container-high">
            {details.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4 py-3">
                <dt className="text-sm text-on-surface-variant">{label}</dt>
                <dd className="truncate text-right text-on-surface">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs text-on-surface-variant">
            Name, email, role and team are managed by an administrator.
          </p>
        </section>

        <section className="card" aria-labelledby="password-heading">
          <h2 id="password-heading" className="text-xl text-on-surface">
            Change password
          </h2>
          <ActionForm
            action={changePassword}
            className="mt-5 flex flex-col gap-4"
          >
            <label className="label">
              Current password
              <input
                name="currentPassword"
                type="password"
                autoComplete="current-password"
                className="input"
                required
              />
            </label>
            <label className="label">
              New password
              <input
                name="newPassword"
                type="password"
                autoComplete="new-password"
                minLength={10}
                maxLength={128}
                className="input"
                required
              />
            </label>
            <label className="label">
              Confirm new password
              <input
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={10}
                maxLength={128}
                className="input"
                required
              />
            </label>
            <div className="flex items-center justify-between gap-4">
              <p className="text-xs text-on-surface-variant">
                At least 10 characters. Other devices will be signed out.
              </p>
              <button type="submit" className="btn">
                Update password
              </button>
            </div>
          </ActionForm>
        </section>
      </div>
    </>
  );
}
