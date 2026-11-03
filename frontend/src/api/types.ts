export type LeagueRole = "commissioner" | "member";

/** One season of a league as the caller may open it. */
export interface SeasonSummary {
  id: number;
  year: number;
  /** The Super Bowl is final: the season is a read-only archive. */
  finished: boolean;
  /** The league's latest season: its addresses carry no year. */
  current: boolean;
  draftStatus: DraftStatus;
  /** The caller's team that year; null when they had none. */
  myTeamId: number | null;
}

/** One entry of the user's league list: the league and where its latest season stands. */
export interface LeagueByUser {
  id: number;
  name: string;
  seasonId: number;
  /** The latest season's year. */
  season: number;
  isCommissioner: boolean;
  userTeamId: number | null;
  /** Events in the league feed this member hasn't seen: drives the nav dot. */
  hasNewActivity: boolean;
  finished: boolean;
  draftStatus: DraftStatus;
  /** Every season, oldest first. */
  seasons: SeasonSummary[];
}

/** A league the caller left: only the finished seasons they owned a team in. */
export interface PastLeague {
  id: number;
  name: string;
  seasons: SeasonSummary[];
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

/** A season's home data: teams, draft status and what the caller may do in it. */
export interface SeasonOverview {
  id: number;
  leagueId: number;
  leagueName: string;
  year: number;
  finished: boolean;
  /** The season is open and the caller is an active member. */
  canEdit: boolean;
  /** The season is open and the caller is a commissioner. */
  canCommission: boolean;
  /** The caller left the league and reads this finished season as history. */
  isFormerMember: boolean;
  numberTeams: number;
  openSpots: number;
  myRole: LeagueRole;
  myTeamId: number | null;
  draftStatus: DraftStatus;
  draftStartTime: string | null;
  /** Empty for a former member. */
  members: MemberSummary[];
  teams: TeamBrief[];
}

/** The permanent league: notes, members and its seasons. Not readable by former members. */
export interface LeagueInfo {
  id: number;
  name: string;
  notes: string;
  myRole: LeagueRole;
  currentSeasonId: number;
  /** The latest season is over and no later one exists. */
  canStartSeason: boolean;
  nextYear: number;
  seasons: SeasonSummary[];
  members: MemberSummary[];
}

export interface TeamBrief {
  id: number;
  name: string;
  ownerUserId: number | null;
  ownerName: string | null;
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
  seasonId: number | null;
  teamId: number | null;
  alreadyMember: boolean;
}

export interface StarterProgress {
  finished: number;
  live: number;
  toPlay: number;
  notPlaying: number;
}

export interface StandingTieReason {
  rule: "round_score" | "super_bowl_winner";
  round: number | null;
  overTeamId: number;
  overTeamName: string;
  aheadValue: number;
  behindValue: number;
  /** The deciding step in words, e.g. "higher Divisional score (20 to 10)". */
  detail: string;
  /** `detail` worded for the team ranked above. */
  message: string;
}

export interface StandingsRow {
  teamId: number;
  /** Null before the draft, when the rows are the team slots. */
  rank: number | null;
  teamName: string;
  /** Null for an open slot. */
  owner: string | null;
  isCommissioner: boolean;
  playersLeft: number;
  wildCard: number;
  divisional: number;
  confChamp: number;
  superBowl: number;
  total: number;
  /** Set when this team is ordered above the next one by the tiebreaker chain. */
  tieReason: StandingTieReason | null;
  progress: StarterProgress;
}

export interface Standings {
  /** `pre_draft`: no standings yet, rows are the season's team slots (points and ranks unset). */
  phase: "pre_draft" | "live";
  /** The round the live counts describe (1-4). */
  round: number;
  gamesInProgress: number;
  /** Players left summed over the whole league. */
  playersLeft: number;
  teams: StandingsRow[];
}

export interface BreakdownPlayer {
  playerId: number;
  name: string;
  position: string;
  teamAbv: string | null;
  /** Lineup slot name; null when the owner never placed the player. */
  slot: string | null;
  points: number;
  /** The latest stat correction, in the same (post-multiplier) points as `points`. */
  scoreChange: ScoreChange | null;
}

export interface BreakdownSlot {
  index: number;
  slot: string;
  player: BreakdownPlayer | null;
  points: number;
  mark: SlotMark | null;
}

export interface BreakdownRound {
  round: number;
  multiplier: number;
  counted: number;
  starters: BreakdownSlot[];
  bench: BreakdownPlayer[];
  benchPoints: number;
}

export interface TeamBreakdown {
  teamId: number;
  seasonId: number;
  teamName: string;
  total: number;
  pointsLeftOnBench: number;
  rounds: BreakdownRound[];
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
  isActive: boolean;
  /** Out, Doubtful, Questionable or Injured Reserve; null when healthy or unreported. */
  injuryStatus?: string | null;
  nextGame: NextGame | null;
  /** Team QB / team K: his slot scores every QB (K) on his NFL team. */
  scoresWholeTeam?: boolean;
}

export type PlayerRoundStatus = "alive" | "eliminated" | "bye";

export interface LineupPlayer extends RosterPlayer {
  status: PlayerRoundStatus;
  /** Scheduled kickoff of their game that round (ISO), which is when they lock. */
  kickoff: string | null;
  locked: boolean;
  /** Points in that round under the league's scoring; null before any stats. */
  points: number | null;
  scoreChange: ScoreChange | null;
}

/** The latest stat correction to a player's score in a round. */
export interface ScoreChange {
  previousPoints: number;
  newPoints: number;
  changedAt: string;
}

/** What a commissioner did to a slot; an override is permanent, the asterisk is not. */
export interface SlotMark {
  kind: "override" | "commissioner_set";
  actorName: string | null;
  at: string;
}

export interface LineupSlot {
  index: number;
  slot: string;
  player: LineupPlayer | null;
  mark: SlotMark | null;
}

export interface RoundLineup {
  round: number;
  slots: LineupSlot[];
  unassigned: LineupPlayer[];
  eliminated: LineupPlayer[];
  emptyStarterSlots: number;
  firstKickoff: string | null;
}

export interface TeamDetails {
  id: number;
  name: string;
  seasonId: number;
  ownerName: string | null;
  canEdit: boolean;
  canSetLineup: boolean;
  /** A commissioner may also move locked players, after confirming. */
  canOverride: boolean;
  roster: RosterPlayer[];
  lineups: RoundLineup[];
}

export interface DraftPick {
  id: number;
  draftId: number;
  teamId: number;
  playerId: number;
  playerName: string | null;
  position: string | null;
  teamAbv?: string | null;
  scoresWholeTeam?: boolean;
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
  seasonId: number;
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
  /** Only positions with a real cap; a team at its cap can't draft more of them. */
  positionCaps: Record<string, number>;
  /** First Wild Card kickoff: no draft can be scheduled or started after it. */
  draftCutoff: string | null;
  playoffFieldSet: boolean;
}

export interface DraftSnapshot extends DraftState {
  queue: number[];
  presence: number[];
  myTeamId: number | null;
}

/** Settings arrive flat in camelCase: numbers, booleans and enum strings. */
export type LeagueSettings = Record<string, number | string | boolean> & {
  id: number;
  seasonId: number;
};

export interface PlayerSummary {
  id: number;
  name: string;
  position: string;
  teamAbv?: string;
  team?: { teamAbv?: string };
  /** Not served yet; the card lists hide these players once the API sets it. */
  eliminated?: boolean;
  injuryStatus?: string | null;
  scoresWholeTeam?: boolean;
}

export interface SyncResult {
  status: string;
  durationMs: number;
  synced: { teams: number; players: number; stats: number; games: number };
}

export interface SyncStatus {
  kind: string;
  lastSyncedAt: string;
  /** The daily API cap stopped live polling, so the data is going stale. */
  budgetExhausted: boolean;
}

export type ActivityKind =
  | "lineup_move"
  | "commissioner_override"
  | "stat_correction"
  | "settings_change"
  | "league_created"
  | "membership_joined"
  | "membership_left"
  | "role_changed";

interface ActivityBase {
  id: number;
  createdAt: string;
  teamId: number | null;
  teamName: string | null;
  actorUserId: number | null;
  actorName: string | null;
  /** Newer than the viewer last looked, and not their own doing. */
  isNew: boolean;
}

export interface LineupMovePayload {
  round: number;
  playerId: number;
  playerName: string;
  fromSlot: string | null;
  toSlot: string | null;
  displaced: { playerId: number; playerName: string; toSlot: string | null } | null;
  changedSlots: number[];
  byCommissioner: boolean;
}

export type ActivityEvent = ActivityBase &
  (
    | { kind: "lineup_move" | "commissioner_override"; payload: LineupMovePayload }
    | {
        kind: "stat_correction";
        payload: {
          round: number;
          gameId: string;
          playerId: number;
          playerName: string;
          previousPoints: number;
          newPoints: number;
        };
      }
    | {
        kind: "settings_change";
        payload: { changes: { field: string; before: unknown; after: unknown }[] };
      }
    | { kind: "league_created"; payload: { leagueName: string } }
    | {
        kind: "membership_joined";
        payload: { role: "commissioner" | "member"; teamName: string | null };
      }
    | { kind: "membership_left"; payload: { userId: number; userName: string } }
    | {
        kind: "role_changed";
        payload: { userId: number; userName: string; role: "commissioner" | "member" };
      }
  );

export interface ActivityFeed {
  events: ActivityEvent[];
  /** Pass as `before` for the next older page; null on the last page. */
  nextBefore: number | null;
  hasNew: boolean;
}

export interface RecapTeam {
  teamId: number;
  teamName: string;
  owner: string;
  total: number;
}

export interface AwardWinner {
  key: string;
  title: string;
  teamId: number;
  teamName: string;
  owner: string;
  playerId: number | null;
  playerName: string | null;
  position: string | null;
  round: number | null;
  /** Counted points; for the draft awards places gained or lost, for the bench award bench points. */
  value: number;
  /** Per-position draft awards only: order drafted and finish by counted points within the position. */
  draftedAs: number | null;
  finishedAs: number | null;
  points: number | null;
}

export interface SeasonRecap {
  seasonId: number;
  leagueId: number;
  year: number;
  finished: boolean;
  /** More than one when the title is tied all the way down the tiebreaker chain. */
  champions: RecapTeam[];
  standings: Standings;
  nextSeasonId: number | null;
  awards: AwardWinner[];
}
