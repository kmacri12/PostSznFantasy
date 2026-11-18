import GavelIcon from "@mui/icons-material/Gavel";
import { IconButton, Tooltip } from "@mui/material";
import type { SlotMark } from "../../api/types";
import { tokens } from "../../theme";
import { formatWhen } from "./describe";

interface Props {
  mark: SlotMark;
  /** The slot has no player now (a commissioner took them out). */
  empty: boolean;
}

/** What a commissioner did to a slot, in words (the gavel's tap-to-read text). */
export const slotMarkText = (mark: SlotMark, empty: boolean): string => {
  const who = `${mark.actorName ?? "A commissioner"} · ${formatWhen(mark.at)}`;
  const verb = empty ? "Emptied" : "Set";
  return mark.kind === "override"
    ? `${verb} by a commissioner after kickoff: ${who}`
    : `${verb} by a commissioner: ${who}`;
};

/**
 * A gavel on the lineup row that opens the wording on tap (or hover or focus), so the mark never
 * adds a line. Red after kickoff, where the league is told prominently; the words carry the
 * meaning, never the colour alone.
 */
const SlotMarker = ({ mark, empty }: Props) => {
  const text = slotMarkText(mark, empty);
  return (
    <Tooltip title={text} arrow placement="top" enterTouchDelay={0} leaveTouchDelay={5000}>
      <IconButton
        aria-label={text}
        data-testid={mark.kind === "override" ? "override-mark" : "commissioner-set-mark"}
        sx={{
          width: 44,
          height: 44,
          color: mark.kind === "override" ? tokens.red : tokens.warning,
        }}
      >
        <GavelIcon sx={{ fontSize: 18 }} />
      </IconButton>
    </Tooltip>
  );
};

export default SlotMarker;
