import React, { useState, useEffect } from "react";
import { Route, Routes, Link, useNavigate } from "react-router-dom";
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import LeaguePage from "./pages/LeaguePage";
import TeamPage from "./pages/TeamPage";
import PlayersPage from "./pages/PlayersPage";
import DraftPage from "./pages/DraftPage";
import SettingsPage from "./pages/SettingsPage";
import CreateLeaguePage from "./pages/CreateLeaguePage";
import { auth } from "./components/auth/firebase";
import {
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import axios from "axios";
import { UserProvider, useUser } from "./contexts/UserContext";

function App() {
  const [user, setUser] = useState<any>(null);
  const [userId, setUserId] = useState<any>(null);
  const [leagues, setLeagues] = useState([]);
  const [selectedLeague, setSelectedLeague] = useState<string>("");
  const navigate = useNavigate(); // Initialize the navigate function

  // Fetch leagues when userId is set
  useEffect(() => {
    const fetchLeagues = async () => {
      try {
        const token = await auth.currentUser?.getIdToken(); // Get the user's token
        const response = await axios.get(
          "http://localhost:5000/api/league/get_leagues_by_user",
          {
            headers: {
              Authorization: `Bearer ${token}`, // Pass the token in the Authorization header
            },
          }
        );
        const fetchedLeagues = response.data.leagues;
        setLeagues(fetchedLeagues);

        if (fetchedLeagues && fetchedLeagues.length > 0) {
          setSelectedLeague(fetchedLeagues[0].id.toString()); // Set the first league as default
          navigate(`/league/${fetchedLeagues[0].id}`); // Navigate to the first league dynamically
        }
      } catch (error) {
        console.error("Error fetching leagues:", error);
      }
    };

    if (userId) {
      fetchLeagues();
    }
  }, [userId]);

  // Handle league change in the dropdown
  const handleLeagueChange = (event: any) => {
    const leagueId = event.target.value;
    setSelectedLeague(leagueId);
    navigate(`/league/${leagueId}`); // Navigate to the selected league
  };

  // Check for authentication state on page load
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (user) {
        user.getIdToken().then((token) => {
          axios
            .post("http://localhost:5000/api/user/login", { token })
            .then((response) => {
              if (response.status === 200) {
                const { user_id } = response.data;
                setUserId(user_id);
              }
            });
        });
      }
    });
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const token = await result.user.getIdToken();
      const response = await axios.post(
        "http://localhost:5000/api/user/login",
        { token }
      );
      if (response.status === 200) {
        const { user_id } = response.data;
        setUserId(user_id);
      }
    } catch (error) {
      console.error("Error signing in:", error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setUserId(null);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <UserProvider>
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

            {/* Show the navigation buttons only if a league is selected */}
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
                  to={`/league/${selectedLeague}/team/1`}
                  style={{ textTransform: "none", color: "inherit" }}
                >
                  Team
                </Button>
                <Button
                  component={Link}
                  to={`/players`}
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
                  to={`/settings`}
                  style={{ textTransform: "none", color: "inherit" }}
                >
                  Settings
                </Button>

                {/* League selection dropdown */}
                <FormControl
                  variant="outlined"
                  style={{ minWidth: 120, marginLeft: "20px" }}
                >
                  <InputLabel id="league-select-label">
                    Select League
                  </InputLabel>
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
                        event.stopPropagation(); // Prevents triggering `handleLeagueChange`
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
                onClick={handleSignIn}
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
                onClick={handleSignOut}
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

        {/* Route Definitions */}
        <Routes>
          <Route path="/league/:leagueId" element={<LeaguePage />} />
          <Route path="/league/:leagueId/team/:teamId" element={<TeamPage />} />
          <Route path="/players" element={<PlayersPage />} />
          <Route path="/league/:leagueId/draft" element={<DraftPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/create-league" element={<CreateLeaguePage />} />
        </Routes>
      </div>
    </UserProvider>
  );
}

export default App;
