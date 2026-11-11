import {
  type InfiniteData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { type HourCycle, setDisplayPreferences } from "../utils/timeZone";
import { api } from "./client";
import { normalizeFeed, normalizeLeague } from "./normalize";
import type {
  ActivityFeed,
  Bracket,
  DraftState,
  Features,
  Feed,
  FeedMessageItem,
  Inbox,
  Invite,
  InvitePreview,
  JoinResult,
  LeagueByUser,
  LeagueInfo,
  LeagueSettings,
  PastLeague,
  PlayerSeasonLine,
  PlayerSummary,
  SeasonOverview,
  SeasonRecap,
  SeasonSummary,
  Standings,
  SyncResult,
  SyncStatus,
  TeamDetails,
  TeamSummary,
} from "./types";

type Id = string | number;

export const keys = {
  config: ["config"] as const,
  features: ["features"] as const,
  bracket: (seasonId: Id) => ["bracket", String(seasonId)] as const,
  userLeagues: ["user-leagues"] as const,
  pastLeagues: ["past-leagues"] as const,
  leagueInfo: (leagueId: Id) => ["league-info", String(leagueId)] as const,
  leagueSeasons: (leagueId: Id) => ["league-seasons", String(leagueId)] as const,
  season: (seasonId: Id) => ["season", String(seasonId)] as const,
  recap: (seasonId: Id) => ["recap", String(seasonId)] as const,
  standings: (seasonId: Id) => ["standings", String(seasonId)] as const,
  teams: (seasonId: Id) => ["teams", String(seasonId)] as const,
  team: (teamId: Id) => ["team", String(teamId)] as const,
  settings: (seasonId: Id) => ["settings", String(seasonId)] as const,
  draft: (seasonId: Id) => ["draft", String(seasonId)] as const,
  invite: (leagueId: Id) => ["invite", String(leagueId)] as const,
  invitePreview: (code: string) => ["invite-preview", code] as const,
  players: ["players"] as const,
  draftPool: (seasonId?: Id) => ["draft-pool", seasonId ?? "all"] as const,
  seasonStats: ["player-season-stats"] as const,
  scoringDefaults: ["scoring-defaults"] as const,
  syncStatus: ["sync-status"] as const,
  feed: (seasonId: Id) => ["feed", String(seasonId)] as const,
  inbox: ["inbox"] as const,
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

/** The owner's feature flags (kill switches). Off until loaded, so nothing flashes in and out. */
export const useFeatures = (): Features => {
  const { data } = useQuery({
    queryKey: keys.features,
    queryFn: ({ signal }) => get<Features>("/api/features", signal),
    staleTime: 60_000,
  });
  return data ?? { bracket: false };
};

const BRACKET_LIVE_REFRESH_MS = 30_000;

export const useBracket = (seasonId: Id | undefined) =>
  useQuery({
    queryKey: keys.bracket(seasonId ?? ""),
    queryFn: ({ signal }) => get<Bracket>(`/api/seasons/${seasonId}/bracket`, signal),
    enabled: seasonId !== undefined,
    refetchInterval: (query) =>
      query.state.data?.rounds.some((r) => r.games.some((g) => g.state === "live"))
        ? BRACKET_LIVE_REFRESH_MS
        : false,
    refetchOnWindowFocus: true,
  });

export const useUserLeagues = (enabled: boolean) =>
  useQuery({
    queryKey: keys.userLeagues,
    queryFn: async ({ signal }) =>
      (await get<LeagueByUser[]>("/api/leagues/user-leagues", signal)).map(normalizeLeague),
    enabled,
    refetchInterval: 60_000, // the nav dot for new league activity
  });

/** Leagues the caller left, with the finished seasons they still may read. */
export const usePastLeagues = (enabled: boolean) =>
  useQuery({
    queryKey: keys.pastLeagues,
    queryFn: ({ signal }) => get<PastLeague[]>("/api/leagues/past-leagues", signal),
    enabled,
  });

/** The seasons of a league the caller may open (all for a member, finished ones after leaving). */
export const useLeagueSeasons = (leagueId: Id | undefined) =>
  useQuery({
    queryKey: keys.leagueSeasons(leagueId ?? ""),
    queryFn: ({ signal }) => get<SeasonSummary[]>(`/api/leagues/${leagueId}/seasons`, signal),
    enabled: leagueId !== undefined,
    retry: false,
  });

/** A season's home data and the caller's `canEdit` / `canCommission` flags in it. */
export const useSeason = (seasonId: Id | undefined) =>
  useQuery({
    queryKey: keys.season(seasonId ?? ""),
    queryFn: ({ signal }) => get<SeasonOverview>(`/api/seasons/${seasonId}`, signal),
    enabled: seasonId !== undefined,
    retry: false,
  });

/** The permanent league: notes, members, whether a next season can start. Members only. */
export const useLeagueInfo = (leagueId: Id | undefined, enabled = true) =>
  useQuery({
    queryKey: keys.leagueInfo(leagueId ?? ""),
    queryFn: ({ signal }) => get<LeagueInfo>(`/api/leagues/${leagueId}`, signal),
    enabled: enabled && leagueId !== undefined,
  });

/** Milliseconds between standings refetches while a game is live; scores land every poll cycle. */
export const STANDINGS_REFRESH_MS = 20_000;

/** Polling runs only inside a game window; at other times the page refreshes when it regains focus. */
export const standingsRefetchInterval = (standings: Standings | undefined): number | false =>
  standings && standings.gamesInProgress > 0 ? STANDINGS_REFRESH_MS : false;

export const useStandings = (seasonId: Id | undefined) =>
  useQuery({
    queryKey: keys.standings(seasonId ?? ""),
    queryFn: ({ signal }) => get<Standings>(`/api/seasons/${seasonId}/standings`, signal),
    enabled: seasonId !== undefined,
    refetchInterval: (query) => standingsRefetchInterval(query.state.data),
    refetchOnWindowFocus: true,
  });

export const useRecap = (seasonId: Id | undefined) =>
  useQuery({
    queryKey: keys.recap(seasonId ?? ""),
    queryFn: ({ signal }) => get<SeasonRecap>(`/api/seasons/${seasonId}/recap`, signal),
    enabled: seasonId !== undefined,
  });

export const useLeagueTeams = (seasonId: Id | undefined) =>
  useQuery({
    queryKey: keys.teams(seasonId ?? ""),
    queryFn: ({ signal }) => get<TeamSummary[]>(`/api/seasons/${seasonId}/teams`, signal),
    enabled: seasonId !== undefined,
  });

export const useTeam = (teamId: Id | undefined) =>
  useQuery({
    queryKey: keys.team(teamId ?? ""),
    queryFn: ({ signal }) => get<TeamDetails>(`/api/teams/${teamId}`, signal),
    enabled: teamId !== undefined,
  });

export const useLeagueSettings = (seasonId: Id | undefined) =>
  useQuery({
    queryKey: keys.settings(seasonId ?? ""),
    queryFn: ({ signal }) => get<LeagueSettings>(`/api/seasons/${seasonId}/settings`, signal),
    enabled: seasonId !== undefined,
  });

/** `pollMs` keeps a read-only view (the standalone board) current without the draft socket. */
export const useDraft = (seasonId: Id | undefined, pollMs?: number) =>
  useQuery({
    queryKey: keys.draft(seasonId ?? ""),
    queryFn: ({ signal }) => get<DraftState>(`/api/drafts/draft-info/${seasonId}`, signal),
    enabled: seasonId !== undefined,
    retry: false,
    refetchInterval: pollMs,
  });

/** Draftable players on the playoff teams; with a league, its team QB / team K settings narrow and flag the pool. */
export const useDraftPool = (seasonId?: Id) =>
  useQuery({
    queryKey: keys.draftPool(seasonId),
    queryFn: ({ signal }) =>
      get<PlayerSummary[]>(
        seasonId === undefined
          ? "/api/players/draft-pool"
          : `/api/players/draft-pool?seasonId=${seasonId}`,
        signal,
      ),
    staleTime: 5 * 60_000,
  });

export const usePlayerSeasonStats = <T>(season: string | undefined, seasonId: Id | undefined) =>
  useQuery({
    queryKey: [...keys.seasonStats, season, seasonId ?? "none"],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ season: season ?? "" });
      if (seasonId !== undefined) params.set("seasonId", String(seasonId));
      return get<T[]>(`/api/players/player-season-stats?${params}`, signal);
    },
    enabled: !!season,
    staleTime: 5 * 60_000,
  });

