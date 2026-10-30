import { Box, Container, useMediaQuery, useTheme } from "@mui/material";
import { lazy, Suspense, useEffect, useState } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { useUserLeagues } from "./api/queries";
import LoadingState from "./components/common/LoadingState";
import BottomTabBar, { TAB_BAR_HEIGHT } from "./components/layout/BottomTabBar";
import NavBar from "./components/layout/NavBar";
import { useUser } from "./contexts/UserContext";

const CreateLeaguePage = lazy(() => import("./pages/CreateLeaguePage"));
const DraftPage = lazy(() => import("./pages/DraftPage"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const JoinPage = lazy(() => import("./pages/JoinPage"));
const LeaguePage = lazy(() => import("./pages/LeaguePage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const PlayersPage = lazy(() => import("./pages/PlayersPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const TeamPage = lazy(() => import("./pages/TeamPage"));

function App() {
  const { user, userId, signIn, signOutUser } = useUser();
  const { data: leagues = [] } = useUserLeagues(userId !== null);
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
  const showTabBar = isMobile && inLeagueArea && userId !== null && tabLeague !== undefined;

  return (
    <>
      <NavBar
        user={user}
        leagues={leagues}
        selectedLeagueId={selectedLeague}
        onSelectLeague={setSelectedLeague}
        onSignIn={signIn}
        onSignOut={signOutUser}
      />
      <Suspense
        fallback={
          <Container maxWidth="md" sx={{ py: 4 }}>
            <LoadingState what="page" />
          </Container>
        }
      >
        <Routes>
          <Route path="/" element={<LandingPage leagues={leagues} />} />
          <Route path="/league/:leagueId" element={<LeaguePage />} />
          <Route path="/join/:code" element={<JoinPage />} />
          <Route path="/team/:teamId" element={<TeamPage />} />
          <Route path="/players" element={<PlayersPage />} />
          <Route path="/league/:leagueId/draft" element={<DraftPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route
            path="/create-league"
            element={<CreateLeaguePage onLeagueCreated={handleLeagueCreated} />}
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
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
