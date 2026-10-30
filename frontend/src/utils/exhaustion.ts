/** How many of each team unit the 14 playoff teams provide. */
export const UNITS_AVAILABLE = 14;

const CAPPED_UNITS = [
  { key: "roster_max_qb", position: "QB" },
  { key: "roster_max_k", position: "K" },
  { key: "roster_max_dst", position: "DST" },
] as const;

/** One plain sentence per position where the league could want more players than exist. */
export function exhaustionWarnings(settings: {
  number_teams: number;
  [key: string]: number;
}): string[] {
  return CAPPED_UNITS.flatMap(({ key, position }) => {
    const perTeam = settings[key] ?? 0;
    const wanted = settings.number_teams * perTeam;
    if (wanted <= UNITS_AVAILABLE) return [];
    return [
      `${settings.number_teams} teams × up to ${perTeam} ${position} is ${wanted}, but only ${UNITS_AVAILABLE} ${position}s are in the playoffs, so they can run out.`,
    ];
  });
}
