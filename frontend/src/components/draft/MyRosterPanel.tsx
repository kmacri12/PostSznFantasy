import { List, ListItem, ListItemText, Typography } from "@mui/material";
import type { DraftState } from "../../api/types";

const MyRosterPanel = ({ state, myTeamId }: { state: DraftState; myTeamId: number | null }) => {
  const mine = state.picks.filter((pick) => pick.teamId === myTeamId);
  if (mine.length === 0)
    return <Typography color="text.secondary">You haven't drafted anyone yet.</Typography>;
  return (
    <List dense aria-label="My roster">
      {mine.map((pick) => (
        <ListItem key={pick.numberPickOverall}>
          <ListItemText
            primary={pick.playerName}
            secondary={`${pick.position} · round ${pick.numberRound}`}
          />
        </ListItem>
      ))}
    </List>
  );
};

export default MyRosterPanel;
