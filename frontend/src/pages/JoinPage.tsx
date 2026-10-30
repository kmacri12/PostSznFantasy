import { Alert, Button, Card, CircularProgress, Container, Typography } from "@mui/material";
import { useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useInvitePreview, useJoinWithCode } from "../api/queries";
import ErrorState from "../components/common/ErrorState";
import { friendlyError } from "../components/common/friendlyError";
import LoadingState from "../components/common/LoadingState";
import { useUser } from "../contexts/UserContext";

/** Shareable /join/:code link. Signed-out visitors log in, come back here and auto-join. */
const JoinPage = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user, userId, loading, signIn, syncError } = useUser();
  const preview = useInvitePreview(code);
  const join = useJoinWithCode();
  const attempted = useRef(false);

  const joinable = preview.data?.joinable === true;
  // biome-ignore lint/correctness/useExhaustiveDependencies: join.mutate is stable and the ref guards repeats
  useEffect(() => {
    if (!code || userId === null || !joinable || attempted.current) return;
    attempted.current = true;
    join.mutate(code, { onSuccess: (result) => navigate(`/league/${result.leagueId}`) });
  }, [code, userId, joinable]);

  if (preview.isLoading || loading) {
    return (
      <Container maxWidth="sm" sx={{ py: 6 }}>
        <LoadingState what="invite" rows={2} />
      </Container>
    );
  }
  if (preview.isError || !preview.data) {
    return (
      <Container maxWidth="sm" sx={{ py: 6 }}>
        <ErrorState
          message={friendlyError(preview.error, "Check the invite link and try again.")}
          onRetry={() => preview.refetch()}
        />
      </Container>
    );
  }

  const { leagueName, season, openSpots, reason } = preview.data;
  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Card sx={{ p: 4, textAlign: "center" }}>
        <Typography variant="overline" color="text.secondary">
          You're invited to join
        </Typography>
        <Typography variant="h4" sx={{ my: 1 }}>
          {leagueName}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {season} postseason · {openSpots} open {openSpots === 1 ? "spot" : "spots"}
        </Typography>

        {reason && <Alert severity="warning">{reason}</Alert>}
        {!reason && !user && (
          <Button variant="contained" size="large" onClick={signIn}>
            Sign in to join
          </Button>
        )}
        {!reason && user && join.isPending && <CircularProgress size={28} />}
        {join.isError && (
          <Alert severity="error">
            {friendlyError(join.error, "Couldn't join this league. Try again.")}
          </Alert>
        )}
        {syncError && <Alert severity="error">{syncError}</Alert>}
      </Card>
    </Container>
  );
};

export default JoinPage;
