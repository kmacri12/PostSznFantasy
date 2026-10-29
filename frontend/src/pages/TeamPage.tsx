import {
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
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useUser } from "../contexts/UserContext";

export interface RosterPlayer {
  id: number;
  name: string;
  position: string;
  teamAbv?: string;
  slot?: string;
  isActive?: boolean;
}

export interface TeamDetails {
  id: number;
  name: string;
  leagueId: number;
  ownerName: string;
  roster: RosterPlayer[];
}

function TeamPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const apiUrl = import.meta.env.VITE_API_URL;
  const { getIdToken } = useUser();
  const [team, setTeam] = useState<TeamDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamId) return;

    const fetchTeam = async () => {
      try {
        const token = await getIdToken();
        const response = await axios.get(`${apiUrl}/api/leagues/teams/${teamId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        setTeam(response.data);
      } catch (error) {
        console.error("Error fetching team:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTeam();
  }, [teamId, apiUrl, getIdToken]);

  if (loading) {
    return <div style={{ padding: 24 }}>Loading roster...</div>;
  }

  return (
    <div style={{ padding: 24 }}>
      <Typography variant="h4" gutterBottom>
        {team?.name || `Team #${teamId}`}
      </Typography>
      <Typography variant="subtitle1" color="textSecondary" gutterBottom>
        Owner: {team?.ownerName || "Unknown"}
      </Typography>

      <TableContainer component={Paper} sx={{ mt: 3 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Slot</TableCell>
              <TableCell>Player</TableCell>
              <TableCell>Position</TableCell>
              <TableCell>NFL Team</TableCell>
              <TableCell>Playoff Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {team?.roster && team.roster.length > 0 ? (
              team.roster.map((player) => (
                <TableRow key={player.id}>
                  <TableCell>{player.slot || "BENCH"}</TableCell>
                  <TableCell style={{ fontWeight: 600 }}>{player.name}</TableCell>
                  <TableCell>{player.position}</TableCell>
                  <TableCell>{player.teamAbv || "-"}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={player.isActive !== false ? "Alive" : "Eliminated"}
                      color={player.isActive !== false ? "success" : "default"}
                    />
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} align="center">
                  No players rostered yet. Complete the draft to populate your lineup!
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </div>
  );
}

export default TeamPage;
