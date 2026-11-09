export interface NumberRule {
  min: number;
  max: number;
  integer?: boolean;
}

// Mirror SCORING_VALUE_LIMIT, ROSTER_SLOTS_MAX and ROSTER_MAX_CAP in api/models/league_models.py.
export const SCORING_RULE: NumberRule = { min: -100, max: 100 };
export const ROSTER_SLOTS_RULE: NumberRule = { min: 0, max: 20, integer: true };
export const ROSTER_CAP_RULE: NumberRule = { min: 0, max: 99, integer: true };
export const MULTIPLIER_RULE: NumberRule = { min: 0, max: 10 };

const NUMBER_PATTERN = /^-?(\d+\.?\d*|\.\d+)$/;

const rangeHint = ({ min, max, integer }: NumberRule) =>
  `Enter ${integer ? "a whole number" : "a number"} from ${min} to ${max}.`;

/** The message for a raw field value that cannot be saved, or null when it is fine. */
export function numberProblem(raw: number | string | undefined, rule: NumberRule): string | null {
  const text = String(raw ?? "").trim();
  if (text === "") return `Required. ${rangeHint(rule)}`;
  if (!NUMBER_PATTERN.test(text) || text.endsWith(".")) return rangeHint(rule);
  const value = Number(text);
  if (rule.integer && !Number.isInteger(value)) return rangeHint(rule);
  if (value < rule.min || value > rule.max) return rangeHint(rule);
  return null;
}

/** Problems keyed by field, for the keys present in `values` and passing `ruleFor`. */
export function numberProblems(
  values: Record<string, number | string | boolean>,
  ruleFor: (key: string) => NumberRule | null,
): Record<string, string> {
  const problems: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    const rule = ruleFor(key);
    if (!rule || typeof value === "boolean") continue;
    const problem = numberProblem(value, rule);
    if (problem) problems[key] = problem;
  }
  return problems;
}

/** Roster slot counts (`roster_num_*`) and position caps (`roster_max_*`). */
export const rosterProblems = (values: Record<string, number | string>) =>
  numberProblems(values, (key) => {
    if (key.startsWith("roster_num_")) return ROSTER_SLOTS_RULE;
    if (key.startsWith("roster_max_")) return ROSTER_CAP_RULE;
    return null;
  });
