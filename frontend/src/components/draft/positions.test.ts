import { describe, expect, it } from "vitest";
import { tokens } from "../../theme";
import { positionChipSx } from "./positions";

describe("positionChipSx", () => {
  it("uses the tag colour for the position, whatever its spelling", () => {
    expect(positionChipSx("rb").bgcolor).toBe(tokens.tagRB);
    expect(positionChipSx("DEF").bgcolor).toBe(tokens.tagDST);
  });

  it("leaves an unknown position uncoloured", () => {
    expect(positionChipSx("BN").bgcolor).toBe("transparent");
  });
});
