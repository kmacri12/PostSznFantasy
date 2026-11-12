import {
  Alert,
  Button,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useDraftSetup } from "../../api/queries";
import type { DraftState, DraftType, PickTimeoutAction } from "../../api/types";
import { describeViewerZone, fromZonedInput, toZonedInput } from "../../utils/timeZone";
import Dialog from "../common/AppDialog";
import { mutationError } from "../common/friendlyError";
import { longDate } from "./calendarMonth";
import DraftCalendar from "./DraftCalendar";

export const PICK_SECONDS_MIN = 15;
export const PICK_SECONDS_MAX = 600;

/** The whole number a seconds field holds, or null when it is empty, fractional or out of range. */
export const parsePickSeconds = (text: string): number | null => {
  if (!/^\d+$/.test(text.trim())) return null;
  const value = Number(text);
  return value >= PICK_SECONDS_MIN && value <= PICK_SECONDS_MAX ? value : null;
};

interface Props {
  draft: DraftState;
  open: boolean;
  onClose: () => void;
}

const DEFAULT_DRAFT_TIME = "19:00";

/** Change the draft's date and time: a month calendar for the day, a time field for the hour. */
export const DraftDateDialog = ({ draft, open, onClose }: Props) => {
  const setup = useDraftSetup(draft.seasonId);
  const current = toZonedInput(draft.startTime);
  const [day, setDay] = useState(current.slice(0, 10));
  const [time, setTime] = useState(current.slice(11) || DEFAULT_DRAFT_TIME);
  const error = mutationError(setup.error, "Couldn't save the draft date. Try again.");
  const today = toZonedInput(new Date().toISOString()).slice(0, 10);
  const canSave = day ? time !== "" : draft.startTime !== null;
  const save = () =>
    setup.mutate(
      day
        ? { startTime: fromZonedInput(`${day}T${time}`) }
        : { clearStartTime: draft.startTime !== null },
      { onSuccess: onClose },
    );
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      sx={{ "& .MuiDialog-paper": { m: 2, width: "calc(100% - 32px)" } }}
    >
      <DialogTitle>Change date</DialogTitle>
      <DialogContent
        sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important", px: 2 }}
      >
        {error && <Alert severity="error">{error}</Alert>}
        <DraftCalendar value={day} min={today} onChange={setDay} />
        <Typography aria-live="polite" sx={{ fontWeight: 600, minHeight: "1.5em" }}>
          {day ? longDate(day) : "No date chosen"}
        </Typography>
        <TextField
          fullWidth
          type="time"
          label="Draft time"
          value={time}
          onChange={(event) => setTime(event.target.value)}
          disabled={!day}
          helperText={`Times here are in ${describeViewerZone()}. Everyone else sees the same moment in their own time zone.`}
          slotProps={{ inputLabel: { shrink: true } }}
        />
      </DialogContent>
      <DialogActions sx={{ justifyContent: "space-between" }}>
        {draft.startTime !== null && day ? (
          <Button color="inherit" onClick={() => setDay("")}>
            Clear date
          </Button>
        ) : (
          <span />
        )}
        <span>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" disabled={setup.isPending || !canSave} onClick={save}>
            Save date
          </Button>
        </span>
      </DialogActions>
    </Dialog>
  );
};

/** Seconds per pick, draft type and what happens when the clock runs out. */
export const DraftRulesDialog = ({ draft, open, onClose }: Props) => {
  const setup = useDraftSetup(draft.seasonId);
  const [timePerPick, setTimePerPick] = useState(String(draft.timePerPickSeconds));
  const [draftType, setDraftType] = useState<DraftType>(draft.draftType);
  const [timeout, setTimeoutAction] = useState<PickTimeoutAction>(draft.pickTimeoutAction);
  const error = mutationError(setup.error, "Couldn't save the draft settings. Try again.");
  const seconds = parsePickSeconds(timePerPick);
  const save = () =>
    seconds !== null &&
    setup.mutate(
      {
        timePerPickSeconds: seconds,
        ...(draft.orderLocked ? {} : { draftType, pickTimeoutAction: timeout }),
      },
      { onSuccess: onClose },
    );
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Draft settings</DialogTitle>
      <DialogContent
        sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}
      >
        {error && <Alert severity="error">{error}</Alert>}
        <TextField
          fullWidth
          label="Seconds per pick"
          value={timePerPick}
          onChange={(event) => setTimePerPick(event.target.value)}
          error={seconds === null}
          helperText={`A whole number of seconds, ${PICK_SECONDS_MIN} to ${PICK_SECONDS_MAX}.`}
          slotProps={{ htmlInput: { inputMode: "numeric" } }}
        />
        <FormControl fullWidth disabled={draft.orderLocked}>
          <InputLabel id="draft-type-label">Draft type</InputLabel>
          <Select
            labelId="draft-type-label"
            label="Draft type"
            value={draftType}
            onChange={(event) => setDraftType(event.target.value as DraftType)}
          >
            <MenuItem value="snake">Snake</MenuItem>
            <MenuItem value="linear">Linear</MenuItem>
            <MenuItem value="third_round_reversal">Third-round reversal</MenuItem>
          </Select>
        </FormControl>
        <FormControl fullWidth disabled={draft.orderLocked}>
          <InputLabel id="draft-timeout-label">When the clock expires</InputLabel>
          <Select
            labelId="draft-timeout-label"
            label="When the clock expires"
            value={timeout}
            onChange={(event) => setTimeoutAction(event.target.value as PickTimeoutAction)}
          >
            <MenuItem value="queue_then_best_available">
              Auto-pick from queue, then best available
            </MenuItem>
            <MenuItem value="best_available">Auto-pick best available</MenuItem>
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={setup.isPending || seconds === null} onClick={save}>
          Save settings
        </Button>
      </DialogActions>
    </Dialog>
  );
};
