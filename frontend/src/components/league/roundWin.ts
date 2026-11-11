import type { Standings } from "../../api/types";
import { ROUNDS } from "./standingsView";

/**
 * The round the standings describe is over (no starter live or still to play) and my team scored
 * the most in it, alone: a tie is no win. Returns that round, else null.
 */
export const roundWon = (standings: Standings, myTeamId: number | null): number | null => {
  if (standings.phase !== "live" || myTeamId === null) return null;
  if (standings.gamesInProgress > 0 || standings.gamesFinal === 0) return null;
  if (standings.teams.some((team) => team.progress.live + team.progress.toPlay > 0)) return null;
  const key = ROUNDS[standings.round - 1]?.key;
  if (!key) return null;
  const mine = standings.teams.find((team) => team.teamId === myTeamId);
  if (!mine || mine[key] <= 0) return null;
  const best = Math.max(...standings.teams.map((team) => team[key]));
  const leaders = standings.teams.filter((team) => team[key] === best);
  return leaders.length === 1 && mine[key] === best ? standings.round : null;
};
