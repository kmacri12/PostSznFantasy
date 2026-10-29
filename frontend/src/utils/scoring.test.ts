import { describe, expect, it } from "vitest";
import { countChangedFromDefaults, toNumericScoring } from "./scoring";

describe("scoring utils", () => {
  it("coerces typed strings to numbers, treating blanks as 0", () => {
    expect(toNumericScoring({ a: "0.04", b: "", c: 4, d: "-1" })).toEqual({
      a: 0.04,
      b: 0,
      c: 4,
      d: -1,
    });
  });

  it("counts settings that differ from defaults, ignoring string/number typing", () => {
    const defaults = { a: 0.04, b: 4, c: 1 };
    expect(countChangedFromDefaults({ a: "0.04", b: 4, c: 1 }, defaults)).toBe(0);
    expect(countChangedFromDefaults({ a: "0.05", b: 6, c: 1 }, defaults)).toBe(2);
  });
});
