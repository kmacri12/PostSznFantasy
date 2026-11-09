import { Box, Button, Container, Typography } from "@mui/material";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFeed, useMarkFeedViewed, useMuteLeagueChat, usePushPreferences } from "../api/queries";
import type { FeedItem, FeedMessageItem } from "../api/types";
import ErrorState from "../components/common/ErrorState";
import { friendlyError } from "../components/common/friendlyError";
import LoadingState from "../components/common/LoadingState";
import Composer from "../components/feed/Composer";
import DeleteMessageDialog from "../components/feed/DeleteMessageDialog";
import FeedEventRow from "../components/feed/FeedEventRow";
import { buildTimeline, firstNewKey, type TimelineRow } from "../components/feed/feedView";
import MessageRow from "../components/feed/MessageRow";
import { useSeasonContext } from "../contexts/SeasonContext";
import { useUser } from "../contexts/UserContext";
import { useFeedLive } from "../hooks/useFeedLive";
import { HEADER_HEIGHT, TAB_BAR_HEIGHT, tokens } from "../theme";

const NEAR_BOTTOM_PX = 160;

const nearBottom = (): boolean =>
  window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - NEAR_BOTTOM_PX;

const newestIds = (items: FeedItem[]) => ({
  upToEventId: items.find((item) => item.type === "event")?.id,
  upToMessageId: items.find((item) => item.type === "message")?.id,
});

const DateRow = ({ label }: { label: string }) => (
  <Box
    component="li"
    sx={{
      listStyle: "none",
      alignSelf: "center",
      fontSize: 11,
      fontWeight: 600,
      color: tokens.muted,
      border: `1px solid ${tokens.border}`,
      borderRadius: "10px",
      px: 1.25,
      py: "2px",
    }}
  >
    {label}
  </Box>
);

const NewDivider = () => (
  <Box
    component="li"
    sx={{
      listStyle: "none",
      alignSelf: "stretch",
      display: "flex",
      alignItems: "center",
      gap: 1,
      fontSize: 11,
      color: tokens.red,
    }}
  >
    <Box sx={{ flex: 1, height: "1px", bgcolor: tokens.dangerBorder }} />
    New
    <Box sx={{ flex: 1, height: "1px", bgcolor: tokens.dangerBorder }} />
  </Box>
);

/** The Feed tab: league events and chat in one stream, newest at the bottom above the message box. */
const FeedPage = () => {
  const { leagueId, seasonId, season } = useSeasonContext();
  const muted = usePushPreferences().data?.mutedLeagueIds.includes(leagueId) ?? false;
  const muteChat = useMuteLeagueChat(leagueId);
  const { userId } = useUser();
  const live = useFeedLive(seasonId, season.canEdit);
  const feed = useFeed(seasonId, live.isConnected);
  const markViewed = useMarkFeedViewed(seasonId);
  const [deleting, setDeleting] = useState<FeedMessageItem | null>(null);
  // Fixed when the feed first shows, so reading it does not move the divider.
  const [divider, setDivider] = useState<{ key: string | null } | null>(null);
  const stickToBottom = useRef(true);
  const scrollToNewest = () => {
    if (stickToBottom.current) window.scrollTo({ top: document.documentElement.scrollHeight });
  };

  const newestFirst = useMemo(
    () => feed.data?.pages.flatMap((page) => page.items) ?? [],
    [feed.data],
  );
  const first = feed.data?.pages[0];
  const rows = useMemo(
    () => buildTimeline(newestFirst, divider?.key ?? null),
    [newestFirst, divider],
  );
  const newestKey = rows[rows.length - 1]?.key;
  const hasNew = first?.hasNew ?? false;

  useEffect(() => {
    if (divider === null && first) setDivider({ key: firstNewKey(first.items) });
  }, [divider, first]);

  // Reading the feed clears its dot, including anything that arrives while it is open.
  useEffect(() => {
    if (hasNew && first && !markViewed.isPending) markViewed.mutate(newestIds(first.items));
  }, [hasNew, first, markViewed]);

  useEffect(() => {
    const track = () => {
      stickToBottom.current = nearBottom();
    };
    window.addEventListener("scroll", track, { passive: true });
    return () => window.removeEventListener("scroll", track);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll only when the newest row changes
  useEffect(() => {
    if (newestKey) scrollToNewest();
  }, [newestKey]);

  const renderRow = (row: TimelineRow) => {
    if (row.type === "date") return <DateRow key={row.key} label={row.label} />;
    if (row.type === "new") return <NewDivider key={row.key} />;
    if (row.type === "event") return <FeedEventRow key={row.key} event={row.item} />;
    return (
      <MessageRow
        key={row.key}
        message={row.item}
        own={row.item.authorUserId === userId}
        onDelete={setDeleting}
        onGifLoad={scrollToNewest}
      />
    );
  };

  if (feed.isLoading) {
    return (
      <Container maxWidth="md" sx={{ py: 2 }}>
        <LoadingState what="the feed" />
      </Container>
    );
  }
  if (feed.isError || !first) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <ErrorState
          message={friendlyError(
            feed.error,
            "Couldn't load the feed. Check your connection and try again.",
          )}
          onRetry={() => feed.refetch()}
        />
      </Container>
    );
  }

  return (
    <Container
      maxWidth="md"
      disableGutters
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: {
          xs: `calc(100dvh - ${HEADER_HEIGHT}px - ${TAB_BAR_HEIGHT}px - env(safe-area-inset-bottom))`,
          md: `calc(100dvh - ${HEADER_HEIGHT}px)`,
        },
      }}
    >
      <Box
        component="ol"
        aria-label="Feed"
        sx={{
          m: 0,
          px: 2,
          py: 1.5,
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          gap: "10px",
        }}
      >
        <Box component="li" sx={{ listStyle: "none", alignSelf: "flex-end" }}>
          <Button
            size="small"
            sx={{ minHeight: 44 }}
            disabled={muteChat.isPending}
            onClick={() => muteChat.mutate(!muted)}
          >
            {muted ? "Chat alerts muted · Unmute" : "Mute chat alerts"}
          </Button>
        </Box>
        {feed.hasNextPage && (
          <Box component="li" sx={{ listStyle: "none", alignSelf: "center" }}>
            <Button
              sx={{ minHeight: 44 }}
              disabled={feed.isFetchingNextPage}
              onClick={() => feed.fetchNextPage()}
            >
              Show earlier
            </Button>
          </Box>
        )}
        {rows.length === 0 && (
          <Typography
            component="li"
            color="text.secondary"
            sx={{ listStyle: "none", textAlign: "center" }}
          >
            Nothing has happened yet.
          </Typography>
        )}
        {rows.map((row) => renderRow(row))}
      </Box>
      <Box
        sx={{
          position: "sticky",
          bottom: { xs: `calc(${TAB_BAR_HEIGHT}px + env(safe-area-inset-bottom))`, md: 0 },
          zIndex: 1,
        }}
      >
        {first.canPost ? (
          <Composer seasonId={seasonId} />
        ) : (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              px: 2,
              py: 1.5,
              textAlign: "center",
              borderTop: `1px solid ${tokens.border}`,
              bgcolor: tokens.bg,
            }}
          >
            This season is archived, so the Feed is read-only.
          </Typography>
        )}
      </Box>
      {deleting && (
        <DeleteMessageDialog
          seasonId={seasonId}
          message={deleting}
          onClose={() => setDeleting(null)}
        />
      )}
    </Container>
  );
};

export default FeedPage;
