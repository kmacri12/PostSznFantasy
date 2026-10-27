import { Grid, Paper, Table, TableCell, TableHead, TableRow } from "@mui/material";
import type React from "react";
import type { Player } from "./PlayerSelector";

interface Props {
  teams: Team[];
  draftPicks: DraftPick[][];
  currentPickIndex: number;
  timer: number;
  onPlayerSelected: (player: Player) => void; // Function to handle player selection
  isMyTurn: boolean; // Flag indicating if it's the user's turn
  selectedPlayerIDs: number[]; // Array of selected player IDs (optional)
}

const DraftBoard: React.FC<Props> = ({
  teams,
  draftPicks: draftBoard,
  currentPickIndex,
  timer,
  onPlayerSelected,
  isMyTurn,
  selectedPlayerIDs,
}) => {
  return (
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
              <TableCell>{roundIndex + 1}</TableCell>
              {round.map((player, teamIndex) => (
                <TableCell
                  key={teamIndex}
                  style={{
                    backgroundColor:
                      player.numberPickOverall === currentPickIndex ? "#f0f0f0" : "inherit",
                  }}
                >
                  {player.playerName || player.numberPickOverall}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </Table>
      </Paper>
    </Grid>
  );
};

export default DraftBoard;
