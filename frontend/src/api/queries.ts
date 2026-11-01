import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type {
  ActivityFeed,
  DraftState,
  Invite,
  InvitePreview,
  JoinResult,
  LeagueByUser,
  LeagueOverview,
  LeagueSettings,
  MemberSummary,
  PlayerSummary,
  SeasonRecap,
  Standings,
  SyncResult,
  SyncStatus,
  TeamBreakdown,
  TeamDetails,
  TeamSummary,
} from "./types";

/**
 * Ids in the SPA: a page's "league id" (route param, `?leagueId=`) is the id of the
 * league's season, which is what the season API routes take. League-level calls
 * (members, notes, invite, starting a season) resolve the permanent league id from
 * the season first. The frontend is reworked around seasons in #235.
 */
type Id = string | number;

export const keys = {
  config: ["config"] as const,
  userLeagues: ["user-leagues"] as const,
  league: (leagueId: Id) => ["league", String(leagueId)] as const,
  recap: (leagueId: Id) => ["recap", String(leagueId)] as const,
  standings: (leagueId: Id) => ["standings", String(leagueId)] as const,
  teams: (leagueId: Id) => ["teams", String(leagueId)] as const,
  team: (teamId: Id) => ["team", String(teamId)] as const,
  breakdown: (teamId: Id) => ["breakdown", String(teamId)] as const,
  settings: (leagueId: Id) => ["settings", String(leagueId)] as const,
  draft: (leagueId: Id) => ["draft", String(leagueId)] as const,
  invite: (leagueId: Id) => ["invite", String(leagueId)] as const,
  invitePreview: (code: string) => ["invite-preview", code] as const,
  players: ["players"] as const,
  draftPool: (leagueId?: Id) => ["draft-pool", leagueId ?? "all"] as const,
  seasonStats: ["player-season-stats"] as const,
  scoringDefaults: ["scoring-defaults"] as const,
  syncStatus: ["sync-status"] as const,
  activity: (scope: "seasons" | "teams", id: Id) => ["activity", scope, String(id)] as const,
};

const get = async <T>(url: string, signal?: AbortSignal): Promise<T> =>
  (await api.get<T>(url, { signal })).data;

export const useConfig = () =>
  useQuery({
    queryKey: keys.config,
    queryFn: ({ signal }) => get<{ season: number }>("/api/config", signal),
    staleTime: Number.POSITIVE_INFINITY,
  });

export const useUserLeagues = (enabled: boolean) =>
  useQuery({
    queryKey: keys.userLeagues,
    queryFn: async ({ signal }) =>
      (
        await get<(Omit<LeagueByUser, "id" | "leagueId"> & { id: number; seasonId: number })[]>(
          "/api/leagues/user-leagues",
          signal,
        )
      ).map(({ seasonId, id, ...league }) => ({ ...league, id: seasonId, leagueId: id })),
    enabled,
    refetchInterval: 60_000, // the nav dot for new league activity
  });

/** Whether the league is a finished, read-only archive; reads the cached league list, no extra request. */
export const useLeagueArchived = (leagueId: Id | undefined): boolean => {
  const { data } = useUserLeagues(true);
  return data?.find((league) => String(league.id) === String(leagueId))?.finished === true;
};

interface SeasonOverview {
  id: number;
  leagueId: number;
  leagueName: string;
  year: number;
  finished: boolean;
  canEdit: boolean;
  canCommission: boolean;
  numberTeams: number;
  openSpots: number;
  myRole: LeagueOverview["myRole"];
  myTeamId: number | null;
  draftStatus: LeagueOverview["draftStatus"];
  draftStartTime: string | null;
  members: MemberSummary[];
  teams: LeagueOverview["teams"];
}

const fetchLeague = async (seasonId: Id, signal?: AbortSignal): Promise<LeagueOverview> => {
  const season = await get<SeasonOverview>(`/api/seasons/${seasonId}`, signal);
  const league = await get<{ name: string; notes: string }>(
    `/api/leagues/${season.leagueId}`,
    signal,
  );
  return {
    id: season.id,
    leagueId: season.leagueId,
    name: league.name,
    season: season.year,
    finished: season.finished,
    canEdit: season.canEdit,
    canCommission: season.canCommission,
    notes: league.notes,
    numberTeams: season.numberTeams,
    openSpots: season.openSpots,
    myRole: season.myRole,
    myTeamId: season.myTeamId,
    draftStatus: season.draftStatus,
    draftStartTime: season.draftStartTime,
    members: season.members,
    teams: season.teams,
  };
};