/** One player's regular season stats (the player sheet); the latest season unless given. */
export const usePlayerSeasonLine = (playerId: Id | undefined) =>
  useQuery({
    queryKey: [...keys.seasonStats, "line", playerId ?? "none"],
    queryFn: async ({ signal }) =>
      (
        await get<PlayerSeasonLine[]>(
          `/api/players/player-season-stats?playerId=${playerId}`,
          signal,
        )
      )[0] ?? null,
    enabled: playerId !== undefined,
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
      (await api.post<{ leagueId?: number; seasonId?: number }>("/api/leagues/create-league", body))
        .data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.userLeagues }),
  });
};

/** League and season data a membership, setting or team change can touch. */
const LEAGUE_DATA_KEYS = [
  "league-info",
  "league-seasons",
  "season",
  "settings",
  "teams",
  "team",
  "standings",
  "invite",
  "draft",
];

/** Mutation whose success refreshes every cached league and season view. */
const useLeagueMutation = <TVariables, TResult>(
  request: (variables: TVariables) => Promise<TResult>,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: request,
    // Awaited so a caller's onSuccess (e.g. navigating to the new season) sees fresh lists.
    onSuccess: () =>
      Promise.all([
        ...LEAGUE_DATA_KEYS.map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
        queryClient.invalidateQueries({ queryKey: keys.userLeagues }),
        queryClient.invalidateQueries({ queryKey: keys.pastLeagues }),
      ]),
  });
};

