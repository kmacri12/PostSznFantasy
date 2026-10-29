import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import {
  Alert,
  Box,
  Button,
  Card,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useDraftControl, useDraftOrder, useDraftSetup, useLeagueTeams } from "../../api/queries";
import type { DraftState, DraftType, PickTimeoutAction } from "../../api/types";

const toLocalInput = (iso: string | null): string => {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const detail = (error: unknown): string | null =>
  (error as { response?: { data?: { detail?: string } } } | null)?.response?.data?.detail ?? null;

/** Commissioner draft setup: schedule, clock, type, rounds, timeout behaviour and slot order. */
const DraftSetupPanel = ({ draft, canEdit }: { draft: DraftState; canEdit: boolean }) => {
  const leagueId = draft.leagueId;
  const setup = useDraftSetup(leagueId);
  const saveOrder = useDraftOrder(leagueId);
  const control = useDraftControl(leagueId);
  const teams = useLeagueTeams(leagueId);

  const [startTime, setStartTime] = useState(toLocalInput(draft.startTime));
  const [timePerPick, setTimePerPick] = useState(String(draft.timePerPickSeconds));
  const [rounds, setRounds] = useState(String(draft.rounds));
  const [draftType, setDraftType] = useState<DraftType>(draft.draftType);
  const [timeout, setTimeoutAction] = useState<PickTimeoutAction>(draft.pickTimeoutAction);
  const [order, setOrder] = useState<number[]>(draft.order.map((slot) => slot.teamId));

  useEffect(() => {
    setStartTime(toLocalInput(draft.startTime));
    setTimePerPick(String(draft.timePerPickSeconds));
    setRounds(String(draft.rounds));
    setDraftType(draft.draftType);
    setTimeoutAction(draft.pickTimeoutAction);
    setOrder(draft.order.map((slot) => slot.teamId));
  }, [draft]);

  const locked = draft.orderLocked || !canEdit;
  const teamName = (id: number) =>
    draft.order.find((slot) => slot.teamId === id)?.teamName ??
    teams.data?.find((team) => team.id === id)?.name ??
    `Team ${id}`;
  const unassigned = (teams.data ?? []).map((team) => team.id).filter((id) => !order.includes(id));

  const move = (index: number, delta: number) => {
    const next = [...order];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const moved = next[index];
    const swapped = next[target];
    if (moved === undefined || swapped === undefined) return;
    next[index] = swapped;
    next[target] = moved;
    setOrder(next);
  };

  const saveSetup = () =>
    setup.mutate({
      startTime: startTime ? new Date(startTime).toISOString() : undefined,
      clearStartTime: startTime === "" && draft.startTime !== null,
      timePerPickSeconds: Number(timePerPick),
      ...(draft.orderLocked
        ? {}
        : { draftType, rounds: Number(rounds), pickTimeoutAction: timeout }),
    });

  const failure = detail(setup.error) ?? detail(saveOrder.error) ?? detail(control.error);

  return (
    <Card sx={{ p: 2.5 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Draft setup
      </Typography>
      {failure && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {failure}
        </Alert>
      )}
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6}>
          <TextField
            fullWidth
            type="datetime-local"
            label="Draft date & time"
            InputLabelProps={{ shrink: true }}
            value={startTime}
            disabled={locked}
            onChange={(event) => setStartTime(event.target.value)}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <TextField
            fullWidth
            label="Seconds per pick"
            value={timePerPick}
            disabled={!canEdit}
            onChange={(event) => setTimePerPick(event.target.value)}
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <TextField
            fullWidth
            label="Rounds"
            value={rounds}
            disabled={locked}
            onChange={(event) => setRounds(event.target.value)}
          />
        </Grid>
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth disabled={locked}>
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
        </Grid>
        <Grid item xs={12} sm={6}>
          <FormControl fullWidth disabled={locked}>
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
        </Grid>
      </Grid>
      {canEdit && (
        <Button sx={{ mt: 2 }} variant="contained" disabled={setup.isPending} onClick={saveSetup}>
          Save draft setup
        </Button>
      )}

      <Typography variant="subtitle1" fontWeight={600} sx={{ mt: 3 }}>
        Draft order {draft.orderLocked && "(locked)"}
      </Typography>
      <List dense aria-label="Draft order">
        {order.map((teamId, index) => (
          <ListItem
            key={teamId}
            secondaryAction={
              !locked && (
                <>
                  <IconButton
                    aria-label={`Move ${teamName(teamId)} up`}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUpwardIcon fontSize="small" />
                  </IconButton>
                  <IconButton
                    aria-label={`Move ${teamName(teamId)} down`}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDownwardIcon fontSize="small" />
                  </IconButton>
                  <Button
                    size="small"
                    onClick={() => setOrder(order.filter((id) => id !== teamId))}
                  >
                    Unassign
                  </Button>
                </>
              )
            }
          >
            <ListItemText primary={`${index + 1}. ${teamName(teamId)}`} />
          </ListItem>
        ))}
      </List>
      {unassigned.length > 0 && (
        <Box sx={{ mb: 1 }}>
          <Typography variant="body2" color="text.secondary">
            Unassigned teams
          </Typography>
          {unassigned.map((teamId) => (
            <Button
              key={teamId}
              size="small"
              disabled={locked}
              onClick={() => setOrder([...order, teamId])}
            >
              + {teamName(teamId)}
            </Button>
          ))}
        </Box>
      )}
      {!locked && (
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button variant="outlined" onClick={() => control.mutate("randomize")}>
            Randomize
          </Button>
          <Button
            variant="contained"
            disabled={saveOrder.isPending}
            onClick={() => saveOrder.mutate(order)}
          >
            Save order
          </Button>
        </Box>
      )}
    </Card>
  );
};

export default DraftSetupPanel;
