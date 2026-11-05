import { describe, expect, it } from "vitest";
import { lineupPlayer, roundLineup, slot } from "../../test/lineup";
import { moveOptions, normalizePosition } from "./moves";

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
    expect(titles(options)).toEqual(["Swap with Stefon Diggs", "Start at FLEX"]);
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
      "Swap with Josh Allen",
    ]);
  });

  it("greys out a swap with a locked starter, after the moves that work", () => {
    const locked = { ...diggs, locked: true };
    const options = moveOptions(
      lineup({ slots: [slot(1, "WR", locked), slot(2, "FLEX"), slot(4, "BENCH", brian)] }),
      brian,
      false,
    );
    expect(titles(options)).toEqual(["Start at FLEX", "Swap with Stefon Diggs"]);
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

  it("swaps with the bench players eligible for his slot", () => {
    const options = moveOptions(lineup(), diggs, false);
    expect(titles(options)).toEqual(["Move to bench", "Swap with Brian Thomas"]);
    expect(options[1]?.move).toEqual({ playerId: 3, slotIndex: 1 });
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
    expect(["DEF", "D/ST", "PK", "FB", "wr"].map(normalizePosition)).toEqual([
      "DST",
      "DST",
      "K",
      "RB",
      "WR",
    ]);
  });
});
