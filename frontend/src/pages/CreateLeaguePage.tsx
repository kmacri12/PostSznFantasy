import React, { useState } from 'react';
import { TextField, Button, Grid, Typography, Box } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function CreateLeaguePage() {
  const navigate = useNavigate();

  const [leagueData, setLeagueData] = useState({
    name: '',
    commissioner_id: '', // Assume the user is already logged in and their ID will be available
  });

  const [leagueSettings, setLeagueSettings] = useState({
    number_teams: 10,
    roster_num_qb: 1,
    roster_num_rb: 2,
    roster_num_wr: 2,
    roster_num_te: 1,
    roster_num_flex_wr_rb_te: 1,
    roster_num_flex_wr_rb: 0,
    roster_num_flex_wr_te: 0,
    roster_num_flex_qb_wr_rb_te: 0,
    roster_num_k: 1,
    roster_num_dst: 1,
    roster_num_total_size: 16,
    roster_max_qb: 3,
    roster_max_rb: 5,
    roster_max_wr: 5,
    roster_max_te: 3,
    roster_max_k: 2,
    roster_max_dst: 2,
    scoring_passing_yard: 0.04,
    scoring_passing_td: 4,
    scoring_rushing_yard: 0.1,
    scoring_rushing_td: 6,
    // Other settings go here...
  });

  const handleLeagueChange = (e) => {
    setLeagueData({
      ...leagueData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSettingsChange = (e) => {
    setLeagueSettings({
      ...leagueSettings,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      // Example POST request to API to create the league and settings
      // const response = await axios.post('/api/leagues', { league: leagueData, settings: leagueSettings });
      
      // After successful creation, redirect to the new league page
      navigate('/league');
    } catch (error) {
      console.error('Error creating league:', error);
    }
  };

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        Create New League
      </Typography>
      <form onSubmit={handleSubmit}>
        <Grid container spacing={2}>
          {/* League Details */}
          <Grid item xs={12}>
            <TextField
              label="League Name"
              name="name"
              value={leagueData.name}
              onChange={handleLeagueChange}
              fullWidth
              required
            />
          </Grid>

          {/* League Settings */}
          <Typography variant="h6" gutterBottom>
            League Settings
          </Typography>

          <Grid item xs={12} sm={6}>
            <TextField
              label="Number of Teams"
              name="number_teams"
              value={leagueSettings.number_teams}
              onChange={handleSettingsChange}
              type="number"
              fullWidth
              required
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              label="Number of QBs"
              name="roster_num_qb"
              value={leagueSettings.roster_num_qb}
              onChange={handleSettingsChange}
              type="number"
              fullWidth
              required
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              label="Number of RBs"
              name="roster_num_rb"
              value={leagueSettings.roster_num_rb}
              onChange={handleSettingsChange}
              type="number"
              fullWidth
              required
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              label="Number of WRs"
              name="roster_num_wr"
              value={leagueSettings.roster_num_wr}
              onChange={handleSettingsChange}
              type="number"
              fullWidth
              required
            />
          </Grid>

          {/* Add more settings fields here based on LeagueSettings model */}

          <Grid item xs={12} sm={6}>
            <TextField
              label="Passing Yards per Point"
              name="scoring_passing_yard"
              value={leagueSettings.scoring_passing_yard}
              onChange={handleSettingsChange}
              type="number"
              fullWidth
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <TextField
              label="Passing TD Points"
              name="scoring_passing_td"
              value={leagueSettings.scoring_passing_td}
              onChange={handleSettingsChange}
              type="number"
              fullWidth
            />
          </Grid>

          {/* Add additional scoring fields here */}

          <Grid item xs={12}>
            <Button type="submit" variant="contained" color="primary" fullWidth>
              Create League
            </Button>
          </Grid>
        </Grid>
      </form>
    </Box>
  );
}

export default CreateLeaguePage;
