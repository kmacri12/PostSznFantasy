import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import DeleteIcon from "@mui/icons-material/Delete";
import { IconButton, List, ListItem, ListItemText, Typography } from "@mui/material";
import type { PlayerSummary } from "../../api/types";

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

  if (available.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ p: 2 }}>
        Your queue is empty. Add players from the Players tab and they'll be drafted for you if your
        clock runs out.
      </Typography>
    );
  }
  return (
    <List dense aria-label="Pick queue">
      {available.map((id, index) => (
        <ListItem
          key={id}
          secondaryAction={
            <>
              <IconButton
                aria-label="Move up"
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                <ArrowUpwardIcon fontSize="small" />
              </IconButton>
              <IconButton
                aria-label="Move down"
                disabled={index === available.length - 1}
                onClick={() => move(index, 1)}
              >
                <ArrowDownwardIcon fontSize="small" />
              </IconButton>
              <IconButton
                aria-label="Remove from queue"
                onClick={() => onChange(available.filter((other) => other !== id))}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </>
          }
        >
          <ListItemText
            primary={`${index + 1}. ${players.get(id)?.name ?? `Player ${id}`}`}
            secondary={players.get(id)?.position}
          />
        </ListItem>
      ))}
    </List>
  );
};

export default QueuePanel;
