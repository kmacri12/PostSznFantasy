import { describe, expect, it } from "vitest";
import type { LeagueByUser } from "../../api/types";
import { groupBySeason } from "./seasons";

const league = (id: number, season: number): LeagueByUser => ({
  id,
  leagueId: id,
  name: `League ${id}`,
  season,
  isCommissioner: false,
  userTeamId: null,
  hasNewActivity: false,
  finished: false,
});

describe("groupBySeason", () => {
  it("puts the newest season first and keeps each season's order", () => {
    const groups = groupBySeason([league(1, 2025), league(2, 2026), league(3, 2025)]);
    expect(groups.map((group) => group.season)).toEqual([2026, 2025]);
    expect(groups[1]?.leagues.map((entry) => entry.id)).toEqual([1, 3]);
  });

  it("returns nothing for no leagues", () => {
    expect(groupBySeason([])).toEqual([]);
  });
});
