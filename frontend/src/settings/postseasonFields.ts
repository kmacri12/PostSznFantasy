import { SETTING_HELP } from "../content/rules";

// Keys and options mirror PostseasonSettings in api/models/league_models.py.
export type PostseasonValues = Record<string, number | string | boolean>;

export interface PostseasonField {
  key: string;
  label: string;
  help?: string;
  kind: "boolean" | "select" | "multiplier";
  options?: { value: string; label: string }[];
}

export const TEAM_QB_HELP = SETTING_HELP.teamQb;
export const TEAM_K_HELP = SETTING_HELP.teamK;

export const POSTSEASON_FIELDS: PostseasonField[] = [
  {
    key: "allow_join_after_draft_start",
    label: "Allow joining after the draft starts",
    kind: "boolean",
    help: SETTING_HELP.allowJoin,
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
  {
    key: "multiplier_wild_card",
    label: "Wild Card multiplier",
    kind: "multiplier",
    help: SETTING_HELP.multiplier,
  },
  {
    key: "multiplier_divisional",
    label: "Divisional multiplier",
    kind: "multiplier",
    help: SETTING_HELP.multiplier,
  },
  {
    key: "multiplier_conference",
    label: "Conference multiplier",
    kind: "multiplier",
    help: SETTING_HELP.multiplier,
  },
  {
    key: "multiplier_super_bowl",
    label: "Super Bowl multiplier",
    kind: "multiplier",
    help: SETTING_HELP.multiplier,
  },
];

export const POSTSEASON_KEYS = POSTSEASON_FIELDS.map((field) => field.key);
