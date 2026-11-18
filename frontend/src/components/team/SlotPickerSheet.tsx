import { Alert, Box, Typography } from "@mui/material";
import type { RoundLineup } from "../../api/types";
import { tokens } from "../../theme";
import SettingsSheet from "../settings/SettingsSheet";
import type { Move } from "./lineup";
import { slotNames } from "./lineupView";
import { slotFillOptions } from "./moves";
import { MoveRow } from "./PlayerSheet";

interface Props {
  lineup: RoundLineup;
  slotIndex: number;
  canOverride: boolean;
  pending: boolean;
  error: string | null;
  onMove: (move: Move) => void;
  onClose: () => void;
}

/** Opened from an empty starter row: the bench players who can fill that slot. */
const SlotPickerSheet = ({
  lineup,
  slotIndex,
  canOverride,
  pending,
  error,
  onMove,
  onClose,
}: Props) => {
  const slot = slotNames(lineup).get(slotIndex) ?? "slot";
  const options = slotFillOptions(lineup, slotIndex, canOverride);
  return (
    <SettingsSheet title={`Start someone at ${slot}`} onClose={onClose} closeLabel="Close">
      {options.length === 0 ? (
        <Typography sx={{ fontSize: 14, color: tokens.muted }}>
          Nobody on your bench can play {slot} this round.
        </Typography>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {options.map((option) => (
            <MoveRow key={option.key} option={option} disabled={pending} onMove={onMove} />
          ))}
        </Box>
      )}
      {error && <Alert severity="error">{error}</Alert>}
    </SettingsSheet>
  );
};

export default SlotPickerSheet;
