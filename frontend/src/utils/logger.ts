import { captureError } from "./sentry";

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
