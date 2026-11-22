import { Typography } from "@mui/material";
import { useState } from "react";
import { useRefreshLive } from "../../api/queries";
import { isAdminHint } from "../../utils/admin";
import { friendlyError } from "../common/friendlyError";
import SettingsCard from "./SettingsCard";
import SettingsRow from "./SettingsRow";

interface Outcome {
  failed: boolean;
  message: string;
}

const refreshedMessage = (polled: number): string =>
  polled === 0
    ? "Nothing to refresh: no live games, or the daily API limit is spent."
    : `Refreshed: ${polled} live ${polled === 1 ? "game" : "games"} updated.`;

/** Runs one live-poll cycle now; each tap spends one Tank01 call per live game. */
const RefreshLiveRow = () => {
  const refresh = useRefreshLive();
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  return (
    <>
      <SettingsCard>
        <SettingsRow
          label="Refresh live stats"
          value={refresh.isPending ? "Refreshing…" : undefined}
          onClick={() => {
            if (refresh.isPending) return;
            setOutcome(null);
            refresh.mutate(undefined, {
              onSuccess: ({ polled }) =>
                setOutcome({ failed: false, message: refreshedMessage(polled) }),
              onError: (error) =>
                setOutcome({
                  failed: true,
                  message: friendlyError(error, "Couldn't refresh stats. Try again."),
                }),
            });
          }}
        />
      </SettingsCard>
      <Typography
        role={outcome?.failed ? "alert" : "status"}
        variant="body2"
        color={outcome?.failed ? "error.light" : "text.secondary"}
        sx={{ mt: 1, px: 2, "&:empty": { display: "none" } }}
      >
        {outcome?.message}
      </Typography>
    </>
  );
};

/** Site-admin tools in the profile sheet, so league and team pages look the same for everyone. */
const AdminSection = ({ userId }: { userId: string }) => {
  if (!isAdminHint(userId)) return null;
  return (
    <>
      <Typography
        component="h3"
        variant="overline"
        sx={{ color: "text.secondary", fontWeight: 700, mt: 3, mb: 0.5, display: "block" }}
      >
        Admin
      </Typography>
      <RefreshLiveRow />
    </>
  );
};

export default AdminSection;
