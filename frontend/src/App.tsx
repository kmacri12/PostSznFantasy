import { Box, Container, useMediaQuery, useTheme } from "@mui/material";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { useApiHealth } from "./api/health";
import { useUserLeagues } from "./api/queries";
import RequireSignIn from "./components/auth/RequireSignIn";
import SessionExpiredBanner from "./components/auth/SessionExpiredBanner";
import LoadingState from "./components/common/LoadingState";
import BottomTabBar, { TAB_BAR_HEIGHT } from "./components/layout/BottomTabBar";
import NavBar from "./components/layout/NavBar";
import { useUser } from "./contexts/UserContext";

const CreateLeaguePage = lazy(() => import("./pages/CreateLeaguePage"));
const DraftPage = lazy(() => import("./pages/DraftPage"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const DormantPage = lazy(() => import("./pages/DormantPage"));
const HowToPlayPage = lazy(() => import("./pages/HowToPlayPage"));
const JoinPage = lazy(() => import("./pages/JoinPage"));
const LeaguePage = lazy(() => import("./pages/LeaguePage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const PlayersPage = lazy(() => import("./pages/PlayersPage"));
const WelcomePage = lazy(() => import("./pages/WelcomePage"));
const SignInPage = lazy(() => import("./pages/SignInPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const TeamPage = lazy(() => import("./pages/TeamPage"));
const TeamPointsPage = lazy(() => import("./pages/TeamPointsPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));

function App() {
  const { user, userId, signIn, signOutUser } = useUser();
  const dormant = useApiHealth() === "down";
  const wasDormant = useRef(false);
  // The sign-in sync in UserContext ran against the dead API and will not retry, so a
  // full reload is the simple way to restore a signed-in session after recovery.
  useEffect(() => {
    if (wasDormant.current && !dormant) window.location.reload();
    wasDormant.current = dormant;
  }, [dormant]);
  const { data: leagues = [] } = useUserLeagues(userId !== null && !dormant);
  const [selectedLeague, setSelectedLeague] = useState<string>("");
  const isMobile = useMediaQuery(useTheme().breakpoints.down("md"));
  const { pathname } = useLocation();

  useEffect(() => {
    if (userId === null) setSelectedLeague("");
    else setSelectedLeague((current) => current || String(leagues[0]?.id ?? ""));
  }, [userId, leagues]);

  const handleLeagueCreated = async (leagueId: number) => {
    setSelectedLeague(String(leagueId));
  };

  const inLeagueArea = /^\/(league|team|players|settings)/.test(pathname);
  const tabLeague = leagues.find((league) => String(league.id) === selectedLeague);
  const showTabBar =
    !dormant && isMobile && inLeagueArea && userId !== null && tabLeague !== undefined;

  return (
    <>
      <NavBar
        user={user}
        leagues={leagues}
        selectedLeagueId={selectedLeague}
        onSelectLeague={setSelectedLeague}
        onSignIn={signIn}
        onSignOut={signOutUser}
        dormant={dormant}
      />
      <SessionExpiredBanner />
      <Box component="main">
        <Suspense
          fallback={
            <Container maxWidth="md" sx={{ py: 4 }}>
              <LoadingState what="page" />
            </Container>
          }
        >
          {dormant ? (
            <Routes>
              <Route path="/" element={<LandingPage leagues={[]} dormant />} />
              <Route path="/how-to-play" element={<HowToPlayPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="*" element={<DormantPage />} />
            </Routes>
          ) : (
            <Routes>
              <Route path="/" element={<LandingPage leagues={leagues} />} />
              <Route path="/league/:leagueId" element={<LeaguePage />} />
              <Route path="/sign-in" element={<SignInPage />} />
              <Route path="/how-to-play" element={<HowToPlayPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/welcome" element={<WelcomePage />} />
              <Route path="/join/:code" element={<JoinPage />} />
              <Route path="/team/:teamId" element={<TeamPage />} />
              <Route path="/team/:teamId/points" element={<TeamPointsPage />} />
              <Route path="/players" element={<PlayersPage />} />
              <Route path="/league/:leagueId/draft" element={<DraftPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route
                path="/create-league"
                element={
                  <RequireSignIn>
                    <CreateLeaguePage onLeagueCreated={handleLeagueCreated} />
                  </RequireSignIn>
                }
              />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          )}
        </Suspense>
      </Box>
      {showTabBar && tabLeague && (
        <>
          <Box sx={{ height: TAB_BAR_HEIGHT }} />
          <BottomTabBar league={tabLeague} />
        </>
      )}
    </>
  );
}

export default App;
