import { describe, expect, it } from "vitest";
import { afterDraftPhase } from "./phase";

const KICKOFF = "2026-01-10T21:30:00Z";
const before = Date.parse(KICKOFF) - 1000;
const after = Date.parse(KICKOFF) + 1000;

describe("afterDraftPhase", () => {
  it("keeps lineups open until the first kickoff", () => {
    expect(afterDraftPhase({ firstKickoff: KICKOFF, gamesStarted: false, now: before })).toBe(
      "lineup",
    );
  });

  it("runs the playoffs from the first kickoff on", () => {
    expect(afterDraftPhase({ firstKickoff: KICKOFF, gamesStarted: false, now: after })).toBe(
      "playoffs",
    );
  });

  it("trusts the standings when a game is already live or final", () => {
    expect(afterDraftPhase({ firstKickoff: KICKOFF, gamesStarted: true, now: before })).toBe(
      "playoffs",
    );
  });

  it("falls back to the playoffs when the kickoff is unknown", () => {
    expect(afterDraftPhase({ firstKickoff: null, gamesStarted: false, now: before })).toBe(
      "playoffs",
    );
  });
});
