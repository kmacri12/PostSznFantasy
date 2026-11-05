import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import CloseIcon from "@mui/icons-material/Close";
import { Box, IconButton, Typography } from "@mui/material";
import type { PlayerSummary } from "../../api/types";
import { radii, tokens } from "../../theme";

interface Props {
  queue: number[];
  players: Map<number, PlayerSummary>;
  draftedIds: Set<number>;
  onChange: (next: number[]) => void;
}

/** Pre-ranked wish list; auto-pick takes the first player still available. */
const QueuePanel = ({ queue, players, draftedIds, onChange }: Props) => {
  const available = queue.filter((id) => !draftedIds.has(id));
  const move = (index: number, delta: number) => {
    const next = [...available];
    const a = next[index];
    const b = next[index + delta];
    if (a === undefined || b === undefined) return;
    next[index] = b;
    next[index + delta] = a;
    onChange(next);
  };

  return (
    <Box
      component="section"
      aria-label="Your queue"
      sx={{
        bgcolor: tokens.surface,
        border: `1px solid ${tokens.border}`,
        borderRadius: `${radii.card}px`,
        overflow: "hidden",
      }}
    >
      <Typography sx={{ px: 2, py: 1.5, fontSize: 13, color: tokens.textSoft }}>
        <b style={{ color: tokens.text }}>Your queue</b> · used if your clock runs out
      </Typography>
      {available.length === 0 ? (
        <Typography sx={{ px: 2, pb: 2, fontSize: 13, color: tokens.muted }}>
          Your queue is empty. Tap the star on a player in the Players view and they'll be drafted
          for you if your clock runs out.
        </Typography>
      ) : (
        <Box component="ol" aria-label="Pick queue" sx={{ m: 0, p: 0, listStyle: "none" }}>
          {available.map((id, index) => {
            const player = players.get(id);
            return (
              <Box
                component="li"
                key={id}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  pl: 2,
                  pr: 0.5,
                  minHeight: 52,
                  borderTop: `1px solid ${tokens.border}`,
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0, fontSize: 14 }}>
                  <b>
                    {index + 1}. {player?.name ?? `Player ${id}`}
                  </b>
                  <Box component="span" sx={{ ml: 1, fontSize: 12, color: tokens.muted }}>
                    {player?.position} {player?.team?.teamAbv ?? player?.teamAbv}
                  </Box>
                </Box>
                <IconButton
                  aria-label={`Move ${player?.name ?? "player"} up`}
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUpwardIcon fontSize="small" />
                </IconButton>
                <IconButton
                  aria-label={`Move ${player?.name ?? "player"} down`}
                  disabled={index === available.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDownwardIcon fontSize="small" />
                </IconButton>
                <IconButton
                  aria-label={`Remove ${player?.name ?? "player"} from queue`}
                  onClick={() => onChange(available.filter((other) => other !== id))}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
};

export default QueuePanel;
