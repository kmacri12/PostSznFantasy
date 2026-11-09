import { describe, expect, it } from "vitest";
import { countChangedFromDefaults, scoringProblems, toNumericScoring } from "./scoring";

describe("scoring utils", () => {
  it("coerces typed strings to numbers and never turns a blank into 0", () => {
    const numeric = toNumericScoring({ a: "0.04", b: "", c: 4, d: "-1", e: "1." });
    expect(numeric).toMatchObject({ a: 0.04, c: 4, d: -1 });
    expect(numeric.b).toBeNaN();
  });

  it("reports blank, half-typed and out-of-range values", () => {
    const problems = scoringProblems({
      ok: "0.04",
      blank: "",
      dash: "-",
      dot: "1.",
      big: "500",
      n: 4,
    });
    expect(Object.keys(problems).sort()).toEqual(["big", "blank", "dash", "dot"]);
    expect(problems.blank).toMatch(/Required/);
  });

  it("counts settings that differ from defaults, ignoring string/number typing", () => {
    const defaults = { a: 0.04, b: 4, c: 1 };
    expect(countChangedFromDefaults({ a: "0.04", b: 4, c: 1 }, defaults)).toBe(0);
    expect(countChangedFromDefaults({ a: "0.05", b: 6, c: 1 }, defaults)).toBe(2);
  });
});
