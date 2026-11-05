import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { Alert, Box, IconButton, InputBase, Typography } from "@mui/material";
import { type FormEvent, type KeyboardEvent, useState } from "react";
import { usePostMessage } from "../../api/queries";
import { tokens } from "../../theme";
import { gifProvider } from "../../utils/gifProvider";
import { mutationError } from "../common/friendlyError";
import GifPicker from "./GifPicker";

export const MAX_MESSAGE_LENGTH = 2000;

const roundButtonSx = {
  width: 44,
  height: 44,
  flex: "none",
  border: `1px solid ${tokens.borderStrong}`,
  color: tokens.textSoft,
  fontSize: 12,
  fontWeight: 700,
} as const;

const finePointer = () => window.matchMedia?.("(pointer: fine)").matches ?? false;

/** The message box: text, an optional GIF, and a send button. Enter sends with a mouse. */
const Composer = ({ seasonId }: { seasonId: number }) => {
  const [text, setText] = useState("");
  const [picking, setPicking] = useState(false);
  const post = usePostMessage(seasonId);
  const provider = gifProvider();
  const body = text.trim();

  const send = (gifUrl?: string) => {
    if (post.isPending || (!body && !gifUrl)) return;
    post.mutate({ body, gifUrl }, { onSuccess: () => setText("") });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    send();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing &&
      finePointer()
    ) {
      event.preventDefault();
      send();
    }
  };

  const error = mutationError(post.error, "Couldn't send your message. Try again.");

  return (
    <Box sx={{ borderTop: `1px solid ${tokens.border}`, bgcolor: tokens.bg, px: 2, py: 1.25 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 1 }}>
          {error}
        </Alert>
      )}
      <Box
        component="form"
        onSubmit={submit}
        sx={{ display: "flex", gap: 1, alignItems: "flex-end" }}
      >
        {provider && (
          <IconButton
            aria-label="Add a GIF"
            onClick={() => setPicking(true)}
            disabled={post.isPending}
            sx={roundButtonSx}
          >
            GIF
          </IconButton>
        )}
        <InputBase
          multiline
          maxRows={4}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Message the league"
          inputProps={{ "aria-label": "Message the league", maxLength: MAX_MESSAGE_LENGTH }}
          sx={{
            flex: 1,
            minWidth: 0,
            minHeight: 44,
            px: 2,
            py: 0.75,
            fontSize: 14,
            borderRadius: "22px",
            border: `1px solid ${tokens.borderStrong}`,
            bgcolor: tokens.surface,
            alignItems: "center",
          }}
        />
        <IconButton
          type="submit"
          aria-label="Send message"
          disabled={post.isPending || !body}
          sx={{
            ...roundButtonSx,
            bgcolor: tokens.accentFill,
            borderColor: tokens.accentFill,
            color: tokens.accentInk,
            "&:hover": { bgcolor: tokens.accentFill },
            "&.Mui-disabled": {
              bgcolor: tokens.surfaceRaised,
              borderColor: tokens.borderStrong,
              color: tokens.muted,
            },
          }}
        >
          <ArrowForwardIcon fontSize="small" />
        </IconButton>
      </Box>
      {text.length > MAX_MESSAGE_LENGTH - 200 && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
          {text.length} / {MAX_MESSAGE_LENGTH}
        </Typography>
      )}
      {picking && provider && (
        <GifPicker
          provider={provider}
          onClose={() => setPicking(false)}
          onPick={(gif) => {
            setPicking(false);
            send(gif.url);
          }}
        />
      )}
    </Box>
  );
};

export default Composer;
