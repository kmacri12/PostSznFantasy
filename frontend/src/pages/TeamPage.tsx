import { Alert, Button, Container } from "@mui/material";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  type LineupMoveRequest,
  needsOverrideConfirmation,
  overrideIsLocked,
  useLeagueInfo,
  useLeagueSettings,
  useMoveInLineup,
  useStandings,
  useTeam,
} from "../api/queries";
import type { TeamDetails } from "../api/types";
import { mutationError } from "../components/common/friendlyError";
import LiveStatsNotice from "../components/common/LiveStatsNotice";
import QueryBoundary from "../components/common/QueryBoundary";
import ArchivedNotice from "../components/league/ArchivedNotice";
import TeamSettingsSheet from "../components/settings/TeamSettingsSheet";
import LineupRound from "../components/team/LineupRound";
import {
  defaultRound,
  emptyLineupWarning,
  formatKickoff,
  ROUND_LABELS,
} from "../components/team/lineup";
import {
  BENCH_GROUP_ID,
  benchPlayersOf,
  hurtStarters,
  hurtStartersMessage,
  rosterStatus,
} from "../components/team/lineupView";
import OverrideDialog from "../components/team/OverrideDialog";
import PlayerSheet from "../components/team/PlayerSheet";
import RoundStrip from "../components/team/RoundStrip";
import SlotPickerSheet from "../components/team/SlotPickerSheet";
import TeamHeader from "../components/team/TeamHeader";
import { useSeasonContext } from "../contexts/SeasonContext";
import { celebrationSeen, markCelebrationSeen } from "../utils/celebrationSeen";

/** Re-renders every 30s so the banner clears the moment a game starts. */
const useNow = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return now;
};

