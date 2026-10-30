import { Alert } from "@mui/material";

const DraftLockNotice = ({ spacing = "bottom" }: { spacing?: "top" | "bottom" }) => (
  <Alert severity="info" sx={spacing === "top" ? { mt: 2 } : { mb: 2 }}>
    Roster slots, position caps and team count lock when the draft starts. Scoring, round
    multipliers and the team QB/K choices stay editable.
  </Alert>
);

export default DraftLockNotice;
