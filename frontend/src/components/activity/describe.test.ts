import { describe, expect, it } from "vitest";
import type { ActivityEvent } from "../../api/types";
import { describeEvent, detailLines, settingLabel } from "./describe";

const base = {
  id: 1,
  createdAt: "2030-01-11T19:00:00Z",
  teamId: 4,
  teamName: "Alpha",
  actorUserId: 2,
  actorName: "ann",
  isNew: false,
};
const move = {
  round: 1,
  playerId: 9,
  playerName: "Josh Allen",
  fromSlot: null,
  toSlot: "QB",
  displaced: null,
  changedSlots: [0],
  byCommissioner: false,
};

describe("describeEvent", () => {
  it("says who moved whom where", () => {
    const event: ActivityEvent = { ...base, kind: "lineup_move", payload: move };
    expect(describeEvent(event)).toBe(
      "ann moved Josh Allen to QB in the Wild Card lineup for Alpha",
    );
  });

  it("names a swap and the bench", () => {
    const event: ActivityEvent = {
      ...base,
      kind: "lineup_move",
      payload: {
        ...move,
        toSlot: "BENCH",
        displaced: { playerId: 3, playerName: "Pat", toSlot: "QB" },
      },
    };
    expect(describeEvent(event)).toContain("to the bench");
    expect(describeEvent(event)).toContain("swapping out Pat");
  });

  it("marks a commissioner override as after kickoff", () => {
    const event: ActivityEvent = {
      ...base,
      kind: "commissioner_override",
      payload: { ...move, byCommissioner: true },
    };
    expect(describeEvent(event)).toContain("(commissioner)");
    expect(describeEvent(event)).toContain("after kickoff");
  });

  it("reports a taken-out player", () => {
    const event: ActivityEvent = {
      ...base,
      kind: "lineup_move",
      payload: { ...move, toSlot: null },
    };
    expect(describeEvent(event)).toContain("took Josh Allen out of the Wild Card lineup");
  });

  it("reports a stat correction with old and new score", () => {
    const event: ActivityEvent = {
      ...base,
      actorName: null,
      kind: "stat_correction",
      payload: {
        round: 2,
        gameId: "g",
        playerId: 9,
        playerName: "Josh Allen",
        previousPoints: 10,
        newPoints: 12.5,
      },
    };
    expect(describeEvent(event)).toBe("Josh Allen's Divisional score changed from 10 to 12.5");
  });
});

describe("settings changes", () => {
  const event: ActivityEvent = {
    ...base,
    teamId: null,
    teamName: null,
    kind: "settings_change",
    payload: {
      changes: [
        { field: "scoringPassingTd", before: 4, after: 6 },
        { field: "allowJoinAfterDraftStart", before: true, after: false },
      ],
    },
  };

  it("counts the changes in the sentence and lists old → new beneath", () => {
    expect(describeEvent(event)).toBe("ann changed 2 settings");
    expect(detailLines(event)).toEqual([
      "Scoring passing td: 4 → 6",
      "Allow join after draft start: on → off",
    ]);
  });

  it("turns a field name into words", () => {
    expect(settingLabel("multiplierSuperBowl")).toBe("Multiplier super bowl");
  });
});

describe("describeEvent for membership", () => {
  const league = { ...base, teamId: null, teamName: null };

  it("describes league creation", () => {
    const event: ActivityEvent = {
      ...league,
      kind: "league_created",
      payload: { leagueName: "Sunday Gang" },
    };
    expect(describeEvent(event)).toBe("ann created the league Sunday Gang");
  });

  it("describes a creator and a later member joining", () => {
    const creator: ActivityEvent = {
      ...league,
      kind: "membership_joined",
      payload: { role: "commissioner", teamName: "Team 1" },
    };
    const member: ActivityEvent = {
      ...league,
      kind: "membership_joined",
      payload: { role: "member", teamName: null },
    };
    expect(describeEvent(creator)).toBe("ann joined as commissioner and took Team 1");
    expect(describeEvent(member)).toBe("ann joined");
  });

  it("tells leaving from being removed", () => {
    const left: ActivityEvent = {
      ...league,
      kind: "membership_left",
      payload: { userId: 2, userName: "ann" },
    };
    expect(describeEvent(left)).toBe("ann left the league");
    expect(describeEvent({ ...left, actorUserId: 9, actorName: "cy" })).toBe(
      "ann was removed from the league by cy",
    );
  });

  it("describes promotions, demotions and backfilled promotions", () => {
    const promoted: ActivityEvent = {
      ...league,
      kind: "role_changed",
      payload: { userId: 5, userName: "bob", role: "commissioner" },
    };
    expect(describeEvent(promoted)).toBe("ann made bob a commissioner");
    expect(describeEvent({ ...promoted, payload: { ...promoted.payload, role: "member" } })).toBe(
      "ann made bob a regular member, no longer a commissioner",
    );
    expect(describeEvent({ ...promoted, actorUserId: null, actorName: null })).toBe(
      "bob became commissioner",
    );
  });
});