export const useStartSeason = (leagueId: Id | undefined) =>
  useLeagueMutation(
    async () => (await api.post<{ seasonId: number }>(`/api/leagues/${leagueId}/seasons`)).data,
  );

export const useUpdateLeague = (leagueId: Id | undefined) =>
  useLeagueMutation(async (body: { name?: string; notes?: string }) => {
    await api.patch(`/api/leagues/${leagueId}`, body);
  });

export const usePinAnnouncement = (leagueId: Id | undefined) =>
  useLeagueMutation(async (body: { body: string; push: boolean }) => {
    await api.put(`/api/leagues/${leagueId}/announcement`, body);
  });

export const useUnpinAnnouncement = (leagueId: Id | undefined) =>
  useLeagueMutation(async () => {
    await api.delete(`/api/leagues/${leagueId}/announcement`);
  });

export const useUpdateSeason = (seasonId: Id | undefined) =>
  useLeagueMutation(async (body: { numberTeams: number }) => {
    await api.patch(`/api/seasons/${seasonId}`, body);
  });

export const useUpdateSettings = (seasonId: Id | undefined) =>
  useLeagueMutation(
    async (body: object) =>
      (await api.patch<LeagueSettings>(`/api/seasons/${seasonId}/settings`, body)).data,
  );

export const useSetMemberRole = (leagueId: Id | undefined) =>
  useLeagueMutation(async (v: { userId: number; role: "commissioner" | "member" }) => {
    await api.patch(`/api/leagues/${leagueId}/members/${v.userId}`, { role: v.role });
  });

export const useAssignTeamOwner = (seasonId: Id | undefined) =>
  useLeagueMutation(async (v: { teamId: number; userId: number | null }) => {
    await api.put(`/api/seasons/${seasonId}/teams/${v.teamId}/owner`, { userId: v.userId });
  });

export const useRemoveMember = (leagueId: Id | undefined) =>
  useLeagueMutation(async (userId: number) => {
    await api.delete(`/api/leagues/${leagueId}/members/${userId}`);
  });

/** Leave the league yourself; the league then disappears from the caller's list. */
export const useLeaveLeague = (leagueId: Id | undefined, userId: number | null) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async () => {
      await api.delete(`/api/leagues/${leagueId}/members/${userId}`);
    },
    onSuccess: () => {
      navigate("/", { replace: true });
      window.scrollTo(0, 0);
      queryClient.removeQueries({ queryKey: keys.leagueSeasons(leagueId ?? "") });
      queryClient.removeQueries({ queryKey: keys.leagueInfo(leagueId ?? "") });
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.userLeagues }),
        queryClient.invalidateQueries({ queryKey: keys.pastLeagues }),
      ]);
    },
  });
};

export const useRegenerateInvite = (leagueId: Id | undefined) =>
  useLeagueMutation(
    async () => (await api.post<Invite>(`/api/leagues/${leagueId}/invite`, {})).data,
  );

export const useRevokeInvite = (leagueId: Id | undefined) =>
  useLeagueMutation(async () => {
    await api.delete(`/api/leagues/${leagueId}/invite`);
  });

