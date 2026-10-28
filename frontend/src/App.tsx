import MenuIcon from "@mui/icons-material/Menu";
import {
  AppBar,
  Button,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  type SelectChangeEvent,
  Toolbar,
  Typography,
} from "@mui/material";
import axios from "axios";
import { useEffect, useState } from "react";
import { Link, Route, Routes, useNavigate } from "react-router-dom";
import { DevQuickSync } from "./components/dev/DevQuickSync";
import { useUser } from "./contexts/UserContext";
import CreateLeaguePage from "./pages/CreateLeaguePage";
import DraftPage from "./pages/DraftPage";
import LeaguePage from "./pages/LeaguePage";
import PlayersPage from "./pages/PlayersPage";
import SettingsPage from "./pages/SettingsPage";
import TeamPage from "./pages/TeamPage";

interface LeagueByUser {
  id: number;
  name: string;
  commissionerId: number;
  userTeamId: number;
}

function App() {
  const apiUrl = import.meta.env.VITE_API_URL;
  const { user, userId, getIdToken, signIn, signOutUser } = useUser();
  const [leagues, setLeagues] = useState<LeagueByUser[]>([]);
  const [teamNumberForLeague, setTeamNumberForLeague] = useState<number | null>(null);
  const [selectedLeague, setSelectedLeague] = useState<string>("");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchLeagues = async () => {
      try {
        const token = await getIdToken();
        const response = await axios.get(`${apiUrl}/api/leagues/user-leagues`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const fetchedLeagues: LeagueByUser[] = response.data;
        setLeagues(fetchedLeagues);

        if (fetchedLeagues && fetchedLeagues.length > 0) {
          setSelectedLeague(fetchedLeagues[0].id.toString());
          setTeamNumberForLeague(fetchedLeagues[0].userTeamId);
          navigate(`/league/${fetchedLeagues[0].id}`);
        }
      } catch (error) {
        console.error("Error fetching leagues:", error);
      }
    };

    if (userId) {
      fetchLeagues();
    } else {
      setLeagues([]);
      setSelectedLeague("");
      setTeamNumberForLeague(null);
    }
  }, [userId, apiUrl, getIdToken, navigate]);

  const handleLeagueChange = (event: SelectChangeEvent<string>) => {
    const leagueId = event.target.value;
    setSelectedLeague(leagueId);
    const userTeamId = leagues.find((league) => league.id === Number(leagueId))?.userTeamId;
    setTeamNumberForLeague(userTeamId ?? null);
  };

  return (
    <div>
      <AppBar position="static">
        <Toolbar>
          <IconButton edge="start" color="inherit" aria-label="menu">
            <MenuIcon />
          </IconButton>
          <Typography
            variant="h6"
            component={Link}
            to="/"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            PostSznFantasy
          </Typography>

          <DevQuickSync />

          {user && selectedLeague && (
            <>
              <Button
                component={Link}
                to={`/league/${selectedLeague}`}
                style={{ textTransform: "none", color: "inherit" }}
              >
                League
              </Button>
              <Button
                component={Link}
                to={`/team/${teamNumberForLeague}`}
                style={{ textTransform: "none", color: "inherit" }}
              >
                Team
              </Button>
              <Button
                component={Link}
                to={"/players"}
                style={{ textTransform: "none", color: "inherit" }}
              >
                Players
              </Button>
              <Button
                component={Link}
                to={`/league/${selectedLeague}/draft`}
                style={{ textTransform: "none", color: "inherit" }}
              >
                Draft
              </Button>
              <Button
                component={Link}
                to={`/settings?leagueId=${selectedLeague}`}
                style={{ textTransform: "none", color: "inherit" }}
              >
                Settings
              </Button>

              <FormControl variant="outlined" style={{ minWidth: 140, marginLeft: "20px" }}>
                <InputLabel id="league-select-label">Select League</InputLabel>
                <Select
                  labelId="league-select-label"
                  value={selectedLeague}
                  onChange={handleLeagueChange}
                  label="Select League"
                  style={{ color: "inherit" }}
                >
                  {leagues.map((league) => (
                    <MenuItem key={league.id} value={league.id.toString()}>
                      {league.name}
                    </MenuItem>
                  ))}
                  <MenuItem
                    onClick={(event) => {
                      event.stopPropagation();
                      navigate("/create-league");
                    }}
                  >
                    Create New League
                  </MenuItem>
                </Select>
              </FormControl>
            </>
          )}

          {!user ? (
            <Button
              onClick={signIn}
              style={{
                textTransform: "none",
                color: "inherit",
                marginLeft: "auto",
              }}
            >
              Sign in with Google
            </Button>
          ) : (
            <Button
              onClick={signOutUser}
              style={{
                textTransform: "none",
                color: "inherit",
                marginLeft: "auto",
              }}
            >
              Sign Out
            </Button>
          )}
        </Toolbar>
      </AppBar>

      <Routes>
        <Route path="/" element={<PlayersPage />} />
        <Route path="/league/:leagueId" element={<LeaguePage />} />
        <Route path="/team/:teamId" element={<TeamPage />} />
        <Route path="/players" element={<PlayersPage />} />
        <Route path="/league/:leagueId/draft" element={<DraftPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/create-league" element={<CreateLeaguePage />} />
      </Routes>
    </div>
  );
}

export default App;
