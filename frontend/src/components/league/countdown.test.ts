import { describe, expect, it } from "vitest";
import { formatCountdown, ordinal } from "./countdown";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("formatCountdown", () => {
  it("counts days, hours and minutes", () => {
    expect(formatCountdown(2 * DAY + 4 * HOUR + 12 * MIN + 59_000)).toBe("2d 4h 12m");
  });

  it("drops days, then hours, and shows seconds in the last hour", () => {
    expect(formatCountdown(4 * HOUR + 12 * MIN)).toBe("4h 12m");
    expect(formatCountdown(12 * MIN + 30_000)).toBe("12m 30s");
  });

  it("says the draft is starting once the time has come", () => {
    expect(formatCountdown(0)).toBe("Starting now");
    expect(formatCountdown(-5_000)).toBe("Starting now");
  });
});

describe("ordinal", () => {
  it("words a pick position", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal)).toEqual([
      "1st",
      "2nd",
      "3rd",
      "4th",
      "11th",
      "12th",
      "13th",
      "21st",
      "22nd",
    ]);
  });
});
