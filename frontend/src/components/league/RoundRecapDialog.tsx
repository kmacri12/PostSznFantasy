import CloseIcon from "@mui/icons-material/Close";
import { DialogActions, DialogContent, IconButton, useMediaQuery, useTheme } from "@mui/material";
import type { RoundHighlight, TeamScore } from "../../api/types";
import Dialog from "../common/AppDialog";
import ShareCardButton from "../share/ShareCardButton";
import { recapCard } from "../share/shareCards";
import RoundRecapPanel from "./RoundRecapPanel";
import type { RecapTeams } from "./roundRecap";

interface Props {
  open: boolean;
  onClose: () => void;
  leagueName: string;
  year: number;
  round: number;
  highlights: RoundHighlight[];
  teamScores?: TeamScore[];
  teams?: RecapTeams;
}

/** The recap as its own screen: full screen on a phone, with Share for the picture of it. */
const RoundRecapDialog = ({
  open,
  onClose,
  leagueName,
  year,
  round,
  highlights,
  teamScores,
  teams,
}: Props) => {
  const phone = useMediaQuery(useTheme().breakpoints.down("sm"));
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={phone}
      fullWidth
      maxWidth="xs"
      aria-label="Week recap"
    >
      <IconButton
        aria-label="Close"
        onClick={onClose}
        sx={{ position: "absolute", top: 4, right: 4, width: 44, height: 44 }}
      >
        <CloseIcon />
      </IconButton>
      <DialogContent sx={{ p: 0 }}>
        <RoundRecapPanel
          leagueName={leagueName}
          round={round}
          highlights={highlights}
          teamScores={teamScores}
          teams={teams}
        />
      </DialogContent>
      <DialogActions
        sx={{
          justifyContent: "center",
          pb: 1.5,
          pt: 0,
          "@media (max-height: 740px)": { pb: 1, py: 0.5 },
        }}
      >
        <ShareCardButton
          card={recapCard(leagueName, year, round, highlights, teamScores, teams)}
          label="Share recap"
        />
      </DialogActions>
    </Dialog>
  );
};

export default RoundRecapDialog;