export const useLeague = (leagueId: Id | undefined) =>
  useQuery({
    queryKey: keys.league(leagueId ?? ""),
    queryFn: ({ signal }) => fetchLeague(leagueId ?? "", signal),
    enabled: leagueId !== undefined,
  });

/** The permanent league behind a page's season id, from the cache or one fetch. */
const resolveLeagueId = async (
  queryClient: ReturnType<typeof useQueryClient>,
  seasonId: Id | undefined,
): Promise<number> =>
  (
    await queryClient.fetchQuery({
      queryKey: keys.league(seasonId ?? ""),
      queryFn: ({ signal }) => fetchLeague(seasonId ?? "", signal),
      staleTime: Number.POSITIVE_INFINITY,
    })
  ).leagueId;

/** Seconds between standings refetches while the page is visible; scores land every poll cycle. */
export const STANDINGS_REFRESH_MS = 20_000;

export const useStandings = (leagueId: Id | undefined) =>
  useQuery({
    queryKey: keys.standings(leagueId ?? ""),
    queryFn: ({ signal }) => get<Standings>(`/api/seasons/${leagueId}/standings`, signal),
    enabled: leagueId !== undefined,
    refetchInterval: STANDINGS_REFRESH_MS,
  });

export const useRecap = (leagueId: Id | undefined) =>
  useQuery({
    queryKey: keys.recap(leagueId ?? ""),
    queryFn: ({ signal }) => get<SeasonRecap>(`/api/seasons/${leagueId}/recap`, signal),
    enabled: leagueId !== undefined,
  });

export const useTeamBreakdown = (teamId: Id | undefined) =>
  useQuery({
    queryKey: keys.breakdown(teamId ?? ""),
    queryFn: ({ signal }) => get<TeamBreakdown>(`/api/teams/${teamId}/breakdown`, signal),
    enabled: teamId !== undefined,
    refetchInterval: STANDINGS_REFRESH_MS,
  });

export const useLeagueTeams = (leagueId: Id | undefined) =>
  useQuery({
    queryKey: keys.teams(leagueId ?? ""),
    queryFn: ({ signal }) => get<TeamSummary[]>(`/api/seasons/${leagueId}/teams`, signal),
    enabled: leagueId !== undefined,
  });

export const useTeam = (teamId: Id | undefined) =>
  useQuery({
    queryKey: keys.team(teamId ?? ""),
    queryFn: ({ signal }) => get<TeamDetails>(`/api/teams/${teamId}`, signal),
    enabled: teamId !== undefined,
  });

export const useLeagueSettings = (leagueId: Id | undefined) =>
  useQuery({
    queryKey: keys.settings(leagueId ?? ""),
    queryFn: ({ signal }) => get<LeagueSettings>(`/api/seasons/${leagueId}/settings`, signal),
    enabled: leagueId !== undefined,
  });

export const useDraft = (leagueId: Id | undefined) =>
  useQuery({
    queryKey: keys.draft(leagueId ?? ""),
    queryFn: ({ signal }) => get<DraftState>(`/api/drafts/draft-info/${leagueId}`, signal),
    enabled: leagueId !== undefined,
    retry: false,
  });

export const usePlayerList = () =>
  useQuery({
    queryKey: keys.players,
    queryFn: ({ signal }) => get<PlayerSummary[]>("/api/players/player-list", signal),
    staleTime: 5 * 60_000,
  });

/** Draftable players on the playoff teams; with a league, its team QB / team K settings narrow and flag the pool. */
export const useDraftPool = (leagueId?: Id) =>
  useQuery({
    queryKey: keys.draftPool(leagueId),
    queryFn: ({ signal }) =>
      get<PlayerSummary[]>(
        leagueId === undefined
          ? "/api/players/draft-pool"
          : `/api/players/draft-pool?seasonId=${leagueId}`,
        signal,
      ),
    staleTime: 5 * 60_000,
  });

export const usePlayerSeasonStats = <T>(season: string | undefined, leagueId: Id | undefined) =>
  useQuery({
    queryKey: [...keys.seasonStats, season, leagueId ?? "none"],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ season: season ?? "" });
      if (leagueId !== undefined) params.set("seasonId", String(leagueId));
      return get<T[]>(`/api/players/player-season-stats?${params}`, signal);
    },
    enabled: !!season,
    staleTime: 5 * 60_000,
  });

export const useSyncStatus = () =>
  useQuery({
    queryKey: keys.syncStatus,
    queryFn: ({ signal }) => get<SyncStatus[]>("/api/players/sync-status", signal),
    refetchInterval: 60_000,
  });

