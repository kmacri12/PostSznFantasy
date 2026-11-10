import { Box, Button, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import { useInvite, useRegenerateInvite, useRevokeInvite } from "../../api/queries";
import { canShareInvite, shareInvite } from "../../utils/shareInvite";
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
  const [copied, setCopied] = useState<"link" | "code" | "failed" | null>(null);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(null), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async (text: string, what: "link" | "code") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
    } catch {
      setCopied("failed");
    }
  };

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
            sx={{ fontFamily: "monospace", fontSize: 28, letterSpacing: 4, userSelect: "all" }}
            aria-label="Invite code"
          >
            {code}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ wordBreak: "break-all", userSelect: "all" }}
          >
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
            {canShareInvite() && (
              <Button variant="contained" sx={{ minHeight: 44 }} onClick={() => shareInvite(link)}>
                Share
              </Button>
            )}
            <Button variant="outlined" sx={{ minHeight: 44 }} onClick={() => copy(link, "link")}>
              {copied === "link" ? "Link copied" : "Copy link"}
            </Button>
            <Button variant="outlined" sx={{ minHeight: 44 }} onClick={() => copy(code, "code")}>
              {copied === "code" ? "Code copied" : "Copy code"}
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
      {copied === "failed" && (
        <Typography role="alert" variant="body2" color="error">
          Couldn't copy. Tap the link above to select it, then copy it yourself.
        </Typography>
      )}
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
