import {
  Avatar,
  Box,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import type React from "react";
import { Link } from "react-router-dom";
import { useStandings } from "../../api/queries";
import { tokens } from "../../theme";

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
  const { data, isLoading } = useStandings(leagueId);
  const standings = [...(data ?? [])].sort((a, b) => a.rank - b.rank);

  if (isLoading) {
    return <Typography color="text.secondary">Loading standings...</Typography>;
  }

  if (standings.length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: "center" }}>
        <Typography color="text.secondary">
          Standings appear once the playoffs begin and scores are in.
        </Typography>
      </Paper>
    );
  }

  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell width={56}>#</TableCell>
            <TableCell>Team</TableCell>
            <TableCell align="center">Alive</TableCell>
            <TableCell align="center">Wild Card</TableCell>
            <TableCell align="center">Divisional</TableCell>
            <TableCell align="center">Conf</TableCell>
            <TableCell align="center">Super Bowl</TableCell>
            <TableCell align="right">Total</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {standings.map((row) => (
            <TableRow key={row.teamId} hover>
              <TableCell sx={{ fontWeight: 800, color: RANK_COLORS[row.rank - 1] ?? tokens.muted }}>
                {row.rank}
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
                  <Avatar
                    sx={{ width: 32, height: 32, bgcolor: tokens.borderStrong, fontSize: 14 }}
                  >
                    {row.teamName[0]}
                  </Avatar>
                  <Box>
                    <Typography fontWeight={600} lineHeight={1.2}>
                      {row.teamName}
                    </Typography>
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
                  label={`${row.playersLeft} alive`}
                  variant="outlined"
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
              <TableCell align="right" sx={{ fontWeight: 800, fontSize: 18 }}>
                {row.total}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default StandingsTable;
