import { describe, expect, it } from "vitest";
import { loadCardAssets } from "./pictureAssets";
import type { ShareCard } from "./shareCards";

const card = (team: object): ShareCard => ({
  kind: "recap",
  leagueName: "L",
  eyebrow: "Wild Card recap",
  headline: "L",
  subhead: "",
  rows: [],
  columns: [],
  fileName: "x.png",
  highlights: [
    { label: "a", text: "b", emoji: "⭐", tone: "gold", stat: null, team: team as never },
  ],
});

describe("loadCardAssets", () => {
  it("finds the outline of a generated picture's icon", async () => {
    const assets = await loadCardAssets(
      card({ name: "Kmac", avatarUrl: null, picture: { color: 0, icon: 1 } }),
    );
    expect(assets.iconPaths.get(1)).toMatch(/^M/);
    expect(assets.avatars.size).toBe(0);
  });

  it("includes the paw's circle toes, not just its pad", async () => {
    const assets = await loadCardAssets(
      card({ name: "Kmac", avatarUrl: null, picture: { color: 0, icon: 10 } }),
    );
    // Four toes as arcs, besides the pad's path.
    expect(assets.iconPaths.get(10)?.match(/a2\.5 2\.5 0 1 0/g)).toHaveLength(8);
  });

  it("needs nothing for a team without a picture", async () => {
    const assets = await loadCardAssets(card({ name: "Kmac", avatarUrl: null, picture: null }));
    expect(assets.iconPaths.size + assets.avatars.size).toBe(0);
  });
});
