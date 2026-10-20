import { z } from "zod";

/**
 * Validated environment variables. Imported by next.config.ts so a bad
 * value fails `next dev` / `next build` immediately instead of at runtime.
 *
 * NEXT_PUBLIC_* values are inlined into client bundles at build time —
 * never put secrets in them.
 */
const schema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  NEXT_PUBLIC_SITE_URL: z.url().default("http://localhost:3000"),
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.url(),
});

const parsed = schema.safeParse({
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  DATABASE_URL: process.env.DATABASE_URL,
  BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
  BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
});

if (!parsed.success) {
  console.error(
    "Invalid environment variables:",
    z.flattenError(parsed.error).fieldErrors,
  );
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;
