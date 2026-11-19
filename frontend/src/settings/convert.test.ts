import { describe, expect, it } from "vitest";
import { groupSummary } from "../components/settings/SettingsSection";
import { fromApi, postseasonFromApi, ROSTER_KEYS, SCORING_KEYS, toCamel } from "./convert";
import { POSTSEASON_KEYS } from "./postseasonFields";
import { SCORING_GROUPS } from "./scoringGroups";

describe("settings conversion", () => {
  it("matches pydantic's camel casing for numeric bands", () => {
    expect(toCamel("scoring_dst_yards_allowed_100_199")).toBe("scoringDstYardsAllowed100199");
    expect(toCamel("scoring_dst_pts_allowed_29_plus")).toBe("scoringDstPtsAllowed29Plus");
    expect(toCamel("number_teams")).toBe("numberTeams");
  });

  it("capitalises a letter after a digit like pydantic, so 2-point keys are found (#535)", () => {
    expect(toCamel("scoring_passing_2pt")).toBe("scoringPassing2Pt");
    const response = Object.fromEntries(SCORING_KEYS.map((key) => [toCamel(key), 1]));
    response.scoringPassing2Pt = 2;
    const values = fromApi(response, SCORING_KEYS);
    expect(Object.keys(values)).toHaveLength(SCORING_KEYS.length);
    for (const group of SCORING_GROUPS)
      expect(groupSummary(group, values)).not.toContain("undefined");
  });

  it("never prints undefined for a key the response lacks", () => {
    for (const group of SCORING_GROUPS) expect(groupSummary(group, {})).not.toContain("undefined");
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
      { allowJoinAfterDraftStart: false, mode: "latest", multiplierSuperBowl: 3 },
      [...POSTSEASON_KEYS, "mode"],
    );
    expect(values).toEqual({
      allow_join_after_draft_start: false,
      mode: "latest",
      multiplier_super_bowl: 3,
    });
  });
});
