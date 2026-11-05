import { alpha, Box, Button, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useDraft, useStandings } from "../../api/queries";
import type { SeasonOverview, Standings } from "../../api/types";
import { useSeasonContext } from "../../contexts/SeasonContext";
import { ROUND_LABELS } from "../team/lineup";
import { formatCountdown, formatDraftTime, ordinal, useNow } from "./countdown";
import InviteLinkButton from "./InviteLinkButton";
import { afterDraftPhase } from "./phase";

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? "" : "s"}`;

const Block = ({ children }: { children: ReactNode }) => (
  <Box
    sx={(theme) => ({
      borderRadius: 2,
      p: 2,
      bgcolor: alpha(theme.palette.success.main, 0.12),
      border: `1px solid ${alpha(theme.palette.success.main, 0.4)}`,
      display: "flex",
      flexDirection: "column",
      gap: 0.5,
    })}
  >
    {children}
  </Box>
);

const Title = ({ children }: { children: ReactNode }) => (
  <Typography component="h2" sx={{ fontSize: 17, fontWeight: 600 }}>
    {children}
  </Typography>
);

const Detail = ({ children }: { children: ReactNode }) => (
  <Typography variant="body2" color="text.secondary">
    {children}
  </Typography>
);

const Action = ({ to, children }: { to: string; children: ReactNode }) => (
  <Button component={Link} to={to} variant="contained" fullWidth sx={{ minHeight: 48, mt: 1.5 }}>
    {children}
  </Button>
);

const teamsFilled = (season: SeasonOverview) =>
  `${season.numberTeams - season.openSpots} of ${season.numberTeams} teams filled.`;

const Unscheduled = ({ season }: { season: SeasonOverview }) =>
  season.canCommission ? (
    <Block>
      <Title>Invite your friends</Title>
      <Detail>{teamsFilled(season)} Draft date not set yet.</Detail>
      <Box sx={{ mt: 1.5 }}>
        <InviteLinkButton leagueId={season.leagueId} leagueName={season.leagueName} />
      </Box>
    </Block>
  ) : (
    <Block>
      <Title>Draft not yet scheduled by your commissioner</Title>
      <Detail>{teamsFilled(season)}</Detail>
    </Block>
  );

const DRAFT_TITLES: Record<string, string> = {
  lobby: "The draft lobby is open",
  in_progress: "The draft is under way",
  paused: "The draft is paused",
};

const DraftBlock = ({ season }: { season: SeasonOverview }) => {
  const { paths } = useSeasonContext();
  const now = useNow();
  const draft = useDraft(season.id).data;
  const startTime = draft?.startTime ?? season.draftStartTime;
  const pick =
    draft && season.myTeamId ? draft.order.findIndex((s) => s.teamId === season.myTeamId) : -1;
  const when = [
    startTime ? formatDraftTime(startTime) : null,
    pick >= 0 ? `you pick ${ordinal(pick + 1)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const countingDown = season.draftStatus === "scheduled" && startTime !== null;
  return (
    <Block>
      {countingDown ? (
        <>
          <Detail>Draft starts in</Detail>
          <Typography
            aria-label={formatCountdown(Date.parse(startTime) - now)}
            sx={{ fontSize: 28, fontWeight: 700, lineHeight: 1.2 }}
          >
            {formatCountdown(Date.parse(startTime) - now)}
          </Typography>
        </>
      ) : (
        <Title>{DRAFT_TITLES[season.draftStatus] ?? "Draft scheduled"}</Title>
      )}
      {when && <Detail>{when}</Detail>}
      <Action to={paths.draft}>Enter draft</Action>
    </Block>
  );
};

const LineupBlock = ({
  season,
  firstKickoff,
}: {
  season: SeasonOverview;
  firstKickoff: string;
}) => {
  const { paths } = useSeasonContext();
  const locks = new Date(firstKickoff).toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
  return (
    <Block>
      <Title>Set your lineup</Title>
      <Detail>Lineups lock {locks}</Detail>
      {season.myTeamId !== null && <Action to={paths.team(season.myTeamId)}>Open my team</Action>}
    </Block>
  );
};

const gamesLine = (standings: Standings): string => {
  const parts = [
    standings.gamesInProgress > 0 ? `${plural(standings.gamesInProgress, "game")} live` : null,
    standings.gamesFinal > 0 ? `${standings.gamesFinal} final` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "No games yet";
};

/** Eliminated players are left out: only starters still to score count here. */
const lineupLine = (standings: Standings, teamId: number | null): string | null => {
  const mine = standings.teams.find((row) => row.teamId === teamId);
  if (!mine) return null;
  const { live, toPlay, finished } = mine.progress;
  const parts = [live > 0 ? `${live} live` : null, toPlay > 0 ? `${toPlay} to play` : null].filter(
    Boolean,
  );
  if (parts.length > 0) return `Your lineup: ${parts.join(", ")}`;
  return finished > 0 ? "Your lineup: all games final" : null;
};

const PlayoffBlock = ({ season, standings }: { season: SeasonOverview; standings: Standings }) => {
  const mine = lineupLine(standings, season.myTeamId);
  return (
    <Block>
      <Title>{ROUND_LABELS[standings.round]}</Title>
      <Detail>{gamesLine(standings)}</Detail>
      {mine && <Detail>{mine}</Detail>}
    </Block>
  );
};

/** Once the draft is done: lineups are open until the first kickoff, then the playoffs run. */
const AfterDraft = ({ season }: { season: SeasonOverview }) => {
  const draft = useDraft(season.id);
  const standings = useStandings(season.id).data;
  const now = useNow(30_000);
  if (draft.isLoading) return null;
  const firstKickoff = draft.data?.draftCutoff ?? null;
  const phase = afterDraftPhase({
    firstKickoff,
    gamesStarted:
      standings !== undefined &&
      (standings.round > 1 || standings.gamesInProgress > 0 || standings.gamesFinal > 0),
    now,
  });
  if (phase === "lineup" && firstKickoff) {
    return <LineupBlock season={season} firstKickoff={firstKickoff} />;
  }
  return standings ? <PlayoffBlock season={season} standings={standings} /> : null;
};

/** The block that tops the League tab; a finished season shows the champion card instead. */
const PhaseBlock = ({ season }: { season: SeasonOverview }) => {
  if (season.finished) return null;
  if (season.draftStatus === "unscheduled") {
    return <Unscheduled season={season} />;
  }
  if (season.draftStatus !== "completed") return <DraftBlock season={season} />;
  return <AfterDraft season={season} />;
};

export default PhaseBlock;
