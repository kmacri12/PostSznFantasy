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
  PlayerSummary,
  StandingsRow,
  SyncResult,
  SyncStatus,
  TeamDetails,
  TeamSummary,
} from "./types";

type Id = string | number;

export const keys = {
  config: ["config"] as const,
  userLeagues: ["user-leagues"] as const,
  league: (leagueId: Id) => ["league", String(leagueId)] as const,
  standings: (leagueId: Id) => ["standings", String(leagueId)] as const,
  teams: (leagueId: Id) => ["teams", String(leagueId)] as const,
  team: (teamId: Id) => ["team", String(teamId)] as const,
  settings: (leagueId: Id) => ["settings", String(leagueId)] as const,
  draft: (leagueId: Id) => ["draft", String(leagueId)] as const,
  invite: (leagueId: Id) => ["invite", String(leagueId)] as const,
  invitePreview: (code: string) => ["invite-preview", code] as const,
  players: ["players"] as const,
  draftPool: ["draft-pool"] as const,
  seasonStats: ["player-season-stats"] as const,
  scoringDefaults: ["scoring-defaults"] as const,
  syncStatus: ["sync-status"] as const,
  activity: (scope: "leagues" | "teams", id: Id) => ["activity", scope, String(id)] as const,
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
    queryFn: ({ signal }) => get<LeagueByUser[]>("/api/leagues/user-leagues", signal),
    enabled,
    // The nav dot for new league activity.
    refetchInterval: 60_000,
  });

export const useLeague = (leagueId: Id | undefined) =>
  useQuery({
    queryKey: keys.league(leagueId ?? ""),
    queryFn: ({ signal }) => get<LeagueOverview>(`/api/leagues/${leagueId}`, signal),
    enabled: leagueId !== undefined,
  });

export const useStandings = (leagueId: Id | undefined) =>
  useQuery({
    queryKey: keys.standings(leagueId ?? ""),
    queryFn: ({ signal }) => get<StandingsRow[]>(`/api/leagues/${leagueId}/standings`, signal),
    enabled: leagueId !== undefined,
  });

export const useLeagueTeams = (leagueId: Id | undefined) =>
  useQuery({
    queryKey: keys.teams(leagueId ?? ""),
    queryFn: ({ signal }) => get<TeamSummary[]>(`/api/leagues/${leagueId}/teams`, signal),
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
    queryFn: ({ signal }) => get<LeagueSettings>(`/api/leagues/${leagueId}/settings`, signal),
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

/** Draftable players on the playoff teams. */
export const useDraftPool = () =>
  useQuery({
    queryKey: keys.draftPool,
    queryFn: ({ signal }) => get<PlayerSummary[]>("/api/players/draft-pool", signal),
    staleTime: 5 * 60_000,
  });

export const usePlayerSeasonStats = <T>(season: string | undefined, leagueId: Id | undefined) =>
  useQuery({
    queryKey: [...keys.seasonStats, season, leagueId ?? "none"],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ season: season ?? "" });
      if (leagueId !== undefined) params.set("leagueId", String(leagueId));
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

export const useInvite = (leagueId: Id | undefined, enabled: boolean) =>
  useQuery({
    queryKey: keys.invite(leagueId ?? ""),
    queryFn: ({ signal }) => get<Invite | null>(`/api/leagues/${leagueId}/invite`, signal),
    enabled: enabled && leagueId !== undefined,
  });

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
      (await api.post<{ leagueId?: number }>("/api/leagues/create-league", body)).data,
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

export const useUpdateLeague = (leagueId: Id | undefined) =>
  useLeagueMutation(
    leagueId,
    async (body: { name?: string; numberTeams?: number }) =>
      (await api.patch<LeagueOverview>(`/api/leagues/${leagueId}`, body)).data,
  );

export const useUpdateSettings = (leagueId: Id | undefined) =>
  useLeagueMutation(
    leagueId,
    async (body: object) =>
      (await api.patch<LeagueSettings>(`/api/leagues/${leagueId}/settings`, body)).data,
  );

export const useSetMemberRole = (leagueId: Id | undefined) =>
  useLeagueMutation(
    leagueId,
    async (v: { userId: number; role: "commissioner" | "member" }) =>
      (
        await api.patch<LeagueOverview>(`/api/leagues/${leagueId}/members/${v.userId}`, {
          role: v.role,
        })
      ).data,
  );

export const useAssignTeamOwner = (leagueId: Id | undefined) =>
  useLeagueMutation(
    leagueId,
    async (v: { teamId: number; userId: number | null }) =>
      (
        await api.put<LeagueOverview>(`/api/leagues/${leagueId}/teams/${v.teamId}/owner`, {
          userId: v.userId,
        })
      ).data,
  );

export const useRemoveMember = (leagueId: Id | undefined) =>
  useLeagueMutation(
    leagueId,
    async (userId: number) =>
      (await api.delete<LeagueOverview>(`/api/leagues/${leagueId}/members/${userId}`)).data,
  );

export const useRegenerateInvite = (leagueId: Id | undefined) =>
  useLeagueMutation(
    leagueId,
    async () => (await api.post<Invite>(`/api/leagues/${leagueId}/invite`, {})).data,
  );

export const useRevokeInvite = (leagueId: Id | undefined) =>
  useLeagueMutation(leagueId, async () => {
    await api.delete(`/api/leagues/${leagueId}/invite`);
  });

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
    },
  });
};

/** Whether a failed lineup move is the server asking a commissioner to confirm. */
export const needsOverrideConfirmation = (error: unknown): boolean =>
  (error as { response?: { data?: { code?: unknown } } } | null)?.response?.data?.code ===
  "override_confirmation_required";

/** One feed, newest first, a page at a time. `scope` is the league or one team. */
export const useActivityFeed = (scope: "leagues" | "teams", id: Id | undefined) =>
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
export const useMarkActivityViewed = (scope: "leagues" | "teams", id: Id | undefined) => {
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
      for (const key of ["sync-status", "standings", "team", "player-season-stats"]) {
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