/** Delete the league for every member (soft delete; the API checks the typed name too). */
export const useDeleteLeague = (leagueId: Id | undefined) => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async (leagueName: string) => {
      await api.delete(`/api/leagues/${leagueId}`, { data: { leagueName } });
    },
    // Leave first: refetching the deleted league's pages in place would show its deleted page.
    onSuccess: () => {
      navigate("/", { replace: true });
      window.scrollTo(0, 0);
      queryClient.removeQueries({ queryKey: keys.leagueSeasons(leagueId ?? "") });
      queryClient.removeQueries({ queryKey: keys.leagueInfo(leagueId ?? "") });
      return Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.userLeagues }),
        queryClient.invalidateQueries({ queryKey: keys.pastLeagues }),
      ]);
    },
  });
};

/** Delete the signed-in member's account (#330); the API says which league needs a new commissioner. */
export const useDeleteAccount = () =>
  useMutation({
    mutationFn: async (confirm: string) => {
      await api.delete("/api/auth/me", { data: { confirm } });
    },
  });

export interface AccountDevice {
  id: number;
  label: string;
  createdAt: string;
  lastSeen: string;
}

export interface Account {
  username: string;
  email: string | null;
  /** How this identity signs in: "google", "email". */
  signInMethods: string[];
  displayTimeZone: string | null;
  hourCycle: HourCycle | null;
  devices: AccountDevice[];
}

const accountKey = ["account"] as const;

/** The account center (#405): sign-in methods, saved time zone and clock, devices. */
export const useAccount = () =>
  useQuery({
    queryKey: accountKey,
    queryFn: ({ signal }) => get<Account>("/api/account", signal),
  });

export const useSaveDisplayPreferences = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { displayTimeZone?: string | null; hourCycle?: HourCycle | null }) =>
      (
        await api.patch<{ displayTimeZone: string | null; hourCycle: HourCycle | null }>(
          "/api/account/preferences",
          body,
        )
      ).data,
    onSuccess: (saved) => {
      setDisplayPreferences({ timeZone: saved.displayTimeZone, hourCycle: saved.hourCycle });
      // Every shown time reads the preference when it renders, so refetching redraws them.
      queryClient.invalidateQueries();
    },
  });
};

export const useRemoveDevice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/api/account/devices/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: accountKey }),
  });
};

/** Downloads the member's data as a JSON file (the API's `Content-Disposition` names it). */
export const downloadMyData = async (): Promise<void> => {
  const { data } = await api.get<Blob>("/api/account/export", { responseType: "blob" });
  const url = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = url;
  link.download = "postszn-my-data.json";
  link.click();
  URL.revokeObjectURL(url);
};

/** For callers outside React Query (the draft socket): recheck whether the league still exists. */
export const useRecheckLeague = () => {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ["league-seasons"] });
};

export const useJoinWithCode = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) =>
      (await api.post<JoinResult>(`/api/invites/${code.trim().toUpperCase()}/join`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.userLeagues }),
  });
};

export interface PushPreferences {
  draftAlerts: boolean;
  lineupReminders: boolean;
  chat: boolean;
  mentions: boolean;
  starterAlerts: boolean;
  scoreAlerts: boolean;
  roundResults: boolean;
  announcements: boolean;
  quietHours: boolean;
  /** The IANA zone quiet hours are counted in, as this browser last reported it. */
  timezone: string | null;
  mutedLeagueIds: number[];
}

export const usePushPreferences = () =>
  useQuery({
    queryKey: ["push-preferences"] as const,
    queryFn: ({ signal }) => get<PushPreferences>("/api/push/preferences", signal),
  });

export const useUpdatePushPreferences = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<Omit<PushPreferences, "mutedLeagueIds">>) =>
      (await api.patch<PushPreferences>("/api/push/preferences", body)).data,
    onSuccess: (data) => queryClient.setQueryData(["push-preferences"], data),
  });
};

export const useMuteLeagueChat = (leagueId: Id | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (muted: boolean) => {
      await api.put(`/api/push/chat-mute/${leagueId}`, { muted });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["push-preferences"] }),
  });
};

/** The notification inbox behind the header bell. */
export const useInbox = (enabled: boolean) =>
  useQuery({
    queryKey: keys.inbox,
    queryFn: ({ signal }) => get<Inbox>("/api/notifications", signal),
    enabled,
    refetchInterval: 60_000, // the bell's count
  });

/** Marks the given entries read, or every entry without `ids`. */
export const useMarkInboxRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids?: number[]) => {
      await api.post("/api/notifications/read", ids ? { ids } : {});
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.inbox }),
  });
};