export const useScoringDefaults = () =>
  useQuery({
    queryKey: keys.scoringDefaults,
    queryFn: ({ signal }) => get<Record<string, number>>("/api/leagues/scoring-defaults", signal),
    staleTime: Number.POSITIVE_INFINITY,
  });

export const useInvite = (leagueId: Id | undefined, enabled: boolean) => {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: keys.invite(leagueId ?? ""),
    queryFn: async ({ signal }) =>
      get<Invite | null>(
        `/api/leagues/${await resolveLeagueId(queryClient, leagueId)}/invite`,
        signal,
      ),
    enabled: enabled && leagueId !== undefined,
  });
};

export const useInvitePreview = (code: string | undefined) =>
  useQuery({
    queryKey: keys.invitePreview(code ?? ""),
    queryFn: ({ signal }) => get<InvitePreview>(`/api/invites/${code}`, signal),
    enabled: !!code,
    retry: false,
  });

// --- Mutations -------------------------------------------------------------

export const useCreateLeague = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: object) =>
      (await api.post<{ leagueId?: number; seasonId?: number }>("/api/leagues/create-league", body))
        .data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.userLeagues }),
  });
};

/** Mutation whose success refreshes everything cached for one league. */
const useLeagueMutation = <TVariables, TResult>(
  leagueId: Id | undefined,
  request: (variables: TVariables) => Promise<TResult>,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    onSuccess: () => {
      for (const key of ["league", "settings", "teams", "standings", "invite", "draft"]) {
        queryClient.invalidateQueries({ queryKey: [key, String(leagueId)] });
      }
      queryClient.invalidateQueries({ queryKey: keys.userLeagues });
    },
  });
};

export const useStartSeason = (seasonId: Id | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const leagueId = await resolveLeagueId(queryClient, seasonId);
      return (await api.post<{ seasonId: number }>(`/api/leagues/${leagueId}/seasons`)).data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.userLeagues }),
  });
};

export const useUpdateLeague = (leagueId: Id | undefined) => {
  const queryClient = useQueryClient();
  return useLeagueMutation(
    leagueId,
    async ({ numberTeams, ...league }: { name?: string; numberTeams?: number; notes?: string }) => {
      if (Object.keys(league).length > 0) {
        await api.patch(`/api/leagues/${await resolveLeagueId(queryClient, leagueId)}`, league);
      }
      if (numberTeams !== undefined) {
        await api.patch(`/api/seasons/${leagueId}`, { numberTeams });
      }
    },
  );
};

export const useUpdateSettings = (leagueId: Id | undefined) =>
  useLeagueMutation(
    leagueId,
    async (body: object) =>
      (await api.patch<LeagueSettings>(`/api/seasons/${leagueId}/settings`, body)).data,
  );

export const useSetMemberRole = (leagueId: Id | undefined) => {
  const queryClient = useQueryClient();
  return useLeagueMutation(
    leagueId,
    async (v: { userId: number; role: "commissioner" | "member" }) => {
      const league = await resolveLeagueId(queryClient, leagueId);
      await api.patch(`/api/leagues/${league}/members/${v.userId}`, { role: v.role });
    },
  );
};

export const useAssignTeamOwner = (leagueId: Id | undefined) =>
  useLeagueMutation(
    leagueId,
    async (v: { teamId: number; userId: number | null }) =>
      (
        await api.put<LeagueOverview>(`/api/seasons/${leagueId}/teams/${v.teamId}/owner`, {
          userId: v.userId,
        })
      ).data,
  );

export const useRemoveMember = (leagueId: Id | undefined) => {
  const queryClient = useQueryClient();
  return useLeagueMutation(leagueId, async (userId: number) => {
    const league = await resolveLeagueId(queryClient, leagueId);
    await api.delete(`/api/leagues/${league}/members/${userId}`);
  });
};

export const useRegenerateInvite = (leagueId: Id | undefined) => {
  const queryClient = useQueryClient();
  return useLeagueMutation(
    leagueId,
    async () =>
      (
        await api.post<Invite>(
          `/api/leagues/${await resolveLeagueId(queryClient, leagueId)}/invite`,
          {},
        )
      ).data,
  );
};

export const useRevokeInvite = (leagueId: Id | undefined) => {
  const queryClient = useQueryClient();
  return useLeagueMutation(leagueId, async () => {
    await api.delete(`/api/leagues/${await resolveLeagueId(queryClient, leagueId)}/invite`);
  });
};

