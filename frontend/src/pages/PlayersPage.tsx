// src/pages/PlayersPage.tsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import PlayersTable from './PlayersTable'; 





function PlayersPage() {
  const [playerStats, setPlayerStats] = useState<[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('http://localhost:5000/api/players/player_season_stats')
      .then(response => {
        setPlayerStats(response.data);
        setLoading(false);
      })
      .catch(error => {
        console.error(error);
      });
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <PlayersTable data={playerStats} /> // Render the PlayersTable component and pass the playersStats data
    </div>
  );
}

export default PlayersPage;