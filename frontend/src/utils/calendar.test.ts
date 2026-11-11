import { describe, expect, it } from "vitest";
import { buildIcs, draftCalendarEvent, googleCalendarUrl, lockCalendarEvent } from "./calendar";

const draft = draftCalendarEvent({
  seasonId: 7,
  leagueName: "Sunday, Funday; League",
  start: "2027-01-10T01:00:00.000Z",
  url: "https://postsznfantasy.com/leagues/1/draft",
});

describe("buildIcs", () => {
  const ics = buildIcs(draft, new Date("2026-12-01T12:00:00Z"));

  it("is a CRLF calendar with a UTC start and a 15 minute reminder", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART:20270110T010000Z\r\n");
    expect(ics).toContain("DTEND:20270110T030000Z\r\n");
    expect(ics).toContain("DTSTAMP:20261201T120000Z\r\n");
    expect(ics).toContain("TRIGGER:-PT15M\r\n");
    expect(ics).toContain("UID:draft-7@postsznfantasy\r\n");
  });

  it("carries the league name, escaped", () => {
    expect(ics).toContain("SUMMARY:Sunday\\, Funday\\; League draft\r\n");
  });

  it("folds long lines at 75 octets", () => {
    for (const line of ics.split("\r\n"))
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });
});

describe("googleCalendarUrl", () => {
  it("fills the template with the UTC window", () => {
    const url = new URL(googleCalendarUrl(draft));
    expect(url.origin).toBe("https://calendar.google.com");
    expect(url.searchParams.get("dates")).toBe("20270110T010000Z/20270110T030000Z");
    expect(url.searchParams.get("text")).toBe("Sunday, Funday; League draft");
  });
});

describe("lockCalendarEvent", () => {
  it("is one entry per season and round", () => {
    const lock = lockCalendarEvent({
      seasonId: 7,
      round: 2,
      roundLabel: "Divisional",
      leagueName: "L",
      start: "2027-01-17T21:30:00Z",
      url: "https://x.test/",
    });
    expect(lock.uid).toBe("lock-7-2@postsznfantasy");
    expect(lock.title).toBe("L: Divisional lineups lock");
  });
});