export const useJoinWithCode = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) =>
      (await api.post<JoinResult>(`/api/invites/${code.trim().toUpperCase()}/join`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.userLeagues }),
  });
};

export const useRenameTeam = (teamId: Id | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) =>
      (await api.patch<TeamDetails>(`/api/teams/${teamId}`, { name })).data,
    onSuccess: (data) => {
      queryClient.setQueryData(keys.team(teamId ?? ""), data);
      queryClient.invalidateQueries({ queryKey: ["league"] });
      queryClient.invalidateQueries({ queryKey: ["standings"] });
    },
  });
};

export interface LineupMoveRequest {
  round: number;
  playerId: number;
  slotIndex: number | null;
  /** A commissioner's agreement to move a locked player. */
  confirmOverride?: boolean;
}

export const useMoveInLineup = (teamId: Id | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: LineupMoveRequest) =>
      (await api.post<TeamDetails>(`/api/teams/${teamId}/lineup`, body)).data,
    onSuccess: (data) => {
      queryClient.setQueryData(keys.team(teamId ?? ""), data);
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      // Only starters score, so a move changes the standings and the breakdown.
      for (const key of ["standings", "breakdown"]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });
};

/** Whether a failed lineup move is the server asking a commissioner to confirm. */
export const needsOverrideConfirmation = (error: unknown): boolean =>
  (error as { response?: { data?: { code?: unknown } } } | null)?.response?.data?.code ===
  "override_confirmation_required";

/** One feed, newest first, a page at a time. `scope` is the season or one team. */
export const useActivityFeed = (scope: "seasons" | "teams", id: Id | undefined) =>
  useInfiniteQuery({
    queryKey: keys.activity(scope, id ?? ""),
    queryFn: ({ signal, pageParam }) => {
      const before = pageParam ? `?before=${pageParam}` : "";
      return get<ActivityFeed>(`/api/${scope}/${id}/activity${before}`, signal);
    },
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextBefore ?? undefined,
    enabled: id !== undefined,
    refetchInterval: 60_000,
  });

/** The member expanded a feed: tell the server so its new-activity dot clears. */
export const useMarkActivityViewed = (scope: "seasons" | "teams", id: Id | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (upToEventId: number) => {
      await api.post(`/api/${scope}/${id}/activity/viewed`, { upToEventId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.activity(scope, id ?? "") });
      queryClient.invalidateQueries({ queryKey: keys.userLeagues });
    },
  });
};

type DraftAction = "lobby" | "start" | "pause" | "resume" | "undo";

export const useDraftControl = (leagueId: Id | undefined) => {
  const queryClient = useQueryClient();
  const base = `/api/drafts/${leagueId}`;
  const update = (data: DraftState) => queryClient.setQueryData(keys.draft(leagueId ?? ""), data);
  return useMutation({
    mutationFn: async (action: DraftAction | "force-pick" | "randomize") => {
      const path =
        action === "force-pick"
          ? `${base}/force-pick`
          : action === "randomize"
            ? `${base}/order/randomize`
            : `${base}/control/${action}`;
      return (await api.post<DraftState>(path)).data;
    },
    onSuccess: update,
  });
};

export const useDraftSetup = (leagueId: Id | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: object) =>
      (await api.patch<DraftState>(`/api/drafts/${leagueId}`, body)).data,
    onSuccess: (data) => queryClient.setQueryData(keys.draft(leagueId ?? ""), data),
  });
};

export const useDraftOrder = (leagueId: Id | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (teamIds: (number | null)[]) =>
      (await api.put<DraftState>(`/api/drafts/${leagueId}/order`, { teamIds })).data,
    onSuccess: (data) => queryClient.setQueryData(keys.draft(leagueId ?? ""), data),
  });
};

export const useAdminSync = () =>
  useMutation({
    mutationFn: async () =>
      (
        await api.post<SyncResult>("/api/admin/update/all", {
          withStats: true,
          withBoxScores: false,
        })
      ).data,
  });

/** Admin-only: poll live games now. Stats shown on standings and team pages reload afterwards. */
export const useRefreshLive = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.post<{ polled: number }>("/api/admin/refresh/live")).data,
    onSuccess: () => {
      for (const key of ["sync-status", "standings", "team", "breakdown", "player-season-stats"]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
  });
};

export const useSaveQueue = (leagueId: Id | undefined) =>
  useMutation({
    mutationFn: async (playerIds: number[]) =>
      (await api.put<{ playerIds: number[] }>(`/api/drafts/${leagueId}/queue`, { playerIds })).data
        .playerIds,
  });
