import {
  Alert,
  Box,
  Button,
  Chip,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemButton,
  ListItemText,
  TextField,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import { useAssignPick, useClearReservedPick } from "../../api/queries";
import type { DraftState, PlayerSummary } from "../../api/types";
import Dialog from "../common/AppDialog";
import { mutationError } from "../common/friendlyError";
import ConfirmDraftAction from "./ConfirmDraftAction";

const POSITIONS = ["QB", "RB", "WR", "TE", "K", "DST"];
const MAX_ROWS = 40;

interface Props {
  draft: DraftState;
  /** Overall pick number of the tapped slot. */
  pickNumber: number;
  teamName: string;
  pool: PlayerSummary[];
  onClose: () => void;
}

const abv = (player: PlayerSummary): string => player.teamAbv ?? player.team?.teamAbv ?? "";

/** A commissioner places a player at one slot: choose, then confirm by name. */
const AssignPickDialog = ({ draft, pickNumber, teamName, pool, onClose }: Props) => {
  const assign = useAssignPick(draft.seasonId);
  const clear = useClearReservedPick(draft.seasonId);
  const [query, setQuery] = useState("");
  const [position, setPosition] = useState<string | null>(null);
  const [chosen, setChosen] = useState<PlayerSummary | null>(null);

  const made = draft.picks.find((pick) => pick.numberPickOverall === pickNumber);
  const reserved = draft.reservedPicks.find((item) => item.pickNumber === pickNumber);
  const onClock = draft.currentPickOverall === pickNumber;
  const unavailable = useMemo(
    () =>
      new Set([
        ...draft.picks.map((pick) => pick.playerId),
        ...draft.reservedPicks.map((item) => item.playerId),
      ]),
    [draft.picks, draft.reservedPicks],
  );
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return pool
      .filter((player) => !unavailable.has(player.id))
      .filter((player) => position === null || player.position === position)
      .filter((player) => needle === "" || player.name.toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, MAX_ROWS);
  }, [pool, unavailable, position, query]);

  const error = mutationError(assign.error ?? clear.error, "Couldn't assign that pick. Try again.");
  const heading = made
    ? `Replace pick ${pickNumber}`
    : onClock
      ? `Assign pick ${pickNumber} (on the clock)`
      : `Assign pick ${pickNumber}`;

  if (chosen) {
    const sentence = made
      ? `Replace ${made.playerName ?? "the player"} with ${chosen.name} for ${teamName}, pick ${pickNumber}?`
      : `Assign ${chosen.name} to ${teamName}, pick ${pickNumber}?`;
    const detail = made
      ? `${made.playerName ?? "The player"} goes back to the pool and leaves ${teamName}'s lineups.`
      : onClock
        ? `${teamName} is picked for now and the clock moves on.`
        : "It is recorded when this pick comes up, and the team's turn is skipped.";
    return (
      <ConfirmDraftAction
        title={sentence}
        confirmLabel={made ? "Replace" : "Assign"}
        lines={[detail, "The Feed shows it as a commissioner action."]}
        pending={assign.isPending}
        error={error}
        onConfirm={() =>
          assign.mutate(
            { pickNumber, playerId: chosen.id, replace: made !== undefined },
            { onSuccess: onClose },
          )
        }
        onClose={() => {
          assign.reset();
          setChosen(null);
        }}
      />
    );
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>
        {heading}
        <Typography variant="body2" color="text.secondary">
          {teamName}
          {made ? ` · now ${made.playerName ?? "a player"}` : ""}
        </Typography>
      </DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        {error && <Alert severity="error">{error}</Alert>}
        {reserved && (
          <Alert
            severity="info"
            action={
              <Button
                color="inherit"
                size="small"
                disabled={clear.isPending}
                onClick={() => clear.mutate(pickNumber, { onSuccess: onClose })}
                sx={{ minHeight: 44 }}
              >
                Clear
              </Button>
            }
          >
            {reserved.playerName ?? "A player"} is reserved for this pick.
          </Alert>
        )}
        <TextField
          fullWidth
          size="small"
          label="Search players"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
          {POSITIONS.map((item) => (
            <Chip
              key={item}
              label={item}
              clickable
              color={position === item ? "primary" : "default"}
              onClick={() => setPosition(position === item ? null : item)}
              sx={{ minHeight: 36 }}
            />
          ))}
        </Box>
        <List dense disablePadding sx={{ maxHeight: 280, overflowY: "auto" }}>
          {matches.map((player) => (
            <ListItemButton
              key={player.id}
              onClick={() => setChosen(player)}
              sx={{ minHeight: 48 }}
            >
              <ListItemText primary={player.name} secondary={`${player.position} ${abv(player)}`} />
            </ListItemButton>
          ))}
          {matches.length === 0 && (
            <Typography color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
              No available player matches.
            </Typography>
          )}
        </List>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ minHeight: 44 }}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AssignPickDialog;
