import React, { useState, useEffect } from 'react';
import { Route, Routes, Link, useNavigate } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Button, IconButton, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import LeaguePage from './pages/LeaguePage';
import TeamPage from './pages/TeamPage';
import PlayersPage from './pages/PlayersPage';
import DraftPage from './pages/DraftPage';
import SettingsPage from './pages/SettingsPage';
import CreateLeaguePage from './pages/CreateLeaguePage';
import { auth } from './components/auth/firebase'; // Import the auth instance from firebase.ts
import { onAuthStateChanged, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import axios from 'axios';

function App() {
  const [user, setUser] = useState<any>(null);
  const [leagues, setLeagues] = useState([]);
  const [selectedLeague, setSelectedLeague] = useState<string>('');
  const navigate = useNavigate();  // Initialize the navigate function

  useEffect(() => {
    const fetchLeagues = async () => {
      try {
        // const response = await axios.get('/api/leagues');  // TODO use api
        // setLeagues(response.data);  // Assuming API response is the list of leagues

        const hardcodedLeagues = [
          { id: 1, name: 'Fantasy League 2023', commissioner_id: 101 },
          { id: 2, name: 'Pro League 2022', commissioner_id: 102 },
          { id: 3, name: 'Friends & Family 2023', commissioner_id: 103 },
        ];

        setLeagues(hardcodedLeagues);

        if (hardcodedLeagues.length > 0) {
          setSelectedLeague(hardcodedLeagues[0].id.toString());
        }
      } catch (error) {
        console.error('Error fetching leagues:', error);
      }
    };

    if (user) {
      fetchLeagues();
    }
  }, [user]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
    });
    return () => unsubscribe();
  }, []);

  const handleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Error signing in:', error);
    }
  };

  return (
    <div>
      <AppBar position="static">
        <Toolbar>
          <IconButton edge="start" color="inherit" aria-label="menu">
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" component={Link} to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
            PostSznFantasy
          </Typography>
          <Button component={Link} to="/league" style={{ textTransform: 'none', color: 'inherit' }}>League</Button>
          <Button component={Link} to="/team" style={{ textTransform: 'none', color: 'inherit' }}>Team</Button>
          <Button component={Link} to="/players" style={{ textTransform: 'none', color: 'inherit' }}>Players</Button>
          <Button component={Link} to="/draft" style={{ textTransform: 'none', color: 'inherit' }}>Draft</Button>
          <Button component={Link} to="/settings" style={{ textTransform: 'none', color: 'inherit' }}>Settings</Button>

          {user && (
            <div style={{ position: 'relative' }}>
              <FormControl variant="outlined" style={{ minWidth: 120 }}>
                <InputLabel id="league-select-label">Select League</InputLabel>
                <Select
                  labelId="league-select-label"
                  value={selectedLeague}
                  onChange={(e) => setSelectedLeague(e.target.value)}
                  label="Select League"
                  style={{ color: 'inherit' }}
                >
                  {leagues.length ? (
                    leagues.map((league) => (
                      <MenuItem key={league.id} value={league.id}>
                        {league.name}
                      </MenuItem>
                    ))
                  ) : null}
                  <MenuItem onClick={() => navigate('/create-league')}>
                    Create New League
                  </MenuItem>
                </Select>
              </FormControl>
            </div>
          )}

          {!user && (
            <Button onClick={handleSignIn} style={{ textTransform: 'none', color: 'inherit' }}>Sign in with Google</Button>
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
  );
}

export default App;
