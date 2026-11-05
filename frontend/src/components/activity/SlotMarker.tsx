import GavelIcon from "@mui/icons-material/Gavel";
import { Box, Typography } from "@mui/material";
import type { SlotMark } from "../../api/types";
import { tokens } from "../../theme";
import { formatWhen } from "./describe";

interface Props {
  mark: SlotMark;
  /** The slot has no player now (an override took them out). */
  empty: boolean;
}

/**
 * What a commissioner did to a slot. An override is a bordered block with an icon and
 * words (never colour alone) and stays for good; the asterisk is a quiet line that goes
 * when the player locks.
 */
const SlotMarker = ({ mark, empty }: Props) => {
  const who = `${mark.actorName ?? "A commissioner"} · ${formatWhen(mark.at)}`;
  if (mark.kind === "commissioner_set") {
    return (
      <Typography
        variant="caption"
        data-testid="commissioner-set-mark"
        sx={{ display: "block", px: 1, pb: 0.5, color: tokens.accent }}
      >
        * Set by {who}
      </Typography>
    );
  }
  return (
    <Box
      data-testid="override-mark"
      sx={{
        display: "flex",
        alignItems: "flex-start",
        gap: 1,
        mx: 1,
        mb: 0.75,
        p: 1,
        border: `2px solid ${tokens.red}`,
        borderRadius: 1,
      }}
    >
      <GavelIcon fontSize="small" sx={{ color: tokens.red, mt: 0.25 }} />
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}>
          {empty ? "Emptied" : "Changed"} by commissioner after kickoff
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {who}
        </Typography>
      </Box>
    </Box>
  );
};

export default SlotMarker;
