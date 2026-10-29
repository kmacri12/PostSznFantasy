import { Settings as SettingsIcon } from "@mui/icons-material";
import { VolumeOff as VolumeOffIcon, VolumeUp as VolumeUpIcon } from "@mui/icons-material";
import {
  Box,
  Button,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Typography,
} from "@mui/material";
import type { FC } from "react";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useDraftInfo, useLeagueSettings, useLeagueTeams } from "../api/queries";
import Countdown from "../components/draft/Countdown";
import DraftBoard from "../components/draft/DraftBoard";
import PlayerSelector, { type Player } from "../components/draft/PlayerSelector";
import { useUser } from "../contexts/UserContext";
import { type DraftMessage, useWebSocket } from "../hooks/useWebSocket";
import { playOnDeckCue } from "../utils/draftCue";
import { createLogger } from "../utils/logger";

const logger = createLogger("DraftPage");

export interface Team {
  id: number;
  name: string;
  ownerId: number | null;
  ownerName: string | null;
}

export interface DraftSettings {
  id: number;
  leagueId: number;
  status: string;
  startTime?: string | Date;
  draftType: string;
  timePerPickSeconds: number;
  slowDraftAutoPause: boolean;
  slowDraftPauseFrom: string;
  slowDraftPauseTo: string;
  slowDraftPauseTimezone: string;
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

const EMPTY_TEAMS: Team[] = [];

const ROSTER_SPOT_KEYS = [
  "rosterNumBench",
  "rosterNumDst",
  "rosterNumFlexQbWrRbTe",
  "rosterNumFlexWrRb",
  "rosterNumFlexWrTe",
  "rosterNumFlexWrRbTe",
  "rosterNumK",
  "rosterNumQb",
  "rosterNumRb",
  "rosterNumTe",
  "rosterNumWr",
];

const countRosterSpots = (settings: Record<string, number>) =>
  ROSTER_SPOT_KEYS.reduce((sum, key) => sum + (settings[key] ?? 0), 0) || 18;

const DraftPage: FC = () => {
  const { leagueId } = useParams<{ leagueId: string }>();
  const wsUrl =
    import.meta.env.VITE_WS_URL ||
    `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}`;
  const { getIdToken, userId } = useUser();

  const websocketUrl = leagueId ? `${wsUrl}/api/drafts/ws/${leagueId}` : "";

  const teamsQuery = useLeagueTeams(leagueId);
  const draftQuery = useDraftInfo(leagueId);
  const settingsQuery = useLeagueSettings(leagueId);
  const teams = teamsQuery.data ?? EMPTY_TEAMS;
  const draftSettings = draftQuery.data ?? null;
  const numRounds = settingsQuery.data ? countRosterSpots(settingsQuery.data) : 0;

  useEffect(() => {
    if (draftQuery.data?.timePerPickSeconds) setTimer(draftQuery.data.timePerPickSeconds);
  }, [draftQuery.data?.timePerPickSeconds]);

  const [openSettings, setOpenSettings] = useState(false);
  const [draftBoard, setDraftBoard] = useState<DraftPick[][]>([[]]);
  const [currentPickIndex, setCurrentPickIndex] = useState<number>(1);
  const [timer, setTimer] = useState<number>(60);
  const [selectedPlayerIDs, setSelectedPlayerIDs] = useState<number[]>([]);
  const [muted, setMuted] = useState(false);

  const myTeamIds = teams.filter((team) => team.ownerId === userId).map((team) => team.id);
  const pickTeamId = (pickOverall: number) =>
    draftBoard.flat().find((pick) => pick.numberPickOverall === pickOverall)?.teamId;
  const isMyTurn = myTeamIds.includes(pickTeamId(currentPickIndex) ?? -1);
  const isOnDeck = myTeamIds.includes(pickTeamId(currentPickIndex + 1) ?? -1);

  useEffect(() => {
    if (isOnDeck && !muted) playOnDeckCue();
  }, [isOnDeck, muted]);

  const calculatePickOverall = (roundIndex: number, teamIndex: number) => {
    const roundNumber = roundIndex + 1;
    const isOddRound = roundNumber % 2 === 1;
    const roundPickOne = teams.length * (roundNumber - 1) + 1;
    const teamOffset = isOddRound ? teamIndex : teams.length - teamIndex - 1;
    return roundPickOne + teamOffset;
  };

  const calculatePickInRound = (roundIndex: number, teamIndex: number) => {
    const isOddRound = (roundIndex + 1) % 2 === 1;
    const teamOffset = isOddRound ? teamIndex : teams.length - 1 - teamIndex;
    return teamOffset + 1;
  };

  useEffect(() => {
    if (teams.length > 0 && numRounds > 0) {
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
    }
  }, [teams, numRounds, draftSettings?.id]);

  const handleMessage = useCallback(
    (data: DraftMessage) => {
      const eventType = data.eventType;
      if (eventType === "PICK_MADE" && data.data) {
        const pickData = data.data;
        if (pickData.playerId) {
          setSelectedPlayerIDs((prev) => [...prev, pickData.playerId]);
          setDraftBoard((board) =>
            board.map((round) =>
              round.map((pick) =>
                pick.numberPickOverall === pickData.numberPickOverall
                  ? { ...pick, playerId: pickData.playerId, playerName: pickData.playerName }
                  : pick,
              ),
            ),
          );
        }
        if (pickData.currentPickIndex) {
          setCurrentPickIndex(pickData.currentPickIndex);
          setTimer(draftSettings?.timePerPickSeconds || 60);
        }
      } else if (eventType === "ERROR") {
        logger.warn("Draft server rejected a message", data.message);
      } else if (eventType === "TIMER_UPDATE" && data.data?.time !== undefined) {
        setTimer(data.data.time);
      }
    },
    [draftSettings?.timePerPickSeconds],
  );

  const { sendMessage } = useWebSocket(websocketUrl, {
    getToken: getIdToken,
    onMessage: handleMessage,
  });

  // The server validates the pick and broadcasts PICK_MADE; the board updates from that echo.
  const handlePlayerSelection = (player: Player) => {
    sendMessage({ eventType: "MAKE_PICK", data: { playerId: player.id } });
  };

  return (
    <Container maxWidth={false} sx={{ py: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2, flexWrap: "wrap" }}>
        <Typography variant="h4" sx={{ flexGrow: 1 }}>
          Draft room
        </Typography>
        {isMyTurn && (
          <Typography color="primary" fontWeight={700}>
            You're on the clock
          </Typography>
        )}
        {!isMyTurn && isOnDeck && (
          <Typography color="secondary" fontWeight={700}>
            You're on deck
          </Typography>
        )}
        <Paper sx={{ px: 2.5, py: 0.5 }}>
          <Countdown time={timer} />
        </Paper>
        <IconButton
          aria-label={muted ? "Unmute cues" : "Mute cues"}
          onClick={() => setMuted((current) => !current)}
        >
          {muted ? <VolumeOffIcon /> : <VolumeUpIcon />}
        </IconButton>
        <IconButton aria-label="Draft settings" onClick={() => setOpenSettings(true)}>
          <SettingsIcon />
        </IconButton>
      </Box>

      <PlayerSelector
        onPlayerSelected={handlePlayerSelection}
        isMyTurn={isMyTurn}
        selectedPlayerIDs={selectedPlayerIDs}
      />
      <DraftBoard
        teams={teams}
        draftPicks={draftBoard}
        currentPickIndex={currentPickIndex}
        myTeamIds={myTeamIds}
      />

      <Dialog open={openSettings} onClose={() => setOpenSettings(false)}>
        <DialogTitle>Draft Settings</DialogTitle>
        <DialogContent>
          <p>Draft Type: {draftSettings?.draftType || "Snake"}</p>
          <p>Time Per Pick: {draftSettings?.timePerPickSeconds || 60} seconds</p>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenSettings(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default DraftPage;
