import { and, asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Avatar } from "@/components/avatar";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { PasswordField } from "@/components/password-field";
import { PageSkeleton, Reveal } from "@/components/reveal";
import { SegmentedNav } from "@/components/segmented-nav";
import { Select } from "@/components/select";
import { db } from "@/db";
import { allowance, roleEnum, team, user } from "@/db/schema";
import { formatRange } from "@/lib/dates";
import { DEFAULT_ALLOWANCE, getHolidays } from "@/lib/leave";
import { requireRole, type CurrentUser } from "@/lib/session";
import {
  addHoliday,
  createTeam,
  createUser,
  deleteHoliday,
  fillHolidays,
  resetPassword,
  updateUser,
} from "./actions";

export const metadata: Metadata = { title: "Admin" };

export default function AdminPage({ searchParams }: PageProps<"/admin">) {
  return (
    <>
      <h1 className="text-[32px] leading-tight text-on-surface">Admin</h1>
      <Reveal fallback={<PageSkeleton />}>
        <Admin searchParams={searchParams} />
      </Reveal>
    </>
  );
}

async function Admin({
  searchParams,
}: {
  searchParams: PageProps<"/admin">["searchParams"];
}) {
  const me = await requireRole("superadmin");
  const { y, tab } = await searchParams;
  const year =
    typeof y === "string" && /^\d{4}$/.test(y)
      ? Number(y)
      : new Date().getUTCFullYear();
  const holidaysTab = tab === "holidays";
  const href = (t: "users" | "holidays", yr: number) =>
    `/admin?${new URLSearchParams({
      ...(t === "holidays" && { tab: t }),
      y: String(yr),
    })}`;

  return (
    <>
      <SegmentedNav
        label="Admin"
        items={[
          { href: href("users", year), label: "Users" },
          { href: href("holidays", year), label: "Holidays" },
        ]}
        active={holidaysTab ? 1 : 0}
      />
      {holidaysTab ? (
        <HolidaysTab year={year} yearHref={(yr) => href("holidays", yr)} />
      ) : (
        <UsersTab me={me} year={year} yearHref={(yr) => href("users", yr)} />
      )}
    </>
  );
}

/** ‹ 2026 › control for the card whose contents depend on the year. */
function YearSwitcher({
  year,
  yearHref,
}: {
  year: number;
  yearHref: (year: number) => string;
}) {
  return (
    <div className="flex items-center gap-1 text-on-surface-variant">
      <Link
        href={yearHref(year - 1)}
        scroll={false}
        aria-label={`Year ${year - 1}`}
        className="icon-btn"
      >
        <ChevronLeftIcon className="size-5" />
      </Link>
      <span className="min-w-14 text-center text-lg text-on-surface">
        {year}
      </span>
      <Link
        href={yearHref(year + 1)}
        scroll={false}
        aria-label={`Year ${year + 1}`}
        className="icon-btn"
      >
        <ChevronRightIcon className="size-5" />
      </Link>
    </div>
  );
}