export const useRenameTeam = (teamId: Id | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) =>
      (await api.patch<TeamDetails>(`/api/teams/${teamId}`, { name })).data,
    onSuccess: (data) => {
      queryClient.setQueryData(keys.team(teamId ?? ""), data);
      queryClient.invalidateQueries({ queryKey: ["season"] });
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
      // Only starters score, so a move changes the standings.
      queryClient.invalidateQueries({ queryKey: ["standings"] });
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

/** Seconds between feed refetches while the live socket is down. */
const FEED_FALLBACK_POLL_MS = 30_000;

/** Events and chat merged, newest first, a page at a time. */
export const useFeed = (seasonId: Id | undefined, socketConnected: boolean) =>
  useInfiniteQuery({
    queryKey: keys.feed(seasonId ?? ""),
    queryFn: async ({ signal, pageParam }) => {
      const before = pageParam ? `?before=${encodeURIComponent(pageParam)}` : "";
      return normalizeFeed(await get<Feed>(`/api/seasons/${seasonId}/feed${before}`, signal));
    },
    initialPageParam: "",
    getNextPageParam: (last) => last.nextBefore ?? undefined,
    enabled: seasonId !== undefined,
    refetchInterval: socketConnected ? false : FEED_FALLBACK_POLL_MS,
  });

/** The Feed was shown: clear its dot for the newest event and message on screen. */
export const useMarkFeedViewed = (seasonId: Id | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (upTo: { upToEventId?: number; upToMessageId?: number }) => {
      await api.post(`/api/seasons/${seasonId}/feed/viewed`, upTo);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.feed(seasonId ?? "") });
      queryClient.invalidateQueries({ queryKey: keys.userLeagues });
    },
  });
};

export interface MessageDraft {
  body: string;
  gifUrl?: string;
  replyToId?: number;
  /** Members picked from the @ autocomplete; their `@name` is in the body. */
  mentionedUserIds?: number[];
}

/** The sender, so a message shows in the Feed the moment it is sent. */
export interface MessageAuthor {
  userId: number | null;
  name: string;
}

type FeedCache = InfiniteData<Feed, string>;

/** Adds a message to the newest end of the cached feed; used for the optimistic send. */
export const withPendingMessage = (
  cache: FeedCache | undefined,
  message: FeedMessageItem,
): FeedCache | undefined =>
  cache && {
    ...cache,
    pages: cache.pages.map((page, index) =>
      index === 0 ? { ...page, items: [message, ...page.items] } : page,
    ),
  };

/**
 * Sends a chat message. It appears in the Feed at once; if the server refuses it the cache
 * goes back to what it was and the caller's `onError` says so.
 */
export const usePostMessage = (seasonId: Id | undefined, author?: MessageAuthor) => {
  const queryClient = useQueryClient();
  const feedKey = keys.feed(seasonId ?? "");
  return useMutation({
    mutationFn: async (draft: MessageDraft) =>
      (await api.post<FeedMessageItem>(`/api/seasons/${seasonId}/messages`, draft)).data,
    onMutate: async (draft) => {
      await queryClient.cancelQueries({ queryKey: feedKey });
      const previous = queryClient.getQueryData<FeedCache>(feedKey);
      if (author) {
        queryClient.setQueryData<FeedCache>(
          feedKey,
          withPendingMessage(previous, {
            type: "message",
            id: -Date.now(),
            createdAt: new Date().toISOString(),
            authorUserId: author.userId,
            authorName: author.name,
            body: draft.body,
            gifUrl: draft.gifUrl ?? null,
            canDelete: false,
            canEdit: false,
            editedAt: null,
            isNew: false,
            replyTo: null,
            mentions: [],
            reactions: [],
          }),
        );
      }
      return { previous };
    },
    onError: (_error, _draft, context) => {
      if (context?.previous) queryClient.setQueryData(feedKey, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: feedKey }),
  });
};

export const useEditMessage = (seasonId: Id | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      messageId,
      body,
      mentionedUserIds,
    }: {
      messageId: number;
      body: string;
      mentionedUserIds: number[];
    }) =>
      (
        await api.patch<FeedMessageItem>(`/api/seasons/${seasonId}/messages/${messageId}`, {
          body,
          mentionedUserIds,
        })
      ).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.feed(seasonId ?? "") }),
  });
};

export const useReactToMessage = (seasonId: Id | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      messageId,
      emoji,
      reacted,
    }: {
      messageId: number;
      emoji: string;
      reacted: boolean;
    }) => {
      await api.put(`/api/seasons/${seasonId}/messages/${messageId}/reactions`, {
        emoji,
        reacted,
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.feed(seasonId ?? "") }),
  });
};

