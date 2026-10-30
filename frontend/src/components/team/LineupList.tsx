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
import LockIcon from "@mui/icons-material/Lock";
import { Box, Button, Chip, Paper, Typography } from "@mui/material";
import { useState } from "react";
import type { LineupPlayer, LineupSlot, RoundLineup, SlotMark } from "../../api/types";
import { tokens } from "../../theme";
import ChangedScore from "../activity/ChangedScore";
import SlotMarker from "../activity/SlotMarker";
import {
  applyTap,
  BENCH_SLOT,
  lineupStatusText,
  type Move,
  parseMove,
  playerDragId,
  slotDropId,
  UNASSIGNED_DROP_ID,
} from "./lineup";

interface RowProps {
  label: string;
  /** Null for the unassigned and eliminated sections, which are not slots. */
  slotIndex: number | null;
  player: LineupPlayer | null;
  canEdit: boolean;
  /** A commissioner may move locked players too (the server asks them to confirm). */
  canOverride: boolean;
  mark?: SlotMark | null;
  selected: boolean;
  isTarget: boolean;
  onTap: () => void;
}

const PlayerRow = ({
  label,
  slotIndex,
  player,
  canEdit,
  canOverride,
  mark,
  selected,
  isTarget,
  onTap,
}: RowProps) => {
  const eliminated = player?.status === "eliminated";
  const locked = player?.locked ?? false;
  const frozen = locked && !canOverride;
  const movable = canEdit && player !== null && !frozen && !eliminated;
  const { setNodeRef: dropRef, isOver } = useDroppable({
    id: slotDropId(slotIndex ?? -1),
    disabled: slotIndex === null || frozen,
  });
  const {
    attributes,
    listeners,
    setNodeRef: dragRef,
    transform,
    isDragging,
  } = useDraggable({
    id: player ? playerDragId(player.id) : `empty-${slotIndex}`,
    disabled: !movable,
  });
  const interactive = canEdit && (movable || (isTarget && !frozen && !eliminated));

  return (
    <Box
      ref={dropRef}
      data-testid={slotIndex === null ? undefined : `slot-${slotIndex}`}
      sx={{
        borderRadius: 1,
        outline: isOver ? `2px solid ${tokens.gold}` : "2px solid transparent",
        bgcolor: isOver ? "rgba(251,191,36,.08)" : "transparent",
      }}
    >
      <Box
        ref={dragRef}
        {...attributes}
        {...listeners}
        aria-pressed={movable ? selected : undefined}
        aria-disabled={player && !movable ? true : undefined}
        onClick={canEdit ? onTap : undefined}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          px: 1,
          py: 0.75,
          minHeight: 52,
          touchAction: "pan-y",
          cursor: interactive ? "pointer" : "default",
          opacity: eliminated ? 0.55 : 1,
          outline: selected ? `2px solid ${tokens.gold}` : "none",
          zIndex: isDragging ? 10 : "auto",
          position: "relative",
          bgcolor: isDragging
            ? "background.paper"
            : selected
              ? "rgba(251,191,36,.12)"
              : "transparent",
          boxShadow: isDragging ? 6 : "none",
          borderRadius: 1,
          transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        }}
      >
        <Chip
          size="small"
          label={label}
          sx={{ width: 58, color: label === "BN" ? tokens.muted : tokens.gold }}
        />
        {player ? (
          <>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography
                noWrap
                sx={{ fontWeight: 600, textDecoration: eliminated ? "line-through" : "none" }}
              >
                {player.name}
              </Typography>
              <Typography
                variant="caption"
                color={eliminated ? tokens.red : "text.secondary"}
                sx={{ display: "block" }}
              >
                {player.position} · {player.teamAbv || "FA"} · {lineupStatusText(player)}
              </Typography>
            </Box>
            <ChangedScore points={player.points} change={player.scoreChange} />
            {locked && !eliminated && (
              <LockIcon aria-label="Locked" fontSize="small" sx={{ color: tokens.muted }} />
            )}
            {movable && <DragIndicatorIcon fontSize="small" sx={{ color: tokens.muted }} />}
          </>
        ) : (
          <Typography color="text.secondary" sx={{ flexGrow: 1 }}>
            Empty
          </Typography>
        )}
      </Box>
      {mark && <SlotMarker mark={mark} empty={player === null} />}
    </Box>
  );
};

const slotLabel = (slot: LineupSlot) =>
  slot.slot === "SUPER_FLEX" ? "SFLX" : slot.slot === BENCH_SLOT ? "BN" : slot.slot;

