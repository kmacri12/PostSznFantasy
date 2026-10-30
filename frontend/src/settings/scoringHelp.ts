const NOUNS: Record<string, string> = {
  td: "touchdown",
  "2pt": "2-point conversion",
  interception: "interception thrown",
  completion: "completion",
  attempt: "attempt",
  sack: "time sacked",
  reception: "reception",
  target: "target",
  fumble: "fumble",
  fumble_lost: "fumble lost",
  fg_made: "field goal made",
  fg_miss: "missed field goal",
  xp_made: "extra point made",
  xp_miss: "missed extra point",
  safety: "safety",
  fumble_recover: "fumble recovery",
  blocked_kick: "blocked kick",
  two_point_return: "2-point return",
  reception_bonus_rb: "reception by a RB (bonus)",
  reception_bonus_wr: "reception by a WR (bonus)",
  reception_bonus_te: "reception by a TE (bonus)",
};

const trim = (n: number): string => String(Number(n.toFixed(3)));
const points = (n: number): string => `${trim(n)} ${Math.abs(n) === 1 ? "point" : "points"}`;
const band = (raw: string): string =>
  raw
    .replace(/_plus$/, "+")
    .replace(/^under_(\d+)$/, "under $1")
    .replace(/_/g, "-");

/** Plain-language meaning of a scoring value, e.g. 0.04 per passing yard = 1 point per 25 yards. */
export function scoringHelp(key: string, raw: string | number): string | null {
  const value = typeof raw === "number" ? raw : Number.parseFloat(raw);
  if (!Number.isFinite(value)) return null;
  if (value === 0) return "Not scored";

  if (key.endsWith("_yard")) {
    if (Math.abs(value) >= 1) return `${points(value)} per yard`;
    const yards = 1 / Math.abs(value);
    return `${value < 0 ? "−" : ""}1 point per ${trim(yards)} yards`;
  }

  const bonus = key.match(/_bonus_(\d+)_yards$/);
  if (bonus) return `${points(value)} bonus for a game of ${bonus[1]}+ yards`;

  const allowed = key.match(/scoring_dst_(pts|yards)_allowed_(.+)$/);
  if (allowed) {
    const what = allowed[1] === "pts" ? "points" : "yards";
    const range = band(allowed[2] ?? "");
    return `${points(value)} when the defense allows ${range} ${what}`;
  }

  const suffix = Object.keys(NOUNS)
    .filter((noun) => key.endsWith(`_${noun}`))
    .sort((a, b) => b.length - a.length)[0];
  return suffix ? `${points(value)} per ${NOUNS[suffix]}` : null;
}
