import { Box, Button, Typography } from "@mui/material";
import { Link as RouterLink } from "react-router-dom";
import { tokens } from "../../theme";

interface Props {
  totalPicks: number;
  teamHref: string | null;
  onShowBoard: () => void;
}

const DraftCompleteNotice = ({ totalPicks, teamHref, onShowBoard }: Props) => (
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
    <Typography sx={{ fontSize: 14, color: tokens.muted, mb: 1.5 }}>
      All {totalPicks} picks are in. Set your lineup before the first kickoff.
    </Typography>
    <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
      <Button variant="contained" onClick={onShowBoard} sx={{ minHeight: 44 }}>
        See the draft board
      </Button>
      {teamHref && (
        <Button variant="outlined" component={RouterLink} to={teamHref} sx={{ minHeight: 44 }}>
          Go to my team
        </Button>
      )}
    </Box>
  </Box>
);

export default DraftCompleteNotice;
