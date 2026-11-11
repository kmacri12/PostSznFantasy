import { afterEach, describe, expect, it, vi } from "vitest";
import { drawShareCard } from "./renderCard";
import type { ShareCard } from "./shareCards";

afterEach(() => vi.unstubAllGlobals());

/** A 2D context that records the text it is asked to draw; every other call does nothing. */
const recordingContext = () => {
  const texts: string[] = [];
  const ctx = new Proxy(
    {},
    {
      get: (_, name) => {
        if (name === "measureText") return (t: string) => ({ width: t.length * 10 });
        if (name === "fillText") return (t: string) => texts.push(t);
        return () => {};
      },
      set: () => true,
    },
  ) as unknown as CanvasRenderingContext2D;
  return { ctx, texts };
};

const base: ShareCard = {
  kind: "champion",
  leagueName: "Sunday League",
  eyebrow: "2026 champion",
  headline: "Gridiron Gang",
  subhead: "Pat",
  rows: [{ rank: 1, label: "Gridiron Gang", detail: "Pat", value: "210.5 pts" }],
  columns: [],
  fileName: "x.png",
};

describe("drawShareCard", () => {
  it("draws the league, the headline and the brand in both themes", () => {
    vi.stubGlobal("Path2D", class {});
    for (const mode of ["dark", "light"] as const) {
      const { ctx, texts } = recordingContext();
      drawShareCard(ctx, base, mode);
      expect(texts).toEqual(
        expect.arrayContaining(["PostSzn Fantasy", "Gridiron Gang", "Sunday League"]),
      );
    }
  });
  it("draws a draft grid of every team's picks", () => {
    vi.stubGlobal("Path2D", class {});
    const { ctx, texts } = recordingContext();
    drawShareCard(
      ctx,
      {
        ...base,
        kind: "draft",
        rows: [],
        columns: [
          { title: "Team A", lines: [{ text: "One", position: "QB" }] },
          { title: "Team B", lines: [{ text: "Two", position: "DST" }] },
        ],
      },
      "dark",
    );
    expect(texts).toEqual(expect.arrayContaining(["Team A", "One", "Team B", "Two"]));
  });
});
