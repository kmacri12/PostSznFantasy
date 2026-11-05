import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { Box } from "@mui/material";
import { Link } from "react-router-dom";
import type { SeasonSummary } from "../../api/types";
import { seasonPaths } from "../../routes";
import { tokens } from "../../theme";
import SettingsSheet from "./SettingsSheet";

interface Props {
  leagueId: number;
  seasons: SeasonSummary[];
  onClose: () => void;
}

/** Every earlier season of the league, newest first; each opens read-only. */
const PastSeasonsSheet = ({ leagueId, seasons, onClose }: Props) => (
  <SettingsSheet title="Past seasons" onClose={onClose}>
    <Box component="nav" aria-label="Past seasons" sx={{ display: "grid" }}>
      {seasons.map((season) => (
        <Box
          key={season.id}
          component={Link}
          to={seasonPaths(leagueId, season.year, false).home}
          onClick={onClose}
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            minHeight: 52,
            color: tokens.text,
            fontWeight: 600,
            textDecoration: "none",
            borderTop: `1px solid ${tokens.border}`,
            "&:first-of-type": { borderTop: 0 },
          }}
        >
          {season.year} season
          <ChevronRightIcon fontSize="small" sx={{ color: tokens.muted }} />
        </Box>
      ))}
    </Box>
  </SettingsSheet>
);

export default PastSeasonsSheet;
