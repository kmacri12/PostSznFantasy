import { Box, Container } from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { matchPath, Route, Routes, useLocation } from "react-router-dom";
import { isDormant, useApiHealth } from "./api/health";
import { useUserLeagues } from "./api/queries";
import RequireSignIn from "./components/auth/RequireSignIn";
import SessionExpiredBanner from "./components/auth/SessionExpiredBanner";
import LoadingState from "./components/common/LoadingState";
import ReconnectingBanner from "./components/connection/ReconnectingBanner";
import AppShell from "./components/layout/AppShell";
import NotificationOptIn from "./components/notifications/NotificationOptIn";
import NameSetupDialog from "./components/onboarding/NameSetupDialog";
import TeamNameDialog from "./components/onboarding/TeamNameDialog";
import FirstRunTour from "./components/tour/FirstRunTour";
import { useUser } from "./contexts/UserContext";
import DormantPage from "./pages/DormantPage";
import HowToPlayPage from "./pages/HowToPlayPage";
import LandingPage from "./pages/LandingPage";
import { teamNamePrompted } from "./utils/displayName";
import { pageTitle } from "./utils/pageTitle";
import { isTourTrigger, tourSeen } from "./utils/tourSeen";

const BracketPage = lazy(() => import("./pages/BracketPage"));
const CreateLeaguePage = lazy(() => import("./pages/CreateLeaguePage"));
const DraftBoardPage = lazy(() => import("./pages/DraftBoardPage"));
const DraftPage = lazy(() => import("./pages/DraftPage"));
const FeedPage = lazy(() => import("./pages/FeedPage"));
const JoinPage = lazy(() => import("./pages/JoinPage"));
const LeaguePage = lazy(() => import("./pages/LeaguePage"));
const MorePage = lazy(() => import("./pages/MorePage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const SignInPage = lazy(() => import("./pages/SignInPage"));
const SeasonLayout = lazy(() => import("./pages/SeasonLayout"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const TeamPage = lazy(() => import("./pages/TeamPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));

function App() {
  const { user, userId, needsNameSetup, syncError, retrySync, signIn, signOutUser } = useUser();
  const dormant = isDormant();
  const apiDown = useApiHealth() === "down";
  const queryClient = useQueryClient();
  const wasDown = useRef(false);
  // An outage keeps the page and its cached data; once the API answers again, refetch what
  // failed and repeat a sign-in sync that ran against the dead API.
  useEffect(() => {
    if (wasDown.current && !apiDown) {
      void queryClient.invalidateQueries();
      if (syncError) retrySync();
    }
    wasDown.current = apiDown;
  }, [apiDown, queryClient, syncError, retrySync]);
  const { data: leagues = [] } = useUserLeagues(userId !== null && !dormant);
  const { pathname, state } = useLocation();
  const [tourOpen, setTourOpen] = useState(false);
  const [teamNameOpen, setTeamNameOpen] = useState(false);
  const routeLeagueId = matchPath("/leagues/:leagueId/*", pathname)?.params.leagueId;
  const league = leagues.find((item) => String(item.id) === routeLeagueId);
  const teamId = league?.userTeamId ?? null;
  // Prompts go one at a time: name, then team name, then the tour, then notifications. Each
  // flag is true from the render that sees its trigger until its dialog is closed.
  const teamNameHolds =
    teamNameOpen ||
    (!needsNameSetup && teamId !== null && isTourTrigger(state) && !teamNamePrompted(teamId));
  const tourBlocked = needsNameSetup || teamNameHolds;
  const tourHolds = tourOpen || (userId !== null && isTourTrigger(state) && !tourSeen(userId));
  const leagueName = league?.name;
  useEffect(() => {
    document.title = pageTitle(pathname, leagueName);
  }, [pathname, leagueName]);

  return (
    <AppShell
      user={user}
      leagues={leagues}
      league={league}
      onSignIn={signIn}
      onSignOut={signOutUser}
      dormant={dormant}
    >
      <SessionExpiredBanner />
      {apiDown && !dormant && <ReconnectingBanner />}
      {!dormant && user && <NameSetupDialog />}
      {!dormant && (
        <TeamNameDialog
          teamId={teamId}
          pending={!needsNameSetup && teamNameHolds && !teamNameOpen}
          onOpenChange={setTeamNameOpen}
        />
      )}
      {!dormant && (
        <FirstRunTour open={tourOpen} onOpenChange={setTourOpen} blocked={tourBlocked} />
      )}
      {!dormant && <NotificationOptIn hold={tourBlocked || tourHolds} />}
      <Box component="main" id="main" tabIndex={-1} sx={{ outline: "none" }}>
        <Suspense
          fallback={
            <Container maxWidth="md" sx={{ py: 4 }}>
              <LoadingState what="page" />
            </Container>
          }
        >
          {dormant ? (
            <Routes>
              <Route path="/" element={<LandingPage dormant />} />
              <Route path="/how-to-play" element={<HowToPlayPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="*" element={<DormantPage />} />
            </Routes>
          ) : (
            <Routes>
              <Route path="/" element={<LandingPage />} />
              {["/leagues/:leagueId", "/leagues/:leagueId/seasons/:year"].map((path) => (
                <Route key={path} path={path} element={<SeasonLayout />}>
                  <Route index element={<LeaguePage />} />
                  <Route path="draft" element={<DraftPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="draft/board" element={<DraftBoardPage />} />
                  <Route path="bracket" element={<BracketPage />} />
                  <Route path="feed" element={<FeedPage />} />
                  <Route path="more" element={<MorePage />} />
                  <Route path="how-to-play" element={<HowToPlayPage />} />
                  <Route path="teams/:teamId" element={<TeamPage />} />
                </Route>
              ))}
              <Route path="/sign-in" element={<SignInPage />} />
              <Route path="/how-to-play" element={<HowToPlayPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/join/:code" element={<JoinPage />} />
              <Route
                path="/create-league"
                element={
                  <RequireSignIn>
                    <CreateLeaguePage />
                  </RequireSignIn>
                }
              />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          )}
        </Suspense>
      </Box>
    </AppShell>
  );
}

export default App;
