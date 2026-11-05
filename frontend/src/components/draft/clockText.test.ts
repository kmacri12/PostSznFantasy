import { describe, expect, it } from "vitest";
import type { DraftState } from "../../api/types";
import { clockText, roundAndPick } from "./clockText";

const base = {
  status: "in_progress",
  startTime: null,
  order: [
    { slot: 1, teamId: 10, teamName: "Alpha", ownerName: null },
    { slot: 2, teamId: 20, teamName: "Bravo", ownerName: null },
    { slot: 3, teamId: 30, teamName: "Charlie", ownerName: null },
    { slot: 4, teamId: 40, teamName: "Delta", ownerName: null },
  ],
  currentPickOverall: 8,
  onTheClockTeamId: 30,
  onDeckTeamId: 20,
  totalPicks: 12,
} as unknown as DraftState;

describe("clockText", () => {
  it("names round and pick, and turns green on my turn", () => {
    expect(roundAndPick(base)).toBe("Round 2, pick 4");
    expect(clockText(base, 30, 47, null)).toEqual({
      title: "You're on the clock",
      subtitle: "Round 2, pick 4",
      timer: "00:47",
      myTurn: true,
    });
  });

  it("names the team on the clock, and says when I am on deck", () => {
    const text = clockText(base, 20, 5, null);
    expect(text.title).toBe("Charlie on the clock");
    expect(text.subtitle).toBe("Round 2, pick 4 · you're on deck");
    expect(text.myTurn).toBe(false);
  });

  it("has no clock before the draft", () => {
    const unscheduled = clockText({ ...base, status: "unscheduled" }, 10, null, null);
    expect(unscheduled.title).toBe("Draft not scheduled yet");
    expect(unscheduled.timer).toBeNull();
    const scheduled = clockText(
      { ...base, status: "scheduled", startTime: "2030-01-05T19:00:00Z" },
      10,
      null,
      3600,
    );
    expect(scheduled.title).toMatch(/^Draft scheduled for /);
    expect(scheduled.subtitle).toBe("1h 0m to go");
    expect(scheduled.timer).toBeNull();
  });

  it("shows a paused draft with the frozen clock", () => {
    expect(clockText({ ...base, status: "paused" }, 10, 30, null).title).toBe("Draft paused");
  });
});
