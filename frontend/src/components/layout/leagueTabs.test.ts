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

  it("targets the league, own team, draft, feed and more", () => {
    expect(tabs.map((t) => t.label)).toEqual(["League", "Team", "Draft", "Feed", "More"]);
    expect(tabs.map((t) => t.to)).toEqual([
      "/leagues/7",
      "/leagues/7/teams/3",
      "/leagues/7/draft",
      "/leagues/7/feed",
      "/leagues/7/more",
    ]);
  });

  it("highlights one tab per route", () => {
    expect(activeTabIndex(tabs, "/leagues/7")).toBe(0);
    expect(activeTabIndex(tabs, "/leagues/7/seasons/2025")).toBe(0);
    expect(activeTabIndex(tabs, "/leagues/7/teams/9/points")).toBe(1);
    expect(activeTabIndex(tabs, "/leagues/7/draft")).toBe(2);
    expect(activeTabIndex(tabs, "/leagues/7/draft/board")).toBe(2);
    expect(activeTabIndex(tabs, "/leagues/7/seasons/2025/draft")).toBe(2);
    expect(activeTabIndex(tabs, "/leagues/7/feed")).toBe(3);
    expect(activeTabIndex(tabs, "/leagues/7/more")).toBe(4);
    expect(activeTabIndex(tabs, "/leagues/7/settings")).toBe(0);
    expect(activeTabIndex(tabs, "/players")).toBe(-1);
    expect(activeTabIndex(tabs, "/leagues/8")).toBe(-1);
  });

  it("puts the new-activity dot on the Feed tab only", () => {
    const dots = leagueTabs({ ...league, hasNewActivity: true }).map((t) => t.dot);
    expect(dots).toEqual([false, false, false, true, false]);
    expect(tabs.some((t) => t.dot)).toBe(false);
  });

  it("falls back to the league page when the user has no team", () => {
    expect(leagueTabs({ ...league, userTeamId: null })[1]?.to).toBe("/leagues/7");
  });
});
