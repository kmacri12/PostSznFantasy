import TimelineIcon from "@mui/icons-material/Timeline";
import {
  Avatar,
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from "@mui/material";
import type React from "react";
import { Link } from "react-router-dom";
import { useStandings } from "../../api/queries";
import type { Standings, StandingsRow } from "../../api/types";
import { tokens } from "../../theme";
import QueryBoundary from "../common/QueryBoundary";
import LiveSummary from "./LiveSummary";
import ProgressCounts from "./ProgressCounts";
import RankCell from "./RankCell";
import StandingsCards from "./StandingsCards";
import { PROGRESS_ITEMS, ROUND_NAMES, rankLabel, tieNote } from "./standingsView";

interface StandingsTableProps {
  leagueId: string;
}

const RANK_COLORS = [tokens.gold, "#cbd5e1", "#d97706"];

const RoundBadge = ({ points }: { points: number }) => (
  <Chip
    size="small"
    label={points}
    variant={points > 0 ? "filled" : "outlined"}
    sx={{
      minWidth: 52,
      bgcolor: points > 0 ? "rgba(34,211,238,.14)" : "transparent",
      color: points > 0 ? tokens.cyan : tokens.muted,
    }}
  />
);

const StandingsTable: React.FC<StandingsTableProps> = ({ leagueId }) => {
  const query = useStandings(leagueId);
  return (
    <QueryBoundary
      query={query}
      what="standings"
      isEmpty={(standings) => standings.teams.length === 0}
      empty={{
        title: "No standings yet",
        description: "Standings appear once the playoffs begin and scores are in.",
        action: (
          <Button component={Link} to={`/league/${leagueId}/draft`} variant="outlined">
            Open the draft room
          </Button>
        ),
      }}
    >
      {(standings) => <StandingsRows standings={standings} />}
    </QueryBoundary>
  );
};

const Legend = () => (
  <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1, mb: 0 }}>
    Starters this round: {PROGRESS_ITEMS.map((item) => `${item.label} (${item.hint})`).join(" · ")}
  </Typography>
);

const TableRows = ({ rows, round }: { rows: StandingsRow[]; round: number }) => (
  <TableContainer component={Paper}>
    <Table>
      <TableHead>
        <TableRow>
          <TableCell width={72}>#</TableCell>
          <TableCell>Team</TableCell>
          <TableCell align="center">Players left</TableCell>
          <TableCell align="center">Wild Card</TableCell>
          <TableCell align="center">Divisional</TableCell>
          <TableCell align="center">Conf</TableCell>
          <TableCell align="center">Super Bowl</TableCell>
          <TableCell>Starters · {ROUND_NAMES[round - 1]}</TableCell>
          <TableCell align="right">Total</TableCell>
          <TableCell width={56} />
        </TableRow>
      </TableHead>
      <TableBody>
        {rows.map((row, index) => (
          <TableRow key={row.teamId} hover>
            <TableCell sx={{ p: 0 }}>
              <RankCell
                label={rankLabel(rows, index)}
                note={tieNote(rows, index)}
                color={RANK_COLORS[row.rank - 1] ?? tokens.muted}
              />
            </TableCell>
            <TableCell>
              <Box
                component={Link}
                to={`/team/${row.teamId}`}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  color: "inherit",
                  textDecoration: "none",
                }}
              >
                <Avatar sx={{ width: 32, height: 32, bgcolor: tokens.borderStrong, fontSize: 14 }}>
                  {row.teamName[0]}
                </Avatar>
                <Box>
                  <Typography sx={{ fontWeight: 600, lineHeight: 1.2 }}>{row.teamName}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {row.owner}
                  </Typography>
                </Box>
              </Box>
            </TableCell>
            <TableCell align="center">
              <Chip
                size="small"
                color={row.playersLeft > 0 ? "success" : "default"}
                label={row.playersLeft}
                variant="outlined"
                aria-label={`${row.playersLeft} players left`}
              />
            </TableCell>
            <TableCell align="center">
              <RoundBadge points={row.wildCard} />
            </TableCell>
            <TableCell align="center">
              <RoundBadge points={row.divisional} />
            </TableCell>
            <TableCell align="center">
              <RoundBadge points={row.confChamp} />
            </TableCell>
            <TableCell align="center">
              <RoundBadge points={row.superBowl} />
            </TableCell>
            <TableCell>
              <ProgressCounts progress={row.progress} compact />
            </TableCell>
            <TableCell align="right" sx={{ fontWeight: 800, fontSize: 18 }}>
              {row.total}
            </TableCell>
            <TableCell sx={{ p: 0 }}>
              <Tooltip title="Round-by-round points">
                <IconButton
                  component={Link}
                  to={`/team/${row.teamId}/points`}
                  aria-label={`Round-by-round points for ${row.teamName}`}
                >
                  <TimelineIcon />
                </IconButton>
              </Tooltip>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </TableContainer>
);

const StandingsRows = ({ standings }: { standings: Standings }) => {
  const rows = [...standings.teams].sort((a, b) => a.rank - b.rank);
  return (
    <>
      <LiveSummary standings={standings} />
      <Box sx={{ display: { xs: "block", md: "none" } }}>
        <StandingsCards rows={rows} round={standings.round} />
      </Box>
      <Box sx={{ display: { xs: "none", md: "block" } }}>
        <TableRows rows={rows} round={standings.round} />
        <Legend />
      </Box>
    </>
  );
};

export default StandingsTable;
