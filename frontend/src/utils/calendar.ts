export interface CalendarEvent {
  /** Stable per appointment, so adding it again updates the entry instead of duplicating it. */
  uid: string;
  title: string;
  start: string;
  durationMinutes: number;
  description: string;
  url: string;
  reminderMinutes: number;
}

const stamp = (iso: string): string => new Date(iso).toISOString().replace(/[-:]|\.\d{3}/g, "");

const escapeText = (text: string): string =>
  text.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** RFC 5545 lines stop at 75 octets; the rest continues on a line that starts with a space. */
const fold = (line: string): string => {
  const encoder = new TextEncoder();
  const pieces: string[] = [];
  let current = "";
  for (const char of line) {
    const limit = pieces.length === 0 ? 75 : 74;
    if (encoder.encode(current + char).length > limit) {
      pieces.push(current);
      current = char;
    } else {
      current += char;
    }
  }
  pieces.push(current);
  return pieces.join("\r\n ");
};

export const buildIcs = (event: CalendarEvent, now: Date = new Date()): string => {
  const end = new Date(Date.parse(event.start) + event.durationMinutes * 60_000).toISOString();
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PostSzn Fantasy//Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `DTSTAMP:${stamp(now.toISOString())}`,
    `DTSTART:${stamp(event.start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(event.description)}`,
    `URL:${event.url}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeText(event.title)}`,
    `TRIGGER:-PT${event.reminderMinutes}M`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.map(fold).join("\r\n")}\r\n`;
};

export const googleCalendarUrl = (event: CalendarEvent): string => {
  const end = new Date(Date.parse(event.start) + event.durationMinutes * 60_000).toISOString();
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates: `${stamp(event.start)}/${stamp(end)}`,
    details: `${event.description}\n${event.url}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};

/** A saved .ics opens in the Calendar app on iPhone and in Google Calendar on Android. */
export const downloadIcs = (event: CalendarEvent, filename: string): void => {
  const blob = new Blob([buildIcs(event)], { type: "text/calendar;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 10_000);
};

export const draftCalendarEvent = (args: {
  seasonId: number;
  leagueName: string;
  start: string;
  url: string;
}): CalendarEvent => ({
  uid: `draft-${args.seasonId}@postsznfantasy`,
  title: `${args.leagueName} draft`,
  start: args.start,
  durationMinutes: 120,
  description: `Draft night for ${args.leagueName}. Your commissioner starts the draft.`,
  url: args.url,
  reminderMinutes: 15,
});

export const lockCalendarEvent = (args: {
  seasonId: number;
  round: number;
  roundLabel: string;
  leagueName: string;
  start: string;
  url: string;
}): CalendarEvent => ({
  uid: `lock-${args.seasonId}-${args.round}@postsznfantasy`,
  title: `${args.leagueName}: ${args.roundLabel} lineups lock`,
  start: args.start,
  durationMinutes: 30,
  description: `The first ${args.roundLabel} game kicks off. Set your lineup before then.`,
  url: args.url,
  reminderMinutes: 15,
});
