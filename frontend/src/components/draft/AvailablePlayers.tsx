import { Button } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import type { PlayerSummary } from "../../api/types";
import PlayerCardList from "../players/PlayerCardList";
import { CARD_POSITIONS, filterPlayerCards, type PlayerCardData } from "../players/playerCards";

const MAX_ROWS = 200;
const CONFIRM_WINDOW_MS = 3000;

interface Props {
  players: PlayerSummary[];
  draftedIds: Set<number>;
  /** Position to the reason this team can't draft it (it reached the cap). */
  cappedPositions: Record<string, string>;
  queue: number[];
  canPick: boolean;
  isConnected: boolean;
  /** Player whose pick is awaiting the server's answer. */
  pendingPlayerId: number | null;
  onPick: (player: PlayerSummary) => void;
  onQueue: (playerId: number) => void;
}

const AvailablePlayers = ({
  players,
  draftedIds,
  cappedPositions,
  queue,
  canPick,
  isConnected,
  pendingPlayerId,
  onPick,
  onQueue,
}: Props) => {
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState<string | null>(null);
  const [armedId, setArmedId] = useState<number | null>(null);

  useEffect(() => {
    if (armedId === null) return;
    const timer = setTimeout(() => setArmedId(null), CONFIRM_WINDOW_MS);
    return () => clearTimeout(timer);
  }, [armedId]);

  const draftLabel = (player: PlayerSummary) => {
    if (cappedPositions[player.position]) return "Position full";
    if (!isConnected) return "Reconnecting…";
    if (pendingPlayerId === player.id) return "Drafting…";
    return armedId === player.id ? `Confirm ${player.name}` : "Draft";
  };

  const handleDraft = (player: PlayerSummary) => {
    if (armedId !== player.id) {
      setArmedId(player.id);
      return;
    }
    setArmedId(null);
    onPick(player);
  };

  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const cards = useMemo(
    () =>
      players.map(
        (p): PlayerCardData => ({
          id: p.id,
          name: p.name,
          position: p.position,
          team: p.team?.teamAbv ?? p.teamAbv ?? "FA",
          eliminated: p.eliminated,
        }),
      ),
    [players],
  );
  const visible = useMemo(
    () => filterPlayerCards(cards, { search, position, hiddenIds: draftedIds }).slice(0, MAX_ROWS),
    [cards, draftedIds, search, position],
  );

  return (
    <PlayerCardList
      label="Available players"
      players={visible}
      search={search}
      onSearchChange={setSearch}
      unavailableReason={(card) => cappedPositions[card.position]}
      positions={CARD_POSITIONS}
      position={position}
      onPositionChange={setPosition}
      renderActions={(card) => {
        const player = byId.get(card.id) as PlayerSummary;
        return (
          <>
            <Button
              sx={{ minHeight: 44, minWidth: 72 }}
              disabled={queue.includes(player.id) || !!cappedPositions[player.position]}
              onClick={() => onQueue(player.id)}
            >
              Queue
            </Button>
            <Button
              variant="contained"
              color={armedId === player.id ? "warning" : "primary"}
              sx={{ minHeight: 44, flex: 1, lineHeight: 1.2 }}
              disabled={
                !canPick ||
                !isConnected ||
                pendingPlayerId !== null ||
                !!cappedPositions[player.position]
              }
              onClick={() => handleDraft(player)}
            >
              {draftLabel(player)}
            </Button>
          </>
        );
      }}
    />
  );
};

export default AvailablePlayers;
