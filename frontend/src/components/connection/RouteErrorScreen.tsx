import { Box, Button, Typography } from "@mui/material";
import { useRouteError } from "react-router-dom";
import {
  ROUTE_ERROR_GENERIC_BODY,
  ROUTE_ERROR_GENERIC_TITLE,
  ROUTE_ERROR_HOME,
  ROUTE_ERROR_RETRY,
  ROUTE_ERROR_RETRY_BODY,
  ROUTE_ERROR_RETRY_TITLE,
  UPDATE_AVAILABLE_TITLE,
  UPDATE_OUTDATED,
  UPDATE_REFRESH,
} from "../../content/rules";
import { isChunkLoadError, markReloadAttempt, reloadedRecently } from "../../utils/chunkError";
import { createLogger } from "../../utils/logger";

const logger = createLogger("RouteErrorScreen");

const reload = () => {
  markReloadAttempt();
  window.location.reload();
};

/**
 * The router's error screen. A page file that failed to load after a deploy asks for a refresh
 * (the member's tap, never automatic); if that already happened this minute, it says so instead
 * of offering a loop. Anything else gets a generic screen with a way home.
 */
const RouteErrorScreen = () => {
  const error = useRouteError();
  const chunk = isChunkLoadError(error);
  const retried = chunk && reloadedRecently();
  if (chunk) logger.warn("Page file failed to load", error);
  else logger.error("Route error", error);

  let title = ROUTE_ERROR_GENERIC_TITLE;
  let body = ROUTE_ERROR_GENERIC_BODY;
  let action = ROUTE_ERROR_RETRY;
  if (retried) {
    title = ROUTE_ERROR_RETRY_TITLE;
    body = ROUTE_ERROR_RETRY_BODY;
  } else if (chunk) {
    title = UPDATE_AVAILABLE_TITLE;
    body = UPDATE_OUTDATED;
    action = UPDATE_REFRESH;
  }

  return (
    <Box
      role="alert"
      sx={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        px: 2,
        py: 6,
        textAlign: "center",
        bgcolor: "background.default",
        color: "text.primary",
      }}
    >
      <Typography component="h1" variant="h5">
        {title}
      </Typography>
      <Typography color="text.secondary" sx={{ maxWidth: 420 }}>
        {body}
      </Typography>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1, width: "100%", maxWidth: 280 }}>
        <Button variant="contained" onClick={reload} sx={{ minHeight: 44 }}>
          {action}
        </Button>
        <Button href="/" sx={{ minHeight: 44 }}>
          {ROUTE_ERROR_HOME}
        </Button>
      </Box>
    </Box>
  );
};

export default RouteErrorScreen;
