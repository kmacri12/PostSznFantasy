import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { Box, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { tokens } from "../../theme";

/** One plain row on the page background: a check, the heading, pick count and lineup reminder, then the page's icon actions. */
const DraftCompleteNotice = ({
  totalPicks,
  actions,
  lineupReminder,
}: {
  totalPicks: number;
  actions: ReactNode;
  /** Off once the season is over, when there are no lineups left to set. */
  lineupReminder: boolean;
}) => (
  <Box
    component="section"
    aria-label="Draft complete"
    sx={{ mb: 1, display: "flex", alignItems: "center", gap: 0.5, minHeight: 48 }}
  >
    <CheckCircleIcon aria-hidden sx={{ fontSize: 22, color: tokens.accent, flexShrink: 0 }} />
    <Box sx={{ flex: 1, minWidth: 0, ml: 0.5 }}>
      <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75 }}>
        <Typography component="h2" noWrap sx={{ fontSize: 18, fontWeight: 700 }}>
          Draft complete
        </Typography>
        <Typography noWrap sx={{ fontSize: 14, color: tokens.muted }}>
          {totalPicks} picks
        </Typography>
      </Box>
      {lineupReminder && (
        <Typography noWrap sx={{ fontSize: 13, color: tokens.muted }}>
          Don't forget to set your lineups!
        </Typography>
      )}
    </Box>
    {actions}
  </Box>
);

export default DraftCompleteNotice;
