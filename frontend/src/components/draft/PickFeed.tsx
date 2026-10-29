import { List, ListItem, ListItemText, Typography } from "@mui/material";
import type { DraftState } from "../../api/types";

const PickFeed = ({ state }: { state: DraftState }) => {
  const teamName = (id: number) =>
    state.order.find((slot) => slot.teamId === id)?.teamName ?? "Team";
  const recent = [...state.picks].reverse();
  if (recent.length === 0) {
    return <Typography color="text.secondary">No picks yet.</Typography>;
  }
  return (
    <List dense aria-label="Pick feed">
      {recent.map((pick) => (
        <ListItem key={pick.numberPickOverall}>
          <ListItemText
            primary={`${pick.numberPickOverall}. ${pick.playerName} (${pick.position})`}
            secondary={`${teamName(pick.teamId)} · round ${pick.numberRound}${pick.autopick ? " · auto-pick" : ""}`}
          />
        </ListItem>
      ))}
    </List>
  );
};

export default PickFeed;
