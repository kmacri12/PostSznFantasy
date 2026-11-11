import { Box, Button, Container, Typography, useMediaQuery, useTheme } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import {
  useDraft,
  useDraftPool,
  useLeagueTeams,
  useRecheckLeague,
  useSaveQueue,
} from "../api/queries";
import type { DraftSnapshot, DraftState } from "../api/types";
import LoadingState from "../components/common/LoadingState";
import AssignPickDialog from "../components/draft/AssignPickDialog";
import CommissionerStrip from "../components/draft/CommissionerStrip";
import { cappedPositions } from "../components/draft/caps";
import DraftBoard from "../components/draft/DraftBoard";
import DraftClockBar from "../components/draft/DraftClockBar";
import DraftOrderEditor from "../components/draft/DraftOrderEditor";
import DraftSettingsSheet from "../components/draft/DraftSettingsSheet";
import DraftToast from "../components/draft/DraftToast";
import QueuePanel from "../components/draft/QueuePanel";
import RosterView from "../components/draft/RosterView";
import ArchivedNotice from "../components/league/ArchivedNotice";
import PlayersView, { type DraftActions } from "../components/players/PlayersView";
import CogButton from "../components/settings/CogButton";
import ShareCardButton from "../components/share/ShareCardButton";
import { draftCard } from "../components/share/shareCards";
import { useSeasonContext } from "../contexts/SeasonContext";
import { useDraftRoom } from "../hooks/useDraftRoom";
import { HEADER_HEIGHT, radii, tokens } from "../theme";
import { playOnDeckCue, vibrateOnTurn } from "../utils/draftCue";

type ViewKey = "players" | "board" | "roster" | "queue";

/** The sticky clock bar is about this tall; the board column sticks below it. */
const CLOCK_BAR_HEIGHT = 64;
const PRE_DRAFT = ["unscheduled", "scheduled", "lobby"];

/**
 * The Draft tab. A finished draft is just the league's player list; before and during the
 * draft it is the room: sticky clock, commissioner strip, and Players / Board / Roster /
 * Queue (all on screen at once from `lg` up).
 */
