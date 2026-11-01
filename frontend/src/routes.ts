type Id = string | number;

export const leaguePath = (leagueId: Id) => `/leagues/${leagueId}`;

/** Every page of one season of a league; the season is addressed by its year. */
export const seasonPaths = (leagueId: Id, year: Id) => {
  const home = `${leaguePath(leagueId)}/seasons/${year}`;
  return {
    home,
    draft: `${home}/draft`,
    settings: `${home}/settings`,
    players: `${home}/players`,
    team: (teamId: Id) => `${home}/teams/${teamId}`,
    teamPoints: (teamId: Id) => `${home}/teams/${teamId}/points`,
  };
};

export type SeasonPaths = ReturnType<typeof seasonPaths>;
