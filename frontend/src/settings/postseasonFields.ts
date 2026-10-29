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
    key: "free_agency_enabled",
    label: "Free agency during the playoffs",
    help: "Owners may add free agents. When off, only eliminated players can be swapped out (if allowed below).",
    kind: "boolean",
  },
  {
    key: "free_agency_window",
    label: "Free agency window",
    kind: "select",
    options: [
      { value: "between_rounds", label: "Between rounds only" },
      { value: "anytime", label: "Any time" },
    ],
  },
  {
    key: "free_agency_claim_order",
    label: "Claim order",
    kind: "select",
    options: [
      { value: "first_come", label: "First come, first served" },
      { value: "waiver_priority", label: "Waiver priority" },
    ],
  },
  {
    key: "allow_swap_eliminated",
    label: "Allow swapping out eliminated players",
    kind: "boolean",
  },
  {
    key: "roster_lock",
    label: "Roster lock",
    kind: "select",
    options: [
      { value: "round_start", label: "At the start of each round" },
      { value: "game_start", label: "At each player's kickoff" },
    ],
  },
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
    key: "bye_week_handling",
    label: "Bye-week teams (Wild Card round)",
    kind: "select",
    options: [
      { value: "alive_no_score", label: "Players stay alive and score zero" },
      { value: "exclude_from_wild_card", label: "Can't be started in the Wild Card round" },
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
