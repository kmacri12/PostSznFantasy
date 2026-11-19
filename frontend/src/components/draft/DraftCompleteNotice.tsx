import { Box, Typography } from "@mui/material";
import { tokens } from "../../theme";

const DraftCompleteNotice = ({ totalPicks }: { totalPicks: number }) => (
  <Box
    component="section"
    aria-label="Draft complete"
    sx={{
      my: 2,
      p: 2,
      borderRadius: 2,
      bgcolor: tokens.accentSurface,
      border: `1px solid ${tokens.accentBorder}`,
    }}
  >
    <Typography component="h2" sx={{ fontSize: 22, fontWeight: 800, color: tokens.accent }}>
      Draft complete
    </Typography>
    <Typography sx={{ fontSize: 14, color: tokens.muted }}>
      All {totalPicks} picks are in. Set your lineup before the first kickoff.
    </Typography>
  </Box>
);

export default DraftCompleteNotice;
