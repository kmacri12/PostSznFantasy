import { useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { useUserLeagues } from "./api/queries";
import NavBar from "./components/layout/NavBar";
import { useUser } from "./contexts/UserContext";
import CreateLeaguePage from "./pages/CreateLeaguePage";
import DraftPage from "./pages/DraftPage";
import LandingPage from "./pages/LandingPage";
import LeaguePage from "./pages/LeaguePage";
import NotFoundPage from "./pages/NotFoundPage";
import PlayersPage from "./pages/PlayersPage";
import SettingsPage from "./pages/SettingsPage";
import TeamPage from "./pages/TeamPage";

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
    </>
  );
}

export default App;
