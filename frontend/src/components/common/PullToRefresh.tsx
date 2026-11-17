import { Box, CircularProgress, Typography } from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { useSyncStatus } from "../../api/queries";
import { tokens } from "../../theme";
import { E2E_BUILD } from "../../utils/e2e";
import {
  latestUpdate,
  liveStatsLine,
  PULL_THRESHOLD,
  pullDistance,
  screenLine,
  shouldRefresh,
} from "./pullToRefresh";

/** How long "This screen is up to date" stays after a refresh before the indicator folds away. */
const DONE_MS = 2000;
const OPEN_HEIGHT = PULL_THRESHOLD + 8;

/** A modal (sheet, dialog) is open: a pull then belongs to the modal, not the page behind it. */
const modalOpen = (): boolean => document.querySelector(".MuiModal-root") !== null;

interface Props {
  children: ReactNode;
}

/**
 * Pull down at the top of the page to refetch what it shows (touch only; the browser's own
 * reload gesture is suppressed while a pull is ours). Two lines show only while pulling and for
 * a moment after a refresh: when this screen last loaded, which the pull controls, and when live
 * stats last synced, which the server does on its own schedule. At rest they take no space.
 */
const PullToRefresh = ({ children }: Props) => {
  const queryClient = useQueryClient();
  const syncStatus = useSyncStatus().data;
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [done, setDone] = useState(false);
  const startY = useRef<number | null>(null);
  const pulled = useRef(0);
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    busy.current = true;
    setRefreshing(true);
    try {
      await queryClient.refetchQueries({ type: "active" });
    } finally {
      busy.current = false;
      setRefreshing(false);
      setDone(true);
    }
  }, [queryClient]);

  // The e2e build never races a timer, so there the line stays until the next pull.
  useEffect(() => {
    if (!done || E2E_BUILD) return;
    const timer = window.setTimeout(() => setDone(false), DONE_MS);
    return () => window.clearTimeout(timer);
  }, [done]);

  useEffect(() => {
    const onStart = (event: TouchEvent) => {
      const atTop = window.scrollY <= 0;
      startY.current =
        atTop && !busy.current && !modalOpen() ? (event.touches[0]?.clientY ?? null) : null;
      pulled.current = 0;
      if (startY.current !== null) setDone(false);
    };
    const onMove = (event: TouchEvent) => {
      if (startY.current === null) return;
      const y = event.touches[0]?.clientY;
      if (y === undefined) return;
      const travel = y - startY.current;
      if (travel <= 0 || window.scrollY > 0) {
        startY.current = null;
        pulled.current = 0;
        setDistance(0);
        return;
      }
      // Ours from here on: stop the browser from pulling the whole page down or reloading it.
      if (event.cancelable) event.preventDefault();
      pulled.current = pullDistance(travel);
      setDistance(pulled.current);
    };
    const onEnd = () => {
      if (startY.current === null) return;
      const release = pulled.current;
      startY.current = null;
      pulled.current = 0;
      setDistance(0);
      if (shouldRefresh(release)) void refresh();
    };
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, [refresh]);

  const pulling = distance > 0 && !refreshing;
  const updatedAt = pulling
    ? latestUpdate(
        queryClient
          .getQueryCache()
          .findAll({ type: "active" })
          .map((query) => query.state.dataUpdatedAt),
      )
    : 0;
  const screen = screenLine({ done, armed: shouldRefresh(distance), updatedAt });
  const stats = liveStatsLine(syncStatus);
  const height = refreshing || done ? OPEN_HEIGHT : distance;
  return (
    <Box>
      <Box
        aria-hidden={height === 0}
        sx={{
          height,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          // Anchored to the bottom, so a short pull shows the update times first.
          justifyContent: "flex-end",
          gap: 0.5,
          px: 2,
          pb: height > 0 ? 0.75 : 0,
          textAlign: "center",
          transition: pulling ? "none" : "height 150ms ease",
        }}
      >
        {!done && (
          <CircularProgress
            size={24}
            variant={refreshing ? "indeterminate" : "determinate"}
            value={Math.min(100, (distance / PULL_THRESHOLD) * 100)}
            aria-label={refreshing ? "Refreshing" : "Pull to refresh"}
            sx={{ flexShrink: 0 }}
          />
        )}
        {height > 0 && (
          <Box role={done ? "status" : undefined} sx={{ flexShrink: 0 }}>
            {!refreshing && (
              <Typography sx={{ fontSize: 13, color: tokens.text }}>{screen}</Typography>
            )}
            {stats && <Typography sx={{ fontSize: 12, color: tokens.muted }}>{stats}</Typography>}
          </Box>
        )}
      </Box>
      {children}
    </Box>
  );
};

export default PullToRefresh;
