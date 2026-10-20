import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <p className="text-6xl text-primary">404</p>
      <h1 className="text-[32px] text-on-surface">Page not found</h1>
      <p className="text-on-surface-variant">
        The page you&apos;re looking for doesn&apos;t exist.
      </p>
      <Link href="/" className="btn mt-2">
        Go home
      </Link>
    </main>
  );
}
