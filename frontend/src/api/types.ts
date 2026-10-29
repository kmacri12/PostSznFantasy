export type LeagueRole = "commissioner" | "member";

export interface LeagueByUser {
  id: number;
  name: string;
  season: number;
  isCommissioner: boolean;
  userTeamId: number | null;
}

export interface MemberSummary {
  userId: number;
  username: string;
  role: LeagueRole;
  teamId: number | null;
  teamName: string | null;
}

export type DraftStatus =
  | "unscheduled"
  | "scheduled"
  | "lobby"
  | "in_progress"
  | "paused"
  | "completed";

export interface LeagueOverview {
  id: number;
  name: string;
  season: number;
  numberTeams: number;
  openSpots: number;
  myRole: LeagueRole;
  myTeamId: number | null;
  draftStatus: DraftStatus;
  draftStartTime: string | null;
  members: MemberSummary[];
}

export interface Invite {
  code: string;
  leagueId: number;
  expiresAt: string | null;
  maxUses: number | null;
  uses: number;
  revoked: boolean;
}

export interface InvitePreview {
  code: string;
  leagueName: string;
  season: number;
  openSpots: number;
  joinable: boolean;
  reason: string | null;
}

export interface JoinResult {
  leagueId: number;
  teamId: number | null;
  alreadyMember: boolean;
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

export interface NextGame {
  opponentAbv: string | null;
  gameTimeEpoch: string | null;
  status: string | null;
}

export interface RosterPlayer {
  id: number;
  name: string;
  position: string;
  teamAbv?: string | null;
  slot: string;
  isActive: boolean;
  nextGame: NextGame | null;
}

export interface RosterSlot {
  slot: string;
  player: RosterPlayer | null;
}

export interface TeamDetails {
  id: number;
  name: string;
  leagueId: number;
  ownerName: string | null;
  canEdit: boolean;
  canManageRoster: boolean;
  roster: RosterPlayer[];
  slots: RosterSlot[];
}

export interface DraftPick {
  id: number;
  draftId: number;
  teamId: number;
  playerId: number;
  playerName: string | null;
  position: string | null;
  numberRound: number;
  numberPickOverall: number;
  numberPickInRound: number;
  autopick: boolean;
}

export interface DraftSlot {
  slot: number;
  teamId: number;
  teamName: string;
  ownerName: string | null;
}

export type DraftType = "snake" | "linear" | "third_round_reversal";
export type PickTimeoutAction = "queue_then_best_available" | "best_available";

export interface DraftState {
  draftId: number;
  leagueId: number;
  status: DraftStatus;
  startTime: string | null;
  draftType: DraftType;
  rounds: number;
  timePerPickSeconds: number;
  pickTimeoutAction: PickTimeoutAction;
  pickStartedAt: string | null;
  currentPickDeadline: string | null;
  pausedRemainingSeconds: number | null;
  serverTime: string;
  orderLocked: boolean;
  order: DraftSlot[];
  unassignedTeamIds: number[];
  picks: DraftPick[];
  totalPicks: number;
  currentPickOverall: number | null;
  onTheClockTeamId: number | null;
  onDeckTeamId: number | null;
}

export interface DraftSnapshot extends DraftState {
  queue: number[];
  presence: number[];
  myTeamId: number | null;
}

/** Settings arrive flat in camelCase: numbers, booleans and enum strings. */
export type LeagueSettings = Record<string, number | string | boolean> & {
  id: number;
  leagueId: number;
};

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
