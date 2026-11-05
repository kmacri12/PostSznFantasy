import { Box, Button, Container, Link as MuiLink, Typography } from "@mui/material";
import { Link } from "react-router-dom";
import LoadingState from "../components/common/LoadingState";
import YourLeagues from "../components/home/YourLeagues";
import { useUser } from "../contexts/UserContext";
import { signInPath } from "../utils/authRedirect";
import { DormantNotice } from "./DormantPage";

const LandingFooter = () => (
  <Box
    component="footer"
    sx={{ display: "flex", gap: 3, justifyContent: "center", py: 1, mt: "auto" }}
  >
    <MuiLink
      component={Link}
      to="/privacy"
      color="text.secondary"
      underline="none"
      sx={{ py: 1.5 }}
    >
      Privacy
    </MuiLink>
    <MuiLink component={Link} to="/terms" color="text.secondary" underline="none" sx={{ py: 1.5 }}>
      Terms
    </MuiLink>
  </Box>
);

const Hero = () => (
  <Box sx={{ textAlign: { xs: "left", md: "center" }, maxWidth: 760, mx: "auto" }}>
    <Typography variant="h1" sx={{ fontSize: { xs: 38, md: 64 }, lineHeight: 1.05 }}>
      Fantasy football for the{" "}
      <Box component="span" sx={{ color: "primary.main" }}>
        playoffs
      </Box>{" "}
      only
    </Typography>
    <Typography
      color="text.secondary"
      sx={{ mt: 1.5, fontSize: { xs: 16, md: 19 }, lineHeight: 1.5 }}
    >
      Draft players from the 14 playoff teams, set a lineup each round, and watch them get knocked
      out. Four rounds, one champion.
    </Typography>
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
        gap: 1.5,
        justifyContent: "center",
        mt: 3,
        alignItems: "stretch",
      }}
    >
      <Button
        component={Link}
        to={signInPath("/")}
        variant="contained"
        size="large"
        sx={{ minHeight: 52, minWidth: { md: 166 } }}
      >
        Sign in
      </Button>
      <Button
        component={Link}
        to="/how-to-play"
        variant="outlined"
        size="large"
        sx={{ minHeight: 52, minWidth: { md: 166 } }}
      >
        How to play
      </Button>
    </Box>
  </Box>
);

/** The root route: the signed-out landing, the signed-in leagues page, or the dormant notice. */
const LandingPage = ({ dormant = false }: { dormant?: boolean }) => {
  const { user, loading } = useUser();

  if (dormant) {
    return (
      <Container maxWidth="md" sx={{ py: { xs: 4, md: 8 }, textAlign: "center" }}>
        <DormantNotice />
        <LandingFooter />
      </Container>
    );
  }
  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ py: 4 }}>
        <LoadingState what="page" rows={2} />
      </Container>
    );
  }
  if (user) return <YourLeagues />;

  return (
    <Container
      maxWidth="lg"
      sx={{
        display: "flex",
        flexDirection: "column",
        minHeight: "calc(100dvh - 64px)",
        py: { xs: 3, md: 0 },
      }}
    >
      <Box sx={{ my: "auto", py: { xs: 2, md: 6 } }}>
        <Hero />
      </Box>
      <LandingFooter />
    </Container>
  );
};

export default LandingPage;
