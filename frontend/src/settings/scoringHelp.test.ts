import { describe, expect, it } from "vitest";
import { scoringHelp } from "./scoringHelp";

describe("scoringHelp", () => {
  it("converts fractional per-yard rates into yards per point", () => {
    expect(scoringHelp("scoring_passing_yard", "0.04")).toBe("1 point per 25 yards");
    expect(scoringHelp("scoring_rushing_yard", 0.1)).toBe("1 point per 10 yards");
    expect(scoringHelp("scoring_receiving_yard", "0.05")).toBe("1 point per 20 yards");
    expect(scoringHelp("scoring_passing_yard", "1")).toBe("1 point per yard");
    expect(scoringHelp("scoring_special_punt_return_yard", "0.2")).toBe("1 point per 5 yards");
  });

  it("describes per-event values", () => {
    expect(scoringHelp("scoring_passing_td", "4")).toBe("4 points per touchdown");
    expect(scoringHelp("scoring_receiving_reception", "1")).toBe("1 point per reception");
    expect(scoringHelp("scoring_passing_interception", "-1")).toBe(
      "-1 point per interception thrown",
    );
    expect(scoringHelp("scoring_carrying_fumble_lost", "-2")).toBe("-2 points per fumble lost");
    expect(scoringHelp("scoring_passing_2pt", "2")).toBe("2 points per 2-point conversion");
  });

  it("describes yardage bonuses, kick yards and defense bands", () => {
    expect(scoringHelp("scoring_passing_bonus_300_yards", "3")).toBe(
      "3 points bonus for a game of 300+ yards",
    );
    expect(scoringHelp("scoring_kicking_fg_yard", "0.1")).toBe("1 point per 10 yards");
    expect(scoringHelp("scoring_dst_pts_allowed_1_13", "5")).toBe(
      "5 points when the defense allows 1-13 points",
    );
    expect(scoringHelp("scoring_dst_yards_allowed_under_100", "6")).toBe(
      "6 points when the defense allows under 100 yards",
    );
    expect(scoringHelp("scoring_dst_pts_allowed_29_plus", "-1")).toBe(
      "-1 point when the defense allows 29+ points",
    );
  });

  it("says when a category is off and ignores unparseable input", () => {
    expect(scoringHelp("scoring_passing_td", "0")).toBe("Not scored");
    expect(scoringHelp("scoring_passing_td", "")).toBeNull();
    expect(scoringHelp("scoring_passing_td", "0.")).toBe("Not scored");
  });
});
