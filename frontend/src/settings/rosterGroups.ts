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
      { key: "roster_num_k", label: "K" },
      { key: "roster_num_dst", label: "DST" },
      { key: "roster_num_bench", label: "Bench" },
    ],
  },
  {
    id: "limits",
    title: "Position limits",
    fields: [
      { key: "roster_max_qb", label: "Max QB", limit: true },
      { key: "roster_max_rb", label: "Max RB", limit: true },
      { key: "roster_max_wr", label: "Max WR", limit: true },
      { key: "roster_max_te", label: "Max TE", limit: true },
      { key: "roster_max_k", label: "Max K", limit: true },
      { key: "roster_max_dst", label: "Max DST", limit: true },
    ],
  },
];

/** A new league's roster; the per-row reset puts these back. */
export const ROSTER_DEFAULTS = {
  roster_total: 18,
  roster_num_qb: 1,
  roster_num_rb: 2,
  roster_num_wr: 2,
  roster_num_te: 1,
  roster_num_flex_wr_rb_te: 1,
  roster_num_flex_wr_rb: 0,
  roster_num_flex_wr_te: 0,
  roster_num_flex_qb_wr_rb_te: 0,
  roster_num_k: 1,
  roster_num_dst: 1,
  roster_num_bench: 9,
  roster_max_qb: 2,
  roster_max_rb: 99,
  roster_max_wr: 99,
  roster_max_te: 99,
  roster_max_k: 2,
  roster_max_dst: 2,
};

export const STARTER_AND_BENCH_KEYS = (ROSTER_GROUPS[0]?.fields ?? []).map((field) => field.key);

export const sumRosterSpots = (values: Record<string, number | string>): number =>
  STARTER_AND_BENCH_KEYS.reduce((sum, key) => sum + (Number(values[key]) || 0), 0);