const TeamContent = ({ team }: { team: TeamDetails }) => {
  const teamId = team.id;
  const { season, seasonId } = useSeasonContext();
  const archived = season.finished;
  const canEdit = team.canEdit && season.canEdit;
  const canSetLineup = team.canSetLineup && season.canEdit;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const canAssignOwner = season.canCommission && season.canEdit;
  const members = useLeagueInfo(season.leagueId, canAssignOwner).data?.members;
  const now = useNow();
  const standings = useStandings(seasonId).data;
  const standing = standings?.teams.find((row) => row.teamId === teamId);
  const settings = useLeagueSettings(seasonId).data;
  const teamUnits = settings && { qb: settings.teamQb === true, k: settings.teamK === true };
  const currentRound = defaultRound(team.lineups, now);
  // Opens on the round the League page shows, which stays on last week's recap until Thursday.
  const shownRound = standings?.round ?? currentRound;
  const [pickedRound, setRound] = useState<number | null>(null);
  const round = pickedRound ?? shownRound;
  const nudgeRound = canSetLineup ? (standings?.lineupNudgeRound ?? null) : null;
  const [nudgeTip, setNudgeTip] = useState(
    () => nudgeRound !== null && !celebrationSeen("lineup-nudge", `${seasonId}-${nudgeRound}`),
  );
  const [sheetPlayerId, setSheetPlayerId] = useState<number | null>(null);
  const [fillSlotIndex, setFillSlotIndex] = useState<number | null>(null);
  const moveInLineup = useMoveInLineup(teamId);
  // A locked move the server wants confirmed first; held until the commissioner answers.
  const [pendingOverride, setPendingOverride] = useState<{
    request: LineupMoveRequest;
    locked: boolean;
  } | null>(null);
  const move = (request: LineupMoveRequest) =>
    moveInLineup.mutate(request, {
      onSuccess: () => {
        setSheetPlayerId(null);
        setFillSlotIndex(null);
      },
      onError: (error) => {
        if (needsOverrideConfirmation(error))
          setPendingOverride({ request, locked: overrideIsLocked(error) });
      },
    });
  const moveError = needsOverrideConfirmation(moveInLineup.error)
    ? null
    : mutationError(moveInLineup.error, "Couldn't move that player. Try again.");

  useEffect(() => {
    if (nudgeRound === null) return;
    setNudgeTip(!celebrationSeen("lineup-nudge", `${seasonId}-${nudgeRound}`));
    markCelebrationSeen("lineup-nudge", `${seasonId}-${nudgeRound}`);
  }, [nudgeRound, seasonId]);

  const lineup = team.lineups.find((entry) => entry.round === round);
  const hurt = lineup ? hurtStarters(lineup) : [];
  const hasBench = lineup ? benchPlayersOf(lineup).length > 0 : false;
  const warning = emptyLineupWarning(team.lineups, team.roster.length, now);
  const sheetPlayer =
    lineup && sheetPlayerId !== null
      ? [
          ...lineup.slots.map((slot) => slot.player),
          ...lineup.unassigned,
          ...lineup.eliminated,
        ].find((player) => player?.id === sheetPlayerId)
      : null;
  const isMine = season.myTeamId === team.id;
  const owner = isMine ? "You" : team.ownerName || "Unclaimed";

  return (
    <Container
      maxWidth="md"
      sx={{ py: { xs: 1, sm: 3 }, display: "flex", flexDirection: "column", gap: 1 }}
    >
      <TeamHeader
        name={team.name}
        avatarUrl={team.avatarUrl}
        picture={team.picture}
        ownerLine={`${owner}${standing?.rank != null ? ` · rank ${standing.rank}` : ""}`}
        total={standing?.total}
        status={rosterStatus(team.lineups, now, standings?.round)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <LiveStatsNotice />
      {archived && <ArchivedNotice what="names and lineups" />}
      {warning && canSetLineup && (
        <Alert severity="warning">
          {ROUND_LABELS[warning.round]}: {warning.emptyStarterSlots} empty starter{" "}
          {warning.emptyStarterSlots === 1 ? "slot" : "slots"}. First game{" "}
          {formatKickoff(warning.firstKickoff)}.
        </Alert>
      )}
      {hurt.length > 0 && canSetLineup && (
        <Alert
          severity="warning"
          action={
            hasBench && (
              <Button
                color="inherit"
                size="small"
                sx={{ minHeight: 44 }}
                onClick={() =>
                  document.getElementById(BENCH_GROUP_ID)?.scrollIntoView({ block: "start" })
                }
              >
                Go to bench
              </Button>
            )
          }
        >
          {hurtStartersMessage(hurt)}
        </Alert>
      )}
      {lineup && (
        <>
          <RoundStrip
            lineups={team.lineups}
            round={round}
            onSelect={setRound}
            nudge={
              nudgeRound === null
                ? null
                : { round: nudgeRound, tipOpen: nudgeTip, onTipClose: () => setNudgeTip(false) }
            }
          />
          <LineupRound
            lineup={lineup}
            teamUnits={teamUnits}
            onOpenPlayer={(player) => setSheetPlayerId(player.id)}
            onFillSlot={canSetLineup && round >= currentRound ? setFillSlotIndex : undefined}
          />
        </>
      )}
      {sheetPlayer && lineup && (
        <PlayerSheet
          player={sheetPlayer}
          lineup={lineup}
          lineups={team.lineups}
          canMove={canSetLineup && round >= currentRound}
          canOverride={team.canOverride && season.canEdit}
          ownTeam={isMine}
          pending={moveInLineup.isPending}
          error={moveError}
          onMove={(request) => move({ round, ...request })}
          onClose={() => {
            moveInLineup.reset();
            setSheetPlayerId(null);
          }}
        />
      )}

      {fillSlotIndex !== null && lineup && (
        <SlotPickerSheet
          lineup={lineup}
          slotIndex={fillSlotIndex}
          canOverride={team.canOverride && season.canEdit}
          pending={moveInLineup.isPending}
          error={moveError}
          onMove={(request) => move({ round, ...request })}
          onClose={() => {
            moveInLineup.reset();
            setFillSlotIndex(null);
          }}
        />
      )}

      {pendingOverride && (
        <OverrideDialog
          pending={moveInLineup.isPending}
          teamName={team.name}
          ownTeam={isMine}
          locked={pendingOverride.locked}
          onCancel={() => setPendingOverride(null)}
          onConfirm={() => {
            move({ ...pendingOverride.request, confirmOverride: true });
            setPendingOverride(null);
          }}
        />
      )}
      {settingsOpen && (
        <TeamSettingsSheet
          team={team}
          owner={owner}
          canRename={canEdit}
          ownerPicker={canAssignOwner && members ? { seasonId, members } : undefined}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </Container>
  );
};

function TeamPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const query = useTeam(teamId);
  return (
    <QueryBoundary query={query} what="this team" page>
      {(team) => <TeamContent key={team.id} team={team} />}
    </QueryBoundary>
  );
}

export default TeamPage;
