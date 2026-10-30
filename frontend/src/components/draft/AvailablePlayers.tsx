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
import { useEffect, useMemo, useState } from "react";
import type { PlayerSummary } from "../../api/types";

const POSITIONS = ["ALL", "QB", "RB", "WR", "TE", "K", "DST"];
const MAX_ROWS = 200;
const CONFIRM_WINDOW_MS = 3000;

interface Props {
  players: PlayerSummary[];
  draftedIds: Set<number>;
  queue: number[];
  canPick: boolean;
  isConnected: boolean;
  /** Player whose pick is awaiting the server's answer. */
  pendingPlayerId: number | null;
  onPick: (player: PlayerSummary) => void;
  onQueue: (playerId: number) => void;
}

const AvailablePlayers = ({
  players,
  draftedIds,
  queue,
  canPick,
  isConnected,
  pendingPlayerId,
  onPick,
  onQueue,
}: Props) => {
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState("ALL");
  const [armedId, setArmedId] = useState<number | null>(null);

  useEffect(() => {
    if (armedId === null) return;
    const timer = setTimeout(() => setArmedId(null), CONFIRM_WINDOW_MS);
    return () => clearTimeout(timer);
  }, [armedId]);

  const draftLabel = (player: PlayerSummary) => {
    if (!isConnected) return "Reconnecting…";
    if (pendingPlayerId === player.id) return "Drafting…";
    return armedId === player.id ? `Confirm ${player.name}` : "Draft";
  };

  const handleDraft = (player: PlayerSummary) => {
    if (armedId !== player.id) {
      setArmedId(player.id);
      return;
    }
    setArmedId(null);
    onPick(player);
  };

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
            sx={{
              flexDirection: { xs: "column", sm: "row" },
              alignItems: { xs: "stretch", sm: "center" },
              gap: 0.5,
            }}
          >
            <ListItemText
              sx={{ flex: "1 1 auto", minWidth: 0 }}
              primary={player.name}
              secondary={`${player.position} · ${player.team?.teamAbv ?? player.teamAbv ?? "FA"}`}
            />
            <Box sx={{ display: "flex", gap: 0.5, minWidth: { sm: 260 } }}>
              <Button
                size="small"
                sx={{ minHeight: 44, minWidth: 64 }}
                disabled={queue.includes(player.id)}
                onClick={() => onQueue(player.id)}
              >
                Queue
              </Button>
              <Button
                size="small"
                variant="contained"
                color={armedId === player.id ? "warning" : "primary"}
                sx={{ minHeight: 44, flex: 1, lineHeight: 1.2 }}
                disabled={!canPick || !isConnected || pendingPlayerId !== null}
                onClick={() => handleDraft(player)}
              >
                {draftLabel(player)}
              </Button>
            </Box>
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
