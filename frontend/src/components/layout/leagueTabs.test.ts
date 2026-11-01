import { describe, expect, it } from "vitest";
import { activeTabIndex, leagueTabs } from "./leagueTabs";

const league = {
  id: 7,
  name: "L",
  seasonId: 70,
  season: 2026,
  isCommissioner: false,
  userTeamId: 3,
  hasNewActivity: false,
  finished: false,
  draftStatus: "unscheduled" as const,
  seasons: [],
};

describe("leagueTabs", () => {
  const tabs = leagueTabs(league);

  it("targets the league, own team, draft and players", () => {
    expect(tabs.map((t) => t.to)).toEqual([
      "/leagues/7/seasons/2026",
      "/leagues/7/seasons/2026/teams/3",
      "/leagues/7/seasons/2026/draft",
      "/leagues/7/seasons/2026/players",
    ]);
  });

  it("highlights one tab per route", () => {
    expect(activeTabIndex(tabs, "/leagues/7/seasons/2026")).toBe(0);
    expect(activeTabIndex(tabs, "/leagues/7/seasons/2025")).toBe(0);
    expect(activeTabIndex(tabs, "/leagues/7/seasons/2026/teams/9/points")).toBe(1);
    expect(activeTabIndex(tabs, "/leagues/7/seasons/2026/draft")).toBe(2);
    expect(activeTabIndex(tabs, "/leagues/7/seasons/2026/players")).toBe(3);
    expect(activeTabIndex(tabs, "/players")).toBe(3);
    expect(activeTabIndex(tabs, "/leagues/7/seasons/2026/settings")).toBe(-1);
  });

  it("puts the new-activity dot on the League tab only", () => {
    const dots = leagueTabs({ ...league, hasNewActivity: true }).map((t) => t.dot);
    expect(dots).toEqual([true, false, false, false]);
    expect(tabs.some((t) => t.dot)).toBe(false);
  });

  it("falls back to the league page when the user has no team", () => {
    expect(leagueTabs({ ...league, userTeamId: null })[1]?.to).toBe("/leagues/7/seasons/2026");
  });
});
