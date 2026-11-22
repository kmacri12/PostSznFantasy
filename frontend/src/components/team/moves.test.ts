import { describe, expect, it } from "vitest";
import { lineupPlayer, roundLineup, slot } from "../../test/lineup";
import { moveOptions, normalizePosition, slotFillOptions } from "./moves";

const josh = lineupPlayer({ id: 1, name: "Josh Allen", position: "QB" });
const diggs = lineupPlayer({
  id: 2,
  name: "Stefon Diggs",
  position: "WR",
  kickoff: "2026-01-11T23:30:00Z",
});
const brian = lineupPlayer({ id: 3, name: "Brian Thomas", position: "WR" });
const cook = lineupPlayer({ id: 4, name: "James Cook", position: "RB", locked: true });
const tyler = lineupPlayer({ id: 5, name: "Tyler Bass", position: "K" });

const lineup = (overrides = {}) =>
  roundLineup(2, {
    slots: [
      slot(0, "QB", josh),
      slot(1, "WR", diggs),
      slot(2, "FLEX"),
      slot(3, "K", tyler),
      slot(4, "BENCH", brian),
      slot(5, "BENCH"),
    ],
    ...overrides,
  });

const titles = (options: ReturnType<typeof moveOptions>) => options.map((option) => option.title);

describe("moves for a bench player", () => {
  it("offers a swap with each starter he can replace and every empty slot he can fill", () => {
    const options = moveOptions(lineup(), brian, false);
    expect(titles(options)).toEqual(["Stefon Diggs", "Start at FLEX"]);
    expect(options[0]).toMatchObject({
      detail: expect.stringMatching(/^WR · [A-Z][a-z]{2} /),
      action: "Swap",
      move: { playerId: 3, slotIndex: 1 },
    });
    expect(options[1]).toMatchObject({
      detail: "Empty slot",
      action: "Start",
      move: { playerId: 3, slotIndex: 2 },
    });
  });

  it("lets a flex slot take a running back but not a quarterback", () => {
    expect(
      titles(moveOptions(lineup({ unassigned: [cook] }), { ...cook, locked: false }, false)),
    ).toEqual(["Start at FLEX"]);
    const bench = lineupPlayer({ id: 8, name: "Backup QB", position: "QB" });
    expect(titles(moveOptions(lineup({ unassigned: [bench] }), bench, false))).toEqual([
      "Josh Allen",
    ]);
  });

  it("greys out a swap with a locked starter, after the moves that work", () => {
    const locked = { ...diggs, locked: true };
    const options = moveOptions(
      lineup({ slots: [slot(1, "WR", locked), slot(2, "FLEX"), slot(4, "BENCH", brian)] }),
      brian,
      false,
    );
    expect(titles(options)).toEqual(["Start at FLEX", "Stefon Diggs"]);
    expect(options[1]).toMatchObject({
      detail: "WR · game started, locked",
      action: "Locked",
      move: null,
    });
  });

  it("greys out everything when the player himself is locked", () => {
    const options = moveOptions(lineup(), { ...brian, locked: true }, false);
    expect(options.every((option) => option.move === null)).toBe(true);
  });

  it("lets a commissioner pick locked options, marked as overrides", () => {
    const options = moveOptions(lineup(), { ...brian, locked: true }, true);
    expect(options.map((option) => option.action)).toEqual(["Override", "Override"]);
    expect(options[0]?.move).not.toBeNull();
  });

  it("numbers slots that share a name", () => {
    const options = moveOptions(
      roundLineup(1, {
        slots: [
          slot(0, "WR", diggs),
          slot(1, "WR", lineupPlayer({ id: 6, name: "Chase", position: "WR" })),
        ],
      }),
      brian,
      false,
    );
    expect(options.map((option) => option.detail.split(" · ")[0])).toEqual(["WR1", "WR2"]);
  });
});

