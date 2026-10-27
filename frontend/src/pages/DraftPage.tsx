import { Settings } from "@mui/icons-material";
import { Button, Dialog, Grid, IconButton } from "@mui/material";
import axios from "axios";
import { getAuth } from "firebase/auth";
import type { FC } from "react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Countdown from "../components/draft/Countdown";
import DraftBoard from "../components/draft/DraftBoard";
import PlayerSelector from "../components/draft/PlayerSelector";
import type { Player } from "../components/draft/PlayerSelector";
import { useWebSocket } from "../hooks/useWebSocket";

export interface Team {
  id: number;
  name: string;
  ownerId: number;
  ownerName: string;
}

export interface DraftSettings {
  id: number;
  leagueId: number;
  status: string;
  startTime: Date;
  draftType: string;
  timePerPickSeconds: number;
  slowDraftAutoPause: boolean;
  slowDraftPauseFrom: string; // time in 24-hour format (e.g. "22:00:00")
  slowDraftPauseTo: string; // time in 24-hour format (e.g. "03:00:00")
  slowDraftPauseTimezone: string; // timezone identifier (e.g. "America/New_York")
  cpuAutopick: boolean;
  alphabeticalSort: boolean;
  draftOrderTeamIds: number[];
}

export interface DraftPick {
  id: number;
  draftId?: number;
  teamId: number;
  playerId: number | null;
  playerName: string;
  numberRound: number;
  numberPickOverall: number;
  numberPickInRound: number;
  autopick: boolean;
}

