import { Alert } from "@mui/material";
import type { DraftState } from "../../api/types";

const PRE_DRAFT = ["unscheduled", "scheduled", "lobby"];

const PreDraftNotice = ({ state }: { state: DraftState }) => {
  if (!PRE_DRAFT.includes(state.status)) return null;
  return (
    <>
      {!state.playoffFieldSet && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          The draft can't start until all 14 playoff teams are set. The player pool fills in then.
        </Alert>
      )}
      {state.draftCutoff && (
        <Alert severity="info" sx={{ mt: 2 }}>
          The draft must start before the first Wild Card kickoff,{" "}
          {new Date(state.draftCutoff).toLocaleString([], {
            weekday: "short",
            hour: "numeric",
            minute: "2-digit",
          })}
          .
        </Alert>
      )}
    </>
  );
};

export default PreDraftNotice;
