import {
  Button,
  Chip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { Link } from "react-router-dom";
import { useRemoveMember, useSetMemberRole } from "../../api/queries";
import type { LeagueOverview } from "../../api/types";

const errorDetail = (error: unknown): string | null =>
  (error as { response?: { data?: { detail?: string } } } | null)?.response?.data?.detail ?? null;

const MembersPanel = ({ league }: { league: LeagueOverview }) => {
  const setRole = useSetMemberRole(league.id);
  const remove = useRemoveMember(league.id);
  const isCommissioner = league.myRole === "commissioner";
  const failure = errorDetail(setRole.error) ?? errorDetail(remove.error);

  return (
    <>
      <TableContainer component={Paper}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Member</TableCell>
              <TableCell>Team</TableCell>
              <TableCell>Role</TableCell>
              {isCommissioner && <TableCell align="right">Manage</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {league.members.map((member) => {
              const nextRole = member.role === "commissioner" ? "member" : "commissioner";
              return (
                <TableRow key={member.userId}>
                  <TableCell>{member.username}</TableCell>
                  <TableCell>
                    {member.teamId ? (
                      <Link to={`/team/${member.teamId}`}>{member.teamName}</Link>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      color={member.role === "commissioner" ? "primary" : "default"}
                      label={member.role === "commissioner" ? "Commissioner" : "Member"}
                    />
                  </TableCell>
                  {isCommissioner && (
                    <TableCell align="right">
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
      {failure && (
        <Typography color="error" variant="body2" sx={{ mt: 1 }}>
          {failure}
        </Typography>
      )}
    </>
  );
};

export default MembersPanel;
