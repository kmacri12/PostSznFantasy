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
import PlayersTable from "../components/players/PlayersTable";
import Countdown from "../components/draft/Countdown";
import { useWebSocket } from "../hooks/useWebSocket"; // Hook to manage websockets for synchronization

const DraftPage: React.FC = () => {
  const wsUrl = import.meta.env.VITE_WS_URL;

  const { data, isConnected, sendMessage } = useWebSocket(
    `${wsUrl}/socket.io/`
  );
  const [openSettings, setOpenSettings] = useState(false);
  const [draftBoard, setDraftBoard] = useState<string[][]>([]); // Array representing the draft board grid
  const [currentPick, setCurrentPick] = useState<number>(0); // Index of the current pick in the draft
  const [timer, setTimer] = useState<number>(0); // Draft timer (in seconds)

  useEffect(() => {
    if (data) {
      const { board, pick, time } = data;
      setDraftBoard(board);
      setCurrentPick(pick);
      setTimer(time);
    }
  }, [data]);

  const handlePlayerSelection = (playerId: string) => {
    // Handle drafting a player
    console.log("Player drafted:", playerId);
    // Send the draft choice to the server via WebSocket
  };

  return (
    <div>
      {/* Draft Board */}
      <Grid container spacing={1}>
        <Grid item xs={12}>
          <h2>Draft Board</h2>
          <Paper>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Round</TableCell>
                  {/* Render the team owners in the top row */}
                  {draftBoard[0]?.map((_, teamIndex) => (
                    <TableCell key={teamIndex}>Team {teamIndex + 1}</TableCell>
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

        {/* Player List (Bottom of Page) */}
        <Grid item xs={12}>
          <PlayersTable />
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
