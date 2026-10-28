import { Grid, Paper, Table, TableCell, TableHead, TableRow } from "@mui/material";
import type React from "react";
import type { DraftPick, Team } from "../../pages/DraftPage";
import type { Player } from "./PlayerSelector";

interface Props {
  teams: Team[];
  draftPicks: DraftPick[][];
  currentPickIndex: number;
  timer?: number;
  onPlayerSelected?: (player: Player) => void;
  isMyTurn?: boolean;
  selectedPlayerIDs?: number[];
}

const DraftBoard: React.FC<Props> = ({ teams, draftPicks: draftBoard, currentPickIndex }) => {
  return (
    <Grid item xs={12}>
      <h2>Draft Board</h2>
      <Paper>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Round</TableCell>
              {teams?.map((team) => (
                <TableCell key={team.id}>
                  {team.name} ({team.ownerName})
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          {draftBoard.map((round, roundIndex) => (
            <TableRow key={roundIndex}>
              <TableCell>{roundIndex + 1}</TableCell>
              {round.map((pick) => (
                <TableCell
                  key={pick.numberPickOverall}
                  style={{
                    backgroundColor:
                      pick.numberPickOverall === currentPickIndex ? "#f0f0f0" : "inherit",
                  }}
                >
                  {pick.playerName || `#${pick.numberPickOverall}`}
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
