import {
  DndContext,
  type DragEndEvent,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import {
  Alert,
  Box,
  Button,
  Card,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useDraftControl, useDraftOrder, useDraftSetup, useLeagueTeams } from "../../api/queries";
import type { DraftSlot, DraftState, DraftType, PickTimeoutAction } from "../../api/types";
import { tokens } from "../../theme";

const toLocalInput = (iso: string | null): string => {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const detail = (error: unknown): string | null =>
  (error as { response?: { data?: { detail?: string } } } | null)?.response?.data?.detail ?? null;

const POOL_ID = "pool";
const slotId = (index: number) => `slot-${index}`;
const teamDragId = (teamId: number) => `team-${teamId}`;

const initialSlots = (placed: DraftSlot[], slotCount: number): (number | null)[] =>
  Array.from(
    { length: slotCount },
    (_, index) => placed.find((slot) => slot.slot === index + 1)?.teamId ?? null,
  );

interface TeamChipProps {
  teamId: number;
  name: string;
  canDrag: boolean;
}

const TeamChip = ({ teamId, name, canDrag }: TeamChipProps) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: teamDragId(teamId),
    disabled: !canDrag,
  });
  return (
    <Box
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        px: 1,
        height: 56,
        borderRadius: 1,
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
        cursor: canDrag ? "grab" : "default",
        position: "relative",
        zIndex: isDragging ? 10 : "auto",
        boxShadow: isDragging ? 6 : "none",
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      }}
    >
      {canDrag && <DragIndicatorIcon fontSize="small" />}
      <Typography
        sx={{
          fontWeight: 600,
          fontSize: 13,
          lineHeight: 1.25,
          overflowWrap: "anywhere",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {name}
      </Typography>
    </Box>
  );
};

interface OrderSlotProps {
  index: number;
  children: ReactNode;
}

const OrderSlot = ({ index, children }: OrderSlotProps) => {
  const { setNodeRef, isOver } = useDroppable({ id: slotId(index) });
  return (
    <Box
      ref={setNodeRef}
      data-testid={`order-slot-${index + 1}`}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        p: 0.5,
        height: 56,
        borderRadius: 1,
        border: "1px dashed",
        borderColor: isOver ? tokens.gold : "divider",
        bgcolor: isOver ? "rgba(251,191,36,.08)" : "transparent",
      }}
    >
      <Typography color="text.secondary" sx={{ width: 28, textAlign: "center", flexShrink: 0 }}>
        {index + 1}
      </Typography>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>{children}</Box>
    </Box>
  );
};

const TeamPool = ({
  teamIds,
  teamName,
}: {
  teamIds: number[];
  teamName: (id: number) => string;
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: POOL_ID });
  return (
    <Box
      ref={setNodeRef}
      aria-label="Unplaced teams"
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 1,
        p: 0.5,
        position: "sticky",
        top: 8,
        borderRadius: 1,
        bgcolor: isOver ? "rgba(251,191,36,.08)" : "transparent",
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {teamIds.length > 0 ? "Teams" : "All placed"}
      </Typography>
      {teamIds.map((id) => (
        <TeamChip key={id} teamId={id} name={teamName(id)} canDrag />
      ))}
    </Box>
  );
};

/** Commissioner draft setup: schedule, clock, type, timeout behaviour and slot order. */
const DraftSetupPanel = ({ draft, canEdit }: { draft: DraftState; canEdit: boolean }) => {
  const leagueId = draft.leagueId;
  const setup = useDraftSetup(leagueId);
  const saveOrder = useDraftOrder(leagueId);
  const control = useDraftControl(leagueId);
  const teams = useLeagueTeams(leagueId);

  const allTeamIds = useMemo(() => (teams.data ?? []).map((team) => team.id), [teams.data]);

  const [startTime, setStartTime] = useState(toLocalInput(draft.startTime));
  const [timePerPick, setTimePerPick] = useState(String(draft.timePerPickSeconds));
  const [draftType, setDraftType] = useState<DraftType>(draft.draftType);
  const [timeout, setTimeoutAction] = useState<PickTimeoutAction>(draft.pickTimeoutAction);
  const [slots, setSlots] = useState<(number | null)[]>([]);

  useEffect(() => {
    setStartTime(toLocalInput(draft.startTime));
    setTimePerPick(String(draft.timePerPickSeconds));
    setDraftType(draft.draftType);
    setTimeoutAction(draft.pickTimeoutAction);
    setSlots(initialSlots(draft.order, allTeamIds.length));
  }, [draft, allTeamIds]);

  const locked = draft.orderLocked || !canEdit;
  const teamName = (id: number) =>
    draft.order.find((slot) => slot.teamId === id)?.teamName ??
    teams.data?.find((team) => team.id === id)?.name ??
    `Team ${id}`;
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
  );

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over) return;
    const teamId = Number(String(active.id).replace("team-", ""));
    const from = slots.indexOf(teamId);
    const next = [...slots];
    if (from >= 0) next[from] = null;
    if (over.id !== POOL_ID) {
      const to = Number(String(over.id).replace("slot-", ""));
      const displaced = next[to] ?? null;
      next[to] = teamId;
      // A displaced team takes the dragged team's old slot, or returns to the pool.
      if (displaced !== null && from >= 0) next[from] = displaced;
    }
    setSlots(next);
  };

  const unplaced = allTeamIds.filter((id) => !slots.includes(id));

  const saveSetup = () =>
    setup.mutate({
      startTime: startTime ? new Date(startTime).toISOString() : undefined,
      clearStartTime: startTime === "" && draft.startTime !== null,
      timePerPickSeconds: Number(timePerPick),
      ...(draft.orderLocked ? {} : { draftType, pickTimeoutAction: timeout }),
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
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            fullWidth
            type="datetime-local"
            label="Draft date & time"
            slotProps={{ inputLabel: { shrink: true } }}
            value={startTime}
            disabled={locked}
            onChange={(event) => setStartTime(event.target.value)}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField
            fullWidth
            label="Seconds per pick"
            value={timePerPick}
            disabled={!canEdit}
            onChange={(event) => setTimePerPick(event.target.value)}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
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
        <Grid size={{ xs: 12, sm: 6 }}>
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

      <Typography variant="subtitle1" sx={{ fontWeight: 600, mt: 3, mb: 0.5 }}>
        Draft order {draft.orderLocked && "(locked)"}
      </Typography>
      {!locked && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Drag teams from the right into pick slots on the left. Drop on a filled slot to swap.
        </Typography>
      )}
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: locked ? "minmax(0, 1fr)" : "repeat(2, minmax(0, 1fr))",
            gap: 1,
            alignItems: "start",
            mb: 2,
          }}
        >
          <Box aria-label="Draft order" sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ p: 0.5 }}>
              Pick order
            </Typography>
            {slots.map((teamId, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: slots are positional
              <OrderSlot key={index} index={index}>
                {teamId !== null ? (
                  <TeamChip teamId={teamId} name={teamName(teamId)} canDrag={!locked} />
                ) : (
                  <Typography color="text.disabled">Empty</Typography>
                )}
              </OrderSlot>
            ))}
          </Box>
          {!locked && <TeamPool teamIds={unplaced} teamName={teamName} />}
        </Box>
      </DndContext>
      {!locked && (
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          <Button variant="outlined" onClick={() => control.mutate("randomize")}>
            Randomize
          </Button>
          <Button
            variant="contained"
            disabled={saveOrder.isPending}
            onClick={() => saveOrder.mutate(slots)}
          >
            Save order
          </Button>
        </Box>
      )}
    </Card>
  );
};

export default DraftSetupPanel;
