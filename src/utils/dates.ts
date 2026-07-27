/**
 * Parses a "YYYY-MM-DD" date string as LOCAL midnight rather than UTC
 * midnight. Passing the raw string to `new Date()` treats it as UTC,
 * which silently shows the wrong day for anyone west of UTC — this is
 * a real bug class carried over (and fixed) from the original app.
 */
export function parseLocalDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00`);
}

export function todayLocal(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function isSameMonth(date: Date, ref: Date): boolean {
  return date.getMonth() === ref.getMonth() && date.getFullYear() === ref.getFullYear();
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Normalizes a category name for case-insensitive comparisons. */
export function normCategory(category?: string | null): string {
  return (category ?? "Other").trim().toLowerCase();
}

/**
 * Advances a recurring rule's next_date by one period, clamping to the
 * target month's real last day (naive month-add overflows "Feb 31" into
 * "Mar 3", which is a jarring, wrong-looking jump for month-end bills).
 */
export function advanceDate(dateStr: string, frequency: "monthly" | "weekly"): string {
  const d = parseLocalDate(dateStr);
  if (frequency === "weekly") {
    d.setDate(d.getDate() + 7);
  } else {
    const origDay = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
    const lastDayOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(origDay, lastDayOfMonth));
  }
  return d.toISOString().split("T")[0];
}
