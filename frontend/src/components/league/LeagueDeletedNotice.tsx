import { Button } from "@mui/material";
import { Link } from "react-router-dom";
import type { LeagueDeleted } from "../../api/leagueDeleted";
import EmptyState from "../common/EmptyState";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

/** Shown to members and former members who open a deleted league; strangers get a plain not-found. */
const LeagueDeletedNotice = ({ leagueName, deletedAt }: LeagueDeleted) => (
  <EmptyState
    title="This league was deleted by a commissioner"
    description={`${leagueName} was deleted on ${formatDate(deletedAt)}.`}
    action={
      <Button component={Link} to="/" variant="outlined" sx={{ minHeight: 44 }}>
        Go to your leagues
      </Button>
    }
  />
);

export default LeagueDeletedNotice;
