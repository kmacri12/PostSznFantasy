import { describe, expect, it } from "vitest";
import { tokens } from "../../theme";
import { positionChipSx, positionColor } from "./positions";

describe("positionChipSx", () => {
  it("uses the board's colour for the position, whatever its spelling", () => {
    expect(positionChipSx("rb").bgcolor).toBe(tokens.posRB);
    expect(positionChipSx("DEF").bgcolor).toBe(positionColor("DST"));
  });

  it("leaves an unknown position uncoloured", () => {
    expect(positionChipSx("BN").bgcolor).toBe("transparent");
  });
});
