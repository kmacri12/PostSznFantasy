import React, { useEffect, useState } from "react";
import {
  Grid,
  Button,
  Dialog,
  IconButton,
  Table,
  TableCell,
  TableHead,
  TableRow,
  Paper,
} from "@mui/material";
import { Settings } from "@mui/icons-material";
import Countdown from "../components/draft/Countdown";
import { useWebSocket } from "../hooks/useWebSocket";
import PlayerSelector from "../components/draft/PlayerSelector";
import { Player } from "../components/draft/PlayerSelector";
import { getAuth } from "firebase/auth";
import axios from "axios";
import { useParams } from "react-router-dom";

interface Team {
  id: number;
  name: string;
  ownerId: number;
  ownerName: string;
}

const DraftPage: React.FC = () => {
  const { leagueId } = useParams<{ leagueId: string }>();
  const wsUrl = import.meta.env.VITE_WS_URL;

  const { data, isConnected, sendMessage } = useWebSocket(
    `${wsUrl}/socket.io/`
  );
  const [openSettings, setOpenSettings] = useState(false);
  const [draftBoard, setDraftBoard] = useState<string[][]>([]); // Array representing the draft board grid
  const [currentPick, setCurrentPick] = useState<number>(0); // Index of the current pick in the draft
  const [timer, setTimer] = useState<number>(0); // Draft timer (in seconds)
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL;
        const auth = getAuth();
        const user = auth.currentUser;

        if (!user) {
          console.error("No user is currently signed in.");
          return;
        }

        const idToken = await user.getIdToken();

        const response = await axios.get(
          `${apiUrl}/api/league/${leagueId}/teams`,
          {
            headers: { Authorization: `Bearer ${idToken}` },
          }
        );

        const teamsList = response.data;
        setTeams(teamsList);
        console.log(teams);
      } catch (error) {
        console.error("Error fetching teams:", error);
      }
    };

    fetchTeams();
  }, [leagueId]);

  useEffect(() => {
    if (data) {
      const { board, pick, time } = data;
      setDraftBoard(board);
      setCurrentPick(pick);
      setTimer(time);
    }
  }, [data]);

  const handlePlayerSelection = (player: Player) => {
    // Handle drafting a player
    console.log("Player drafted:", player);
    // Send the draft choice to the server via WebSocket
  };

  return (
    <div>
      <PlayerSelector
        onPlayerSelected={handlePlayerSelection}
        isMyTurn={true}
        selectedPlayerIDs={[]}
      />
      <Grid container spacing={1}>
        <Grid item xs={12}>
          <h2>Draft Board</h2>
          <Paper>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Round</TableCell>
                  {/* Render the team owners in the top row */}
                  {teams?.map((team, teamIndex) => (
                    <TableCell key={teamIndex}>
                      {team.name} {team.ownerName}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              {/* Render draft picks */}
              {draftBoard.map((round, roundIndex) => (
                <TableRow key={roundIndex}>
                  <TableCell>Round {roundIndex + 1}</TableCell>
                  {round.map((player, teamIndex) => (
                    <TableCell key={teamIndex}>{player || "-"}</TableCell>
                  ))}
                </TableRow>
              ))}
            </Table>
          </Paper>
        </Grid>

        {/* Settings Button */}
        <IconButton
          style={{ position: "absolute", top: 10, right: 10 }}
          onClick={() => setOpenSettings(true)}
        >
          <Settings />
        </IconButton>

        {/* Countdown Timer */}
        <Grid item xs={12}>
          <Countdown time={timer} />
        </Grid>
      </Grid>

      {/* Draft Settings Dialog */}
      <Dialog open={openSettings} onClose={() => setOpenSettings(false)}>
        {/* Settings content goes here */}
        <h2>Draft Settings</h2>
        <Button onClick={() => setOpenSettings(false)}>Close</Button>
      </Dialog>
    </div>
  );
};

export default DraftPage;
