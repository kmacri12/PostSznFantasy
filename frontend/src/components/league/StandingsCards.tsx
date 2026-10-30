import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { Box, Button, Card, Chip, Collapse, Typography } from "@mui/material";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useTeam } from "../../api/queries";
import type { StandingsRow } from "../../api/types";
import { tokens } from "../../theme";

const ROUNDS = [
  { key: "wildCard", label: "Wild Card" },
  { key: "divisional", label: "Divisional" },
  { key: "confChamp", label: "Conference" },
  { key: "superBowl", label: "Super Bowl" },
] as const;

const EliminatedPlayers = ({ teamId }: { teamId: number }) => {
  const { data: team, isLoading, isError } = useTeam(teamId);
  const out = team?.roster.filter((player) => !player.isActive) ?? [];
  return (
    <Box sx={{ mt: 1.5 }}>
      <Typography variant="overline" color="text.secondary">
        Eliminated players
      </Typography>
      {isLoading && <Typography color="text.secondary">Loading…</Typography>}
      {isError && <Typography color="text.secondary">Couldn't load this roster.</Typography>}
      {team && out.length === 0 && <Typography color="text.secondary">None yet.</Typography>}
      {out.map((player) => (
        <Typography key={player.id} sx={{ textDecoration: "line-through" }} color="text.secondary">
          {player.name} · {player.position} {player.teamAbv ? `· ${player.teamAbv}` : ""}
        </Typography>
      ))}
    </Box>
  );
};

const StandingsCard = ({ row }: { row: StandingsRow }) => {
  const [open, setOpen] = useState(false);
  const panelId = `standings-${row.teamId}`;
  return (
    <Card sx={{ p: 0 }}>
      <Box
        component="button"
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        sx={{
          all: "unset",
          boxSizing: "border-box",
          width: "100%",
          minHeight: 64,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          p: 1.5,
          cursor: "pointer",
          "&:focus-visible": { outline: `2px solid ${tokens.gold}`, outlineOffset: -2 },
        }}
      >
        <Typography
          sx={{
            width: 28,
            fontWeight: 800,
            fontSize: 20,
            color: tokens.muted,
            textAlign: "center",
          }}
        >
          {row.rank}
        </Typography>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography noWrap sx={{ fontWeight: 700 }}>
            {row.teamName}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap component="div">
            {row.owner} · {row.playersLeft} alive
          </Typography>
        </Box>
        <Box sx={{ textAlign: "right" }}>
          <Typography variant="h6" sx={{ color: tokens.gold, lineHeight: 1 }}>
            {row.total}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            pts
          </Typography>
        </Box>
        <ExpandMoreIcon
          sx={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}
        />
      </Box>
      <Collapse in={open} unmountOnExit>
        <Box id={panelId} sx={{ px: 1.5, pb: 1.5 }}>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
            {ROUNDS.map(({ key, label }) => (
              <Chip key={key} variant="outlined" label={`${label} ${row[key]}`} />
            ))}
          </Box>
          <EliminatedPlayers teamId={row.teamId} />
          <Button component={Link} to={`/team/${row.teamId}`} sx={{ mt: 1 }}>
            View team
          </Button>
        </Box>
      </Collapse>
    </Card>
  );
};

const StandingsCards = ({ rows }: { rows: StandingsRow[] }) => (
  <Box component="ol" aria-label="Standings" sx={{ display: "grid", gap: 1, m: 0, p: 0 }}>
    {rows.map((row) => (
      <Box component="li" key={row.teamId} sx={{ listStyle: "none" }}>
        <StandingsCard row={row} />
      </Box>
    ))}
  </Box>
);

export default StandingsCards;
