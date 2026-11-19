import { Box, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { tokens } from "../../theme";

/** One compact row: the heading and pick count, then the page's actions (share, settings). */
const DraftCompleteNotice = ({
  totalPicks,
  actions,
}: {
  totalPicks: number;
  actions: ReactNode;
}) => (
  <Box
    component="section"
    aria-label="Draft complete"
    sx={{
      my: 1,
      pl: 1.5,
      pr: 0.5,
      display: "flex",
      alignItems: "center",
      gap: 0.5,
      borderRadius: 2,
      bgcolor: tokens.accentSurface,
      border: `1px solid ${tokens.accentBorder}`,
    }}
  >
    <Box sx={{ flex: 1, minWidth: 0, display: "flex", alignItems: "baseline", gap: 0.75 }}>
      <Typography
        component="h2"
        noWrap
        sx={{ fontSize: 18, fontWeight: 800, color: tokens.accent }}
      >
        Draft complete
      </Typography>
      <Typography
        noWrap
        sx={{ display: { xs: "none", sm: "block" }, fontSize: 14, color: tokens.muted }}
      >
        · {totalPicks} picks
      </Typography>
    </Box>
    {actions}
  </Box>
);

export default DraftCompleteNotice;
