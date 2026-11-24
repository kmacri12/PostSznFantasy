import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { Box, Button, ButtonBase, Typography } from "@mui/material";
import { type ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import { useDraft, useFeatures, useRoundRecap, useStandings } from "../../api/queries";
import type { SeasonOverview, Standings } from "../../api/types";
import { useSeasonContext } from "../../contexts/SeasonContext";
import { tokens } from "../../theme";
import { draftCalendarEvent, lockCalendarEvent } from "../../utils/calendar";
import { formatInViewerZone } from "../../utils/timeZone";
import AddToCalendar from "../common/AddToCalendar";
import { ROUND_LABELS } from "../team/lineup";
import { formatCountdown, formatDraftTime, ordinal, useNow } from "./countdown";
import InviteLinkButton from "./InviteLinkButton";
import LiveIndicator, { ARROW_OUTSET } from "./LiveIndicator";
import { afterDraftPhase } from "./phase";
import RoundRecapDialog from "./RoundRecapDialog";
import { recapTeams } from "./roundRecap";
import { gamesSummary } from "./standingsView";

const Block = ({ children }: { children: ReactNode }) => (
  <Box
    sx={{
      borderRadius: 2,
      px: 2,
      py: 1.25,
      bgcolor: tokens.accentSurface,
      border: `1px solid ${tokens.accentBorder}`,
      display: "flex",
      flexDirection: "column",
      gap: 0.5,
    }}
  >
    {children}
  </Box>
);

const Row = ({ children }: { children: ReactNode }) => (
  <Box
    sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", columnGap: 1.5, rowGap: 0.5 }}
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
  <Typography variant="body2" sx={{ color: tokens.accentSoft }}>
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
  const countingDown =
    season.draftStatus === "scheduled" && startTime !== null && Date.parse(startTime) > now;
  const timePassed = season.draftStatus === "scheduled" && startTime !== null && !countingDown;
  const awaitingStart = timePassed || season.draftStatus === "lobby";
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
        <Title>
          {timePassed
            ? "Draft time has passed"
            : (DRAFT_TITLES[season.draftStatus] ?? "Draft scheduled")}
        </Title>
      )}
      {when && <Detail>{when}</Detail>}
      {awaitingStart && (
        <Detail>
          {season.canCommission
            ? "The draft only begins when you start it."
            : "Waiting for your commissioner to start it."}
        </Detail>
      )}
      {countingDown && startTime && (
        <Box sx={{ display: "flex", mt: 1 }}>
          <AddToCalendar
            event={draftCalendarEvent({
              seasonId: season.id,
              leagueName: season.leagueName,
              start: startTime,
              url: `${window.location.origin}${paths.draft}`,
            })}
            filename="draft.ics"
          />
        </Box>
      )}
      <Action to={paths.draft}>
        {awaitingStart && season.canCommission ? "Start the draft" : "Enter draft"}
      </Action>
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
  const locks = formatInViewerZone(firstKickoff, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
  return (
    <Block>
      <Row>
        <Title>Set your lineup</Title>
        <Detail>First lock {locks}</Detail>
        {Date.parse(firstKickoff) > Date.now() && (
          <AddToCalendar
            label="Add first lock to calendar"
            event={lockCalendarEvent({
              seasonId: season.id,
              round: 1,
              roundLabel: ROUND_LABELS[1] ?? "Wild Card",
              leagueName: season.leagueName,
              start: firstKickoff,
              url: `${window.location.origin}${season.myTeamId !== null ? paths.team(season.myTeamId) : paths.home}`,
            })}
            filename="first-lock.ics"
          />
        )}
        {season.myTeamId !== null && (
          <Button
            component={Link}
            to={paths.team(season.myTeamId)}
            variant="contained"
            size="small"
            sx={{ minHeight: 44, ml: "auto" }}
          >
            Open my team
          </Button>
        )}
      </Row>
    </Block>
  );
};

const gamesLine = (standings: Standings): string => gamesSummary(standings) || "No games yet";

