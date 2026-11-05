type Id = string | number;

export const leaguePath = (leagueId: Id) => `/leagues/${leagueId}`;

/**
 * Every page of one season of a league. The league's current season has no year in its
 * addresses; any other season is addressed by `/seasons/<year>`.
 */
export const seasonPaths = (leagueId: Id, year: Id, current: boolean) => {
  const home = current ? leaguePath(leagueId) : `${leaguePath(leagueId)}/seasons/${year}`;
  return {
    home,
    draft: `${home}/draft`,
    settings: `${home}/settings`,
    draftBoard: `${home}/draft/board`,
    feed: `${home}/feed`,
    more: `${home}/more`,
    team: (teamId: Id) => `${home}/teams/${teamId}`,
  };
};

export type SeasonPaths = ReturnType<typeof seasonPaths>;
