import { numberProblems, SCORING_RULE } from "./numberField";

export type ScoringSettingsState = Record<string, number | string>;

/** Fields whose typed text is not a valid scoring value, with a message each. */
export const scoringProblems = (settings: ScoringSettingsState): Record<string, string> =>
  numberProblems(settings, () => SCORING_RULE);

// Inputs hold raw strings while typing ("0." is a valid intermediate). An unparseable value
// becomes NaN rather than 0; callers must check `scoringProblems` before sending anything.
export function toNumericScoring(settings: ScoringSettingsState): Record<string, number> {
  return Object.fromEntries(
    Object.entries(settings).map(([key, value]) => [
      key,
      Number(String(value).trim() || Number.NaN),
    ]),
  );
}

export function countChangedFromDefaults(
  settings: ScoringSettingsState,
  defaults: ScoringSettingsState,
): number {
  const current = toNumericScoring(settings);
  return Object.entries(toNumericScoring(defaults)).filter(([key, value]) => current[key] !== value)
    .length;
}
