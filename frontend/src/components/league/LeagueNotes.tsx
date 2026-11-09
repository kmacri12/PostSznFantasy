import { Alert, Box, Button, Collapse, Paper, TextField, Typography } from "@mui/material";
import { useState } from "react";
import { useUpdateLeague } from "../../api/queries";
import type { LeagueInfo } from "../../api/types";
import {
  NOTES_EMPTY_COMMISSIONER,
  NOTES_EMPTY_MEMBER,
  NOTES_HINT,
  NOTES_MAX_LENGTH,
  NOTES_TITLE,
} from "../../content/rules";
import { mutationError } from "../common/friendlyError";

/** Free text for house rules and a welcome message: commissioners edit it, everyone reads it. */
const LeagueNotes = ({ league }: { league: LeagueInfo }) => {
  const isCommissioner = league.myRole === "commissioner";
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const update = useUpdateLeague(league.id);
  const failure = mutationError(update.error, "Couldn't save the notes. Try again.");
  const bodyId = "league-notes-body";

  return (
    <Paper component="section" aria-label={NOTES_TITLE}>
      <Box
        component="button"
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((value) => !value)}
        sx={{
          all: "unset",
          boxSizing: "border-box",
          width: "100%",
          minHeight: 52,
          px: 2,
          display: "flex",
          alignItems: "center",
          cursor: "pointer",
          "&:focus-visible": { outline: "2px solid", outlineOffset: -2 },
        }}
      >
        <Typography component="h2" sx={{ flexGrow: 1, fontSize: 14, fontWeight: 600 }}>
          {NOTES_TITLE}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {open ? "Hide" : "Show"}
        </Typography>
      </Box>
      <Collapse in={open} unmountOnExit>
        <Box id={bodyId} sx={{ px: 2, pb: 2 }}>
          {draft === null ? (
            <>
              <Typography
                color={league.notes ? "text.primary" : "text.secondary"}
                sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
              >
                {league.notes || (isCommissioner ? NOTES_EMPTY_COMMISSIONER : NOTES_EMPTY_MEMBER)}
              </Typography>
              {isCommissioner && (
                <Button sx={{ mt: 1 }} onClick={() => setDraft(league.notes)}>
                  Edit notes
                </Button>
              )}
            </>
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
                <Button onClick={() => setDraft(null)}>Cancel</Button>
                <Button
                  variant="contained"
                  disabled={update.isPending}
                  onClick={() =>
                    update.mutate({ notes: draft }, { onSuccess: () => setDraft(null) })
                  }
                >
                  Save
                </Button>
              </Box>
            </>
          )}
        </Box>
      </Collapse>
    </Paper>
  );
};

export default LeagueNotes;
