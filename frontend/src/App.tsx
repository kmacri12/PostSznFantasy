import { Box, Container } from "@mui/material";
import { lazy, Suspense, useEffect, useRef } from "react";
import { matchPath, Route, Routes, useLocation } from "react-router-dom";
import { useApiHealth } from "./api/health";
import { useUserLeagues } from "./api/queries";
import RequireSignIn from "./components/auth/RequireSignIn";
import SessionExpiredBanner from "./components/auth/SessionExpiredBanner";
import LoadingState from "./components/common/LoadingState";
import AppShell from "./components/layout/AppShell";
import NotificationOptIn from "./components/notifications/NotificationOptIn";
import { useUser } from "./contexts/UserContext";
import DormantPage from "./pages/DormantPage";
import HowToPlayPage from "./pages/HowToPlayPage";
import LandingPage from "./pages/LandingPage";

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
  const { pathname } = useLocation();
  const routeLeagueId = matchPath("/leagues/:leagueId/*", pathname)?.params.leagueId;
  const league = leagues.find((item) => String(item.id) === routeLeagueId);

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
      {!dormant && <NotificationOptIn />}
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
                  <Route path="feed" element={<FeedPage />} />
                  <Route path="more" element={<MorePage />} />
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
