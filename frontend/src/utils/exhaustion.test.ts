import { describe, expect, it } from "vitest";
import { exhaustionWarnings } from "./exhaustion";

const settings = (over: Record<string, number> = {}) => ({
  number_teams: 6,
  roster_max_qb: 2,
  roster_max_k: 2,
  roster_max_dst: 2,
  ...over,
});

describe("exhaustionWarnings", () => {
  it("is quiet for the 6-team defaults", () => {
    expect(exhaustionWarnings(settings())).toEqual([]);
  });

  it("warns for 8 teams with a cap of 2 kickers", () => {
    const warnings = exhaustionWarnings(settings({ number_teams: 8 }));
    expect(warnings.some((w) => w.includes("8 teams × up to 2 K is 16"))).toBe(true);
  });

  it("allows exactly 14 units", () => {
    expect(exhaustionWarnings(settings({ number_teams: 7 }))).toEqual([]);
  });
});