/** Title-row link to the NFL schedule; hidden while the owner's kill switch (`bracket`) is off. */
const ScheduleLink = () => {
  const { paths } = useSeasonContext();
  const { bracket } = useFeatures();
  if (!bracket) return null;
  return (
    <ButtonBase
      component={Link}
      to={paths.schedule}
      sx={{
        minHeight: 44,
        ml: "auto",
        mr: ARROW_OUTSET,
        gap: 0.25,
        fontWeight: 600,
        fontSize: 14,
        color: tokens.accentSoft,
        borderRadius: 1,
      }}
    >
      NFL schedule
      <ChevronRightIcon aria-hidden fontSize="small" />
    </ButtonBase>
  );
};

/**
 * While a game is on, the games line moves to its own row under the title. Once the round is over
 * the line gives way to a View recap button (the recap only reads well in its own screen).
 */
const PlayoffBlock = ({ season, standings }: { season: SeasonOverview; standings: Standings }) => {
  const { paths } = useSeasonContext();
  const games = gamesLine(standings);
  const live = standings.gamesInProgress > 0;
  const over = !live && standings.gamesToPlay === 0 && standings.gamesFinal > 0;
  const recap = useRoundRecap(season.id, over).data;
  const [recapOpen, setRecapOpen] = useState(false);
  const hasRecap = over && recap != null && recap.highlights.length > 0;
  return (
    <Block>
      <Row>
        <Title>{ROUND_LABELS[standings.round]}</Title>
        {hasRecap ? (
          <Button
            variant="outlined"
            size="small"
            onClick={() => setRecapOpen(true)}
            sx={{ minHeight: 44, fontWeight: 600 }}
          >
            View recap
          </Button>
        ) : (
          !live && <Detail>{games}</Detail>
        )}
        <ScheduleLink />
      </Row>
      <LiveIndicator seasonId={season.id} games={games} schedule={paths.schedule} />
      {recapOpen && recap && (
        <RoundRecapDialog
          open
          onClose={() => setRecapOpen(false)}
          leagueName={season.leagueName}
          year={season.year}
          round={recap.round}
          highlights={recap.highlights}
          teamScores={recap.teamScores}
          teams={recapTeams(standings.teams)}
        />
      )}
    </Block>
  );
};

/** The phase after the draft, or null while it loads. */
const useAfterDraftPhase = (season: SeasonOverview) => {
  const draft = useDraft(season.id);
  const standings = useStandings(season.id).data;
  const now = useNow(30_000);
  const firstKickoff = draft.data?.draftCutoff ?? null;
  const phase = draft.isLoading
    ? null
    : afterDraftPhase({
        firstKickoff,
        gamesStarted:
          standings !== undefined &&
          (standings.round > 1 || standings.gamesInProgress > 0 || standings.gamesFinal > 0),
        now,
      });
  return { phase, firstKickoff, standings };
};

/** Once the draft is done: lineups are open until the first kickoff, then the playoffs run. */
const AfterDraft = ({ season }: { season: SeasonOverview }) => {
  const { phase, firstKickoff, standings } = useAfterDraftPhase(season);
  if (phase === null) return null;
  if (phase === "lineup" && firstKickoff) {
    return <LineupBlock season={season} firstKickoff={firstKickoff} />;
  }
  return standings ? <PlayoffBlock season={season} standings={standings} /> : null;
};

/**
 * A small link row under the standings to the NFL schedule before the playoffs start (the
 * playoff block carries it in its title row); hidden while the owner's kill switch (`bracket`) is off.
 */
export const BracketLink = ({ season }: { season: SeasonOverview }) => {
  const { paths } = useSeasonContext();
  const { bracket } = useFeatures();
  const { phase, standings } = useAfterDraftPhase(season);
  const inPlayoffBlock =
    season.draftStatus === "completed" && phase === "playoffs" && standings !== undefined;
  if (!bracket || inPlayoffBlock) return null;
  return (
    <Button
      component={Link}
      to={paths.schedule}
      endIcon={<ChevronRightIcon aria-hidden />}
      sx={{ minHeight: 44, alignSelf: "flex-start", fontWeight: 600 }}
    >
      NFL schedule
    </Button>
  );
};

const phaseBlock = (season: SeasonOverview) => {
  if (season.draftStatus === "unscheduled") return <Unscheduled season={season} />;
  if (season.draftStatus !== "completed") return <DraftBlock season={season} />;
  return <AfterDraft season={season} />;
};

/** The block that tops the League tab; a finished season shows the champion card instead. */
const PhaseBlock = ({ season }: { season: SeasonOverview }) =>
  season.finished ? null : phaseBlock(season);

export default PhaseBlock;
