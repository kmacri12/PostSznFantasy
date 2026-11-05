import { describe, expect, it } from "vitest";
import { STANDINGS_REFRESH_MS, standingsRefetchInterval } from "./queries";
import type { Standings } from "./types";

const standings = (gamesInProgress: number) => ({ gamesInProgress }) as Standings;

describe("standingsRefetchInterval", () => {
  it("polls only while a game is live", () => {
    expect(standingsRefetchInterval(standings(1))).toBe(STANDINGS_REFRESH_MS);
    expect(standingsRefetchInterval(standings(0))).toBe(false);
    expect(standingsRefetchInterval(undefined)).toBe(false);
  });
});
