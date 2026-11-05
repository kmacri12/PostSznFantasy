import { Box, Button } from "@mui/material";
import { useEffect, useState } from "react";
import { useInvite, useRegenerateInvite } from "../../api/queries";

const COPIED_MS = 2000;

/** Copies (or creates, then copies) the league's invite link; shares it where the browser can. */
const InviteLinkButton = ({ leagueId, leagueName }: { leagueId: number; leagueName: string }) => {
  const invite = useInvite(leagueId, true);
  const regenerate = useRegenerateInvite(leagueId);
  const [copied, setCopied] = useState(false);
  const code = invite.data?.code;
  const link = code ? `${window.location.origin}/join/${code}` : "";

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const copy = async (text: string) => {
    await navigator.clipboard?.writeText(text);
    setCopied(true);
  };

  if (!code) {
    return (
      <Button
        fullWidth
        variant="contained"
        sx={{ minHeight: 48 }}
        disabled={invite.isLoading || regenerate.isPending}
        onClick={() =>
          regenerate.mutate(undefined, { onSuccess: (made) => copy(linkFor(made.code)) })
        }
      >
        Create invite link
      </Button>
    );
  }
  return (
    <Box sx={{ display: "flex", gap: 1 }}>
      <Button fullWidth variant="contained" sx={{ minHeight: 48 }} onClick={() => copy(link)}>
        {copied ? "Link copied" : "Copy invite link"}
      </Button>
      {typeof navigator.share === "function" && (
        <Button
          variant="outlined"
          sx={{ minHeight: 48, flexShrink: 0 }}
          onClick={() =>
            navigator.share({ title: `Join ${leagueName}`, url: link }).catch(() => undefined)
          }
        >
          Share
        </Button>
      )}
    </Box>
  );
};

const linkFor = (code: string) => `${window.location.origin}/join/${code}`;

export default InviteLinkButton;
