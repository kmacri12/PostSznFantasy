import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type {
  DraftInfo,
  LeagueByUser,
  LeagueSettings,
  PlayerSummary,
  StandingsRow,
  SyncResult,
  TeamDetails,
  TeamSummary,
} from "./types";

export const keys = {
  userLeagues: ["user-leagues"] as const,
  standings: (leagueId: string | number) => ["standings", String(leagueId)] as const,
  teams: (leagueId: string | number) => ["teams", String(leagueId)] as const,
  team: (teamId: string | number) => ["team", String(teamId)] as const,
  settings: (leagueId: string | number) => ["settings", String(leagueId)] as const,
  draftInfo: (leagueId: string | number) => ["draft-info", String(leagueId)] as const,
  players: ["players"] as const,
  seasonStats: ["player-season-stats"] as const,
  scoringDefaults: ["scoring-defaults"] as const,
};

const get = async <T>(url: string, signal?: AbortSignal): Promise<T> =>
  (await api.get<T>(url, { signal })).data;

export const useUserLeagues = (enabled: boolean) =>
  useQuery({
    queryKey: keys.userLeagues,
    queryFn: ({ signal }) => get<LeagueByUser[]>("/api/leagues/user-leagues", signal),
    enabled,
  });

export const useStandings = (leagueId: string | number | undefined) =>
  useQuery({
    queryKey: keys.standings(leagueId ?? ""),
    queryFn: ({ signal }) => get<StandingsRow[]>(`/api/leagues/${leagueId}/standings`, signal),
    enabled: leagueId !== undefined,
  });

export const useLeagueTeams = (leagueId: string | number | undefined) =>
  useQuery({
    queryKey: keys.teams(leagueId ?? ""),
    queryFn: ({ signal }) => get<TeamSummary[]>(`/api/leagues/${leagueId}/teams`, signal),
    enabled: leagueId !== undefined,
  });

export const useTeam = (teamId: string | undefined) =>
  useQuery({
    queryKey: keys.team(teamId ?? ""),
    queryFn: ({ signal }) => get<TeamDetails>(`/api/leagues/teams/${teamId}`, signal),
    enabled: teamId !== undefined,
  });

export const useLeagueSettings = (leagueId: string | number | undefined) =>
  useQuery({
    queryKey: keys.settings(leagueId ?? ""),
    queryFn: ({ signal }) => get<LeagueSettings>(`/api/leagues/${leagueId}/settings`, signal),
    enabled: leagueId !== undefined,
  });

export const useDraftInfo = (leagueId: string | number | undefined) =>
  useQuery({
    queryKey: keys.draftInfo(leagueId ?? ""),
    queryFn: ({ signal }) => get<DraftInfo>(`/api/drafts/draft-info/${leagueId}`, signal),
    enabled: leagueId !== undefined,
    retry: false,
  });

export const usePlayerList = () =>
  useQuery({
    queryKey: keys.players,
    queryFn: ({ signal }) => get<PlayerSummary[]>("/api/players/player-list", signal),
    staleTime: 5 * 60_000,
  });

export const usePlayerSeasonStats = <T>() =>
  useQuery({
    queryKey: keys.seasonStats,
    queryFn: ({ signal }) => get<T[]>("/api/players/player-season-stats", signal),
    staleTime: 5 * 60_000,
  });

export const useScoringDefaults = () =>
  useQuery({
    queryKey: keys.scoringDefaults,
    queryFn: ({ signal }) => get<Record<string, number>>("/api/leagues/scoring-defaults", signal),
    staleTime: Number.POSITIVE_INFINITY,
  });

export const useCreateLeague = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: object) =>
      (await api.post<{ leagueId?: number }>("/api/leagues/create-league", body)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.userLeagues }),
  });
};

export const useUpdateSettings = (leagueId: string | number | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: object) =>
      (await api.put<LeagueSettings>(`/api/leagues/${leagueId}/settings`, body)).data,
    onSuccess: (data) => queryClient.setQueryData(keys.settings(leagueId ?? ""), data),
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

export const invalidateLeague = (queryClient: QueryClient, leagueId: string | number) =>
  queryClient.invalidateQueries({ predicate: (q) => q.queryKey[1] === String(leagueId) });
