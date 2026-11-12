/** Dates here are plain `YYYY-MM-DD` strings: a calendar day has no time zone of its own. */

const pad = (n: number) => String(n).padStart(2, "0");

export const isoDate = (year: number, month: number, day: number): string =>
  `${year}-${pad(month + 1)}-${pad(day)}`;

/** The year and zero-based month of a `YYYY-MM-DD` string. */
export const parseMonth = (iso: string): { year: number; month: number } => {
  const [year = 1970, month = 1] = iso.split("-").map(Number);
  return { year, month: month - 1 };
};

export const shiftMonth = (
  { year, month }: { year: number; month: number },
  delta: number,
): { year: number; month: number } => {
  const index = year * 12 + month + delta;
  return { year: Math.floor(index / 12), month: ((index % 12) + 12) % 12 };
};

/** One entry per grid cell of a Sunday-first month: `null` pads the days before the 1st. */
export const monthCells = (year: number, month: number): (number | null)[] => {
  const leading = new Date(Date.UTC(year, month, 1)).getUTCDay();
  const length = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return [...Array<null>(leading).fill(null), ...Array.from({ length }, (_, index) => index + 1)];
};

const utcFormat = (options: Intl.DateTimeFormatOptions, year: number, month: number, day = 1) =>
  new Intl.DateTimeFormat(undefined, { ...options, timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month, day)),
  );

export const monthTitle = (year: number, month: number): string =>
  utcFormat({ month: "long", year: "numeric" }, year, month);

/** "Wednesday, November 18, 2026": what a screen reader says and the summary line shows. */
export const longDate = (iso: string): string => {
  const [year = 1970, month = 1, day = 1] = iso.split("-").map(Number);
  return utcFormat(
    { weekday: "long", month: "long", day: "numeric", year: "numeric" },
    year,
    month - 1,
    day,
  );
};

/** Sun..Sat as two letters, in the viewer's language. */
export const weekdayInitials = (): string[] =>
  Array.from({ length: 7 }, (_, index) =>
    // 2023-01-01 was a Sunday.
    utcFormat({ weekday: "short" }, 2023, 0, 1 + index).slice(0, 2),
  );
