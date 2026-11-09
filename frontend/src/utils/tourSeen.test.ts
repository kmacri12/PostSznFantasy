import { beforeEach, describe, expect, it } from "vitest";
import { isTourTrigger, markTourSeen, tourSeen } from "./tourSeen";

describe("tourSeen", () => {
  beforeEach(() => localStorage.clear());

  it("is unseen until marked, per account", () => {
    expect(tourSeen(1)).toBe(false);
    markTourSeen(1);
    expect(tourSeen(1)).toBe(true);
    expect(tourSeen(2)).toBe(false);
  });

  it("counts as seen when the device cannot remember", () => {
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error("blocked");
    };
    try {
      expect(tourSeen(1)).toBe(true);
    } finally {
      Storage.prototype.getItem = original;
    }
  });

  it("starts only after joining or creating a league", () => {
    expect(isTourTrigger({ joinedLeague: true })).toBe(true);
    expect(isTourTrigger({ createdLeague: true })).toBe(true);
    expect(isTourTrigger(null)).toBe(false);
    expect(isTourTrigger({})).toBe(false);
  });
});
