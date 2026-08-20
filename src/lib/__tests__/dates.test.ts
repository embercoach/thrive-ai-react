import { describe, it, expect, beforeAll, vi } from "vitest";
import { advanceDate, todayLocalStr, formatLocalDate, parseLocalDate, isSameMonth } from "@/utils/dates";

// These all guard against the same class of bug: using toISOString() on a
// LOCAL midnight Date, which silently shifts the calendar day for anyone
// east of UTC. It shipped three separate times in this app.
describe("local-date handling east of UTC", () => {
  beforeAll(() => {
    process.env.TZ = "Africa/Johannesburg"; // UTC+2
  });

  it("formats from local calendar fields, not UTC", () => {
    // 00:30 local on the 20th is still the 19th in UTC.
    const d = new Date(2026, 7, 20, 0, 30, 0);
    expect(formatLocalDate(d)).toBe("2026-08-20");
    expect(d.toISOString().split("T")[0]).toBe("2026-08-19"); // the old, wrong answer
  });

  it("todayLocalStr agrees with the local clock just after midnight", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 20, 0, 30, 0));
    expect(todayLocalStr()).toBe("2026-08-20");
    vi.useRealTimers();
  });

  it("holds the same day-of-month across many monthly cycles", () => {
    let cur = "2026-08-20";
    const seen: string[] = [];
    for (let i = 0; i < 6; i++) {
      cur = advanceDate(cur, "monthly");
      seen.push(cur);
    }
    expect(seen).toEqual([
      "2026-09-20",
      "2026-10-20",
      "2026-11-20",
      "2026-12-20",
      "2027-01-20",
      "2027-02-20",
    ]);
  });

  it("advances weekly by exactly seven days", () => {
    expect(advanceDate("2026-08-20", "weekly")).toBe("2026-08-27");
    expect(advanceDate("2026-08-27", "weekly")).toBe("2026-09-03");
  });

  it("clamps month-end instead of overflowing Feb 31 into March", () => {
    expect(advanceDate("2026-01-31", "monthly")).toBe("2026-02-28");
    expect(advanceDate("2026-03-31", "monthly")).toBe("2026-04-30");
  });

  it("parses YYYY-MM-DD as local midnight, not UTC midnight", () => {
    const d = parseLocalDate("2026-08-20");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7);
    expect(d.getDate()).toBe(20);
  });

  it("isSameMonth compares calendar month and year", () => {
    expect(isSameMonth(parseLocalDate("2026-08-01"), parseLocalDate("2026-08-31"))).toBe(true);
    expect(isSameMonth(parseLocalDate("2026-08-31"), parseLocalDate("2026-09-01"))).toBe(false);
    expect(isSameMonth(parseLocalDate("2025-08-20"), parseLocalDate("2026-08-20"))).toBe(false);
  });
});
