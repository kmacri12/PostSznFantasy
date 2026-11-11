import { describe, expect, it } from "vitest";
import type { DraftPick, DraftState } from "../../api/types";
import { announcedDraft, draftAnnouncement } from "./draftAnnouncement";

const pick = { teamId: 10, playerName: "Josh Allen", numberPickOverall: 1 } as DraftPick;

const base = {
  status: "in_progress",
  startTime: null,
  order: [
    { slot: 1, teamId: 10, teamName: "Alpha", ownerName: null },
    { slot: 2, teamId: 20, teamName: "Bravo", ownerName: null },
  ],
  picks: [] as DraftPick[],
  currentPickOverall: 1,
  onTheClockTeamId: 10,
  onDeckTeamId: 20,
  totalPicks: 8,
} as unknown as DraftState;

const afterPick = { ...base, picks: [pick], currentPickOverall: 2, onTheClockTeamId: 20 };

describe("draftAnnouncement", () => {
  it("says nothing on the first render", () => {
    expect(draftAnnouncement(null, announcedDraft(base, 20, 60))).toBeNull();
  });

  it("announces a pick and who is on the clock next", () => {
    const before = announcedDraft(base, 20, 3);
    expect(draftAnnouncement(before, announcedDraft(afterPick, 20, 90))).toBe(
      "Pick 1: Alpha took Josh Allen. You are on the clock.",
    );
    expect(draftAnnouncement(announcedDraft(base, 30, 3), announcedDraft(afterPick, 30, 90))).toBe(
      "Pick 1: Alpha took Josh Allen. Bravo is on the clock.",
    );
  });

  it("stays quiet while only the clock ticks", () => {
    expect(
      draftAnnouncement(announcedDraft(base, 20, 59), announcedDraft(base, 20, 58)),
    ).toBeNull();
    expect(
      draftAnnouncement(announcedDraft(base, 10, 59), announcedDraft(base, 10, 58)),
    ).toBeNull();
    expect(
      draftAnnouncement(announcedDraft(base, 10, 29), announcedDraft(base, 10, 28)),
    ).toBeNull();
  });

  it("warns once at 30 and once at 10 seconds on my own pick only", () => {
    expect(draftAnnouncement(announcedDraft(base, 10, 31), announcedDraft(base, 10, 30))).toBe(
      "Under 30 seconds to make your pick.",
    );
    expect(draftAnnouncement(announcedDraft(base, 10, 11), announcedDraft(base, 10, 10))).toBe(
      "Under 10 seconds to make your pick.",
    );
    expect(
      draftAnnouncement(announcedDraft(base, 20, 31), announcedDraft(base, 20, 30)),
    ).toBeNull();
  });

  it("says who picks next after every pick, even the same team again", () => {
    const again = { ...afterPick, picks: [pick, { ...pick, teamId: 20, numberPickOverall: 2 }] };
    expect(draftAnnouncement(announcedDraft(afterPick, 20, 5), announcedDraft(again, 20, 90))).toBe(
      "Pick 2: Bravo took Josh Allen. You are on the clock.",
    );
  });

  it("says nothing before the draft starts", () => {
    const lobby = { ...base, status: "lobby", onTheClockTeamId: null } as DraftState;
    expect(
      draftAnnouncement(announcedDraft(lobby, 10, null), announcedDraft(lobby, 10, null)),
    ).toBeNull();
    expect(draftAnnouncement(announcedDraft(lobby, 20, null), announcedDraft(base, 20, 90))).toBe(
      "Alpha is on the clock.",
    );
  });

  it("announces a pause", () => {
    const paused = { ...base, status: "paused" } as DraftState;
    expect(draftAnnouncement(announcedDraft(base, 20, 40), announcedDraft(paused, 20, 40))).toBe(
      "The draft is on hold.",
    );
  });
});
