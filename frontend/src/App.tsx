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
import { UserProvider } from "./contexts/UserContext";

function App() {
  const [user, setUser] = useState<any>(null);
  const [userId, setUserId] = useState<any>(null);
  const [leagues, setLeagues] = useState([]);
  const [selectedLeague, setSelectedLeague] = useState<string>("");
  const navigate = useNavigate();

  // Function to fetch leagues
  const fetchLeagues = async (userToken: string) => {
    try {
      const response = await axios.get(
        "http://localhost:5000/api/league/get_leagues_by_user",
        {
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        }
      );
      const fetchedLeagues = response.data.leagues;
      setLeagues(fetchedLeagues);

      if (fetchedLeagues && fetchedLeagues.length > 0) {
        setSelectedLeague(fetchedLeagues[0].id.toString());
      }
    } catch (error) {
      console.error("Error fetching leagues:", error);
    }
  };

  // Handle user authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // User is logged in
        setUser(user);
        const token = await user.getIdToken();
        setUserId(user.uid); // Set userId from Firebase auth

        // Fetch leagues as soon as the user is authenticated
        fetchLeagues(token);
      } else {
        // User is not logged in
        setUser(null);
        setUserId(null);
        setLeagues([]); // Clear leagues if user is not logged in
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
        {
          token,
        }
      );
      if (response.status === 200) {
        const { user_id } = response.data;
        setUserId(user_id);
        fetchLeagues(token);
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
      setLeagues([]); // Clear leagues on sign out
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  return (
    <UserProvider>
      <div>
        <AppBar position="static">
          <Toolbar>
            {/* <IconButton edge="start" color="inherit" aria-label="menu">
              <MenuIcon />
            </IconButton> */}
            <Typography
              variant="h6"
              component={Link}
              to="/"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              PostSznFantasy
            </Typography>
            <Button
              component={Link}
              to="/league"
              style={{ textTransform: "none", color: "inherit" }}
            >
              League
            </Button>
            <Button
              component={Link}
              to="/team"
              style={{ textTransform: "none", color: "inherit" }}
            >
              Team
            </Button>
            <Button
              component={Link}
              to="/players"
              style={{ textTransform: "none", color: "inherit" }}
            >
              Players
            </Button>
            <Button
              component={Link}
              to="/draft"
              style={{ textTransform: "none", color: "inherit" }}
            >
              Draft
            </Button>
            <Button
              component={Link}
              to="/settings"
              style={{ textTransform: "none", color: "inherit" }}
            >
              Settings
            </Button>

            {user && (
              <div style={{ position: "relative" }}>
                <FormControl variant="outlined" style={{ minWidth: 120 }}>
                  <InputLabel id="league-select-label">
                    Select League
                  </InputLabel>
                  <Select
                    labelId="league-select-label"
                    value={selectedLeague}
                    onChange={(e) => setSelectedLeague(e.target.value)}
                    label="Select League"
                    style={{ color: "inherit" }}
                  >
                    {leagues.length > 0 &&
                      leagues.map((league) => (
                        <MenuItem key={league.id} value={league.id.toString()}>
                          {league.name}
                        </MenuItem>
                      ))}
                    <MenuItem onClick={() => navigate("/create-league")}>
                      Create New League
                    </MenuItem>
                  </Select>
                </FormControl>
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
              </div>
            )}

            {!user && (
              <Button
                onClick={handleSignIn}
                style={{ textTransform: "none", color: "inherit" }}
              >
                Sign in with Google
              </Button>
            )}
          </Toolbar>
        </AppBar>

        <Routes>
          <Route path="/league" element={<LeaguePage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/players" element={<PlayersPage />} />
          <Route path="/draft" element={<DraftPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/create-league" element={<CreateLeaguePage />} />
        </Routes>
      </div>
    </UserProvider>
  );
}

export default App;
