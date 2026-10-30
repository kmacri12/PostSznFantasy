import { describe, expect, it } from "vitest";
import { valuesEqual } from "./dirty";

describe("valuesEqual", () => {
  it("treats a typed '5' as unchanged from the served 5", () => {
    expect(valuesEqual({ a: 5 }, { a: "5" })).toBe(true);
  });

  it("detects changed, added and removed fields", () => {
    expect(valuesEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(valuesEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(valuesEqual({ a: 1, b: 2 }, { a: 1 })).toBe(false);
  });

  it("compares booleans and strings", () => {
    expect(valuesEqual({ a: true, b: "x" }, { a: true, b: "x" })).toBe(true);
    expect(valuesEqual({ a: true }, { a: false })).toBe(false);
  });
});
