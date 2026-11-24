import CloseIcon from "@mui/icons-material/Close";
import { Box, DialogActions, DialogContent, IconButton } from "@mui/material";
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

/**
 * The recap as a centered modal that is only as tall as it needs to be, so a tap on the dimmed
 * backdrop (or the X) closes it, with Share for the picture of it.
 */
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
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      aria-label="Week recap"
      sx={{
        // Margins all round on a phone so there is always some backdrop to tap.
        "& .MuiDialog-paper": {
          m: 2,
          width: "calc(100% - 32px)",
          maxHeight: "calc(100% - 32px)",
          borderRadius: 3,
          // A short phone gives the recap a little more of the screen, still with backdrop to tap.
          "@media (max-height: 740px)": {
            m: 1,
            width: "calc(100% - 16px)",
            maxHeight: "calc(100% - 16px)",
          },
        },
      }}
    >
      <DialogContent sx={{ p: 0 }}>
        {/*
          Inside the scrolling content, not floating over it: Safari on iPhone composites a
          scroller as its own layer and could paint it over an earlier sibling, so the X never
          got the tap. A zero-height sticky row with a z-index keeps it on top and in view.
        */}
        <Box
          sx={{
            position: "sticky",
            top: 0,
            height: 0,
            zIndex: 2,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <IconButton
            aria-label="Close"
            onClick={onClose}
            sx={{ width: 44, height: 44, mt: 0.5, mr: 0.5 }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
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
