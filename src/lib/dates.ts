// Date helpers. All dates are ISO "YYYY-MM-DD" strings handled in UTC so
// results never shift with the server's timezone.

export type IsoDate = string;

export function toIso(d: Date): IsoDate {
  return d.toISOString().slice(0, 10);
}

export function parseIso(s: IsoDate): Date {
  return new Date(`${s}T00:00:00Z`);
}

export function addDays(s: IsoDate, n: number): IsoDate {
  const d = parseIso(s);
  d.setUTCDate(d.getUTCDate() + n);
  return toIso(d);
}

/** First day of the month `n` months after the month of `first`. */
export function addMonths(first: IsoDate, n: number): IsoDate {
  const d = parseIso(first);
  return toIso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1)));
}

export function monthEnd(first: IsoDate): IsoDate {
  return addDays(addMonths(first, 1), -1);
}

export function mondayOf(d: IsoDate): IsoDate {
  return addDays(d, -((parseIso(d).getUTCDay() + 6) % 7));
}

export function sundayOf(d: IsoDate): IsoDate {
  return addDays(d, (7 - parseIso(d).getUTCDay()) % 7);
}

export function isWeekend(s: IsoDate): boolean {
  const day = parseIso(s).getUTCDay();
  return day === 0 || day === 6;
}

/** Inclusive list of dates from start to end. */
export function eachDay(start: IsoDate, end: IsoDate): IsoDate[] {
  const out: IsoDate[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Working days in [start, end], excluding weekends and the given holidays. */
export function countWorkingDays(
  start: IsoDate,
  end: IsoDate,
  holidays: ReadonlySet<IsoDate>,
): number {
  return eachDay(start, end).filter((d) => !isWeekend(d) && !holidays.has(d))
    .length;
}

const dayFmt = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const yearFmt = new Intl.DateTimeFormat("en-GB", {
  year: "numeric",
  timeZone: "UTC",
});

/** "Mon 21 Dec 2026" or "Mon 21 Dec – Thu 31 Dec 2026". */
export function formatRange(start: IsoDate, end: IsoDate): string {
  const year = yearFmt.format(parseIso(end));
  if (start === end) return `${dayFmt.format(parseIso(start))} ${year}`;
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  const from = dayFmt.format(parseIso(start));
  return `${from}${sameYear ? "" : ` ${yearFmt.format(parseIso(start))}`} – ${dayFmt.format(parseIso(end))} ${year}`;
}

/** Orthodox Easter Sunday (Gregorian date), valid for 1900–2099. */
export function orthodoxEaster(year: number): IsoDate {
  // Meeus' Julian algorithm, then +13 days Julian→Gregorian.
  const a = year % 4;
  const b = year % 7;
  const c = year % 19;
  const d = (19 * c + 15) % 30;
  const e = (2 * a + 4 * b - d + 34) % 7;
  const month = Math.floor((d + e + 114) / 31);
  const day = ((d + e + 114) % 31) + 1;
  const julian = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return addDays(julian, 13);
}

/**
 * Bulgarian official holidays (Labour Code art. 154). When a fixed holiday
 * falls on a weekend, the next working day is off; this does not apply to
 * the Easter holidays. Government-declared extra days off are not included —
 * add those in the admin page.
 */
export function bulgarianHolidays(
  year: number,
): { date: IsoDate; name: string }[] {
  const y = String(year);
  const fixed = [
    [`${y}-01-01`, "New Year's Day"],
    [`${y}-03-03`, "Liberation Day"],
    [`${y}-05-01`, "Labour Day"],
    [`${y}-05-06`, "St. George's Day"],
    [`${y}-05-24`, "Culture and Literacy Day"],
    [`${y}-09-06`, "Unification Day"],
    [`${y}-09-22`, "Independence Day"],
    [`${y}-12-24`, "Christmas Eve"],
    [`${y}-12-25`, "Christmas Day"],
    [`${y}-12-26`, "Christmas (2nd day)"],
  ] as const;

  const easter = orthodoxEaster(year);
  const result = new Map<IsoDate, string>([
    [addDays(easter, -2), "Good Friday"],
    [addDays(easter, -1), "Holy Saturday"],
    [easter, "Easter Sunday"],
    [addDays(easter, 1), "Easter Monday"],
  ]);
  for (const [date, name] of fixed) result.set(date, name);

  for (const [date, name] of fixed) {
    if (!isWeekend(date)) continue;
    let d = addDays(date, 1);
    while (isWeekend(d) || result.has(d)) d = addDays(d, 1);
    result.set(d, `${name} (moved)`);
  }

  return [...result]
    .map(([date, name]) => ({ date, name }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
