import { Box, CircularProgress, Typography } from "@mui/material";
import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { tokens } from "../../theme";
import { formatAgo } from "./DataFreshness";
import { latestUpdate, PULL_THRESHOLD, pullDistance, shouldRefresh } from "./pullToRefresh";

const TICK_MS = 30_000;

/** A modal (sheet, dialog) is open: a pull then belongs to the modal, not the page behind it. */
const modalOpen = (): boolean => document.querySelector(".MuiModal-root") !== null;

interface Props {
  children: ReactNode;
}

/**
 * Pull down at the top of the page to refetch what it shows (touch only; the browser's own
 * reload gesture is suppressed while a pull is ours), with a small "Updated X ago" line that
 * works without a gesture.
 */
const PullToRefresh = ({ children }: Props) => {
  const queryClient = useQueryClient();
  // Subscribes to fetch activity so the line moves forward as soon as any refetch lands.
  useIsFetching();
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const startY = useRef<number | null>(null);
  const pulled = useRef(0);
  const busy = useRef(false);

  const updatedAt = latestUpdate(
    queryClient
      .getQueryCache()
      .findAll({ type: "active" })
      .map((query) => query.state.dataUpdatedAt),
  );

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  const refresh = useCallback(async () => {
    busy.current = true;
    setRefreshing(true);
    try {
      await queryClient.refetchQueries({ type: "active" });
    } finally {
      busy.current = false;
      setRefreshing(false);
      setNow(Date.now());
    }
  }, [queryClient]);

  useEffect(() => {
    const onStart = (event: TouchEvent) => {
      const atTop = window.scrollY <= 0;
      startY.current =
        atTop && !busy.current && !modalOpen() ? (event.touches[0]?.clientY ?? null) : null;
      pulled.current = 0;
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

  const height = refreshing ? PULL_THRESHOLD * 0.75 : distance;
  return (
    <Box>
      <Box
        aria-hidden={!refreshing && distance === 0}
        sx={{
          height,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: distance === 0 ? "height 150ms ease" : "none",
        }}
      >
        <CircularProgress
          size={24}
          variant={refreshing ? "indeterminate" : "determinate"}
          value={Math.min(100, (distance / PULL_THRESHOLD) * 100)}
          aria-label={refreshing ? "Refreshing" : "Pull to refresh"}
        />
      </Box>
      {updatedAt > 0 && (
        <Typography sx={{ textAlign: "center", fontSize: 12, color: tokens.muted, pt: 0.5 }}>
          Updated {formatAgo(new Date(updatedAt).toISOString(), now)}
        </Typography>
      )}
      {children}
    </Box>
  );
};

export default PullToRefresh;