const SectionTitle = ({ children }: { children: string }) => (
  <Typography variant="overline" color="text.secondary" sx={{ px: 1, display: "block", mt: 1 }}>
    {children}
  </Typography>
);

const UnassignedDrop = ({ children }: { children: React.ReactNode }) => {
  const { setNodeRef, isOver } = useDroppable({ id: UNASSIGNED_DROP_ID });
  return (
    <Box
      ref={setNodeRef}
      sx={{ borderRadius: 1, outline: isOver ? `2px solid ${tokens.gold}` : "none" }}
    >
      {children}
    </Box>
  );
};

interface Props {
  lineup: RoundLineup;
  canEdit: boolean;
  canOverride?: boolean;
  onMove: (move: Move) => void;
}

/** One round: starters, bench, unplaced players, then the eliminated section. */
const LineupList = ({ lineup, canEdit, canOverride = false, onMove }: Props) => {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // A short press-and-hold, so a swipe still scrolls the page on phones.
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );
  const starters = lineup.slots.filter((slot) => slot.slot !== BENCH_SLOT);
  const bench = lineup.slots.filter((slot) => slot.slot === BENCH_SLOT);
  const selectedPlayer = [...lineup.slots.map((slot) => slot.player), ...lineup.unassigned].find(
    (player) => player?.id === selectedId,
  );
  const selectedIsPlaced = lineup.slots.some((slot) => slot.player?.id === selectedId);

  const tap = (index: number | null, player: LineupPlayer | null) => {
    const result = applyTap(
      selectedId,
      { index, playerId: player?.id ?? null, locked: player?.locked ?? false },
      canOverride,
    );
    setSelectedId(result.selectedPlayerId);
    if (result.move) onMove(result.move);
  };

  const slotRow = (slot: LineupSlot) => (
    <PlayerRow
      key={slot.index}
      label={slotLabel(slot)}
      slotIndex={slot.index}
      player={slot.player}
      canEdit={canEdit}
      canOverride={canOverride}
      mark={slot.mark}
      selected={slot.player !== null && slot.player.id === selectedId}
      isTarget={selectedId !== null}
      onTap={() => tap(slot.index, slot.player)}
    />
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const move = parseMove(event.active.id, event.over?.id);
    if (move) onMove(move);
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <Paper sx={{ p: 1, maxWidth: 760 }}>
        <SectionTitle>Starters</SectionTitle>
        {starters.map(slotRow)}
        {bench.length > 0 && (
          <>
            <SectionTitle>Bench</SectionTitle>
            {bench.map(slotRow)}
          </>
        )}
        {lineup.unassigned.length > 0 && (
          <>
            <SectionTitle>Not in this lineup</SectionTitle>
            <UnassignedDrop>
              {lineup.unassigned.map((player) => (
                <PlayerRow
                  key={player.id}
                  label={player.position}
                  slotIndex={null}
                  player={player}
                  canEdit={canEdit}
                  canOverride={canOverride}
                  selected={player.id === selectedId}
                  isTarget={selectedId !== null}
                  onTap={() => tap(null, player)}
                />
              ))}
            </UnassignedDrop>
          </>
        )}
        {lineup.eliminated.length > 0 && (
          <Box data-testid="eliminated-section">
            <SectionTitle>Eliminated</SectionTitle>
            {lineup.eliminated.map((player) => (
              <PlayerRow
                key={player.id}
                label={player.position}
                slotIndex={null}
                player={player}
                canEdit={false}
                canOverride={false}
                selected={false}
                isTarget={false}
                onTap={() => {}}
              />
            ))}
          </Box>
        )}
      </Paper>
      {canEdit && selectedPlayer && (
        <Box
          role="status"
          sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1, flexWrap: "wrap" }}
        >
          <Typography sx={{ flexGrow: 1 }}>
            Tap a slot to move {selectedPlayer.name} there.
          </Typography>
          {selectedIsPlaced && (
            <Button
              sx={{ minHeight: 44 }}
              onClick={() => {
                onMove({ playerId: selectedPlayer.id, slotIndex: null });
                setSelectedId(null);
              }}
            >
              Remove from lineup
            </Button>
          )}
          <Button sx={{ minHeight: 44 }} onClick={() => setSelectedId(null)}>
            Cancel
          </Button>
        </Box>
      )}
      {canEdit && !selectedPlayer && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
          Tap a player, then tap a slot to start, bench or swap. You can also touch and hold a
          player and drag. Players lock at their game's kickoff and can't be moved after
          {canOverride ? ", except by you as commissioner (you'll be asked to confirm)" : ""}.
        </Typography>
      )}
    </DndContext>
  );
};

export default LineupList;
