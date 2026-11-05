import { Box } from "@mui/material";
import { tokens } from "../../theme";

/** Tops every page of a finished season: the pages stay readable, nothing can be changed. */
const ArchivedBanner = ({ year }: { year: number }) => (
  <Box
    role="status"
    sx={{
      px: 2,
      py: 1,
      textAlign: "center",
      fontSize: 13,
      color: tokens.textSoft,
      bgcolor: tokens.surfaceRaised,
      borderBottom: `1px solid ${tokens.border}`,
    }}
  >
    <b>{year} season · archived.</b> Read-only: nothing here can be changed.
  </Box>
);

export default ArchivedBanner;
