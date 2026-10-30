import { describe, expect, it } from "vitest";
import { fromApi, postseasonFromApi, ROSTER_KEYS, SCORING_KEYS, toCamel } from "./convert";
import { POSTSEASON_KEYS } from "./postseasonFields";

describe("settings conversion", () => {
  it("matches pydantic's camel casing for numeric bands", () => {
    expect(toCamel("scoring_dst_yards_allowed_100_199")).toBe("scoringDstYardsAllowed100199");
    expect(toCamel("scoring_dst_pts_allowed_29_plus")).toBe("scoringDstPtsAllowed29Plus");
    expect(toCamel("number_teams")).toBe("numberTeams");
  });

  it("reads snake_case form state from a camelCase response", () => {
    const values = fromApi(
      { scoringPassingTd: 4, scoringDstYardsAllowed100199: 3, rosterTotal: "x", other: 1 },
      [...SCORING_KEYS, ...ROSTER_KEYS],
    );
    expect(values).toEqual({ scoring_passing_td: 4, scoring_dst_yards_allowed_100_199: 3 });
  });

  it("keeps booleans and enum strings for postseason settings", () => {
    const values = postseasonFromApi(
      { allowJoinAfterDraftStart: false, tiebreaker: "latest_round_score", multiplierSuperBowl: 3 },
      POSTSEASON_KEYS,
    );
    expect(values).toEqual({
      allow_join_after_draft_start: false,
      tiebreaker: "latest_round_score",
      multiplier_super_bowl: 3,
    });
  });
});
