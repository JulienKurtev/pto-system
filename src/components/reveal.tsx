import { Suspense, ViewTransition, type ReactNode } from "react";

/**
 * Suspense boundary whose skeleton slides out and content slides in
 * (classes defined in globals.css).
 */
export function Reveal({
  fallback,
  children,
}: {
  fallback: ReactNode;
  children: ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <ViewTransition exit="slide-down" default="none">
          <div>{fallback}</div>
        </ViewTransition>
      }
    >
      <ViewTransition enter="slide-up" default="none">
        <div className="flex flex-col gap-6">{children}</div>
      </ViewTransition>
    </Suspense>
  );
}

/** Generic page skeleton: a few soft placeholder blocks. */
export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <span className="sr-only">Loading…</span>
      <div className="skeleton h-32" />
      <div className="skeleton h-20" />
      <div className="skeleton h-20" />
    </div>
  );
}
