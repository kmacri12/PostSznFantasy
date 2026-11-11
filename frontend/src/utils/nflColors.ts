/** Primary colors by Tank01 team abbreviation, for the draft pick reveal's accent edge only. */
const NFL_COLORS: Record<string, string> = {
  ARI: "#97233f",
  ATL: "#a71930",
  BAL: "#241773",
  BUF: "#00338d",
  CAR: "#0085ca",
  CHI: "#c83803",
  CIN: "#fb4f14",
  CLE: "#ff3c00",
  DAL: "#003594",
  DEN: "#fb4f14",
  DET: "#0076b6",
  GB: "#203731",
  HOU: "#03202f",
  IND: "#002c5f",
  JAX: "#006778",
  KC: "#e31837",
  LAC: "#0080c6",
  LAR: "#003594",
  LV: "#a5acaf",
  MIA: "#008e97",
  MIN: "#4f2683",
  NE: "#002244",
  NO: "#d3bc8d",
  NYG: "#0b2265",
  NYJ: "#125740",
  PHI: "#004c54",
  PIT: "#ffb612",
  SEA: "#69be28",
  SF: "#aa0000",
  TB: "#d50a0a",
  TEN: "#4b92db",
  WAS: "#5a1414",
};

/** Null for a team we have no color for (the reveal then uses the accent). */
export const nflTeamColor = (abbreviation: string | null | undefined): string | null =>
  NFL_COLORS[(abbreviation ?? "").toUpperCase()] ?? null;
