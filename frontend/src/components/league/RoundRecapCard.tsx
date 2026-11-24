import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import { Box, ButtonBase, IconButton, Typography } from "@mui/material";
import { useState } from "react";
import { useRoundRecap } from "../../api/queries";
import { tokens } from "../../theme";
import RoundRecapDialog from "./RoundRecapDialog";

/**
 * The week's notable things, under the round title once its games are over and until the next
 * round takes over (Thursday morning). Open to start with, since it is why members come in on
 * Tuesday; the header folds it away.
 */
const RoundRecapCard = ({
  seasonId,
  leagueName,
  year,
  over,
}: {
  seasonId: number;
  leagueName: string;
  year: number;
  over: boolean;
}) => {
  const recap = useRoundRecap(seasonId, over).data;
  const [open, setOpen] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  if (!over || !recap || recap.highlights.length === 0) return null;
  return (
    <Box sx={{ mt: 0.5 }}>
      <Box sx={{ display: "flex", alignItems: "center" }}>
        <ButtonBase
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          sx={{
            flex: 1,
            minHeight: 44,
            justifyContent: "space-between",
            fontSize: 14,
            fontWeight: 600,
            color: tokens.text,
          }}
        >
          Week recap
          <ExpandMoreIcon
            aria-hidden
            sx={{ transform: open ? "rotate(180deg)" : "none", color: tokens.accentSoft }}
          />
        </ButtonBase>
        <IconButton
          aria-label="Open the recap on its own"
          onClick={() => setDialogOpen(true)}
          sx={{ width: 44, height: 44, color: tokens.accentSoft }}
        >
          <OpenInFullIcon fontSize="small" />
        </IconButton>
      </Box>
      {open && (
        <Box
          component="ul"
          sx={{ m: 0, pl: 2.5, display: "flex", flexDirection: "column", gap: 0.75 }}
        >
          {recap.highlights.map((highlight) => (
            <Typography component="li" key={highlight.kind} sx={{ fontSize: 14 }}>
              {highlight.text}
            </Typography>
          ))}
        </Box>
      )}
      {dialogOpen && (
        <RoundRecapDialog
          open
          onClose={() => setDialogOpen(false)}
          leagueName={leagueName}
          year={year}
          round={recap.round}
          highlights={recap.highlights}
        />
      )}
    </Box>
  );
};

export default RoundRecapCard;
