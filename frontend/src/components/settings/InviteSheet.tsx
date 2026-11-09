import { Box, Button, Typography } from "@mui/material";
import { useInvite, useRegenerateInvite, useRevokeInvite } from "../../api/queries";
import ErrorState from "../common/ErrorState";
import SettingsSheet from "./SettingsSheet";

/** Show, copy, regenerate or revoke the league's invite link. */
const InviteSheet = ({ leagueId, onClose }: { leagueId: number; onClose: () => void }) => {
  const invite = useInvite(leagueId, true);
  const regenerate = useRegenerateInvite(leagueId);
  const revoke = useRevokeInvite(leagueId);
  const code = invite.data && !invite.data.revoked ? invite.data.code : undefined;
  const link = code ? `${window.location.origin}/join/${code}` : "";
  const expiresAt = invite.data?.expiresAt;
  const copy = (text: string) => navigator.clipboard?.writeText(text);

  return (
    <SettingsSheet title="Invite link" onClose={onClose}>
      {invite.isError ? (
        <ErrorState
          message="Couldn't load the invite. Check your connection and try again."
          onRetry={() => invite.refetch()}
        />
      ) : code ? (
        <Box>
          <Typography
            sx={{ fontFamily: "monospace", fontSize: 28, letterSpacing: 4 }}
            aria-label="Invite code"
          >
            {code}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ wordBreak: "break-all" }}>
            {link}
          </Typography>
        </Box>
      ) : (
        <Typography color="text.secondary">
          No active invite. The old link no longer works (it is retired when a member is removed or
          revoked). Regenerate it to let people join.
        </Typography>
      )}
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        {code && (
          <>
            <Button variant="outlined" sx={{ minHeight: 44 }} onClick={() => copy(link)}>
              Copy link
            </Button>
            <Button variant="outlined" sx={{ minHeight: 44 }} onClick={() => copy(code)}>
              Copy code
            </Button>
          </>
        )}
        <Button
          variant="contained"
          sx={{ minHeight: 44 }}
          disabled={regenerate.isPending}
          onClick={() => regenerate.mutate()}
        >
          {code ? "Regenerate" : "Regenerate invite"}
        </Button>
        {code && (
          <Button
            color="error"
            sx={{ minHeight: 44 }}
            disabled={revoke.isPending}
            onClick={() => revoke.mutate()}
          >
            Revoke
          </Button>
        )}
      </Box>
      {code && (
        <Typography variant="caption" color="text.secondary">
          {expiresAt
            ? `The link works until ${new Date(expiresAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}; regenerate it for a new one. `
            : ""}
          Regenerating retires the old link and code immediately.
        </Typography>
      )}
    </SettingsSheet>
  );
};

export default InviteSheet;
