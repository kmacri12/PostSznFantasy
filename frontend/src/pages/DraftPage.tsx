import {
  Box,
  Chip,
  Container,
  Dialog,
  DialogContent,
  Paper,
  Tab,
  Tabs,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useLeague, usePlayerList, useSaveQueue } from "../api/queries";
import LoadingState from "../components/common/LoadingState";
import AvailablePlayers from "../components/draft/AvailablePlayers";
import CommissionerControls from "../components/draft/CommissionerControls";
import DraftBoard from "../components/draft/DraftBoard";
import DraftSetupPanel from "../components/draft/DraftSetupPanel";
import DraftStatusBar from "../components/draft/DraftStatusBar";
import DraftToast from "../components/draft/DraftToast";
import MyRosterPanel from "../components/draft/MyRosterPanel";
import OnTheClockBanner from "../components/draft/OnTheClockBanner";
import PickFeed from "../components/draft/PickFeed";
import QueuePanel from "../components/draft/QueuePanel";
import { useDraftRoom } from "../hooks/useDraftRoom";
import { playOnDeckCue, vibrateOnTurn } from "../utils/draftCue";

type TabKey = "board" | "players" | "queue" | "roster" | "feed";

const DraftPage = () => {
  const { leagueId } = useParams<{ leagueId: string }>();
  const room = useDraftRoom(leagueId);
  const league = useLeague(leagueId);
  const playersQuery = usePlayerList();
  const saveQueue = useSaveQueue(leagueId);
  const [tab, setTab] = useState<TabKey>("board");
  const [showSetup, setShowSetup] = useState(false);

  const state = room.state;
  const myTeamId = state?.myTeamId ?? null;
  const isCommissioner = league.data?.myRole === "commissioner";
  const myTurn =
    state?.status === "in_progress" && myTeamId !== null && state.onTheClockTeamId === myTeamId;
  const onDeck =
    state?.status === "in_progress" && myTeamId !== null && state.onDeckTeamId === myTeamId;

  const players = useMemo(
    () => new Map((playersQuery.data ?? []).map((p) => [p.id, p])),
    [playersQuery.data],
  );
  const draftedIds = useMemo(
    () => new Set([...(state?.picks.map((p) => p.playerId) ?? []), ...room.takenPlayerIds]),
    [state?.picks, room.takenPlayerIds],
  );

  useEffect(() => {
    if (onDeck && !myTurn) playOnDeckCue();
  }, [onDeck, myTurn]);

  useEffect(() => {
    if (myTurn) vibrateOnTurn();
  }, [myTurn]);

  if (!state) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {room.isConnected ? "Loading the draft room…" : "Connecting to the draft room…"}
        </Typography>
        <LoadingState what="the draft room" rows={3} />
      </Container>
    );
  }

  const updateQueue = (next: number[]) => {
    room.setQueueLocal(next);
    saveQueue.mutate(next);
  };

  return (
    <Container maxWidth={false} sx={{ py: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2, flexWrap: "wrap" }}>
        <Typography variant="h4" sx={{ flexGrow: 1 }}>
          Draft room
        </Typography>
        <Chip
          size="small"
          color={room.isConnected ? "success" : "warning"}
          label={room.isConnected ? "Live" : "Reconnecting…"}
        />
        <Chip size="small" variant="outlined" label={`${state.presence.length} here`} />
        {isCommissioner && (
          <Chip clickable label="Draft setup" onClick={() => setShowSetup(true)} />
        )}
      </Box>

      <DraftStatusBar
        state={state}
        secondsLeft={room.secondsLeft}
        secondsToStart={room.secondsToStart}
        isConnected={room.isConnected}
        myTeamId={myTeamId}
      />
      <OnTheClockBanner
        active={myTurn}
        secondsLeft={room.secondsLeft}
        isConnected={room.isConnected}
      />
      <DraftToast toast={room.toast} onClose={room.dismissToast} />
      {isCommissioner && (
        <Box sx={{ mt: 2 }}>
          <CommissionerControls draft={state} />
        </Box>
      )}

      <Paper sx={{ mt: 2 }}>
        <Tabs value={tab} onChange={(_, value: TabKey) => setTab(value)} variant="scrollable">
          <Tab value="board" label="Board" />
          <Tab value="players" label="Players" />
          <Tab value="queue" label={`Queue (${state.queue.length})`} />
          <Tab value="roster" label="My roster" />
          <Tab value="feed" label="Pick feed" />
        </Tabs>
        <Box sx={{ p: 2 }}>
          {tab === "board" && <DraftBoard state={state} myTeamId={myTeamId} />}
          {tab === "players" && (
            <AvailablePlayers
              players={playersQuery.data ?? []}
              draftedIds={draftedIds}
              queue={state.queue}
              canPick={myTurn}
              isConnected={room.isConnected}
              pendingPlayerId={room.pendingPlayerId}
              onPick={(player) => room.makePick(player.id)}
              onQueue={(id) => updateQueue([...state.queue, id])}
            />
          )}
          {tab === "queue" && (
            <QueuePanel
              queue={state.queue}
              players={players}
              draftedIds={draftedIds}
              onChange={updateQueue}
            />
          )}
          {tab === "roster" && <MyRosterPanel state={state} myTeamId={myTeamId} />}
          {tab === "feed" && <PickFeed state={state} />}
        </Box>
      </Paper>

      <Dialog open={showSetup} onClose={() => setShowSetup(false)} fullWidth maxWidth="md">
        <DialogContent>
          <DraftSetupPanel draft={state} canEdit={isCommissioner} />
        </DialogContent>
      </Dialog>
    </Container>
  );
};

export default DraftPage;
