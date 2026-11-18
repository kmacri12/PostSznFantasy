import { Container } from "@mui/material";
import { isAxiosError } from "axios";
import { useBracket } from "../api/queries";
import BracketView from "../components/bracket/BracketView";
import EmptyState from "../components/common/EmptyState";
import QueryBoundary from "../components/common/QueryBoundary";
import BackHeader from "../components/layout/BackHeader";
import { useSeasonContext } from "../contexts/SeasonContext";

/** The NFL playoff bracket with the viewer's players in each game; open before the draft. */
const BracketPage = () => {
  const { seasonId, paths } = useSeasonContext();
  const bracket = useBracket(seasonId);
  // The owner's kill switch answers 404; that is a notice, not an error to retry.
  const off = isAxiosError(bracket.error) && bracket.error.response?.status === 404;
  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, md: 3 } }}>
      <BackHeader title="NFL bracket" fallback={paths.home} />
      {off ? (
        <EmptyState
          title="The bracket is off for now"
          description="It will be back. Your lineups and standings are not affected."
        />
      ) : (
        <QueryBoundary query={bracket} what="the bracket">
          {(data) => <BracketView bracket={data} />}
        </QueryBoundary>
      )}
    </Container>
  );
};

export default BracketPage;
