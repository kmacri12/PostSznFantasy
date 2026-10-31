import { Button, Container, Stack, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import { HOW_TO_PLAY_LABEL } from "../content/rules";

export const DORMANT_HEADLINE = "We're back for the next postseason";

export const DormantNotice = () => (
  <>
    <Typography variant="h4" component="h1">
      {DORMANT_HEADLINE}
    </Typography>
    <Typography color="text.secondary" sx={{ mt: 2 }}>
      PostSzn Fantasy is offline right now, either between seasons or for a short outage. Leagues
      and drafts return when the playoffs do.
    </Typography>
  </>
);

const DormantPage = () => (
  <Container maxWidth="sm" sx={{ py: { xs: 6, md: 10 }, textAlign: "center" }}>
    <DormantNotice />
    <Stack spacing={1.5} sx={{ mt: 4, alignItems: "center" }}>
      <Button variant="contained" size="large" component={Link} to="/">
        See how it works
      </Button>
      <Button component={Link} to="/how-to-play" color="inherit">
        {HOW_TO_PLAY_LABEL}
      </Button>
    </Stack>
  </Container>
);

export default DormantPage;
