// src/App.tsx
import React from 'react';
import { Route, Routes, Link } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Button, IconButton } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import LeaguePage from './pages/LeaguePage';
import TeamPage from './pages/TeamPage';
import PlayersPage from './pages/PlayersPage';
import DraftPage from './pages/DraftPage';
import SettingsPage from './pages/SettingsPage';



function App() {
  return (
      <div>
        <AppBar position="static">
          <Toolbar>
            <IconButton edge="start" color="inherit" aria-label="menu">
              <MenuIcon />
            </IconButton>
            <Typography variant="h6">
              PostSznFantasy
            </Typography>
            <Button color="inherit" component={Link} to="/league">League</Button>
            <Button color="inherit" component={Link} to="/team">Team</Button>
            <Button color="inherit" component={Link} to="/players">Players</Button>
            <Button color="inherit" component={Link} to="/draft">Draft</Button>
            <Button color="inherit" style={{ marginLeft: 'auto' }} component={Link} to="/settings">Settings</Button>
          </Toolbar>
        </AppBar>
        <Routes>
          <Route path="/league" element={<LeaguePage />}/>
          <Route path="/team" element={<TeamPage />}/>
          <Route path="/players" element={<PlayersPage />}/>
          <Route path="/draft" element={<DraftPage />}/>
          <Route path="/settings" element={<SettingsPage />}/>
        </Routes>
      </div>
  );
}

export default App;
