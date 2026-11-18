import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import { Box, Switch, Typography } from "@mui/material";
import { useSetAutopilot } from "../../api/queries";
import type { DraftState } from "../../api/types";
import { AUTOPILOT } from "../../content/rules";
import { tint, tokens } from "../../theme";
import { friendlyError } from "../common/friendlyError";

interface Props {
  draft: DraftState;
  teamId: number;
}

/** The manager's own autopilot switch, under the clock bar; tinted while it is on. */
const AutopilotSwitch = ({ draft, teamId }: Props) => {
  const setAutopilot = useSetAutopilot(draft.seasonId);
  const on = draft.autopilotTeamIds.includes(teamId);
  const switchId = "autopilot-switch";
  return (
    <Box
      component="section"
      aria-label={AUTOPILOT.label}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        px: 2,
        py: 1,
        bgcolor: on ? tint(tokens.warning, 12) : "transparent",
        borderBottom: `1px solid ${tokens.border}`,
      }}
    >
      <SmartToyOutlinedIcon
        aria-hidden
        sx={{ fontSize: 20, color: on ? tokens.warning : tokens.muted }}
      />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          component="label"
          htmlFor={switchId}
          sx={{ display: "block", fontSize: 14, fontWeight: 600 }}
        >
          {AUTOPILOT.label}
        </Typography>
        <Typography sx={{ fontSize: 12, color: tokens.textSoft }}>
          {on ? AUTOPILOT.on : AUTOPILOT.off}
        </Typography>
        {setAutopilot.isError && (
          <Typography role="alert" sx={{ fontSize: 12, color: tokens.red }}>
            {friendlyError(setAutopilot.error, "Couldn't change autopilot. Try again.")}
          </Typography>
        )}
      </Box>
      <Switch
        id={switchId}
        checked={on}
        disabled={setAutopilot.isPending}
        onChange={(event) => setAutopilot.mutate({ teamId, enabled: event.target.checked })}
      />
    </Box>
  );
};

export default AutopilotSwitch;
