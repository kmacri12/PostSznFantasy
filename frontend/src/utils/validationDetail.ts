interface ValidationIssue {
  loc?: unknown[];
  msg?: string;
}

/** FastAPI 422 `detail` is a list of issues; worded as "field: message", or null for any other error. */
export const validationDetail = (error: unknown): string | null => {
  const detail = (error as { response?: { data?: { detail?: unknown } } } | null)?.response?.data
    ?.detail;
  if (!Array.isArray(detail)) return null;
  const lines = (detail as ValidationIssue[])
    .filter((issue) => typeof issue?.msg === "string")
    .map((issue) => {
      const field = String(issue.loc?.at(-1) ?? "").replaceAll("_", " ");
      return field ? `${field}: ${issue.msg}` : String(issue.msg);
    });
  return lines.length > 0 ? lines.join("; ") : null;
};
