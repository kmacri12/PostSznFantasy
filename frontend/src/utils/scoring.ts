import axios from "axios";

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

export async function fetchScoringDefaults(apiUrl: string): Promise<ScoringSettingsState> {
  const response = await axios.get<Record<string, number>>(
    `${apiUrl}/api/leagues/scoring-defaults`,
  );
  return response.data;
}
