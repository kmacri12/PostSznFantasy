import { Alert, Box, Button, Typography } from "@mui/material";
import { useAssignTeamOwner } from "../../api/queries";
import type { MemberSummary } from "../../api/types";
import { mutationError } from "../common/friendlyError";
import PictureAvatar from "../common/PictureAvatar";
import SettingsSheet from "./SettingsSheet";

interface Props {
  seasonId: number;
  teamId: number;
  members: MemberSummary[];
  onClose: () => void;
}

/** Commissioner picker for a team's owner; the API moves a member off any team they held. */
const TeamOwnerSheet = ({ seasonId, teamId, members, onClose }: Props) => {
  const assign = useAssignTeamOwner(seasonId);
  const failure = mutationError(assign.error, "Couldn't change the owner. Try again.");
  const choose = (userId: number | null) =>
    assign.mutate({ teamId, userId }, { onSuccess: onClose });
  // Members without a team first: they are who this control is for.
  const ordered = [...members].sort(
    (a, b) => Number(a.teamId !== null) - Number(b.teamId !== null),
  );

  return (
    <SettingsSheet title="Team owner" onClose={onClose}>
      {failure && <Alert severity="error">{failure}</Alert>}
      <Box
        component="ul"
        sx={{ listStyle: "none", m: 0, p: 0, border: 1, borderColor: "divider", borderRadius: 2 }}
      >
        {ordered.map((member) => {
          const isOwner = member.teamId === teamId;
          const elsewhere = member.teamId !== null && !isOwner;
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
                  {member.teamName ?? "No team"}
                </Typography>
              </Box>
              {isOwner ? (
                <Typography variant="caption" color="text.secondary">
                  Owner
                </Typography>
              ) : (
                <Button
                  variant="outlined"
                  sx={{ minHeight: 44 }}
                  disabled={assign.isPending}
                  aria-label={`${elsewhere ? "Move" : "Assign"} ${member.username}`}
                  onClick={() => choose(member.userId)}
                >
                  {elsewhere ? "Move here" : "Assign"}
                </Button>
              )}
            </Box>
          );
        })}
      </Box>
      <Button
        variant="text"
        color="error"
        sx={{ minHeight: 44 }}
        disabled={assign.isPending}
        onClick={() => choose(null)}
      >
        Remove the owner
      </Button>
    </SettingsSheet>
  );
};

export default TeamOwnerSheet;
