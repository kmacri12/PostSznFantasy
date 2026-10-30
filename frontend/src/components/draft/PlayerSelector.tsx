import Autocomplete from "@mui/material/Autocomplete";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";
import { useState } from "react";
import { usePlayerList } from "../../api/queries";

const POSITIONS = ["ALL", "QB", "RB", "WR", "TE", "K", "DST"];

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
  const { data: players = [] } = usePlayerList();
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [inputValue, setInputValue] = useState("");
  const [position, setPosition] = useState("ALL");

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
      (position === "ALL" || player.position === position) &&
      player.name.toLowerCase().includes(inputValue.toLowerCase()) &&
      !selectedPlayerIDs.includes(player.id),
  );

  const formatPlayerName = (player: Player) => {
    const team = player.teamAbv || player.team?.teamAbv || "FA";
    return `${player.name}, ${player.position}, ${team}`;
  };

  return (
    <div style={{ marginBottom: "16px" }}>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }}>
        {POSITIONS.map((pos) => (
          <Chip
            key={pos}
            label={pos}
            clickable
            color={position === pos ? "primary" : "default"}
            variant={position === pos ? "filled" : "outlined"}
            aria-pressed={position === pos}
            onClick={() => setPosition(pos)}
          />
        ))}
      </div>
      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
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
    </div>
  );
};

export default PlayerSelector;
