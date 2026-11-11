import { describe, expect, it } from "vitest";
import { nflTeamColor } from "./nflColors";

describe("nflTeamColor", () => {
  it("finds a team by abbreviation in any case", () => {
    expect(nflTeamColor("KC")).toBe("#e31837");
    expect(nflTeamColor("kc")).toBe("#e31837");
  });

  it("is null for an unknown or missing team", () => {
    expect(nflTeamColor("XXX")).toBeNull();
    expect(nflTeamColor(null)).toBeNull();
    expect(nflTeamColor(undefined)).toBeNull();
  });
});
