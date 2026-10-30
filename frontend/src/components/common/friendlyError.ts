/** Server-provided `detail` when present; otherwise the caller's plain-language fallback, never the raw exception text. */
export const friendlyError = (error: unknown, fallback: string): string => {
  const detail = (error as { response?: { data?: { detail?: unknown } } } | null)?.response?.data
    ?.detail;
  return typeof detail === "string" && detail ? detail : fallback;
};
