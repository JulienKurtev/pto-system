"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/select";

const MONTHS = Array.from({ length: 12 }, (_, i) =>
  new Date(Date.UTC(2000, i, 1)).toLocaleDateString("en-GB", {
    month: "long",
    timeZone: "UTC",
  }),
);

/** Month/year dropdowns that jump straight to a period. */
export function PeriodPicker({
  view,
  anchor,
  years,
}: {
  view: string;
  anchor: string;
  years: number[];
}) {
  const router = useRouter();
  const year = Number(anchor.slice(0, 4));
  const month = Number(anchor.slice(5, 7));

  function go(y: number, m: number) {
    const target = `${y}-${String(m).padStart(2, "0")}-01`;
    router.push(`/calendar?view=${view}&d=${target}`, {
      transitionTypes: [target > anchor ? "nav-forward" : "nav-back"],
    });
  }

  return (
    <div className="flex gap-2">
      {view !== "year" && (
        <Select
          aria-label="Month"
          small
          className="w-36"
          value={String(month)}
          onChange={(v) => go(year, Number(v))}
          options={MONTHS.map((name, i) => ({
            value: String(i + 1),
            label: name,
          }))}
        />
      )}
      <Select
        aria-label="Year"
        small
        className="w-24"
        value={String(year)}
        onChange={(v) => go(Number(v), view === "year" ? 1 : month)}
        options={years.map((y) => ({ value: String(y), label: String(y) }))}
      />
    </div>
  );
}
