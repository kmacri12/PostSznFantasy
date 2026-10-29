import { ROSTER_GROUPS } from "./rosterGroups";
import { SCORING_GROUPS } from "./scoringGroups";
import type { SettingsValues } from "./types";

// Mirrors pydantic's to_camel, which is not reversible for numeric bands like `fg_made_0_19`.
export const toCamel = (snake: string): string =>
  snake
    .split("_")
    .map((word, index) => (index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join("");

const keysOf = (groups: { fields: { key: string }[] }[]) =>
  groups.flatMap((group) => group.fields.map((field) => field.key));

export const ROSTER_KEYS = ["number_teams", "roster_total", ...keysOf(ROSTER_GROUPS)];
export const SCORING_KEYS = keysOf(SCORING_GROUPS);

/** Picks the schema's fields out of a camelCase API response into snake_case form state. */
export const fromApi = (response: Record<string, unknown>, keys: string[]): SettingsValues =>
  Object.fromEntries(
    keys
      .filter((key) => typeof response[toCamel(key)] === "number")
      .map((key) => [key, response[toCamel(key)] as number]),
  );
