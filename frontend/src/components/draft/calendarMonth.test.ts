import { describe, expect, it } from "vitest";
import { isoDate, longDate, monthCells, parseMonth, shiftMonth } from "./calendarMonth";

describe("monthCells", () => {
  it("pads the days before the 1st so the weekday columns line up", () => {
    // November 2026 starts on a Sunday and has 30 days.
    const november = monthCells(2026, 10);
    expect(november[0]).toBe(1);
    expect(november).toHaveLength(30);
    // December 2026 starts on a Tuesday.
    const december = monthCells(2026, 11);
    expect(december.slice(0, 3)).toEqual([null, null, 1]);
    expect(december).toHaveLength(33);
  });

  it("knows leap February", () => {
    expect(monthCells(2028, 1).filter((day) => day !== null)).toHaveLength(29);
    expect(monthCells(2027, 1).filter((day) => day !== null)).toHaveLength(28);
  });
});

describe("shiftMonth", () => {
  it("rolls over year boundaries both ways", () => {
    expect(shiftMonth({ year: 2026, month: 11 }, 1)).toEqual({ year: 2027, month: 0 });
    expect(shiftMonth({ year: 2026, month: 0 }, -1)).toEqual({ year: 2025, month: 11 });
  });
});

describe("dates", () => {
  it("round-trips a month through its date string", () => {
    expect(parseMonth(isoDate(2026, 10, 18))).toEqual({ year: 2026, month: 10 });
  });

  it("names the weekday of a day", () => {
    expect(longDate("2026-11-18")).toContain("Wednesday");
  });
});
