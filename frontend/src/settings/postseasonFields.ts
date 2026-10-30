// Keys and options mirror PostseasonSettings in api/models/league_models.py.
export type PostseasonValues = Record<string, number | string | boolean>;

export interface PostseasonField {
  key: string;
  label: string;
  help?: string;
  kind: "boolean" | "select" | "multiplier";
  options?: { value: string; label: string }[];
}

export const TEAM_QB_HELP =
  "Draft a QB by name, but he scores every QB on his NFL team in each game, so a backup who steps in still counts.";
export const TEAM_K_HELP =
  "Draft a kicker by name, but he scores every kicker on his NFL team in each game. A player who is not a kicker never counts.";

export const POSTSEASON_FIELDS: PostseasonField[] = [
  {
    key: "allow_join_after_draft_start",
    label: "Allow joining after the draft starts",
    kind: "boolean",
  },
  {
    key: "team_qb",
    label: "Team QB",
    kind: "boolean",
    help: TEAM_QB_HELP,
  },
  {
    key: "team_k",
    label: "Team K",
    kind: "boolean",
    help: TEAM_K_HELP,
  },
  { key: "multiplier_wild_card", label: "Wild Card multiplier", kind: "multiplier" },
  { key: "multiplier_divisional", label: "Divisional multiplier", kind: "multiplier" },
  { key: "multiplier_conference", label: "Conference multiplier", kind: "multiplier" },
  { key: "multiplier_super_bowl", label: "Super Bowl multiplier", kind: "multiplier" },
];

export const POSTSEASON_KEYS = POSTSEASON_FIELDS.map((field) => field.key);
