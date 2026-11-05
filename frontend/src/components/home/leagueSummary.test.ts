import { describe, expect, it } from "vitest";
import { ordinal, phaseTag, rankText } from "./leagueSummary";

describe("leagueSummary", () => {
  it("writes ordinals", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal)).toEqual([
      "1st",
      "2nd",
      "3rd",
      "4th",
      "11th",
      "12th",
      "13th",
      "21st",
      "22nd",
    ]);
  });

  it("tags the phase", () => {
    const tag = (draftStatus: Parameters<typeof phaseTag>[0]["draftStatus"], finished = false) =>
      phaseTag({ draftStatus, finished }, { round: 3, gamesInProgress: 1 }, null);
    expect(tag("unscheduled").label).toBe("Draft not scheduled");
    expect(tag("in_progress")).toEqual({ label: "Draft live", live: true });
    expect(tag("completed")).toEqual({ label: "Conference Championship", live: true });
    expect(tag("completed", true).label).toBe("Season over");
  });

  it("marks shared ranks", () => {
    const rows = [
      { teamId: 1, rank: 1 },
      { teamId: 2, rank: 2 },
      { teamId: 3, rank: 2 },
    ];
    expect(rankText(rows, 1)).toBe("1st");
    expect(rankText(rows, 2)).toBe("T2");
    expect(rankText(rows, 9)).toBeNull();
    expect(rankText([{ teamId: 1, rank: null }], 1)).toBeNull();
  });
});
