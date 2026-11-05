import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LOGO_STROKES } from "./logoGeometry";

describe("logo geometry", () => {
  const tile = readFileSync("src/assets/logo-tile.svg", "utf8");

  it("is the same set of strokes the tile draws", () => {
    for (const { d, width, cap } of LOGO_STROKES) {
      expect(tile).toContain(
        `<path d="${d}" stroke="#04233d" stroke-width="${width}" stroke-linecap="${cap}"`,
      );
    }
  });
});