async function UsersTab({
  me,
  year,
  yearHref,
}: {
  me: CurrentUser;
  year: number;
  yearHref: (year: number) => string;
}) {
  const [teams, users] = await Promise.all([
    db.select().from(team).orderBy(asc(team.name)),
    db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        teamId: user.teamId,
        allowance: allowance.days,
      })
      .from(user)
      .leftJoin(
        allowance,
        and(eq(allowance.userId, user.id), eq(allowance.year, year)),
      )
      .orderBy(asc(user.name)),
  ]);

  const teamOptions = [
    { value: "", label: "No team" },
    ...teams.map((t) => ({ value: t.id, label: t.name })),
  ];
  const roleOptions = roleEnum.enumValues.map((r) => ({
    value: r,
    label: r.charAt(0).toUpperCase() + r.slice(1),
  }));

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card flex flex-col gap-4">
          <h2 className="text-xl text-on-surface">Create user</h2>
          <ActionForm action={createUser} className="flex flex-col gap-4">
            <label className="label">
              Name
              <input name="name" required className="input" />
            </label>
            <label className="label">
              Email
              <input name="email" type="email" required className="input" />
            </label>
            <label className="label">
              Initial password
              <PasswordField name="password" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="label">
                Role
                <Select
                  name="role"
                  defaultValue="employee"
                  options={roleOptions}
                />
              </label>
              <label className="label">
                Team
                <Select name="teamId" defaultValue="" options={teamOptions} />
              </label>
            </div>
            <button type="submit" className="btn self-start">
              Create user
            </button>
          </ActionForm>
        </section>

        <section className="card flex flex-col gap-4 self-start">
          <h2 className="text-xl text-on-surface">Teams</h2>
          {teams.length === 0 ? (
            <p className="text-sm text-on-surface-variant">No teams yet.</p>
          ) : (
            <ul className="flex flex-wrap gap-2 text-sm">
              {teams.map((t) => (
                <li
                  key={t.id}
                  className="rounded-lg border border-outline-variant px-3 py-1.5 text-on-surface-variant"
                >
                  {t.name}
                </li>
              ))}
            </ul>
          )}
          <ActionForm action={createTeam} className="flex gap-2">
            <input
              name="name"
              required
              placeholder="Team name"
              className="input flex-1"
            />
            <button type="submit" className="btn">
              Add team
            </button>
          </ActionForm>
        </section>
      </div>

      <section className="card flex flex-col gap-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl text-on-surface">Users</h2>
            <p className="text-sm text-on-surface-variant">
              Allowance = paid vacation days for {year} (default{" "}
              {DEFAULT_ALLOWANCE}). Role and team don&apos;t depend on the year.
            </p>
          </div>
          <YearSwitcher year={year} yearHref={yearHref} />
        </div>
        <ul className="mt-2 divide-y divide-outline-variant">
          {users.map((u) => (
            <li key={u.id} className="flex flex-col gap-2 py-4">
              <ActionForm
                // Re-create per year: the inputs are uncontrolled, so they'd
                // otherwise keep the previous year's allowance.
                key={year}
                action={updateUser}
                resetOnSuccess={false}
                className="flex flex-wrap items-end gap-3"
              >
                <div className="flex min-w-56 flex-1 items-center gap-3 self-center">
                  <Avatar name={u.name} size={36} />
                  <div className="min-w-0">
                    <p className="font-medium text-on-surface">{u.name}</p>
                    <p className="truncate text-sm text-on-surface-variant">
                      {u.email}
                    </p>
                  </div>
                </div>
                <input type="hidden" name="id" value={u.id} />
                <input type="hidden" name="year" value={year} />
                <label className="label">
                  Role
                  <Select
                    name="role"
                    defaultValue={u.role}
                    options={roleOptions}
                    disabled={u.id === me.id}
                    className="w-40"
                  />
                  {/* Disabled selects aren't submitted. */}
                  {u.id === me.id && (
                    <input type="hidden" name="role" value={u.role} />
                  )}
                </label>
                <label className="label">
                  Team
                  <Select
                    name="teamId"
                    defaultValue={u.teamId ?? ""}
                    options={teamOptions}
                    className="w-44"
                  />
                </label>
                <label className="label">
                  Allowance {year}
                  <input
                    name="allowance"
                    type="number"
                    min={0}
                    max={366}
                    defaultValue={u.allowance ?? DEFAULT_ALLOWANCE}
                    className="input w-20"
                  />
                </label>
                <button type="submit" className="btn-tonal">
                  Save
                </button>
              </ActionForm>
              <details className="text-sm">
                <summary className="w-fit cursor-pointer text-primary">
                  Reset password
                </summary>
                <ActionForm
                  action={resetPassword}
                  className="mt-2 flex flex-wrap items-center gap-2"
                >
                  <input type="hidden" name="id" value={u.id} />
                  <PasswordField
                    name="password"
                    placeholder="New password (10+ chars)"
                    className="min-w-72 flex-1"
                  />
                  <button type="submit" className="btn-secondary">
                    Set password
                  </button>
                </ActionForm>
              </details>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

async function HolidaysTab({
  year,
  yearHref,
}: {
  year: number;
  yearHref: (year: number) => string;
}) {
  const holidays = await getHolidays(`${year}-01-01`, `${year}-12-31`);
  return (
    <>
      <section className="card flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-xl text-on-surface">Holidays</h2>
            <YearSwitcher year={year} yearHref={yearHref} />
          </div>
          <ActionForm action={fillHolidays} className="flex items-center gap-2">
            <input type="hidden" name="year" value={year} />
            <button type="submit" className="btn-secondary">
              Add Bulgarian official holidays for {year}
            </button>
          </ActionForm>
        </div>
        {holidays.length === 0 ? (
          <p className="text-sm text-on-surface-variant">
            No holidays for {year}.
          </p>
        ) : (
          <ul className="divide-y divide-outline-variant text-sm">
            {holidays.map((h) => (
              <li key={h.date} className="flex items-center gap-3 py-1">
                <span className="w-36 text-on-surface-variant">
                  {formatRange(h.date, h.date)}
                </span>
                <span className="flex-1 text-on-surface">{h.name}</span>
                <form action={deleteHoliday}>
                  <input type="hidden" name="date" value={h.date} />
                  <button type="submit" className="btn-text text-error">
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <ActionForm action={addHoliday} className="flex flex-wrap gap-2">
          <input name="date" type="date" required className="input" />
          <input
            name="name"
            required
            placeholder="Name, e.g. Bridge day"
            className="input flex-1"
          />
          <button type="submit" className="btn">
            Add day off
          </button>
        </ActionForm>
        <p className="text-xs text-on-surface-variant">
          Changing holidays doesn&apos;t recount requests already submitted.
        </p>
      </section>
    </>
  );
}
