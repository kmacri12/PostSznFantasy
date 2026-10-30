type Values = Record<string, number | string | boolean>;

/** Form fields hold raw strings while the API serves numbers, so compare as text. */
export function valuesEqual(a: Values, b: Values): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (String(a[key] ?? "") !== String(b[key] ?? "")) return false;
  }
  return true;
}
