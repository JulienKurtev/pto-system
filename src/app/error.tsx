"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // Replace with your error reporting service (e.g. Sentry).
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h1 className="text-[32px] text-on-surface">Something went wrong</h1>
      <p className="text-on-surface-variant">
        Please try again. If it keeps happening, contact your administrator.
      </p>
      <button type="button" onClick={() => retry()} className="btn mt-2">
        Try again
      </button>
    </main>
  );
}
