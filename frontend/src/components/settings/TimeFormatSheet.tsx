import { Alert, Box, Button, TextField, ToggleButton, ToggleButtonGroup } from "@mui/material";
import { useState } from "react";
import { type Account, useSaveDisplayPreferences } from "../../api/queries";
import { browserTimeZone, type HourCycle } from "../../utils/timeZone";
import { mutationError } from "../common/friendlyError";
import SettingsSheet from "./SettingsSheet";

const DEVICE = "";

const zones = (): string[] => {
  const supported = Intl.supportedValuesOf?.("timeZone") ?? [];
  const device = browserTimeZone();
  return supported.includes(device) ? supported : [device, ...supported];
};

interface Props {
  account: Account;
  onClose: () => void;
}

/** Time zone and 12/24-hour clock: "This device" follows the browser, which is the default. */
const TimeFormatSheet = ({ account, onClose }: Props) => {
  const save = useSaveDisplayPreferences();
  const [zone, setZone] = useState(account.displayTimeZone ?? DEVICE);
  const [clock, setClock] = useState<HourCycle | "auto">(account.hourCycle ?? "auto");
  const unchanged =
    zone === (account.displayTimeZone ?? DEVICE) && clock === (account.hourCycle ?? "auto");

  const submit = () =>
    save.mutate(
      {
        displayTimeZone: zone === DEVICE ? null : zone,
        hourCycle: clock === "auto" ? null : clock,
      },
      { onSuccess: onClose },
    );

  return (
    <SettingsSheet title="Time zone and clock" onClose={onClose} closeLabel="Cancel">
      <Box sx={{ display: "grid", gap: 2 }}>
        <TextField
          select
          fullWidth
          label="Time zone"
          value={zone}
          onChange={(event) => setZone(event.target.value)}
          slotProps={{ select: { native: true } }}
          helperText="Every game, draft and lock time is shown in this zone."
        >
          <option value={DEVICE}>This device ({browserTimeZone()})</option>
          {zones().map((name) => (
            <option key={name} value={name}>
              {name.replaceAll("_", " ")}
            </option>
          ))}
        </TextField>
        <ToggleButtonGroup
          exclusive
          fullWidth
          size="small"
          value={clock}
          aria-label="Clock"
          onChange={(_, next: HourCycle | "auto" | null) => next && setClock(next)}
        >
          <ToggleButton value="auto" sx={{ minHeight: 44 }}>
            This device
          </ToggleButton>
          <ToggleButton value="12" sx={{ minHeight: 44 }}>
            12-hour
          </ToggleButton>
          <ToggleButton value="24" sx={{ minHeight: 44 }}>
            24-hour
          </ToggleButton>
        </ToggleButtonGroup>
        {save.error && (
          <Alert severity="error">{mutationError(save.error, "Couldn't save. Try again.")}</Alert>
        )}
        <Button
          variant="contained"
          sx={{ minHeight: 44 }}
          disabled={unchanged || save.isPending}
          onClick={submit}
        >
          Save
        </Button>
      </Box>
    </SettingsSheet>
  );
};

export default TimeFormatSheet;
