import { describe, expect, it } from "vitest";
import type { DraftState } from "../../api/types";
import { picksAwayLabel, picksUntilMyPick, teamOnPick } from "./pickOrder";

const draft = (over: Partial<DraftState>): DraftState => {
  const state = {
    status: "in_progress",
    draftType: "snake",
    order: [10, 20, 30].map((teamId, i) => ({
      slot: i + 1,
      teamId,
      teamName: `T${teamId}`,
      ownerName: null,
    })),
    currentPickOverall: 1,
    totalPicks: 9,
    ...over,
  } as unknown as DraftState;
  state.onTheClockTeamId = teamOnPick(state, state.currentPickOverall ?? 1);
  state.onDeckTeamId = teamOnPick(state, (state.currentPickOverall ?? 1) + 1);
  return state;
};

describe("teamOnPick", () => {
  it("snakes: the order reverses every other round", () => {
    const state = draft({});
    expect([1, 2, 3, 4, 5, 6, 7].map((n) => teamOnPick(state, n))).toEqual([
      10, 20, 30, 30, 20, 10, 10,
    ]);
  });

  it("repeats the order in a linear draft", () => {
    const state = draft({ draftType: "linear" });
    expect([3, 4, 5].map((n) => teamOnPick(state, n))).toEqual([30, 10, 20]);
  });

  it("is null past the last pick", () => {
    expect(teamOnPick(draft({}), 10)).toBeNull();
  });
});

describe("picks until my pick", () => {
  it("counts across the snake turn", () => {
    // Pick 2 is on the clock; team 30 picks 3 and 4, team 10 next at 6.
    const state = draft({ currentPickOverall: 2 });
    expect(picksUntilMyPick(state, 20)).toBe(0);
    expect(picksUntilMyPick(state, 30)).toBe(1);
    expect(picksUntilMyPick(state, 10)).toBe(4);
  });

  it("labels on deck, picks away, and nothing on my own turn", () => {
    const state = draft({ currentPickOverall: 2 });
    expect(picksAwayLabel(state, 30)).toBe("On deck");
    expect(picksAwayLabel(state, 10)).toBe("4 picks away");
    expect(picksAwayLabel(state, 20)).toBeNull();
  });

  it("is null when I have no pick left or no team", () => {
    const state = draft({ currentPickOverall: 9 });
    expect(picksAwayLabel(state, 20)).toBeNull();
    expect(picksAwayLabel(state, null)).toBeNull();
    expect(picksAwayLabel(draft({ status: "lobby" }), 10)).toBeNull();
  });
});
