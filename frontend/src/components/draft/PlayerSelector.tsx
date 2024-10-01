import React, { useState, useEffect } from "react";
import axios from "axios";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";

export interface Player {
  id: number;
  name: string;
  position: string;
  teamAbv: string;
}

interface PlayerSelectorProps {
  onPlayerSelected: (player: Player) => void;
  isMyTurn: boolean;
  selectedPlayerIDs: number[];
}

const PlayerSelector = ({
  onPlayerSelected,
  isMyTurn,
  selectedPlayerIDs,
}: PlayerSelectorProps) => {
  const apiUrl = import.meta.env.VITE_API_URL;
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const response = await axios.get(`${apiUrl}/api/players/player-list`);
        setPlayers(response.data);
      } catch (error) {
        console.error("Error fetching players:", error);
      }
    };

    fetchPlayers();
  }, [apiUrl]);

  const handlePlayerSelect = (event, newValue) => {
    setSelectedPlayer(newValue);
  };

  const handleDraft = () => {
    if (
      isMyTurn &&
      selectedPlayer &&
      !selectedPlayerIDs.includes(selectedPlayer.id)
    ) {
      // Send data to DraftBoard and websocket
      onPlayerSelected(selectedPlayer);
    }
  };

  const filteredPlayers = players.filter(
    (player) =>
      player.name.toLowerCase().includes(inputValue.toLowerCase()) &&
      !selectedPlayerIDs.includes(player.id)
  );

  const formatPlayerName = (player) => {
    return `${player.name}, ${player.position}, ${player.teamAbv}`;
  };

  return (
    <div>
      <Autocomplete
        options={filteredPlayers}
        getOptionLabel={formatPlayerName}
        value={selectedPlayer}
        onChange={handlePlayerSelect}
        inputValue={inputValue}
        onInputChange={(event, newInputValue) => setInputValue(newInputValue)}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Search for player"
            variant="outlined"
            fullWidth
          />
        )}
        disableClearable
        renderOption={(props, option) => (
          <li
            {...props}
            style={{
              color: selectedPlayerIDs.includes(option.id) ? "gray" : "black",
            }}
          >
            {formatPlayerName(option)}
          </li>
        )}
      />
      <button
        disabled={
          !isMyTurn ||
          !selectedPlayer ||
          selectedPlayerIDs.includes(selectedPlayer.id)
        }
        onClick={handleDraft}
      >
        Draft
      </button>
    </div>
  );
};

export default PlayerSelector;
