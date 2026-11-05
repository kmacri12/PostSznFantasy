import { Container, Typography } from "@mui/material";
import { useDraft } from "../api/queries";
import LoadingState from "../components/common/LoadingState";
import DraftBoard from "../components/draft/DraftBoard";
import { useSeasonContext } from "../contexts/SeasonContext";

const BOARD_REFRESH_MS = 10_000;

/** The draft board on its own, reachable from More before, during and after the draft. */
const DraftBoardPage = () => {
  const { seasonId, season } = useSeasonContext();
  const draft = useDraft(seasonId, BOARD_REFRESH_MS);
  return (
    <Container maxWidth="lg" sx={{ py: 2 }}>
      <Typography variant="h6" component="h1" sx={{ mb: 1.5 }}>
        Draft board
      </Typography>
      {draft.data ? (
        <DraftBoard state={draft.data} myTeamId={season.myTeamId} />
      ) : (
        <LoadingState what="the draft board" />
      )}
    </Container>
  );
};

export default DraftBoardPage;