const DraftPage: FC = () => {
  const { leagueId } = useParams<{ leagueId: string }>();
  const wsUrl = import.meta.env.VITE_WS_URL;

  const { data } = useWebSocket(`${wsUrl}/socket.io/`);
  const [draftSettings, setDraftSettings] = useState<DraftSettings | null>(null);
  const [_leagueSettings, setLeagueSettings] = useState<any>(null);
  const [openSettings, setOpenSettings] = useState(false);
  const [draftBoard, setDraftBoard] = useState<DraftPick[][]>([[]]);
  const [currentPickIndex, setCurrentPickIndex] = useState<number>(1);
  const [timer, setTimer] = useState<number>(draftSettings?.timePerPickSeconds || 60);
  const [teams, setTeams] = useState<Team[]>([]);
  const [numRounds, setNumRounds] = useState<number>(0);

  useEffect(() => {
    const newDraftBoard = Array.from({ length: numRounds }, (_, roundIndex) =>
      Array(teams.length)
        .fill(null)
        .map((_, teamIndex) => ({
          id: -1,
          draftId: draftSettings?.id,
          teamId: teams[teamIndex].id,
          playerId: null,
          playerName: "",
          numberRound: roundIndex + 1,
          numberPickOverall: calculatePickOverall(roundIndex, teamIndex),
          numberPickInRound: calculatePickInRound(roundIndex, teamIndex),
          autopick: false,
        })),
    );
    setDraftBoard(newDraftBoard);
  }, [teams, numRounds]);

  const calculatePickOverall = (roundIndex: number, teamIndex: number) => {
    const roundNumber = roundIndex + 1;
    const isOddRound = roundNumber % 2 === 1;
    const roundPickOne = teams.length * (roundNumber - 1) + 1;
    // const startIndex = isOddRound ? 1 : teams.length + 1;
    // const endIndex = isOddRound ? teams.length : 1;
    const teamOffset = isOddRound ? teamIndex : teams.length - teamIndex - 1;
    return roundPickOne + teamOffset;
  };

  const calculatePickInRound = (roundIndex: number, teamIndex: number) => {
    const isOddRound = (roundIndex + 1) % 2 === 1;
    const teamOffset = isOddRound ? teamIndex : teams.length - 1 - teamIndex;
    return teamOffset + 1;
  };

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL;
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      console.error("No user is currently signed in.");
      return;
    }

    const fetchTeams = async () => {
      try {
        const idToken = await user.getIdToken();
        const response = await axios.get(`${apiUrl}/api/league/${leagueId}/teams`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        const teamsList = response.data;
        setTeams(teamsList);
        console.log(teams);
      } catch (error) {
        console.error("Error fetching teams:", error);
      }
    };

    const fetchDraftSettings = async () => {
      try {
        const idToken = await user.getIdToken();
        const response = await axios.get(`${apiUrl}/api/draft-info/${leagueId}`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        setDraftSettings(response.data);
        console.log(teams);
      } catch (error) {
        console.error("Error fetching draft settings:", error);
      }
    };

    const calculateNumRounds = (leagueSettings) => {
      const rosterNumKeys: string[] = [
        "roster_num_bench",
        "roster_num_dst",
        "roster_num_flex_qb_wr_rb_te",
        "roster_num_flex_wr_rb",
        "roster_num_flex_wr_te",
        "roster_num_k",
        "roster_num_qb",
        "roster_num_rb",
        "roster_num_te",
        "roster_num_wr",
      ];

      let totalRosterNum = 0;
      for (const key of rosterNumKeys) {
        totalRosterNum += leagueSettings[key];
      }
      console.log(totalRosterNum);

      return totalRosterNum;
    };

    const fetchLeagueSettings = async () => {
      try {
        const idToken = await user.getIdToken();
        const response = await axios.get(`${apiUrl}/api/league/${leagueId}/settings`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        setLeagueSettings(response.data);
        setNumRounds(calculateNumRounds(response.data));
      } catch (error) {
        console.error("Error fetching league settings:", error);
      }
    };

    fetchTeams();
    fetchDraftSettings();
    fetchLeagueSettings();
  }, [leagueId]);

  useEffect(() => {
    if (data) {
      const { board, pick, time } = data;
      setDraftBoard(board);
      setCurrentPickIndex(pick);
      setTimer(time);
    }
  }, [data]);

  const handlePlayerSelection = (player: Player) => {
    // Handle drafting a player
    console.log("Player drafted:", player);
    // Find the DraftPick object for the current pick
    const roundIndex = Math.floor((currentPickIndex - 1) / teams.length);
    const picksInRound = draftBoard[roundIndex];
    const currentPick = picksInRound.find((pick) => pick.numberPickOverall === currentPickIndex);
    if (!currentPick) {
      console.error("Error: Could not find current pick in draft board");
      return;
    }
    const updatedDraftPick = {
      ...currentPick,
      playerId: player.id,
      playerName: player.name,
    };
    const updatedDraftBoard = draftBoard.map((round) =>
      round.map((pick) => (pick.numberPickOverall === currentPickIndex ? updatedDraftPick : pick)),
    );
    setDraftBoard(updatedDraftBoard);

    // Increment pick #
    setCurrentPickIndex(currentPickIndex + 1);
    setTimer(draftSettings?.timePerPickSeconds || 60);
  };

  return (
    <div>
      <PlayerSelector
        onPlayerSelected={handlePlayerSelection}
        isMyTurn={true}
        selectedPlayerIDs={[]}
      />
      <Grid container spacing={1}>
        <DraftBoard
          teams={teams}
          draftPicks={draftBoard}
          currentPickIndex={currentPickIndex}
          timer={timer}
          onPlayerSelected={handlePlayerSelection} // Pass function to handle player selection
          isMyTurn={true} // Placeholder, might be determined elsewhere
          selectedPlayerIDs={[]} // Placeholder, might be determined elsewhere
        />

        {/* Settings Button */}
        <IconButton
          style={{ position: "absolute", top: 10, right: 10 }}
          onClick={() => setOpenSettings(true)}
        >
          <Settings />
        </IconButton>

        {/* Countdown Timer */}
        <Grid item xs={12}>
          <Countdown time={timer} />
        </Grid>
      </Grid>

      {/* Draft Settings Dialog */}
      <Dialog open={openSettings} onClose={() => setOpenSettings(false)}>
        {/* Settings content goes here */}
        <h2>Draft Settings</h2>
        <Button onClick={() => setOpenSettings(false)}>Close</Button>
      </Dialog>
    </div>
  );
};

export default DraftPage;
