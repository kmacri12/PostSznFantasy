export type ScoringSettingsState = Record<string, number | string>;

// Inputs hold raw strings while typing ("0." is a valid intermediate), so coerce on submit.
export function toNumericScoring(settings: ScoringSettingsState): Record<string, number> {
  return Object.fromEntries(
    Object.entries(settings).map(([key, value]) => [key, Number.parseFloat(String(value)) || 0]),
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
