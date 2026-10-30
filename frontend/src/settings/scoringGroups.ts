// Field order and labels for the scoring form; keys must match ScoringSettings (see scoringGroups.test.ts).
import type { SettingGroup } from "./types";

export const SCORING_GROUPS: SettingGroup[] = [
  {
    id: "passing",
    title: "Passing",
    fields: [
      { key: "scoring_passing_yard", label: "Yard" },
      { key: "scoring_passing_td", label: "TD" },
      { key: "scoring_passing_2pt", label: "2-Pt Conversion" },
      { key: "scoring_passing_interception", label: "Interception" },
      { key: "scoring_passing_completion", label: "Completion" },
      { key: "scoring_passing_attempt", label: "Attempt" },
      { key: "scoring_passing_sack", label: "Sack" },
      { key: "scoring_passing_bonus_300_yards", label: "Bonus 300 Yards" },
      { key: "scoring_passing_bonus_400_yards", label: "Bonus 400 Yards" },
    ],
  },
  {
    id: "rushing",
    title: "Rushing",
    fields: [
      { key: "scoring_rushing_yard", label: "Yard" },
      { key: "scoring_rushing_td", label: "TD" },
      { key: "scoring_rushing_2pt", label: "2-Pt Conversion" },
      { key: "scoring_rushing_attempt", label: "Attempt" },
      { key: "scoring_rushing_bonus_100_yards", label: "Bonus 100 Yards" },
      { key: "scoring_rushing_bonus_200_yards", label: "Bonus 200 Yards" },
    ],
  },
  {
    id: "receiving",
    title: "Receiving",
    fields: [
      { key: "scoring_receiving_reception", label: "Reception" },
      { key: "scoring_receiving_yard", label: "Yard" },
      { key: "scoring_receiving_td", label: "TD" },
      { key: "scoring_receiving_2pt", label: "2-Pt Conversion" },
      { key: "scoring_receiving_target", label: "Target" },
      { key: "scoring_receiving_reception_bonus_rb", label: "Reception Bonus RB" },
      { key: "scoring_receiving_reception_bonus_wr", label: "Reception Bonus WR" },
      { key: "scoring_receiving_reception_bonus_te", label: "Reception Bonus TE" },
      { key: "scoring_receiving_bonus_100_yards", label: "Bonus 100 Yards" },
      { key: "scoring_receiving_bonus_200_yards", label: "Bonus 200 Yards" },
    ],
  },
  {
    id: "carrying",
    title: "Fumbles",
    fields: [
      { key: "scoring_carrying_fumble", label: "Fumble" },
      { key: "scoring_carrying_fumble_lost", label: "Fumble Lost" },
    ],
  },
  {
    id: "kicking",
    title: "Kicking",
    fields: [
      { key: "scoring_kicking_fg_made", label: "FG Made (flat)" },
      { key: "scoring_kicking_fg_miss", label: "FG Miss" },
      { key: "scoring_kicking_fg_yard", label: "Made FG Yard" },
      { key: "scoring_kicking_xp_made", label: "XP Made" },
      { key: "scoring_kicking_xp_miss", label: "XP Miss" },
    ],
  },
  {
    id: "specialTeams",
    title: "Special Teams",
    fields: [
      { key: "scoring_special_punt_return_yard", label: "Punt Return Yard" },
      { key: "scoring_special_kick_return_yard", label: "Kick Return Yard" },
    ],
  },
  {
    id: "defense",
    title: "Defense",
    fields: [
      { key: "scoring_dst_td", label: "TD" },
      { key: "scoring_dst_pts_allowed_0", label: "Pts Allowed 0" },
      { key: "scoring_dst_pts_allowed_1_13", label: "Pts Allowed 1-13" },
      { key: "scoring_dst_pts_allowed_14_21", label: "Pts Allowed 14-21" },
      { key: "scoring_dst_pts_allowed_22_28", label: "Pts Allowed 22-28" },
      { key: "scoring_dst_pts_allowed_29_plus", label: "Pts Allowed 29+" },
      { key: "scoring_dst_yards_allowed_under_100", label: "Yards Allowed Under 100" },
      { key: "scoring_dst_yards_allowed_100_199", label: "Yards Allowed 100-199" },
      { key: "scoring_dst_yards_allowed_200_299", label: "Yards Allowed 200-299" },
      { key: "scoring_dst_yards_allowed_300_plus", label: "Yards Allowed 300+" },
      { key: "scoring_dst_sack", label: "Sack" },
      { key: "scoring_dst_safety", label: "Safety" },
      { key: "scoring_dst_fumble_recover", label: "Fumble Recover" },
      { key: "scoring_dst_interception", label: "Interception" },
      { key: "scoring_dst_blocked_kick", label: "Blocked Kick" },
      { key: "scoring_dst_two_point_return", label: "Two Point Return" },
    ],
  },
];