const DraftPage = () => {
  const { seasonId, season } = useSeasonContext();
  const info = useDraft(seasonId);
  const finishedOnLoad = info.data?.status === "completed";
  const room = useDraftRoom(finishedOnLoad ? undefined : seasonId, useRecheckLeague());
  const pool = useDraftPool(seasonId);
  const leagueTeams = useLeagueTeams(seasonId).data;
  const saveQueue = useSaveQueue(seasonId);
  const wide = useMediaQuery(useTheme().breakpoints.up("lg"));
  const [view, setView] = useState<ViewKey>("players");
  const [editingOrder, setEditingOrder] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [assigning, setAssigning] = useState<{ pickNumber: number; teamName: string } | null>(null);

  const snapshot: DraftSnapshot | null = room.state;
  const state: DraftState | null = snapshot ?? info.data ?? null;
  const myTeamId = snapshot?.myTeamId ?? season.myTeamId;
  const archived = season.finished;
  const live = state?.status === "in_progress" || state?.status === "paused";
  const myTurn =
    state?.status === "in_progress" && myTeamId !== null && state.onTheClockTeamId === myTeamId;
  const onDeck =
    state?.status === "in_progress" && myTeamId !== null && state.onDeckTeamId === myTeamId;
  const queue = snapshot?.queue ?? [];

  const teams = useMemo(
    () =>
      leagueTeams?.map((team) => ({ id: team.id, name: team.name })) ??
      (state?.order ?? []).map((slot) => ({ id: slot.teamId, name: slot.teamName })),
    [leagueTeams, state?.order],
  );
  const players = useMemo(
    () => new Map((pool.data ?? []).map((player) => [player.id, player])),
    [pool.data],
  );
  const draftedIds = useMemo(
    () =>
      new Set([
        ...(state?.picks.map((p) => p.playerId) ?? []),
        ...(state?.reservedPicks.map((item) => item.playerId) ?? []),
        ...room.takenPlayerIds,
      ]),
    [state?.picks, state?.reservedPicks, room.takenPlayerIds],
  );
  const myPicks = useMemo(
    () => (state?.picks ?? []).filter((pick) => pick.teamId === myTeamId),
    [state?.picks, myTeamId],
  );
  const capped = useMemo(
    () =>
      cappedPositions(
        state?.positionCaps ?? {},
        myPicks.map((p) => p.position ?? ""),
      ),
    [state?.positionCaps, myPicks],
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

  const settingsSheet = settingsOpen && (
    <DraftSettingsSheet
      draft={state}
      canEdit={season.canCommission && !archived}
      onClose={() => setSettingsOpen(false)}
    />
  );

  if (state.status === "completed") {
    return (
      <Container maxWidth="md" sx={{ py: 2 }}>
        <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
          <CogButton label="Draft settings" onClick={() => setSettingsOpen(true)} />
        </Box>
        {archived && <ArchivedNotice what="picks and the queue" />}
        <ShareCardButton
          card={draftCard(season.leagueName, season.year, state)}
          label="Share draft recap"
        />
        <PlayersView
          seasonId={seasonId}
          year={season.year}
          picks={state.picks}
          teams={teams}
          myTeamId={myTeamId}
        />
        {settingsSheet}
      </Container>
    );
  }

  const canAssign = season.canCommission && !archived && live;
  const onSelectSlot = canAssign ? setAssigning : undefined;
  const updateQueue = (next: number[]) => {
    room.setQueueLocal(next);
    saveQueue.mutate(next);
  };
  const toggleQueue = (playerId: number) =>
    updateQueue(
      queue.includes(playerId) ? queue.filter((id) => id !== playerId) : [...queue, playerId],
    );
  const actions: DraftActions | undefined = archived
    ? undefined
    : {
        live,
        canPick: myTurn,
        isConnected: room.isConnected,
        pendingPlayerId: room.pendingPlayerId,
        capped,
        queue,
        takenIds: [...draftedIds],
        onPick: room.makePick,
        onToggleQueue: toggleQueue,
      };
  const playersView = (
    <PlayersView
      seasonId={seasonId}
      year={season.year}
      picks={state.picks}
      teams={teams}
      myTeamId={myTeamId}
      draft={actions}
    />
  );
  const queuePanel = (
    <QueuePanel queue={queue} players={players} draftedIds={draftedIds} onChange={updateQueue} />
  );
  const orderEditor = <DraftOrderEditor draft={state} onDone={() => setEditingOrder(false)} />;
  const showEditor = editingOrder && PRE_DRAFT.includes(state.status);
  const queued = queue.filter((id) => !draftedIds.has(id)).length;
  const views: { key: ViewKey; label: string }[] = [
    { key: "players", label: "Players" },
    { key: "board", label: "Board" },
    { key: "roster", label: "Roster" },
    { key: "queue", label: queued > 0 ? `Queue ${queued}` : "Queue" },
  ];

  return (
    <Box sx={{ mx: "auto", maxWidth: wide ? 1200 : 640 }}>
      <DraftClockBar
        state={state}
        myTeamId={myTeamId}
        secondsLeft={room.secondsLeft}
        secondsToStart={room.secondsToStart}
        isConnected={room.isConnected}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      {settingsSheet}
      {season.canCommission && !archived && (
        <CommissionerStrip
          draft={state}
          presence={snapshot?.presence ?? []}
          editingOrder={editingOrder}
          onEditOrder={() => setEditingOrder(!editingOrder)}
        />
      )}
      <DraftToast toast={room.toast} onClose={room.dismissToast} />
      {assigning && (
        <AssignPickDialog
          draft={state}
          pickNumber={assigning.pickNumber}
          teamName={assigning.teamName}
          pool={pool.data ?? []}
          onClose={() => setAssigning(null)}
        />
      )}
      {archived && (
        <Box sx={{ px: 2, pt: 2 }}>
          <ArchivedNotice what="picks and the queue" />
        </Box>
      )}

      {wide ? (
        <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 520px", gap: 3, p: 3 }}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, minWidth: 0 }}>
            {showEditor ? (
              orderEditor
            ) : (
              <>
                {!archived && queuePanel}
                {playersView}
              </>
            )}
          </Box>
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              minWidth: 0,
              position: "sticky",
              top: HEADER_HEIGHT + CLOCK_BAR_HEIGHT + 16,
              alignSelf: "start",
              maxHeight: `calc(100dvh - ${HEADER_HEIGHT + CLOCK_BAR_HEIGHT + 32}px)`,
              overflowY: "auto",
            }}
          >
            <DraftBoard
              state={state}
              myTeamId={myTeamId}
              onSelectSlot={onSelectSlot}
              sx={{ maxHeight: 440 }}
            />
            <RosterView seasonId={seasonId} picks={myPicks} />
          </Box>
        </Box>
      ) : (
        <>
          <Box
            role="tablist"
            aria-label="Draft room views"
            sx={{
              display: "grid",
              gridTemplateColumns: `repeat(${archived ? 2 : 4}, 1fr)`,
              gap: 0.75,
              px: 2,
              pt: 1.5,
              pb: 1,
            }}
          >
            {views
              .filter((item) => !archived || item.key === "board" || item.key === "roster")
              .map((item) => {
                const selected = view === item.key;
                return (
                  <Button
                    key={item.key}
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setView(item.key)}
                    sx={{
                      border: `${selected ? 2 : 1}px solid ${selected ? tokens.accent : tokens.borderStrong}`,
                      borderRadius: `${radii.button - 2}px`,
                      bgcolor: selected ? tokens.accentSurface : "transparent",
                      color: selected ? tokens.accent : tokens.textSoft,
                      fontSize: 13,
                      fontWeight: selected ? 600 : 400,
                      px: 0.5,
                    }}
                  >
                    {item.label}
                  </Button>
                );
              })}
          </Box>
          <Box sx={{ px: view === "board" ? 0 : 2, pb: 2 }}>
            {showEditor ? (
              <Box sx={{ px: view === "board" ? 2 : 0 }}>{orderEditor}</Box>
            ) : (
              <>
                {view === "players" && !archived && playersView}
                {view === "board" && (
                  <DraftBoard state={state} myTeamId={myTeamId} onSelectSlot={onSelectSlot} />
                )}
                {view === "roster" && <RosterView seasonId={seasonId} picks={myPicks} />}
                {view === "queue" && !archived && queuePanel}
              </>
            )}
          </Box>
        </>
      )}
    </Box>
  );
};

export default DraftPage;
