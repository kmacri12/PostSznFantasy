import { describe, expect, it } from "vitest";
import { signInDestination } from "./signInDestination";

describe("signInDestination", () => {
  it("goes straight to a single league", () => {
    expect(signInDestination([{ id: 12 }])).toBe("/leagues/12");
  });
  it("opens the leagues page for none or several", () => {
    expect(signInDestination([])).toBe("/");
    expect(signInDestination([{ id: 1 }, { id: 2 }])).toBe("/");
  });
});
