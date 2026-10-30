import {
  Alert,
  Box,
  Button,
  Chip,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useAssignTeamOwner, useRemoveMember, useSetMemberRole } from "../../api/queries";
import type { LeagueOverview } from "../../api/types";
import { mutationError } from "../common/friendlyError";

const NO_TEAM = "none";

/** Roles, team assignment and removal. Commissioners can edit; members see the roster. */
const MembersSection = ({ league }: { league: LeagueOverview }) => {
  const canEdit = league.myRole === "commissioner";
  const setRole = useSetMemberRole(league.id);
  const remove = useRemoveMember(league.id);
  const assign = useAssignTeamOwner(league.id);
  const failure =
    mutationError(setRole.error, "Couldn't change that role. Try again.") ??
    mutationError(remove.error, "Couldn't remove that member. Try again.") ??
    mutationError(assign.error, "Couldn't assign that team. Try again.");

  const teamOf = (userId: number) => league.teams.find((team) => team.ownerUserId === userId);

  const changeTeam = (userId: number, value: string) => {
    if (value === NO_TEAM) {
      const current = teamOf(userId);
      if (current) assign.mutate({ teamId: current.id, userId: null });
    } else {
      assign.mutate({ teamId: Number(value), userId });
    }
  };

  return (
    <Box>
      <Typography variant="h6" sx={{ mb: 1 }}>
        Members
      </Typography>
      {failure && (
        <Alert severity="error" sx={{ mb: 1 }}>
          {failure}
        </Alert>
      )}
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Member</TableCell>
              <TableCell>Team</TableCell>
              <TableCell>Role</TableCell>
              {canEdit && <TableCell align="right">Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {league.members.map((member) => {
              const team = teamOf(member.userId);
              const nextRole = member.role === "commissioner" ? "member" : "commissioner";
              return (
                <TableRow key={member.userId}>
                  <TableCell>{member.username}</TableCell>
                  <TableCell>
                    {canEdit ? (
                      <Select
                        size="small"
                        value={team ? String(team.id) : NO_TEAM}
                        onChange={(event) => changeTeam(member.userId, event.target.value)}
                        inputProps={{ "aria-label": `Team for ${member.username}` }}
                        sx={{ minWidth: 160 }}
                      >
                        <MenuItem value={NO_TEAM}>No team</MenuItem>
                        {league.teams
                          .filter((t) => t.ownerUserId === null || t.ownerUserId === member.userId)
                          .map((t) => (
                            <MenuItem key={t.id} value={String(t.id)}>
                              {t.name}
                            </MenuItem>
                          ))}
                      </Select>
                    ) : (
                      (team?.name ?? "No team")
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={member.role === "commissioner" ? "primary" : "default"}
                      label={member.role === "commissioner" ? "Commissioner" : "Member"}
                    />
                  </TableCell>
                  {canEdit && (
                    <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                      <Button
                        size="small"
                        disabled={setRole.isPending}
                        onClick={() => setRole.mutate({ userId: member.userId, role: nextRole })}
                      >
                        {member.role === "commissioner" ? "Demote" : "Make commissioner"}
                      </Button>
                      <Button
                        size="small"
                        color="error"
                        disabled={remove.isPending}
                        onClick={() => {
                          if (window.confirm(`Remove ${member.username} from the league?`)) {
                            remove.mutate(member.userId);
                          }
                        }}
                      >
                        Remove
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
      {league.teams.some((team) => team.ownerUserId === null) && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Unclaimed teams:{" "}
          {league.teams
            .filter((t) => t.ownerUserId === null)
            .map((t) => t.name)
            .join(", ")}
        </Typography>
      )}
    </Box>
  );
};

export default MembersSection;
