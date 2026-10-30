import { Box, Button, Card, Container, Divider, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import JoinCodeBox from "../components/league/JoinCodeBox";

/** First-login landing: every new account either starts a league or joins a friend's. */
const WelcomePage = () => (
  <Container maxWidth="xs" sx={{ py: { xs: 3, sm: 8 } }}>
    <Card sx={{ p: { xs: 2.5, sm: 4 }, display: "grid", gap: 2.5 }}>
      <Box>
        <Typography variant="h5" component="h1">
          Welcome to PostSzn
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 0.5 }}>
          Start a league for your group, or join one with a code from your commissioner.
        </Typography>
      </Box>
      <Button
        component={Link}
        to="/create-league"
        variant="contained"
        size="large"
        sx={{ minHeight: 48 }}
      >
        Create a league
      </Button>
      <Divider>or</Divider>
      <Box
        sx={{
          display: "grid",
          gap: 1,
          "& form": { flexDirection: "column" },
          "& button": { minHeight: 48 },
        }}
      >
        <Typography variant="subtitle2">Have a join code?</Typography>
        <JoinCodeBox />
      </Box>
    </Card>
  </Container>
);

export default WelcomePage;
