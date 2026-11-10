import { describe, expect, it } from "vitest";
import { maskEmail } from "./maskEmail";

describe("maskEmail", () => {
  it("keeps the first letter and the domain", () => {
    expect(maskEmail("pat@x.co")).toBe("p**@x.co");
  });

  it("caps the stars so a long name does not wrap", () => {
    expect(maskEmail("patricia.longname@x.co")).toBe("p******@x.co");
  });

  it("leaves a one-letter name and non-addresses alone", () => {
    expect(maskEmail("p@x.co")).toBe("p@x.co");
    expect(maskEmail("nonsense")).toBe("nonsense");
  });
});
