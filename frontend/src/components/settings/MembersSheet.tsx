import {
  Alert,
  Box,
  Button,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Switch,
  Typography,
} from "@mui/material";
import { useState } from "react";
import { useRegenerateInvite, useRemoveMember, useSetMemberRole } from "../../api/queries";
import type { MemberSummary } from "../../api/types";
import { INVITE_RETIRED_NOTE, LAST_COMMISSIONER_NOTE } from "../../content/rules";
import Dialog from "../common/AppDialog";
import { mutationError } from "../common/friendlyError";
import PictureAvatar from "../common/PictureAvatar";
import { isLastCommissioner, removalWarning, toggledRole } from "./members";
import SettingsSheet from "./SettingsSheet";

interface Props {
  leagueId: number;
  members: MemberSummary[];
  currentUserId: number | null;
  /** Members see who is in the league and who commissions it; only commissioners change it. */
  readOnly?: boolean;
  onClose: () => void;
}

/** Commissioner toggle and removal per member; the only commissioner's toggle stays locked on. */
const MembersSheet = ({ leagueId, members, currentUserId, readOnly = false, onClose }: Props) => {
  const setRole = useSetMemberRole(leagueId);
  const remove = useRemoveMember(leagueId);
  const regenerate = useRegenerateInvite(leagueId);
  const [inviteRetired, setInviteRetired] = useState(false);
  const [removing, setRemoving] = useState<MemberSummary | null>(null);
  const failure =
    mutationError(setRole.error, "Couldn't change that role. Try again.") ??
    mutationError(remove.error, "Couldn't remove that member. Try again.");

  return (
    <SettingsSheet title={readOnly ? "Members" : "Edit members"} onClose={onClose}>
      {failure && <Alert severity="error">{failure}</Alert>}
      {inviteRetired && (
        <Alert
          severity="warning"
          action={
            <Button
              color="inherit"
              size="small"
              sx={{ minHeight: 44 }}
              disabled={regenerate.isPending}
              onClick={() =>
                regenerate.mutate(undefined, { onSuccess: () => setInviteRetired(false) })
              }
            >
              Regenerate
            </Button>
          }
        >
          {INVITE_RETIRED_NOTE}
        </Alert>
      )}
      <Box
        component="ul"
        sx={{ listStyle: "none", m: 0, p: 0, border: 1, borderColor: "divider", borderRadius: 2 }}
      >
        {members.map((member) => {
          const isYou = member.userId === currentUserId;
          const locked = isLastCommissioner(members, member.userId);
          const team = member.teamName ?? "No team";
          return (
            <Box
              component="li"
              key={member.userId}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                p: 1.5,
                minHeight: 64,
                "& + &": { borderTop: 1, borderColor: "divider" },
              }}
            >
              <PictureAvatar url={member.avatarUrl} name={member.username} size={36} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography noWrap sx={{ fontWeight: 600 }}>
                  {member.username}
                </Typography>
                <Typography noWrap variant="caption" color="text.secondary">
                  {isYou ? `You · ${team}` : team}
                </Typography>
              </Box>
              {readOnly ? (
                member.role === "commissioner" && (
                  <Typography variant="caption" color="text.secondary">
                    Commissioner
                  </Typography>
                )
              ) : (
                <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                  <Box component="label" sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">
                      Commissioner
                    </Typography>
                    <Switch
                      size="small"
                      checked={member.role === "commissioner"}
                      disabled={locked || setRole.isPending}
                      onChange={() =>
                        setRole.mutate({ userId: member.userId, role: toggledRole(member) })
                      }
                      slotProps={{
                        input: { "aria-label": `Commissioner: ${member.username}` },
                      }}
                    />
                  </Box>
                  {!isYou && (
                    <Button
                      size="small"
                      color="error"
                      sx={{ minHeight: 32 }}
                      onClick={() => setRemoving(member)}
                    >
                      Remove from league
                    </Button>
                  )}
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
      {!readOnly && (
        <Typography variant="caption" color="text.secondary">
          {LAST_COMMISSIONER_NOTE}
        </Typography>
      )}

      {removing && (
        <Dialog open onClose={() => setRemoving(null)} aria-labelledby="remove-member-title">
          <DialogTitle id="remove-member-title">Remove {removing.username}?</DialogTitle>
          <DialogContent>
            <DialogContentText>{removalWarning(removing.username)}</DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button sx={{ minHeight: 44 }} onClick={() => setRemoving(null)}>
              Cancel
            </Button>
            <Button
              color="error"
              variant="contained"
              sx={{ minHeight: 44 }}
              disabled={remove.isPending}
              onClick={() =>
                remove.mutate(removing.userId, {
                  onSuccess: () => setInviteRetired(true),
                  onSettled: () => setRemoving(null),
                })
              }
            >
              Remove from league
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </SettingsSheet>
  );
};

export default MembersSheet;
