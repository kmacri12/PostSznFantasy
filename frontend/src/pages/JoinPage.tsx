import { Alert, Box, Button, Container, Typography } from "@mui/material";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { isLeagueFullError } from "../api/inviteErrors";
import { useInvitePreview, useJoinWithCode } from "../api/queries";
import ErrorState from "../components/common/ErrorState";
import { friendlyError } from "../components/common/friendlyError";
import LoadingState from "../components/common/LoadingState";
import InviteMembers from "../components/invite/InviteMembers";
import { commissionerName, inviteView } from "../components/invite/inviteView";
import TourDialog from "../components/tour/TourDialog";
import { TOUR_LABEL } from "../content/rules";
import { useUser } from "../contexts/UserContext";
import { leaguePath } from "../routes";
import { signInPath } from "../utils/authRedirect";
import { JOINED_LEAGUE_STATE } from "../utils/notificationPrompt";

const FULL_HELP =
  "Every team has an owner. Ask your commissioner to raise the team count limit in the league settings, then try again.";

/** Shareable /join/:code link: preview the league, sign in if needed, then press Join. */
const JoinPage = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user, userId, loading, syncError } = useUser();
  const preview = useInvitePreview(code);
  const join = useJoinWithCode();
  const [filledMeanwhile, setFilledMeanwhile] = useState(false);
  const [touring, setTouring] = useState(false);

  if (preview.isLoading || loading) {
    return (
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <LoadingState what="invite" rows={2} />
      </Container>
    );
  }
  if (preview.isError || !preview.data) {
    return (
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <ErrorState
          message={friendlyError(preview.error, "Check the invite link and try again.")}
          onRetry={() => preview.refetch()}
        />
      </Container>
    );
  }

  const data = preview.data;
  const view = filledMeanwhile ? { kind: "full" as const } : inviteView(data, user !== null);
  const commissioner = commissionerName(data);
  const joinNow = () =>
    code &&
    join.mutate(code, {
      onSuccess: (result) => navigate(leaguePath(result.leagueId), { state: JOINED_LEAGUE_STATE }),
      onError: (error) => {
        if (isLeagueFullError(error)) {
          setFilledMeanwhile(true);
          void preview.refetch();
        }
      },
    });
  const failure =
    join.isError && !isLeagueFullError(join.error)
      ? friendlyError(join.error, "Couldn't join this league. Try again.")
      : null;

  return (
    <Container maxWidth="sm" sx={{ py: { xs: 3, sm: 6 }, display: "grid", gap: 2 }}>
      <Box>
        <Typography variant="body2" sx={{ color: "primary.main", fontWeight: 600 }}>
          You're invited
        </Typography>
        <Typography variant="h4" component="h1" sx={{ mt: 0.5 }}>
          {data.leagueName}
        </Typography>
        <Typography color="text.secondary">
          {commissioner ? `${commissioner} is the commissioner · ` : ""}
          {data.season} playoffs
        </Typography>
      </Box>

      <InviteMembers preview={data} />

      {view.kind === "full" && (
        <Alert severity="warning">
          <Typography sx={{ fontWeight: 700 }}>This league is full</Typography>
          {FULL_HELP}
        </Alert>
      )}
      {view.kind === "unavailable" && <Alert severity="warning">{view.reason}</Alert>}
      {failure && <Alert severity="error">{failure}</Alert>}
      {syncError && <Alert severity="error">{syncError}</Alert>}

      {view.kind === "sign-in" && (
        <Button
          component={Link}
          to={signInPath(`/join/${code ?? ""}`)}
          variant="contained"
          size="large"
          sx={{ minHeight: 52 }}
        >
          Sign in to join
        </Button>
      )}
      {(view.kind === "join" || view.kind === "full") && (
        <>
          <Button
            variant="contained"
            size="large"
            sx={{ minHeight: 52 }}
            disabled={view.kind === "full" || join.isPending || userId === null}
            onClick={joinNow}
          >
            Join league
          </Button>
          {user?.email && (
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: "center" }}>
              Signed in as {user.email}
            </Typography>
          )}
        </>
      )}
      <Button variant="outlined" sx={{ minHeight: 48 }} onClick={() => setTouring(true)}>
        {TOUR_LABEL}
      </Button>
      {touring && <TourDialog onClose={() => setTouring(false)} />}
    </Container>
  );
};

export default JoinPage;
