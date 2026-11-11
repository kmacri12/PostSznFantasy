/**
 * The one place that decides which time zone a time is shown in. Today it is the browser's;
 * a saved account preference (#405) plugs in at `savedTimeZone` and nothing else changes.
 */
const savedTimeZone = (): string | null => null;

const browserTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** The IANA name, "America/New_York". */
export const viewerTimeZone = (): string => savedTimeZone() ?? browserTimeZone();

/** Every schedule time carries its zone abbreviation, so "8:00 PM EST" is never ambiguous. */
const zonedFormat = (options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat =>
  new Intl.DateTimeFormat(undefined, {
    ...options,
    timeZone: viewerTimeZone(),
    timeZoneName: "short",
  });

export const formatInViewerZone = (
  iso: string | number | Date,
  options: Intl.DateTimeFormatOptions,
): string => zonedFormat(options).format(new Date(iso));

export const partsInViewerZone = (
  iso: string | number | Date,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormatPart[] => zonedFormat(options).formatToParts(new Date(iso));

/** "Eastern Standard Time (America/New_York)": the zone the commissioner's picker is in. */
export const describeViewerZone = (at: Date = new Date()): string => {
  const zone = viewerTimeZone();
  const long = new Intl.DateTimeFormat(undefined, { timeZone: zone, timeZoneName: "long" })
    .formatToParts(at)
    .find((part) => part.type === "timeZoneName")?.value;
  return long ? `${long} (${zone})` : zone;
};

/** The zone's UTC offset at an instant, in ms (negative west of Greenwich). */
const offsetMs = (utcMs: number, zone: string): number => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(new Date(utcMs));
  const n = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second"));
  return asUtc - Math.floor(utcMs / 1000) * 1000;
};

const pad = (n: number) => String(n).padStart(2, "0");

/** An ISO instant as the `YYYY-MM-DDTHH:mm` a datetime-local field holds, on the viewer's wall clock. */
export const toZonedInput = (iso: string | null): string => {
  if (!iso) return "";
  const utc = Date.parse(iso);
  const wall = new Date(utc + offsetMs(utc, viewerTimeZone()));
  return `${wall.getUTCFullYear()}-${pad(wall.getUTCMonth() + 1)}-${pad(wall.getUTCDate())}T${pad(wall.getUTCHours())}:${pad(wall.getUTCMinutes())}`;
};

/**
 * The instant for a datetime-local value read on the viewer's wall clock. A time the spring
 * clock change skips lands an hour later (2:30 becomes 3:30); an autumn time that happens
 * twice takes the first.
 */
export const fromZonedInput = (value: string): string => {
  const [year = 0, month = 1, day = 1, hour = 0, minute = 0] = value.split(/[-T:]/).map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const zone = viewerTimeZone();
  const guess = wall - offsetMs(wall, zone);
  let instant = wall - offsetMs(guess, zone);
  if (toZonedInput(new Date(instant).toISOString()) !== value) instant += 3_600_000;
  return new Date(instant).toISOString();
};
