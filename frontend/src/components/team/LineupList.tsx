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
import { Box, Chip, Paper, Typography } from "@mui/material";
import type { RosterSlot } from "../../api/types";
import { tokens } from "../../theme";
import { BENCH_SLOT, nextGameText, parseMove, playerDragId, slotDropId } from "./lineup";

interface RowProps {
  slot: RosterSlot;
  canDrag: boolean;
}

const SlotRow = ({ slot, canDrag }: RowProps) => {
  const player = slot.player;
  const { setNodeRef: dropRef, isOver } = useDroppable({ id: slotDropId(slot.index) });
  const {
    attributes,
    listeners,
    setNodeRef: dragRef,
    transform,
    isDragging,
  } = useDraggable({
    id: player ? playerDragId(player.id) : `empty-${slot.index}`,
    disabled: !canDrag || !player,
  });

  return (
    <Box
      ref={dropRef}
      data-testid={`slot-${slot.index}`}
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
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          px: 1,
          py: 0.75,
          minHeight: 48,
          touchAction: "pan-y",
          cursor: canDrag && player ? "grab" : "default",
          zIndex: isDragging ? 10 : "auto",
          position: "relative",
          bgcolor: isDragging ? "background.paper" : "transparent",
          boxShadow: isDragging ? 6 : "none",
          borderRadius: 1,
          transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        }}
      >
        <Chip
          size="small"
          label={slot.slot === "SUPER_FLEX" ? "SFLX" : slot.slot === BENCH_SLOT ? "BN" : slot.slot}
          sx={{ width: 58, color: slot.slot === BENCH_SLOT ? tokens.muted : tokens.gold }}
        />
        {player ? (
          <>
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography
                noWrap
                fontWeight={600}
                sx={{ textDecoration: player.isActive ? "none" : "line-through" }}
              >
                {player.name}
              </Typography>
              <Typography noWrap variant="caption" color="text.secondary">
                {player.position} · {player.teamAbv || "FA"}
                <Box component="span" sx={{ display: { xs: "inline", sm: "none" } }}>
                  {" · "}
                  {nextGameText(player)}
                </Box>
              </Typography>
            </Box>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ display: { xs: "none", sm: "block" }, minWidth: 190 }}
            >
              {nextGameText(player)}
            </Typography>
            <Box
              aria-label={player.isActive ? "Alive" : "Eliminated"}
              sx={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                flexShrink: 0,
                bgcolor: player.isActive ? tokens.green : tokens.red,
              }}
            />
            {canDrag && <DragIndicatorIcon fontSize="small" sx={{ color: tokens.muted }} />}
          </>
        ) : (
          <Typography color="text.secondary" sx={{ flexGrow: 1 }}>
            Empty
          </Typography>
        )}
      </Box>
    </Box>
  );
};

interface Props {
  slots: RosterSlot[];
  canDrag: boolean;
  onMove: (move: { playerId: number; slotIndex: number }) => void;
}

/** Starters then bench as dense rows; drag a player onto any slot to move or swap. */
const LineupList = ({ slots, canDrag, onMove }: Props) => {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // A short press-and-hold, so a swipe still scrolls the page on phones.
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );
  const starters = slots.filter((slot) => slot.slot !== BENCH_SLOT);
  const bench = slots.filter((slot) => slot.slot === BENCH_SLOT);

  const handleDragEnd = (event: DragEndEvent) => {
    const move = parseMove(event.active.id, event.over?.id);
    if (move) onMove(move);
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <Paper sx={{ p: 1, maxWidth: 760 }}>
        <Typography variant="overline" color="text.secondary" sx={{ px: 1 }}>
          Starters
        </Typography>
        {starters.map((slot) => (
          <SlotRow key={slot.index} slot={slot} canDrag={canDrag} />
        ))}
        {bench.length > 0 && (
          <>
            <Typography
              variant="overline"
              color="text.secondary"
              sx={{ px: 1, display: "block", mt: 1 }}
            >
              Bench
            </Typography>
            {bench.map((slot) => (
              <SlotRow key={slot.index} slot={slot} canDrag={canDrag} />
            ))}
          </>
        )}
      </Paper>
      {canDrag && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
          Touch and hold a player, then drag onto a slot to start, bench or swap.
        </Typography>
      )}
    </DndContext>
  );
};

export default LineupList;
