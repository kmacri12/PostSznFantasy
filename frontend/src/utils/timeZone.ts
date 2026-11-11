/**
 * The one place that decides which time zone and clock a time is shown in: the member's saved
 * account preference (#405) when they set one, the browser's otherwise.
 */
export type HourCycle = "12" | "24";

export interface DisplayPreferences {
  timeZone: string | null;
  hourCycle: HourCycle | null;
}

const STORAGE_KEY = "postszn-display-prefs";

const isZone = (value: unknown): value is string => {
  if (typeof value !== "string") return false;
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
};

/** Remembered per device so the first paint after a reload already uses the saved zone. */
const readStored = (): DisplayPreferences => {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    return {
      timeZone: isZone(raw?.timeZone) ? raw.timeZone : null,
      hourCycle: raw?.hourCycle === "12" || raw?.hourCycle === "24" ? raw.hourCycle : null,
    };
  } catch {
    return { timeZone: null, hourCycle: null };
  }
};

let preferences: DisplayPreferences | null = null;

export const displayPreferences = (): DisplayPreferences => {
  preferences ??= readStored();
  return preferences;
};

/** Called with the account's saved values on sign-in and after the member changes them. */
export const setDisplayPreferences = (next: DisplayPreferences): void => {
  preferences = {
    timeZone: isZone(next.timeZone) ? next.timeZone : null,
    hourCycle: next.hourCycle ?? null,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Private mode: the preference still applies for this page load.
  }
};

export const clearDisplayPreferences = (): void =>
  setDisplayPreferences({ timeZone: null, hourCycle: null });

const savedTimeZone = (): string | null => displayPreferences().timeZone;

const hourCycleOption = (): Pick<Intl.DateTimeFormatOptions, "hourCycle"> => {
  const { hourCycle } = displayPreferences();
  return hourCycle ? { hourCycle: hourCycle === "24" ? "h23" : "h12" } : {};
};

export const browserTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** The IANA name, "America/New_York". */
export const viewerTimeZone = (): string => savedTimeZone() ?? browserTimeZone();

/** Every schedule time carries its zone abbreviation, so "8:00 PM EST" is never ambiguous. */
const zonedFormat = (options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat =>
  new Intl.DateTimeFormat(undefined, {
    ...hourCycleOption(),
    ...options,
    timeZone: viewerTimeZone(),
    timeZoneName: "short",
  });

/** A date or time in the viewer's zone and clock, without the zone abbreviation. */
export const formatPlainInViewerZone = (
  iso: string | number | Date,
  options: Intl.DateTimeFormatOptions,
): string =>
  new Intl.DateTimeFormat(undefined, {
    ...hourCycleOption(),
    ...options,
    timeZone: viewerTimeZone(),
  }).format(new Date(iso));

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
