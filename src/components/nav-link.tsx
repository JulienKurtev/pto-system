"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({
  href,
  children,
}: {
  href: string;
  children: string;
}) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`state-layer inline-flex h-9 shrink-0 items-center rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors duration-200 ease-emphasized ${
        active
          ? "bg-secondary-container text-on-secondary-container"
          : "text-on-surface-variant"
      }`}
    >
      {children}
    </Link>
  );
}
