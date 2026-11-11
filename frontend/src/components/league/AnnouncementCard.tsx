import { Alert, Box, Button, Typography } from "@mui/material";
import { useState } from "react";
import { useUnpinAnnouncement } from "../../api/queries";
import type { LeagueInfo } from "../../api/types";
import { ANNOUNCEMENT } from "../../content/rules";
import { tokens } from "../../theme";
import { formatWhen } from "../activity/describe";
import { mutationError } from "../common/friendlyError";
import AnnouncementSheet from "./AnnouncementSheet";

/**
 * The pinned announcement at the top of the league home. Everyone reads it; commissioners
 * post, replace and remove it, and see a button to post one when there is none.
 */
const AnnouncementCard = ({ league }: { league: LeagueInfo }) => {
  const isCommissioner = league.myRole === "commissioner";
  const { announcement } = league;
  const [editing, setEditing] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const unpin = useUnpinAnnouncement(league.id);
  const failure = mutationError(unpin.error, "Couldn't remove the announcement. Try again.");

  if (!announcement && !isCommissioner) return null;

  return (
    <>
      {announcement ? (
        <Box
          component="section"
          aria-label={ANNOUNCEMENT.title}
          sx={{
            borderRadius: 2,
            p: 2,
            bgcolor: tokens.accentSurface,
            border: `1px solid ${tokens.accentBorder}`,
            display: "grid",
            gap: 0.75,
          }}
        >
          <Typography
            component="h2"
            sx={{ fontSize: 12, fontWeight: 700, color: tokens.accentSoft, letterSpacing: 0.4 }}
          >
            {ANNOUNCEMENT.title.toUpperCase()}
          </Typography>
          <Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
            {announcement.body}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {announcement.authorName ?? "A commissioner"} · {formatWhen(announcement.postedAt)}
          </Typography>
          {failure && <Alert severity="error">{failure}</Alert>}
          {isCommissioner && (
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 0.5 }}>
              <Button sx={{ minHeight: 44 }} onClick={() => setEditing(true)}>
                {ANNOUNCEMENT.edit}
              </Button>
              {confirmingRemove ? (
                <>
                  <Typography variant="caption" sx={{ alignSelf: "center" }}>
                    {ANNOUNCEMENT.removeConfirm}
                  </Typography>
                  <Button
                    color="error"
                    sx={{ minHeight: 44 }}
                    disabled={unpin.isPending}
                    onClick={() =>
                      unpin.mutate(undefined, { onSuccess: () => setConfirmingRemove(false) })
                    }
                  >
                    Yes, remove
                  </Button>
                  <Button sx={{ minHeight: 44 }} onClick={() => setConfirmingRemove(false)}>
                    Keep it
                  </Button>
                </>
              ) : (
                <Button
                  color="error"
                  sx={{ minHeight: 44 }}
                  onClick={() => setConfirmingRemove(true)}
                >
                  {ANNOUNCEMENT.remove}
                </Button>
              )}
            </Box>
          )}
        </Box>
      ) : (
        <Button
          variant="outlined"
          fullWidth
          sx={{ minHeight: 48 }}
          onClick={() => setEditing(true)}
        >
          {ANNOUNCEMENT.post}
        </Button>
      )}
      {editing && (
        <AnnouncementSheet
          leagueId={league.id}
          initial={announcement?.body ?? ""}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  );
};

export default AnnouncementCard;
