import type { SeasonOverview } from "../api/types";
import { buildSeasonContext, type SeasonContextValue } from "../contexts/SeasonContext";

/** A season context for page tests; league 3, season 5 (2025), an open season the caller may edit. */
export const testSeason = (
  overrides: Partial<SeasonOverview> = {},
  current = false,
): SeasonContextValue =>
  buildSeasonContext(
    {
      id: 5,
      leagueId: 3,
      leagueName: "Test League",
      year: 2025,
      finished: false,
      canEdit: true,
      canCommission: false,
      isFormerMember: false,
      numberTeams: 3,
      openSpots: 0,
      myRole: "member",
      myTeamId: 1,
      draftStatus: "completed",
      draftStartTime: null,
      members: [],
      teams: [],
      ...overrides,
    },
    current,
  );
