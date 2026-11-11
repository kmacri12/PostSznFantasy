import { useEffect, useState } from "react";
import { useStandings } from "../../api/queries";
import { celebrationSeen, markCelebrationSeen } from "../../utils/celebrationSeen";
import AppToast from "../common/AppToast";
import { roundWon } from "./roundWin";
import { ROUNDS } from "./standingsView";

/** "You won the round": once per device, season and round, when the round ends with my team on top. */
const RoundWinToast = ({ seasonId, myTeamId }: { seasonId: number; myTeamId: number | null }) => {
  const standings = useStandings(seasonId).data;
  const [won, setWon] = useState<number | null>(null);
  const round = standings ? roundWon(standings, myTeamId) : null;

  useEffect(() => {
    if (round === null) return;
    const id = `${seasonId}-${round}`;
    if (celebrationSeen("round", id)) return;
    markCelebrationSeen("round", id);
    setWon(round);
  }, [round, seasonId]);

  return (
    <AppToast
      open={won !== null}
      message={`You won the ${won ? ROUNDS[won - 1]?.label : ""} round. Nice work!`}
      autoHideMs={7000}
      onClose={() => setWon(null)}
    />
  );
};

export default RoundWinToast;
