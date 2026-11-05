/** Swap the team at `index` with its neighbour; out-of-range moves change nothing. */
export function moveTeam<T>(ids: T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  const a = ids[index];
  const b = ids[target];
  if (a === undefined || b === undefined) return ids;
  const next = [...ids];
  next[index] = b;
  next[target] = a;
  return next;
}

export const sameOrder = (a: readonly number[], b: readonly number[]): boolean =>
  a.length === b.length && a.every((id, index) => id === b[index]);
