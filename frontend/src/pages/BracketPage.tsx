import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Box, Container, IconButton, Typography } from "@mui/material";
import { isAxiosError } from "axios";
import { useNavigate } from "react-router-dom";
import { useBracket } from "../api/queries";
import BracketView from "../components/bracket/BracketView";
import EmptyState from "../components/common/EmptyState";
import QueryBoundary from "../components/common/QueryBoundary";
import { useSeasonContext } from "../contexts/SeasonContext";

/** The NFL playoff bracket with the viewer's players in each game; open before the draft. */
const BracketPage = () => {
  const { seasonId, paths } = useSeasonContext();
  const navigate = useNavigate();
  // The data router counts entries in `history.state.idx`; 0 means opened from a link or a push.
  const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate(paths.home));
  const bracket = useBracket(seasonId);
  // The owner's kill switch answers 404; that is a notice, not an error to retry.
  const off = isAxiosError(bracket.error) && bracket.error.response?.status === 404;
  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, md: 3 } }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 2, ml: -1 }}>
        <IconButton aria-label="Back" onClick={goBack} sx={{ width: 44, height: 44 }}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h1" sx={{ fontSize: { xs: 20, md: 26 }, fontWeight: 700 }}>
          NFL bracket
        </Typography>
      </Box>
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
