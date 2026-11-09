interface ValidationIssue {
  loc?: unknown[];
  msg?: string;
}

/** FastAPI 422 `detail` is a list of issues; word each as "field: message". */
const validationMessage = (detail: unknown): string | null => {
  if (!Array.isArray(detail)) return null;
  const lines = (detail as ValidationIssue[])
    .filter((issue) => typeof issue?.msg === "string")
    .map((issue) => {
      const field = String(issue.loc?.at(-1) ?? "").replaceAll("_", " ");
      return field ? `${field}: ${issue.msg}` : String(issue.msg);
    });
  return lines.length > 0 ? lines.join("; ") : null;
};

/** Server-provided `detail` when present; otherwise the caller's plain-language fallback, never the raw exception text. */
export const friendlyError = (error: unknown, fallback: string): string => {
  const detail = (error as { response?: { data?: { detail?: unknown } } } | null)?.response?.data
    ?.detail;
  if (typeof detail === "string" && detail) return detail;
  return validationMessage(detail) ?? fallback;
};

/** Message for a failed mutation, or null while nothing has failed. */
export const mutationError = (error: unknown, fallback: string): string | null =>
  error ? friendlyError(error, fallback) : null;
