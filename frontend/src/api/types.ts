export interface LeagueByUser {
  id: number;
  name: string;
  commissionerId: number;
  userTeamId: number;
}

export interface StandingsRow {
  teamId: number;
  rank: number;
  teamName: string;
  owner: string;
  playersLeft: number;
  wildCard: number;
  divisional: number;
  confChamp: number;
  superBowl: number;
  total: number;
}

export interface TeamSummary {
  id: number;
  name: string;
  ownerId: number | null;
  ownerName: string | null;
  picksMade: number;
}

export interface RosterPlayer {
  id: number;
  name: string;
  position: string;
  teamAbv?: string;
  slot?: string;
  isActive?: boolean;
}

export interface TeamDetails {
  id: number;
  name: string;
  leagueId: number;
  ownerName: string | null;
  roster: RosterPlayer[];
}

export interface DraftInfo {
  id: number;
  leagueId: number;
  status: string | null;
  startTime: string | null;
  draftType: string | null;
  timePerPickSeconds: number;
}

/** Roster and scoring fields arrive flat and snake_case-free (camelCase) from the API. */
export type LeagueSettings = Record<string, number> & { id: number; leagueId: number };

export interface PlayerSummary {
  id: number;
  name: string;
  position: string;
  teamAbv?: string;
  team?: { teamAbv?: string };
}

export interface SyncResult {
  status: string;
  durationMs: number;
  synced: { teams: number; players: number; stats: number; games: number };
}
