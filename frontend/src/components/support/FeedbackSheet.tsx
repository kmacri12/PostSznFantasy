import { Alert, Box, Button, Rating, TextField, Typography } from "@mui/material";
import { type FormEvent, useState } from "react";
import { useSendFeedback } from "../../api/queries";
import { FEEDBACK_LABEL, FEEDBACK_NOTE } from "../../content/rules";
import { tokens } from "../../theme";
import { friendlyError } from "../common/friendlyError";
import SettingsSheet from "../settings/SettingsSheet";

export const MAX_FEEDBACK_CHARS = 2000;

interface Props {
  onClose: () => void;
  onSent: () => void;
}

/** More, Send feedback: an optional 1 to 5 rating and two optional texts, sent anonymously. */
const FeedbackSheet = ({ onClose, onSent }: Props) => {
  const send = useSendFeedback();
  const [rating, setRating] = useState<number | null>(null);
  const [good, setGood] = useState("");
  const [bad, setBad] = useState("");

  const empty = rating === null && good.trim() === "" && bad.trim() === "";

  const submit = (event: FormEvent) => {
    event.preventDefault();
    send.mutate({ rating, good: good.trim(), bad: bad.trim() }, { onSuccess: onSent });
  };

  const failure = send.isError
    ? friendlyError(send.error, "Couldn't send your feedback. Check your connection and try again.")
    : null;

  return (
    <SettingsSheet title={FEEDBACK_LABEL} onClose={onClose} closeLabel="Cancel">
      <Box component="form" onSubmit={submit} sx={{ display: "grid", gap: 2 }}>
        <Typography sx={{ fontSize: 13, color: tokens.textSoft }}>{FEEDBACK_NOTE}</Typography>
        <Box sx={{ display: "grid", gap: 0.5 }}>
          <Typography component="legend" sx={{ fontWeight: 600 }}>
            How is it going? (optional)
          </Typography>
          <Rating
            name="feedback-rating"
            value={rating}
            onChange={(_, value) => setRating(value)}
            size="large"
            getLabelText={(value) => `${value} out of 5`}
            sx={{
              "& .MuiRating-icon": { p: "6px", fontSize: 32 },
              "& .MuiRating-label": { minWidth: 44, minHeight: 44 },
            }}
          />
        </Box>
        <TextField
          fullWidth
          multiline
          minRows={3}
          label="What was good?"
          value={good}
          onChange={(event) => setGood(event.target.value)}
          slotProps={{ htmlInput: { maxLength: MAX_FEEDBACK_CHARS } }}
        />
        <TextField
          fullWidth
          multiline
          minRows={3}
          label="What was bad?"
          value={bad}
          onChange={(event) => setBad(event.target.value)}
          slotProps={{ htmlInput: { maxLength: MAX_FEEDBACK_CHARS } }}
        />
        {failure && <Alert severity="error">{failure}</Alert>}
        <Button
          type="submit"
          variant="contained"
          sx={{ minHeight: 44 }}
          disabled={send.isPending || empty}
        >
          {send.isPending ? "Sending…" : "Send"}
        </Button>
      </Box>
    </SettingsSheet>
  );
};

export default FeedbackSheet;
