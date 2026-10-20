// Creates the first superadmin and fills Bulgarian holidays for this and
// next year. Safe to re-run.
//
//   npm run db:seed -- --email cto@company.bg --name "Jane Doe" --password "..."

import { eq } from "drizzle-orm";
import { parseArgs } from "node:util";
import { db } from "@/db";
import { holiday, user } from "@/db/schema";
import { createUserWithPassword } from "@/db/users";
import { bulgarianHolidays } from "@/lib/dates";

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    name: { type: "string" },
    password: { type: "string" },
  },
});

async function main() {
  const year = new Date().getUTCFullYear();
  for (const y of [year, year + 1]) {
    await db.insert(holiday).values(bulgarianHolidays(y)).onConflictDoNothing();
  }
  console.log(`Holidays filled for ${year} and ${year + 1}.`);

  const { email, name, password } = values;
  if (!email || !name || !password) {
    console.log("Skipping superadmin (pass --email, --name and --password).");
    return;
  }
  if (password.length < 10) throw new Error("Password must be 10+ characters.");

  const existing = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.email, email.toLowerCase()));
  if (existing.length > 0) {
    console.log(`User ${email} already exists, skipping.`);
    return;
  }
  await createUserWithPassword({
    email,
    name,
    password,
    role: "superadmin",
    teamId: null,
  });
  console.log(`Superadmin ${email} created.`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