describe("moves for a starter", () => {
  it("can always go to the bench, into an open bench slot", () => {
    const [bench] = moveOptions(lineup(), josh, false);
    expect(bench).toMatchObject({
      title: "Move to bench",
      action: "Bench",
      move: { playerId: 1, slotIndex: 5 },
    });
  });

  it("leaves the lineup entirely when the bench has no open slot", () => {
    const full = lineup({ slots: [slot(0, "QB", josh), slot(1, "BENCH", brian)] });
    expect(moveOptions(full, josh, false)[0]?.move).toEqual({ playerId: 1, slotIndex: null });
  });

  it("swaps with the bench players eligible for his slot, or moves to an empty slot he can play", () => {
    const options = moveOptions(lineup(), diggs, false);
    expect(titles(options)).toEqual(["Move to bench", "Brian Thomas", "Move to FLEX"]);
    expect(options[1]?.move).toEqual({ playerId: 3, slotIndex: 1 });
    expect(options[2]).toMatchObject({ action: "Move", move: { playerId: 2, slotIndex: 2 } });
  });

  it("swaps a WR at WR with a WR at FLEX in one move, without the bench", () => {
    const both = lineup({
      slots: [slot(0, "WR", diggs), slot(1, "FLEX", brian), slot(2, "BENCH")],
    });
    const fromWr = moveOptions(both, diggs, false).find((o) => o.title === "Brian Thomas");
    expect(fromWr).toMatchObject({
      detail: "FLEX · Game not scheduled",
      action: "Swap",
      move: { playerId: 2, slotIndex: 1 },
    });
    const fromFlex = moveOptions(both, brian, false).find((o) => o.title === "Stefon Diggs");
    expect(fromFlex?.move).toEqual({ playerId: 3, slotIndex: 0 });
  });

  it("moves RBs and TEs between their own slot and FLEX the same way", () => {
    const rb1 = lineupPlayer({ id: 6, name: "Rb One", position: "RB" });
    const rb2 = lineupPlayer({ id: 7, name: "Rb Two", position: "RB" });
    const te1 = lineupPlayer({ id: 8, name: "Te One", position: "TE" });
    const te2 = lineupPlayer({ id: 9, name: "Te Two", position: "TE" });
    const rbs = lineup({ slots: [slot(0, "RB", rb1), slot(1, "FLEX", rb2), slot(2, "BENCH")] });
    expect(moveOptions(rbs, rb2, false).find((o) => o.title === "Rb One")?.move).toEqual({
      playerId: 7,
      slotIndex: 0,
    });
    const tes = lineup({ slots: [slot(0, "TE", te1), slot(1, "FLEX", te2), slot(2, "BENCH")] });
    expect(moveOptions(tes, te1, false).find((o) => o.title === "Te Two")).toMatchObject({
      action: "Swap",
      move: { playerId: 8, slotIndex: 1 },
    });
  });

  it("moves a WR into a FLEX held by an RB, sending the RB to the bench", () => {
    const rb = lineupPlayer({ id: 6, name: "Rb Flex", position: "RB" });
    const mixed = lineup({
      slots: [slot(0, "WR", diggs), slot(1, "FLEX", rb), slot(2, "BENCH")],
    });
    expect(moveOptions(mixed, diggs, false).find((o) => o.key === "swap-slot-1")).toMatchObject({
      title: "Move to FLEX",
      detail: "Rb Flex goes to the bench",
      action: "Move",
      move: { playerId: 2, slotIndex: 1 },
    });
    // The RB can't play WR, so from FLEX there is no move into the WR slot.
    expect(titles(moveOptions(mixed, rb, false))).not.toContain("Stefon Diggs");
  });

  it("needs an open bench spot to send the other starter to", () => {
    const rb = lineupPlayer({ id: 6, name: "Rb Flex", position: "RB" });
    const full = lineup({
      slots: [slot(0, "WR", diggs), slot(1, "FLEX", rb), slot(2, "BENCH", brian)],
    });
    expect(moveOptions(full, diggs, false).find((o) => o.key === "swap-slot-1")).toBeUndefined();
  });

  it("cannot be benched once his game has started", () => {
    const options = moveOptions(lineup(), { ...diggs, locked: true }, false);
    expect(options[0]).toMatchObject({ action: "Locked", move: null });
  });
});

describe("moves for nobody", () => {
  it("offers nothing for an eliminated player", () => {
    expect(moveOptions(lineup(), lineupPlayer({ status: "eliminated" }), true)).toEqual([]);
  });
});

describe("normalizePosition", () => {
  it("reads the upstream's spellings", () => {
    expect(["DEF", "D/ST", "FB", "wr"].map(normalizePosition)).toEqual(["DST", "DST", "RB", "WR"]);
  });
});

describe("slotFillOptions", () => {
  it("lists the bench players who can play the empty slot, named after the player", () => {
    const options = slotFillOptions(
      roundLineup(2, {
        slots: [
          slot(0, "WR", lineupPlayer({ id: 2, name: "Stefon Diggs", position: "WR" })),
          slot(1, "WR"),
          slot(2, "BENCH", lineupPlayer({ id: 3, name: "Brian Thomas Jr.", position: "WR" })),
          slot(3, "BENCH", lineupPlayer({ id: 4, name: "James Cook", position: "RB" })),
        ],
      }),
      1,
      false,
    );
    expect(options.map((option) => option.title)).toEqual(["Brian Thomas Jr."]);
    expect(options[0]?.move).toEqual({ playerId: 3, slotIndex: 1 });
    expect(options[0]?.action).toBe("Start");
  });
});
