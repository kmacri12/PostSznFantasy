import { describe, expect, it } from "vitest";
import type { DraftState } from "../../api/types";
import { preflight } from "./preflight";

const draft = (overrides: Partial<DraftState> = {}): DraftState =>
  ({
    rounds: 3,
    draftType: "snake",
    timePerPickSeconds: 90,
    unassignedTeamIds: [],
    order: [
      { slot: 1, teamId: 1, teamName: "Alpha", ownerName: "ann", ownerUserId: 11 },
      { slot: 2, teamId: 2, teamName: "Bravo", ownerName: "bo", ownerUserId: 12 },
      { slot: 3, teamId: 3, teamName: "Charlie", ownerName: null, ownerUserId: null },
    ],
    ...overrides,
  }) as DraftState;

describe("preflight", () => {
  it("summarizes what starting locks in, who is online and who will be auto-picked", () => {
    const check = preflight(draft(), [11]);
    expect(check.orderComplete).toBe(true);
    expect(check.lines).toEqual([
      "2 of 3 teams have an owner.",
      "3 rounds, snake, 90 seconds per pick.",
      "The first pick belongs to Alpha.",
      "In the room now: ann.",
    ]);
    expect(check.warnings).toEqual([
      "1 team has no owner and will be auto-picked: Charlie.",
      "Not in the room: bo.",
    ]);
  });

  it("blocks starting until every team has a slot", () => {
    const check = preflight(draft({ unassignedTeamIds: [4] }), []);
    expect(check.orderComplete).toBe(false);
    expect(check.warnings[0]).toMatch(/every team needs a draft slot/i);
    expect(check.lines).toContain("Nobody is in the room yet.");
  });
});
