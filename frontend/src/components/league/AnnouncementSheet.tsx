import { Alert, Box, Button, Switch, TextField, Typography } from "@mui/material";
import { type FormEvent, useState } from "react";
import { usePinAnnouncement } from "../../api/queries";
import { ANNOUNCEMENT } from "../../content/rules";
import { mutationError } from "../common/friendlyError";
import SettingsSheet from "../settings/SettingsSheet";

interface Props {
  leagueId: number;
  initial: string;
  onClose: () => void;
}

/** Write or replace the pinned announcement; the commissioner chooses whether it also pushes. */
const AnnouncementSheet = ({ leagueId, initial, onClose }: Props) => {
  const pin = usePinAnnouncement(leagueId);
  const [body, setBody] = useState(initial);
  const [push, setPush] = useState(false);
  const trimmed = body.trim();
  const failure = mutationError(pin.error, "Couldn't post the announcement. Try again.");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    pin.mutate({ body: trimmed, push }, { onSuccess: onClose });
  };

  return (
    <SettingsSheet title={ANNOUNCEMENT.post} onClose={onClose} closeLabel="Cancel">
      <Box component="form" onSubmit={submit} sx={{ display: "grid", gap: 1.5 }}>
        <TextField
          autoFocus
          fullWidth
          multiline
          minRows={4}
          label={ANNOUNCEMENT.label}
          value={body}
          helperText={`${ANNOUNCEMENT.hint} ${body.length}/${ANNOUNCEMENT.maxLength}`}
          slotProps={{ htmlInput: { maxLength: ANNOUNCEMENT.maxLength } }}
          onChange={(event) => setBody(event.target.value)}
        />
        <Box
          component="label"
          sx={{ display: "flex", alignItems: "center", gap: 1, minHeight: 44, cursor: "pointer" }}
        >
          <Switch
            checked={push}
            onChange={(event) => setPush(event.target.checked)}
            slotProps={{ input: { "aria-label": ANNOUNCEMENT.pushLabel } }}
          />
          <Box>
            <Typography sx={{ fontSize: 14, fontWeight: 600 }}>{ANNOUNCEMENT.pushLabel}</Typography>
            <Typography variant="caption" color="text.secondary">
              {ANNOUNCEMENT.pushHint}
            </Typography>
          </Box>
        </Box>
        {failure && <Alert severity="error">{failure}</Alert>}
        <Button
          type="submit"
          variant="contained"
          sx={{ minHeight: 44 }}
          disabled={pin.isPending || trimmed === ""}
        >
          {ANNOUNCEMENT.save}
        </Button>
      </Box>
    </SettingsSheet>
  );
};

export default AnnouncementSheet;
