import Autocomplete from "@mui/material/Autocomplete";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import axios from "axios";
import { useEffect, useState } from "react";

export interface Player {
  id: number;
  name: string;
  position: string;
  teamAbv?: string;
  team?: {
    teamAbv?: string;
  };
}

interface PlayerSelectorProps {
  onPlayerSelected: (player: Player) => void;
  isMyTurn: boolean;
  selectedPlayerIDs: number[];
}

const PlayerSelector = ({ onPlayerSelected, isMyTurn, selectedPlayerIDs }: PlayerSelectorProps) => {
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

  const handlePlayerSelect = (_: unknown, newValue: Player | null) => {
    setSelectedPlayer(newValue);
  };

  const handleDraft = () => {
    if (isMyTurn && selectedPlayer && !selectedPlayerIDs.includes(selectedPlayer.id)) {
      onPlayerSelected(selectedPlayer);
      setSelectedPlayer(null);
    }
  };

  const filteredPlayers = players.filter(
    (player) =>
      player.name.toLowerCase().includes(inputValue.toLowerCase()) &&
      !selectedPlayerIDs.includes(player.id),
  );

  const formatPlayerName = (player: Player) => {
    const team = player.teamAbv || player.team?.teamAbv || "FA";
    return `${player.name}, ${player.position}, ${team}`;
  };

  return (
    <div style={{ display: "flex", gap: "12px", alignItems: "center", marginBottom: "16px" }}>
      <Autocomplete
        options={filteredPlayers}
        getOptionLabel={formatPlayerName}
        value={selectedPlayer}
        onChange={handlePlayerSelect}
        inputValue={inputValue}
        onInputChange={(_, newInputValue) => setInputValue(newInputValue)}
        style={{ flex: 1 }}
        renderInput={(params) => (
          <TextField {...params} label="Search for player" variant="outlined" />
        )}
        renderOption={(props, option) => (
          <li
            {...props}
            key={option.id}
            style={{
              color: selectedPlayerIDs.includes(option.id) ? "gray" : "inherit",
            }}
          >
            {formatPlayerName(option)}
          </li>
        )}
      />
      <Button
        variant="contained"
        color="primary"
        disabled={!isMyTurn || !selectedPlayer || selectedPlayerIDs.includes(selectedPlayer.id)}
        onClick={handleDraft}
      >
        Draft
      </Button>
    </div>
  );
};

export default PlayerSelector;
