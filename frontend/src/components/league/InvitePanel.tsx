import { Box, Button, Card, Typography } from "@mui/material";
import { useInvite, useRegenerateInvite, useRevokeInvite } from "../../api/queries";
import ErrorState from "../common/ErrorState";

const InvitePanel = ({ leagueId }: { leagueId: number }) => {
  const invite = useInvite(leagueId, true);
  const regenerate = useRegenerateInvite(leagueId);
  const revoke = useRevokeInvite(leagueId);
  const code = invite.data?.code;
  const link = code ? `${window.location.origin}/join/${code}` : "";
  const expiresAt = invite.data?.expiresAt;

  const copy = (text: string) => navigator.clipboard?.writeText(text);

  return (
    <Card sx={{ p: 2.5 }}>
      <Typography variant="h6">Invite friends</Typography>
      {invite.isError ? (
        <Box sx={{ my: 1 }}>
          <ErrorState
            message="Couldn't load the invite. Check your connection and try again."
            onRetry={() => invite.refetch()}
          />
        </Box>
      ) : code ? (
        <>
          <Typography
            sx={{ fontFamily: "monospace", fontSize: 28, letterSpacing: 4, my: 1 }}
            aria-label="Invite code"
          >
            {code}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ wordBreak: "break-all" }}>
            {link}
          </Typography>
        </>
      ) : (
        <Typography color="text.secondary" sx={{ my: 1 }}>
          No active invite. Generate one to let people join.
        </Typography>
      )}
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 2 }}>
        {code && (
          <>
            <Button size="small" variant="outlined" onClick={() => copy(link)}>
              Copy link
            </Button>
            <Button size="small" variant="outlined" onClick={() => copy(code)}>
              Copy code
            </Button>
          </>
        )}
        <Button
          size="small"
          variant="contained"
          disabled={regenerate.isPending}
          onClick={() => regenerate.mutate()}
        >
          {code ? "Regenerate" : "Create invite"}
        </Button>
        {code && (
          <Button
            size="small"
            color="error"
            disabled={revoke.isPending}
            onClick={() => revoke.mutate()}
          >
            Revoke
          </Button>
        )}
      </Box>
      {code && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
          {expiresAt
            ? `Expires ${new Date(expiresAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })} (invites last 7 days). `
            : ""}
          Regenerating retires the old link and code immediately.
        </Typography>
      )}
    </Card>
  );
};

export default InvitePanel;
