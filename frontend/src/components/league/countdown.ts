import { useEffect, useState } from "react";
import { formatInViewerZone } from "../../utils/timeZone";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "2d 4h 12m", dropping the leading units that are zero; seconds only in the last hour. */
export const formatCountdown = (ms: number): string => {
  if (ms <= 0) return "Starting now";
  const days = Math.floor(ms / DAY);
  const hours = Math.floor((ms % DAY) / HOUR);
  const minutes = Math.floor((ms % HOUR) / MINUTE);
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m ${Math.floor((ms % MINUTE) / 1000)}s`;
};

export const ordinal = (n: number): string => {
  const teens = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teens ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10];
  return `${n}${suffix ?? "th"}`;
};

/** The current time, re-read every second so a countdown ticks. */
export const useNow = (intervalMs = 1000): number => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
};

export const formatDraftTime = (iso: string): string =>
  formatInViewerZone(iso, {
    weekday: "long",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
