import { describe, expect, it } from "vitest";
import { roundLineup } from "../../test/lineup";
import { defaultRound, emptyLineupWarning, formatKickoff } from "./lineup";

const lineup = roundLineup;

const NOW = new Date("2026-01-10T12:00:00Z");
const LATER = "2026-01-11T18:00:00Z";
const EARLIER = "2026-01-09T18:00:00Z";

describe("empty lineup warning", () => {
  it("names the nearest round with open starter slots before kickoff", () => {
    const lineups = [
      lineup(1, { emptyStarterSlots: 3, firstKickoff: EARLIER }),
      lineup(2, { emptyStarterSlots: 2, firstKickoff: LATER }),
    ];
    expect(emptyLineupWarning(lineups, 18, NOW)).toEqual({
      round: 2,
      emptyStarterSlots: 2,
      firstKickoff: LATER,
    });
  });

  it("is gone once the lineup is full or the round has kicked off", () => {
    expect(emptyLineupWarning([lineup(1, { firstKickoff: LATER })], 18, NOW)).toBeNull();
    expect(
      emptyLineupWarning([lineup(1, { emptyStarterSlots: 4, firstKickoff: EARLIER })], 18, NOW),
    ).toBeNull();
  });

  it("stays quiet before the draft fills a roster or while kickoff is unknown", () => {
    const empty = lineup(1, { emptyStarterSlots: 9, firstKickoff: LATER });
    expect(emptyLineupWarning([empty], 0, NOW)).toBeNull();
    expect(emptyLineupWarning([lineup(1, { emptyStarterSlots: 9 })], 18, NOW)).toBeNull();
  });
});

describe("defaultRound", () => {
  it("opens on the first round that has not kicked off", () => {
    const lineups = [
      lineup(1, { firstKickoff: EARLIER }),
      lineup(2, { firstKickoff: LATER }),
      lineup(3),
      lineup(4),
    ];
    expect(defaultRound(lineups, NOW)).toBe(2);
  });

  it("falls back to the latest scheduled round, then round one", () => {
    expect(defaultRound([lineup(1, { firstKickoff: EARLIER }), lineup(2)], NOW)).toBe(1);
    expect(defaultRound([lineup(1), lineup(2)], NOW)).toBe(1);
  });
});

describe("formatKickoff", () => {
  it("is the day and time of the game, never the word kickoff", () => {
    const text = formatKickoff("2026-01-11T23:30:00Z");
    expect(text).toMatch(/^[A-Z][a-z]{2} \d{1,2}:\d{2}( [ap]m)? \S+$/);
    expect(text.toLowerCase()).not.toContain("kickoff");
  });
});
