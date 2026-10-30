import { describe, expect, it } from "vitest";
import { activeTabIndex, leagueTabs } from "./leagueTabs";

const league = { id: 7, name: "L", season: 2026, isCommissioner: false, userTeamId: 3 };

describe("leagueTabs", () => {
  const tabs = leagueTabs(league);

  it("targets the league, own team, draft and players", () => {
    expect(tabs.map((t) => t.to)).toEqual([
      "/league/7",
      "/team/3",
      "/league/7/draft",
      "/players?leagueId=7",
    ]);
  });

  it("highlights one tab per route", () => {
    expect(activeTabIndex(tabs, "/league/7")).toBe(0);
    expect(activeTabIndex(tabs, "/team/9")).toBe(1);
    expect(activeTabIndex(tabs, "/league/7/draft")).toBe(2);
    expect(activeTabIndex(tabs, "/players")).toBe(3);
    expect(activeTabIndex(tabs, "/settings")).toBe(-1);
  });

  it("falls back to the league page when the user has no team", () => {
    expect(leagueTabs({ ...league, userTeamId: null })[1]?.to).toBe("/league/7");
  });
});
