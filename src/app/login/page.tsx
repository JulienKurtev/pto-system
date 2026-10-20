import type { Metadata } from "next";
import { ActionForm } from "@/components/action-form";
import { CalendarIcon } from "@/components/icons";
import { ThemeToggle } from "@/components/theme-toggle";
import { signIn } from "./actions";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16">
      <div className="fixed top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="card w-full max-w-md p-8 sm:p-10">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-on-primary">
          <CalendarIcon className="size-6" />
        </span>
        <h1 className="mt-6 text-3xl text-on-surface">Sign in</h1>
        <p className="mt-2 text-on-surface-variant">to continue to PTO</p>
        <ActionForm action={signIn} className="mt-8 flex flex-col gap-5">
          <label className="label">
            Email
            <input
              className="input"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </label>
          <label className="label">
            Password
            <input
              className="input"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <div className="mt-2 flex items-center justify-between gap-4">
            <p className="text-sm text-on-surface-variant">
              No account? Ask your administrator.
            </p>
            <button className="btn" type="submit">
              Sign in
            </button>
          </div>
        </ActionForm>
      </div>
    </main>
  );
}
