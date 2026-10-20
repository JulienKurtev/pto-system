// Pure paid-leave carry-over arithmetic (no DB), used by getBalances().

/** First year whose unused paid days carry over (no records before it). */
export const CARRY_OVER_START = 2026;
/** Days of year Y stay usable until the end of Y + 2 (Labour Code art. 176a). */
const CARRY_YEARS = 2;

export type Balance = {
  /** The year's own allowance. */
  allowance: number;
  /** Unused days brought in from earlier years. */
  carriedIn: number;
  /** allowance + carriedIn. */
  total: number;
  approved: number;
  pending: number;
  remaining: number;
  /** Part of `remaining` that expires at the end of the year. */
  expiring: number;
};

/**
 * Balances for fromYear..toYear. Unused days carry forward from
 * CARRY_OVER_START on and expire CARRY_YEARS years after their own year;
 * booked leave (approved + pending) uses the oldest days first.
 */
export function computeBalances(
  fromYear: number,
  toYear: number,
  allowanceFor: (year: number) => number,
  usedIn: (year: number) => { approved: number; pending: number },
): Map<number, Balance> {
  const out = new Map<number, Balance>();
  // Carry-over depends on every year since the start, so replay from there.
  // Unused days per year of origin, oldest first.
  let pools: { year: number; days: number }[] = [];
  for (let y = Math.min(fromYear, CARRY_OVER_START); y <= toYear; y++) {
    pools =
      y > CARRY_OVER_START
        ? pools.filter((p) => p.year >= y - CARRY_YEARS && p.days > 0)
        : [];
    const carriedIn = pools.reduce((sum, p) => sum + p.days, 0);
    const own = allowanceFor(y);
    pools.push({ year: y, days: own });

    const { approved, pending } = usedIn(y);
    let toUse = approved + pending;
    for (const p of pools) {
      const take = Math.min(p.days, toUse);
      p.days -= take;
      toUse -= take;
    }
    // Overdrawn (e.g. allowance lowered later): show it, carry nothing.
    pools[pools.length - 1]!.days -= toUse;

    if (y >= fromYear) {
      out.set(y, {
        allowance: own,
        carriedIn,
        total: own + carriedIn,
        approved,
        pending,
        remaining: pools.reduce((sum, p) => sum + p.days, 0),
        expiring: Math.max(
          0,
          pools.find((p) => p.year === y - CARRY_YEARS)?.days ?? 0,
        ),
      });
    }
  }
  return out;
}
