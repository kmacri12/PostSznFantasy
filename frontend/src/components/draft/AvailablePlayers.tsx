import {
  Box,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText,
  TextField,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import type { PlayerSummary } from "../../api/types";

const POSITIONS = ["ALL", "QB", "RB", "WR", "TE", "K", "DST"];
const MAX_ROWS = 200;

interface Props {
  players: PlayerSummary[];
  draftedIds: Set<number>;
  queue: number[];
  canPick: boolean;
  onPick: (player: PlayerSummary) => void;
  onQueue: (playerId: number) => void;
}

const AvailablePlayers = ({ players, draftedIds, queue, canPick, onPick, onQueue }: Props) => {
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState("ALL");

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return players
      .filter(
        (p) =>
          !draftedIds.has(p.id) &&
          (position === "ALL" || p.position === position) &&
          (!needle || p.name.toLowerCase().includes(needle)),
      )
      .slice(0, MAX_ROWS);
  }, [players, draftedIds, search, position]);

  return (
    <Box>
      <TextField
        fullWidth
        size="small"
        label="Search players"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        sx={{ mb: 1 }}
      />
      <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mb: 1 }}>
        {POSITIONS.map((pos) => (
          <Chip
            key={pos}
            label={pos}
            size="small"
            color={position === pos ? "primary" : "default"}
            onClick={() => setPosition(pos)}
          />
        ))}
      </Box>
      <List dense aria-label="Available players" sx={{ maxHeight: 480, overflowY: "auto" }}>
        {visible.map((player) => (
          <ListItem
            key={player.id}
            secondaryAction={
              <Box sx={{ display: "flex", gap: 0.5 }}>
                <Button
                  size="small"
                  disabled={queue.includes(player.id)}
                  onClick={() => onQueue(player.id)}
                >
                  Queue
                </Button>
                <Button
                  size="small"
                  variant="contained"
                  disabled={!canPick}
                  onClick={() => onPick(player)}
                >
                  Draft
                </Button>
              </Box>
            }
          >
            <ListItemText
              primary={player.name}
              secondary={`${player.position} · ${player.team?.teamAbv ?? player.teamAbv ?? "FA"}`}
            />
          </ListItem>
        ))}
        {visible.length === 0 && (
          <Typography color="text.secondary" sx={{ p: 2 }}>
            No players match.
          </Typography>
        )}
      </List>
    </Box>
  );
};

export default AvailablePlayers;
