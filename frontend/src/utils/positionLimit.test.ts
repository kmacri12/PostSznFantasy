import { describe, expect, it } from "vitest";
import { formatLimit, limitFieldValue, limitFromField } from "./positionLimit";

describe("position limits", () => {
  it("never formats the stored 99 as a number", () => {
    expect(formatLimit(99)).toBe("No limit");
    expect(formatLimit("99")).toBe("No limit");
    expect(formatLimit(2)).toBe("2");
  });

  it("shows an empty field for no limit and saves an emptied field as 99", () => {
    expect(limitFieldValue(99)).toBe("");
    expect(limitFieldValue(3)).toBe(3);
    expect(limitFromField("")).toBe("99");
    expect(limitFromField(" 4 ")).toBe(" 4 ");
  });
});
