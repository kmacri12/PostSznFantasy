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
import axios from "axios";
import type React from "react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useUser } from "../../contexts/UserContext";
import { tokens } from "../../theme";
import { createLogger } from "../../utils/logger";

const logger = createLogger("StandingsTable");

interface StandingsTableProps {
  leagueId: string;
}

interface Standings {
  teamId: number;
  rank: number;
  teamName: string;
  owner: string;
  playersLeft: number;
  wildCard: number;
  divisional: number;
  confChamp: number;
  superBowl: number;
  total: number;
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
  const [standings, setStandings] = useState<Standings[]>([]);
  const [loading, setLoading] = useState(true);
  const { getIdToken } = useUser();

  useEffect(() => {
    const fetchStandings = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL;
        const idToken = await getIdToken();

        if (!idToken) {
          logger.error("No user is currently signed in.");
          return;
        }

        const response = await axios.get<Standings[]>(
          `${apiUrl}/api/leagues/${leagueId}/standings`,
          { headers: { Authorization: `Bearer ${idToken}` } },
        );
        setStandings([...response.data].sort((a, b) => a.rank - b.rank));
      } catch (error) {
        logger.error("Error fetching standings:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStandings();
  }, [leagueId, getIdToken]);

  if (loading) {
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
