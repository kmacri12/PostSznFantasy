import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearDisplayPreferences,
  describeViewerZone,
  formatInViewerZone,
  formatPlainInViewerZone,
  fromZonedInput,
  setDisplayPreferences,
  toZonedInput,
  viewerTimeZone,
} from "./timeZone";

const originalZone = process.env.TZ;
const useZone = (zone: string) => {
  process.env.TZ = zone;
};

beforeEach(() => useZone("America/New_York"));
afterEach(() => {
  if (originalZone === undefined) delete process.env.TZ;
  else process.env.TZ = originalZone;
});

const TIME = { hour: "numeric", minute: "2-digit" } as const;

describe("formatInViewerZone", () => {
  it("shows the zone abbreviation and shifts with the viewer's zone", () => {
    const iso = "2027-01-10T01:00:00Z";
    expect(viewerTimeZone()).toBe("America/New_York");
    expect(formatInViewerZone(iso, TIME)).toMatch(/^8:00\s?PM EST$/);
    useZone("America/Los_Angeles");
    expect(formatInViewerZone(iso, TIME)).toMatch(/^5:00\s?PM PST$/);
  });

  it("uses daylight time in summer", () => {
    expect(formatInViewerZone("2027-07-10T00:00:00Z", TIME)).toMatch(/^8:00\s?PM EDT$/);
  });
});

describe("describeViewerZone", () => {
  it("names the zone and its IANA id", () => {
    expect(describeViewerZone(new Date("2027-01-10T00:00:00Z"))).toBe(
      "Eastern Standard Time (America/New_York)",
    );
  });
});

describe("datetime-local round trip", () => {
  it("reads the picker on the viewer's wall clock, not the machine's", () => {
    useZone("America/Los_Angeles");
    expect(fromZonedInput("2027-01-09T20:00")).toBe("2027-01-10T04:00:00.000Z");
    expect(toZonedInput("2027-01-10T04:00:00.000Z")).toBe("2027-01-09T20:00");
  });

  it("handles the spring clock change: a skipped time lands an hour later", () => {
    // 2027-03-14, 2:30 AM does not exist in New York.
    expect(fromZonedInput("2027-03-14T01:30")).toBe("2027-03-14T06:30:00.000Z");
    expect(fromZonedInput("2027-03-14T02:30")).toBe("2027-03-14T07:30:00.000Z");
    expect(fromZonedInput("2027-03-14T03:30")).toBe("2027-03-14T07:30:00.000Z");
  });

  it("handles the autumn clock change: a repeated time takes the first", () => {
    // 2027-11-07, 1:30 AM happens twice in New York.
    expect(fromZonedInput("2027-11-07T01:30")).toBe("2027-11-07T05:30:00.000Z");
    expect(fromZonedInput("2027-11-07T02:30")).toBe("2027-11-07T07:30:00.000Z");
    expect(toZonedInput("2027-11-07T06:30:00.000Z")).toBe("2027-11-07T01:30");
  });

  it("is empty for no time", () => {
    expect(toZonedInput(null)).toBe("");
  });
});

describe("saved display preferences", () => {
  afterEach(() => clearDisplayPreferences());

  it("shows times in the saved zone instead of the browser's", () => {
    setDisplayPreferences({ timeZone: "America/Los_Angeles", hourCycle: null });
    expect(viewerTimeZone()).toBe("America/Los_Angeles");
    expect(formatInViewerZone("2027-01-10T01:00:00Z", TIME)).toMatch(/^5:00\s?PM PST$/);
  });

  it("follows the browser again once cleared", () => {
    setDisplayPreferences({ timeZone: "Asia/Tokyo", hourCycle: null });
    clearDisplayPreferences();
    expect(viewerTimeZone()).toBe("America/New_York");
  });

  it("ignores a zone the browser does not know", () => {
    setDisplayPreferences({ timeZone: "Mars/Base", hourCycle: null });
    expect(viewerTimeZone()).toBe("America/New_York");
  });

  it("forces a 24-hour or a 12-hour clock", () => {
    const iso = "2027-01-10T01:00:00Z";
    setDisplayPreferences({ timeZone: null, hourCycle: "24" });
    expect(formatInViewerZone(iso, TIME)).toMatch(/^20:00 EST$/);
    expect(formatPlainInViewerZone(iso, TIME)).toBe("20:00");
    setDisplayPreferences({ timeZone: null, hourCycle: "12" });
    expect(formatPlainInViewerZone(iso, TIME)).toMatch(/^8:00\s?PM$/);
  });

  it("is remembered on this device for the next page load", () => {
    setDisplayPreferences({ timeZone: "Europe/London", hourCycle: "24" });
    expect(JSON.parse(localStorage.getItem("postszn-display-prefs") ?? "null")).toEqual({
      timeZone: "Europe/London",
      hourCycle: "24",
    });
  });
});
