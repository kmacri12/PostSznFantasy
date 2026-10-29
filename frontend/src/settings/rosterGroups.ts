import type { SettingGroup } from "./types";

// Keys must match RosterSettings in api/models/league_models.py.
export const ROSTER_GROUPS: SettingGroup[] = [
  {
    id: "starters",
    title: "Starters",
    fields: [
      { key: "roster_num_qb", label: "QB" },
      { key: "roster_num_rb", label: "RB" },
      { key: "roster_num_wr", label: "WR" },
      { key: "roster_num_te", label: "TE" },
      { key: "roster_num_flex_wr_rb_te", label: "FLEX (WR/RB/TE)" },
      { key: "roster_num_flex_wr_rb", label: "FLEX (WR/RB)" },
      { key: "roster_num_flex_wr_te", label: "FLEX (WR/TE)" },
      { key: "roster_num_flex_qb_wr_rb_te", label: "SUPERFLEX (QB/WR/RB/TE)" },
      { key: "roster_num_k", label: "K" },
      { key: "roster_num_dst", label: "DEF" },
      { key: "roster_num_bench", label: "Bench" },
    ],
  },
  {
    id: "limits",
    title: "Position limits",
    fields: [
      { key: "roster_max_qb", label: "Max QB" },
      { key: "roster_max_rb", label: "Max RB" },
      { key: "roster_max_wr", label: "Max WR" },
      { key: "roster_max_te", label: "Max TE" },
      { key: "roster_max_k", label: "Max K" },
      { key: "roster_max_dst", label: "Max DEF" },
    ],
  },
];

export const STARTER_AND_BENCH_KEYS = (ROSTER_GROUPS[0]?.fields ?? []).map((field) => field.key);

export const sumRosterSpots = (values: Record<string, number | string>): number =>
  STARTER_AND_BENCH_KEYS.reduce((sum, key) => sum + (Number(values[key]) || 0), 0);
