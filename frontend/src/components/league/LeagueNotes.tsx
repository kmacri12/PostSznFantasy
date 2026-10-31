import { Alert, Box, Button, Paper, TextField, Typography } from "@mui/material";
import { useState } from "react";
import { useUpdateLeague } from "../../api/queries";
import type { LeagueOverview } from "../../api/types";
import {
  NOTES_EMPTY_COMMISSIONER,
  NOTES_EMPTY_MEMBER,
  NOTES_HINT,
  NOTES_MAX_LENGTH,
  NOTES_TITLE,
} from "../../content/rules";
import { mutationError } from "../common/friendlyError";

/** Free text for buy-in, prizes and house rules: commissioners edit it, everyone reads it. */
const LeagueNotes = ({
  league,
  readOnly = false,
}: {
  league: LeagueOverview;
  readOnly?: boolean;
}) => {
  const isCommissioner = league.myRole === "commissioner" && !readOnly;
  const [draft, setDraft] = useState<string | null>(null);
  const update = useUpdateLeague(league.id);
  const failure = mutationError(update.error, "Couldn't save the notes. Try again.");

  return (
    <Paper component="section" aria-label={NOTES_TITLE} sx={{ p: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Typography variant="h6" component="h2" sx={{ flexGrow: 1 }}>
          {NOTES_TITLE}
        </Typography>
        {isCommissioner && draft === null && (
          <Button sx={{ minHeight: 44 }} onClick={() => setDraft(league.notes)}>
            Edit notes
          </Button>
        )}
      </Box>
      {draft === null ? (
        <Typography
          color={league.notes ? "text.primary" : "text.secondary"}
          sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
        >
          {league.notes || (isCommissioner ? NOTES_EMPTY_COMMISSIONER : NOTES_EMPTY_MEMBER)}
        </Typography>
      ) : (
        <>
          <TextField
            fullWidth
            multiline
            minRows={4}
            label={NOTES_TITLE}
            value={draft}
            helperText={`${NOTES_HINT} ${draft.length}/${NOTES_MAX_LENGTH}`}
            slotProps={{ htmlInput: { maxLength: NOTES_MAX_LENGTH } }}
            onChange={(event) => setDraft(event.target.value)}
          />
          {failure && <Alert severity="error">{failure}</Alert>}
          <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end", mt: 1 }}>
            <Button sx={{ minHeight: 44 }} onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button
              variant="contained"
              sx={{ minHeight: 44 }}
              disabled={update.isPending}
              onClick={() => update.mutate({ notes: draft }, { onSuccess: () => setDraft(null) })}
            >
              Save
            </Button>
          </Box>
        </>
      )}
    </Paper>
  );
};

export default LeagueNotes;
