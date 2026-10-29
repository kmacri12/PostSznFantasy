import { Box, CircularProgress } from "@mui/material";
import { Suspense, lazy, useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { useUserLeagues } from "./api/queries";
import NavBar from "./components/layout/NavBar";
import { useUser } from "./contexts/UserContext";

const CreateLeaguePage = lazy(() => import("./pages/CreateLeaguePage"));
const DraftPage = lazy(() => import("./pages/DraftPage"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const LeaguePage = lazy(() => import("./pages/LeaguePage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const PlayersPage = lazy(() => import("./pages/PlayersPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const TeamPage = lazy(() => import("./pages/TeamPage"));

function App() {
  const { user, userId, signIn, signOutUser } = useUser();
  const { data: leagues = [] } = useUserLeagues(userId !== null);
  const [selectedLeague, setSelectedLeague] = useState<string>("");

  useEffect(() => {
    if (userId === null) setSelectedLeague("");
    else setSelectedLeague((current) => current || String(leagues[0]?.id ?? ""));
  }, [userId, leagues]);

  const handleLeagueCreated = async (leagueId: number) => {
    setSelectedLeague(String(leagueId));
  };

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
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
            <CircularProgress />
          </Box>
        }
      >
        <Routes>
          <Route path="/" element={<LandingPage leagues={leagues} />} />
          <Route path="/league/:leagueId" element={<LeaguePage />} />
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
    </>
  );
}

export default App;
