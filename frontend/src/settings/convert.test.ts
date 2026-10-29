import { describe, expect, it } from "vitest";
import { fromApi, postseasonFromApi, ROSTER_KEYS, SCORING_KEYS, toCamel } from "./convert";
import { POSTSEASON_KEYS } from "./postseasonFields";

describe("settings conversion", () => {
  it("matches pydantic's camel casing for numeric bands", () => {
    expect(toCamel("scoring_kicking_fg_made_0_19")).toBe("scoringKickingFgMade019");
    expect(toCamel("scoring_dst_pts_allowed_35_plus")).toBe("scoringDstPtsAllowed35Plus");
    expect(toCamel("number_teams")).toBe("numberTeams");
  });

  it("reads snake_case form state from a camelCase response", () => {
    const values = fromApi(
      { scoringPassingTd: 4, scoringKickingFgMade019: 3, rosterTotal: "x", other: 1 },
      [...SCORING_KEYS, ...ROSTER_KEYS],
    );
    expect(values).toEqual({ scoring_passing_td: 4, scoring_kicking_fg_made_0_19: 3 });
  });

  it("keeps booleans and enum strings for postseason settings", () => {
    const values = postseasonFromApi(
      { freeAgencyEnabled: true, rosterLock: "game_start", multiplierSuperBowl: 3 },
      POSTSEASON_KEYS,
    );
    expect(values).toEqual({
      free_agency_enabled: true,
      roster_lock: "game_start",
      multiplier_super_bowl: 3,
    });
  });
});
