import { Box, Card, Chip, Container, Grid, Typography } from "@mui/material";
import axios from "axios";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useUser } from "../contexts/UserContext";
import { tokens } from "../theme";
import { createLogger } from "../utils/logger";

const logger = createLogger("TeamPage");

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
        logger.error("Error fetching team:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTeam();
  }, [teamId, apiUrl, getIdToken]);

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Typography color="text.secondary">Loading roster...</Typography>
      </Container>
    );
  }

  const roster = team?.roster ?? [];
  const aliveCount = roster.filter((player) => player.isActive !== false).length;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4">{team?.name || `Team #${teamId}`}</Typography>
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", mt: 1, mb: 3 }}>
        <Typography color="text.secondary">Owner: {team?.ownerName || "Unclaimed"}</Typography>
        {roster.length > 0 && (
          <Chip
            size="small"
            color="success"
            variant="outlined"
            label={`${aliveCount} of ${roster.length} alive`}
          />
        )}
      </Box>

      {roster.length === 0 ? (
        <Card sx={{ p: 4, textAlign: "center" }}>
          <Typography color="text.secondary">
            No players rostered yet. Complete the draft to populate your lineup!
          </Typography>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {roster.map((player) => {
            const alive = player.isActive !== false;
            return (
              <Grid item xs={12} sm={6} md={4} key={player.id}>
                <Card
                  sx={{
                    p: 2,
                    opacity: alive ? 1 : 0.55,
                    borderLeft: `4px solid ${alive ? tokens.green : tokens.red}`,
                  }}
                >
                  <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                    <Chip size="small" label={player.slot || "BENCH"} variant="outlined" />
                    <Chip
                      size="small"
                      color={alive ? "success" : "error"}
                      label={alive ? "Alive" : "Eliminated"}
                    />
                  </Box>
                  <Typography
                    variant="h6"
                    sx={{ mt: 1.5, textDecoration: alive ? "none" : "line-through" }}
                  >
                    {player.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {player.position} · {player.teamAbv || "FA"}
                  </Typography>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Container>
  );
}

export default TeamPage;
