import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { env } from "@/env";

export const auth = betterAuth({
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    // Internal system: accounts are created by the superadmin only.
    disableSignUp: true,
    minPasswordLength: 10,
  },
  user: {
    additionalFields: {
      // input: false — can never be set through auth endpoints.
      role: { type: "string", required: true, input: false },
      teamId: { type: "string", required: false, input: false },
    },
  },
  // Must be last: lets Server Actions set auth cookies.
  plugins: [nextCookies()],
});
