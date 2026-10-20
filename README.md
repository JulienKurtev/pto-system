# PTO

Internal leave tracker. Employees request time off; managers approve their
team's requests and see them on a calendar; the superadmin (CTO) can approve
anything and manages users, teams, allowances and holidays.

Stack: Next.js 16 (App Router, Cache Components), PostgreSQL, Drizzle ORM,
Better Auth (email + password), Tailwind CSS.

## Setup

Requires Node 24+ and PostgreSQL.

```bash
npm install
cp .env.example .env.local      # then fill in values
createdb pto                    # or: psql -c "create database pto;"
npm run db:migrate
npm run db:seed -- --email cto@company.bg --name "Your Name" --password "a-long-password"
npm run dev
```

Open http://localhost:3000 and sign in as the superadmin. Create teams and
users under **Admin**. There is no self sign-up.

The seed also fills Bulgarian official holidays for this year and next. Use
**Admin → Holidays** for other years and government-declared days off.

## Rules

- Roles: `employee`, `manager`, `superadmin`.
- Managers approve requests from their own team, never their own. The
  superadmin can approve anything.
- Leave types: paid vacation (counts against the yearly allowance, default
  20), unpaid, sick.
- Working days exclude weekends and holidays; the count is fixed when the
  request is submitted. Pending paid days are reserved from the balance.
- Requests can't overlap and can't span two years. Only pending requests can
  be cancelled.

## Scripts

| Script                | What it does                               |
| --------------------- | ------------------------------------------ |
| `npm run dev`         | Dev server                                 |
| `npm run build`       | Production build                           |
| `npm run check`       | Typecheck + lint + format check            |
| `npm run db:generate` | Create a migration after editing schema.ts |
| `npm run db:migrate`  | Apply migrations                           |
| `npm run db:studio`   | Browse the database                        |
| `npm run db:seed`     | Holidays + first superadmin                |
