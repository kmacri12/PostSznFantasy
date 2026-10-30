import { Box, Card, Chip, TextField, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { tokens } from "../../theme";
import { positionColor } from "../draft/positions";
import type { PlayerCardData } from "./playerCards";
import { formatPoints } from "./playerStats";

interface Props {
  /** Already filtered; use filterPlayerCards for the common case. */
  players: PlayerCardData[];
  search: string;
  onSearchChange: (value: string) => void;
  /** Show an ALL chip (position null). */
  includeAll?: boolean;
  /** Chip options. */
  positions: readonly string[];
  position: string | null;
  onPositionChange: (position: string | null) => void;
  /** Per-card buttons, e.g. Queue and Draft. */
  renderActions?: (player: PlayerCardData) => ReactNode;
  /** When it returns text, the card is greyed out and shows it as the reason why. */
  unavailableReason?: (player: PlayerCardData) => string | undefined;
  emptyText?: string;
  label: string;
}

const PlayerCardList = ({
  players,
  search,
  onSearchChange,
  includeAll = true,
  positions,
  position,
  onPositionChange,
  renderActions,
  unavailableReason,
  emptyText = "No players match.",
  label,
}: Props) => (
  <Box>
    <TextField
      fullWidth
      size="small"
      label="Search players"
      type="search"
      value={search}
      onChange={(event) => onSearchChange(event.target.value)}
      sx={{ mb: 1 }}
    />
    <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", mb: 1.5 }}>
      {(includeAll ? [null, ...positions] : positions).map((pos) => (
        <Chip
          key={pos ?? "ALL"}
          label={pos ?? "ALL"}
          color={position === pos ? "primary" : "default"}
          aria-pressed={position === pos}
          onClick={() => onPositionChange(pos)}
          sx={{ minWidth: 52 }}
        />
      ))}
    </Box>
    {players.length === 0 ? (
      <Typography color="text.secondary" sx={{ p: 2 }}>
        {emptyText}
      </Typography>
    ) : (
      <Box component="ul" aria-label={label} sx={{ display: "grid", gap: 1, m: 0, p: 0 }}>
        {players.map((player) => {
          const reason = unavailableReason?.(player);
          return (
            <Card
              key={player.id}
              component="li"
              aria-disabled={reason ? true : undefined}
              sx={{
                listStyle: "none",
                p: 1.5,
                opacity: reason ? 0.55 : 1,
                borderLeft: `4px solid ${positionColor(player.position)}`,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minHeight: 44 }}>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography noWrap sx={{ fontWeight: 700 }}>
                    {player.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {player.position} · {player.team}
                  </Typography>
                </Box>
                {player.points !== undefined && (
                  <Box sx={{ textAlign: "right" }}>
                    <Typography variant="h6" sx={{ color: tokens.gold, lineHeight: 1 }}>
                      {formatPoints(player.points)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      fantasy pts
                    </Typography>
                  </Box>
                )}
              </Box>
              {player.stats && (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 1 }}>
                  {player.stats.map((stat) => (
                    <Chip
                      key={stat.label}
                      size="small"
                      variant="outlined"
                      label={`${stat.label} ${stat.value}`}
                    />
                  ))}
                </Box>
              )}
              {reason && (
                <Typography variant="body2" sx={{ mt: 1, fontWeight: 600 }}>
                  {reason}
                </Typography>
              )}
              {renderActions && (
                <Box sx={{ display: "flex", gap: 1, mt: 1 }}>{renderActions(player)}</Box>
              )}
            </Card>
          );
        })}
      </Box>
    )}
  </Box>
);

export default PlayerCardList;
