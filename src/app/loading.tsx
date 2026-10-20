export default function Loading() {
  return (
    <main
      aria-busy="true"
      className="mx-auto flex w-full max-w-3xl flex-1 items-center justify-center px-6 py-24"
    >
      <span className="sr-only">Loading…</span>
      <div className="size-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
    </main>
  );
}
