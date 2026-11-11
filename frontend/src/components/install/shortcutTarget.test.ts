import { describe, expect, it } from "vitest";
import { parseShortcut, shortcutTarget } from "./shortcutTarget";

const league = (over: Partial<Parameters<typeof shortcutTarget>[1][number]> = {}) => ({
  id: 7,
  season: 2026,
  finished: false,
  userTeamId: 42,
  ...over,
});

describe("parseShortcut", () => {
  it("accepts the three manifest shortcuts only", () => {
    expect(parseShortcut("?shortcut=draft")).toBe("draft");
    expect(parseShortcut("?shortcut=team")).toBe("team");
    expect(parseShortcut("?shortcut=feed")).toBe("feed");
    expect(parseShortcut("?shortcut=admin")).toBeNull();
    expect(parseShortcut("")).toBeNull();
  });
});

describe("shortcutTarget", () => {
  it("opens the league's Draft, Team and Feed pages", () => {
    expect(shortcutTarget("draft", [league()])).toBe("/leagues/7/draft");
    expect(shortcutTarget("feed", [league()])).toBe("/leagues/7/feed");
    expect(shortcutTarget("team", [league()])).toBe("/leagues/7/teams/42");
  });

  it("falls back to the league home without a team", () => {
    expect(shortcutTarget("team", [league({ userTeamId: null })])).toBe("/leagues/7");
  });

  it("prefers a league still being played", () => {
    const done = league({ id: 1, finished: true });
    expect(shortcutTarget("draft", [done, league({ id: 2 })])).toBe("/leagues/2/draft");
    expect(shortcutTarget("draft", [done])).toBe("/leagues/1/draft");
  });

  it("has nowhere to go without a league", () => {
    expect(shortcutTarget("draft", [])).toBeNull();
  });
});
