// Keys and options mirror PostseasonSettings in api/models/league_models.py.
export type PostseasonValues = Record<string, number | string | boolean>;

export interface PostseasonField {
  key: string;
  label: string;
  help?: string;
  kind: "boolean" | "select" | "multiplier";
  options?: { value: string; label: string }[];
}

export const POSTSEASON_FIELDS: PostseasonField[] = [
  {
    key: "tiebreaker",
    label: "Tiebreaker",
    kind: "select",
    options: [
      { value: "most_players_alive", label: "Most players still alive" },
      { value: "highest_single_round", label: "Highest single-round score" },
      { value: "latest_round_score", label: "Latest round score" },
    ],
  },
  {
    key: "allow_join_after_draft_start",
    label: "Allow joining after the draft starts",
    kind: "boolean",
  },
  { key: "multiplier_wild_card", label: "Wild Card multiplier", kind: "multiplier" },
  { key: "multiplier_divisional", label: "Divisional multiplier", kind: "multiplier" },
  { key: "multiplier_conference", label: "Conference multiplier", kind: "multiplier" },
  { key: "multiplier_super_bowl", label: "Super Bowl multiplier", kind: "multiplier" },
];

export const POSTSEASON_KEYS = POSTSEASON_FIELDS.map((field) => field.key);