export const useDeleteMessage = (seasonId: Id | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (messageId: number) => {
      await api.delete(`/api/seasons/${seasonId}/messages/${messageId}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.feed(seasonId ?? "") }),
  });
};

type DraftAction = "lobby" | "start" | "pause" | "resume" | "undo";

export const useDraftControl = (seasonId: Id | undefined) => {
  const queryClient = useQueryClient();
  const base = `/api/drafts/${seasonId}`;
  const update = (data: DraftState) => queryClient.setQueryData(keys.draft(seasonId ?? ""), data);
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

export const useAssignPick = (seasonId: Id | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: { pickNumber: number; playerId: number; replace: boolean }) =>
      (await api.post<DraftState>(`/api/drafts/${seasonId}/assign`, body)).data,
    onSuccess: (data) => queryClient.setQueryData(keys.draft(seasonId ?? ""), data),
  });
};

export const useClearReservedPick = (seasonId: Id | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (pickNumber: number) =>
      (await api.delete<DraftState>(`/api/drafts/${seasonId}/assign/${pickNumber}`)).data,
    onSuccess: (data) => queryClient.setQueryData(keys.draft(seasonId ?? ""), data),
  });
};

export const useDraftSetup = (seasonId: Id | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: object) =>
      (await api.patch<DraftState>(`/api/drafts/${seasonId}`, body)).data,
    onSuccess: (data) => queryClient.setQueryData(keys.draft(seasonId ?? ""), data),
  });
};

export const useDraftOrder = (seasonId: Id | undefined) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (teamIds: (number | null)[]) =>
      (await api.put<DraftState>(`/api/drafts/${seasonId}/order`, { teamIds })).data,
    onSuccess: (data) => queryClient.setQueryData(keys.draft(seasonId ?? ""), data),
  });
};

export const useAdminSync = () =>
  useMutation({
    mutationFn: async () =>
      (
        await api.post<SyncResult>("/api/admin/update/all?wait=true", {
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

export const useSaveQueue = (seasonId: Id | undefined) =>
  useMutation({
    mutationFn: async (playerIds: number[]) =>
      (await api.put<{ playerIds: number[] }>(`/api/drafts/${seasonId}/queue`, { playerIds })).data
        .playerIds,
  });

export interface SupportReport {
  message: string;
  images: File[];
  /** Already scrubbed client-side; null when the member left it out. */
  diagnostics: object | null;
}

export const useReportProblem = () =>
  useMutation({
    mutationFn: async ({ message, images, diagnostics }: SupportReport) => {
      const form = new FormData();
      form.append("message", message);
      if (diagnostics) form.append("diagnostics", JSON.stringify(diagnostics));
      for (const image of images) form.append("images", image);
      await api.post("/api/support", form);
    },
  });

export interface Feedback {
  rating: number | null;
  good: string;
  bad: string;
}

export const useSendFeedback = () =>
  useMutation({
    mutationFn: async (feedback: Feedback) => {
      await api.post("/api/support/feedback", feedback);
    },
  });

/** The API's build commit, for support reports; null while unknown or unreachable. */
export const useApiVersion = () =>
  useQuery({
    queryKey: ["api-version"],
    queryFn: async () => (await api.get<{ version?: string }>("/api")).data.version ?? null,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  });

export type AvatarTarget =
  | { kind: "me" }
  | { kind: "league"; id: Id | undefined }
  | { kind: "team"; id: Id | undefined };

const avatarPath = (target: AvatarTarget): string =>
  target.kind === "me"
    ? "/api/avatars/me"
    : target.kind === "league"
      ? `/api/leagues/${target.id}/avatar`
      : `/api/teams/${target.id}/avatar`;

// Everything that carries a picture: the league list and overview, members, teams, standings.
const AVATAR_DATA_KEYS = ["league-info", "season", "teams", "team", "standings"] as const;

/** Sets the picture (a cropped Blob) or removes it (null); resolves to the new `avatarUrl`. */
export const useSetAvatar = (target: AvatarTarget) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (picture: Blob | null): Promise<string | null> => {
      if (!picture) {
        await api.delete(avatarPath(target));
        return null;
      }
      const { data } = await api.put<{ avatarUrl: string | null }>(avatarPath(target), picture, {
        headers: { "Content-Type": picture.type },
      });
      return data.avatarUrl;
    },
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: keys.userLeagues }),
        ...AVATAR_DATA_KEYS.map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
      ]),
  });
};
