import { captureError, scrubText } from "./sentry";

type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

const LEVEL_ORDER: Record<LogLevel, number> = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };

// Debug/info are dev-only so production consoles only show problems.
const MIN_LEVEL: LogLevel = import.meta.env.DEV ? "DEBUG" : "WARN";

const CONSOLE_METHOD = {
  DEBUG: "debug",
  INFO: "info",
  WARN: "warn",
  ERROR: "error",
} as const;

export interface LogEntry {
  time: string;
  level: LogLevel;
  scope: string;
  message: string;
}

// What "Report a problem" attaches. Every level is kept, even those the console hides, but only
// the scrubbed message: context objects could hold chat text or other members' data.
const MAX_BUFFERED_ENTRIES = 50;
const buffer: LogEntry[] = [];

const remember = (level: LogLevel, scope: string, message: string): void => {
  buffer.push({ time: new Date().toISOString(), level, scope, message: scrubText(message) });
  if (buffer.length > MAX_BUFFERED_ENTRIES) buffer.shift();
};

export const recentLogEntries = (): LogEntry[] => buffer.map((entry) => ({ ...entry }));

export const clearLogBuffer = (): void => {
  buffer.length = 0;
};

export interface Logger {
  debug: (message: string, ...context: unknown[]) => void;
  info: (message: string, ...context: unknown[]) => void;
  warn: (message: string, ...context: unknown[]) => void;
  error: (message: string, ...context: unknown[]) => void;
}

export const createLogger = (scope: string): Logger => {
  const log =
    (level: LogLevel) =>
    (message: string, ...context: unknown[]) => {
      remember(level, scope, message);
      if (LEVEL_ORDER[level] < LEVEL_ORDER[MIN_LEVEL]) return;
      console[CONSOLE_METHOD[level]](`[${scope}] ${message}`, ...context);
    };

  const logError =
    (level: LogLevel) =>
    (message: string, ...context: unknown[]) => {
      log(level)(message, ...context);
      // Only the Error and plain-string context go to Sentry; arbitrary objects could hold PII.
      const error = context.find((item) => item instanceof Error);
      const notes = context.filter((item): item is string => typeof item === "string");
      captureError(error ?? new Error(`[${scope}] ${message}`), { scope, notes });
    };

  return {
    debug: log("DEBUG"),
    info: log("INFO"),
    warn: log("WARN"),
    error: logError("ERROR"),
  };
};
