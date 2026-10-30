export const CARD_POSITIONS = ["QB", "RB", "WR", "TE", "K", "DST"] as const;

export interface PlayerCardData {
  id: number;
  name: string;
  position: string;
  team: string;
  /** Set once the API reports the player's NFL team as out of the playoffs. */
  eliminated?: boolean;
  /** Team QB / team K: the card gets a badge saying he scores the whole team. */
  scoresWholeTeam?: boolean;
  points?: number | null;
  stats?: { label: string; value: number }[];
}

interface CardFilter {
  search: string;
  /** null shows every position. */
  position: string | null;
  /** Drafted or otherwise unavailable players. */
  hiddenIds?: ReadonlySet<number>;
}

export function filterPlayerCards(players: PlayerCardData[], filter: CardFilter): PlayerCardData[] {
  const needle = filter.search.trim().toLowerCase();
  return players.filter(
    (p) =>
      !p.eliminated &&
      !filter.hiddenIds?.has(p.id) &&
      (filter.position === null || p.position === filter.position) &&
      (!needle || p.name.toLowerCase().includes(needle)),
  );
}
