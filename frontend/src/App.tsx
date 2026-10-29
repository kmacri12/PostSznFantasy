import axios from "axios";
import { useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import NavBar, { type LeagueByUser } from "./components/layout/NavBar";
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
  const apiUrl = import.meta.env.VITE_API_URL;
  const { user, userId, getIdToken, signIn, signOutUser } = useUser();
  const [leagues, setLeagues] = useState<LeagueByUser[]>([]);
  const [selectedLeague, setSelectedLeague] = useState<string>("");

  useEffect(() => {
    if (!userId) {
      setLeagues([]);
      setSelectedLeague("");
      return;
    }

    const fetchLeagues = async () => {
      try {
        const token = await getIdToken();
        const response = await axios.get<LeagueByUser[]>(`${apiUrl}/api/leagues/user-leagues`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setLeagues(response.data);
        setSelectedLeague((current) => current || String(response.data[0]?.id ?? ""));
      } catch (error) {
        console.error("Error fetching leagues:", error);
      }
    };

    fetchLeagues();
  }, [userId, apiUrl, getIdToken]);

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
        <Route path="/create-league" element={<CreateLeaguePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}

export default App;
