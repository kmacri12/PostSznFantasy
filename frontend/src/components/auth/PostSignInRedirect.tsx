import { Container } from "@mui/material";
import { Navigate } from "react-router-dom";
import { useUserLeagues } from "../../api/queries";
import { useUser } from "../../contexts/UserContext";
import ErrorState from "../common/ErrorState";
import { friendlyError } from "../common/friendlyError";
import LoadingState from "../common/LoadingState";

/**
 * Where a freshly signed-in visitor lands. An explicit destination (invite link, the page
 * they were on) always wins; otherwise a user with no leagues is sent to onboarding.
 */
const PostSignInRedirect = ({ next }: { next: string }) => {
  const { userId, syncError } = useUser();
  const leagues = useUserLeagues(next === "/" && userId !== null);

  if (next !== "/") return <Navigate to={next} replace />;
  if (syncError) {
    return (
      <Container maxWidth="xs" sx={{ py: 6 }}>
        <ErrorState message={syncError} />
      </Container>
    );
  }
  if (leagues.isError) {
    return (
      <Container maxWidth="xs" sx={{ py: 6 }}>
        <ErrorState
          message={friendlyError(leagues.error, "Couldn't load your leagues.")}
          onRetry={() => leagues.refetch()}
        />
      </Container>
    );
  }
  if (!leagues.data) {
    return (
      <Container maxWidth="xs" sx={{ py: 6 }}>
        <LoadingState what="your account" rows={2} />
      </Container>
    );
  }
  return <Navigate to={leagues.data.length === 0 ? "/welcome" : "/"} replace />;
};

export default PostSignInRedirect;
