import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from "@mui/material";
import { useState } from "react";
import { useDraftSetup } from "../../api/queries";
import type { DraftState, DraftType, PickTimeoutAction } from "../../api/types";
import { mutationError } from "../common/friendlyError";

export const PICK_SECONDS_MIN = 15;
export const PICK_SECONDS_MAX = 600;

/** The whole number a seconds field holds, or null when it is empty, fractional or out of range. */
export const parsePickSeconds = (text: string): number | null => {
  if (!/^\d+$/.test(text.trim())) return null;
  const value = Number(text);
  return value >= PICK_SECONDS_MIN && value <= PICK_SECONDS_MAX ? value : null;
};

const timeZoneName = (): string =>
  new Intl.DateTimeFormat(undefined, { timeZoneName: "short" })
    .formatToParts(new Date())
    .find((part) => part.type === "timeZoneName")?.value ?? "";

const toLocalInput = (iso: string | null): string => {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

interface Props {
  draft: DraftState;
  open: boolean;
  onClose: () => void;
}

/** Change the draft's date and time. */
export const DraftDateDialog = ({ draft, open, onClose }: Props) => {
  const setup = useDraftSetup(draft.seasonId);
  const [value, setValue] = useState(toLocalInput(draft.startTime));
  const error = mutationError(setup.error, "Couldn't save the draft date. Try again.");
  const save = () =>
    setup.mutate(
      value
        ? { startTime: new Date(value).toISOString() }
        : { clearStartTime: draft.startTime !== null },
      { onSuccess: onClose },
    );
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Change date</DialogTitle>
      <DialogContent
        sx={{ display: "flex", flexDirection: "column", gap: 2, pt: "8px !important" }}
      >
        {error && <Alert severity="error">{error}</Alert>}
        <TextField
          fullWidth
          type="datetime-local"
          label="Draft date & time"
          helperText={`In your time zone (${timeZoneName()}). Everyone else sees it in theirs.`}
          slotProps={{ inputLabel: { shrink: true } }}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={setup.isPending} onClick={save}>
          Save date
        </Button>
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
