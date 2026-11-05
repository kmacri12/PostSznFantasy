import SearchIcon from "@mui/icons-material/Search";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import {
  Box,
  Button,
  Chip,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useDraftPool, useLeagueSettings, usePlayerSeasonStats } from "../../api/queries";
import type { DraftPick } from "../../api/types";
import { radii, tokens } from "../../theme";
import EmptyState from "../common/EmptyState";
import ErrorState from "../common/ErrorState";
import InjuryTag from "../common/InjuryTag";
import LoadingState from "../common/LoadingState";
import TeamUnitBadge from "../common/TeamUnitBadge";
import FilterMenu from "./FilterMenu";
import {
  type Availability,
  buildPlayerRows,
  filterRows,
  flexPositions,
  type Owner,
  ownersByPlayer,
  type PlayerRow,
  POSITION_FILTERS,
  type SeasonStatsRow,
  sortOptions,
  sortRows,
} from "./playerRows";

const MAX_ROWS = 200;
const CONFIRM_WINDOW_MS = 3000;

/** What the draft room adds to the list: the Draft and queue buttons and the availability filter. */
export interface DraftActions {
  /** Picks are open (the draft is in progress or paused). */
  live: boolean;
  canPick: boolean;
  isConnected: boolean;
  /** Player whose pick is awaiting the server's answer. */
  pendingPlayerId: number | null;
  /** Position to the reason this team can't draft it (it reached the cap). */
  capped: Record<string, string>;
  queue: number[];
  /** Players the server rejected as already drafted. */
  takenIds: number[];
  onPick: (playerId: number) => void;
  onToggleQueue: (playerId: number) => void;
}

interface Props {
  seasonId: number;
  /** The NFL season whose regular-season stats and fantasy points the list shows. */
  year: number;
  picks: DraftPick[];
  teams: { id: number; name: string }[];
  myTeamId: number | null;
  draft?: DraftActions;
}

const chipSx = (selected: boolean) => ({
  height: 36,
  minHeight: 36,
  minWidth: 44,
  ...(selected
    ? { bgcolor: tokens.accentSurface, borderColor: tokens.accent, color: tokens.accent }
    : { color: tokens.textSoft, borderColor: tokens.borderStrong }),
});

const ownerText = (owner: Owner) => `Drafted by ${owner.teamName} · R${owner.round} #${owner.pick}`;

interface RowProps {
  row: PlayerRow;
  owner: Owner | undefined;
  myTeamId: number | null;
  year: number;
  draft: DraftActions | undefined;
  armed: boolean;
  onDraft: () => void;
}

const PlayerListItem = ({ row, owner, myTeamId, year, draft, armed, onDraft }: RowProps) => {
  const capReason = draft?.capped[row.position];
  const queued = draft?.queue.includes(row.id) ?? false;
  const pending = draft?.pendingPlayerId === row.id;
  const drafted = draft !== undefined && owner !== undefined;
  const showDraft = draft?.live === true && owner === undefined;
  const draftLabel = capReason
    ? "Position full"
    : !draft?.isConnected
      ? "Offline"
      : pending
        ? "Drafting…"
        : armed
          ? "Confirm"
          : "Draft";

  return (
    <Box
      component="li"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        py: 1.25,
        pl: 1.75,
        pr: 1.5,
        borderTop: `1px solid ${tokens.border}`,
        "&:first-of-type": { borderTop: 0 },
        listStyle: "none",
        opacity: drafted || row.eliminated ? 0.55 : 1,
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          sx={{
            fontSize: 14,
            fontWeight: 600,
            textDecoration: drafted ? "line-through" : undefined,
            overflowWrap: "anywhere",
          }}
        >
          {row.name}
          {row.injuryStatus && (
            <Box component="span" sx={{ ml: 0.75 }}>
              <InjuryTag status={row.injuryStatus} />
            </Box>
          )}
          {row.scoresWholeTeam && (
            <Box component="span" sx={{ ml: 0.75 }}>
              <TeamUnitBadge position={row.position} teamAbv={row.team} />
            </Box>
          )}
        </Typography>
        <Typography sx={{ fontSize: 12, color: tokens.muted, mt: 0.125 }}>
          {row.position} {row.team}
          {" · "}
          {drafted && owner ? ownerText(owner) : row.line}
          {row.eliminated && " · Eliminated"}
        </Typography>
        {capReason && (
          <Typography sx={{ fontSize: 12, fontWeight: 600, mt: 0.5 }}>{capReason}</Typography>
        )}
      </Box>
      {!draft && owner && (
        <Chip
          size="small"
          label={owner.teamName}
          sx={{
            maxWidth: 110,
            bgcolor: owner.teamId === myTeamId ? tokens.accentSurface : tokens.border,
            color: owner.teamId === myTeamId ? tokens.accent : tokens.text,
          }}
        />
      )}
      {row.points !== null && (
        <Box sx={{ textAlign: "right", minWidth: 44 }}>
          <Typography sx={{ fontSize: 15, fontWeight: 700, lineHeight: 1.2 }}>
            {row.points.toFixed(1)}
          </Typography>
          <Typography sx={{ fontSize: 10, color: tokens.muted }}>{year} pts</Typography>
        </Box>
      )}
      {draft && owner === undefined && (
        <IconButton
          aria-label={`${queued ? "Remove" : "Add"} ${row.name} ${queued ? "from" : "to"} queue`}
          aria-pressed={queued}
          disabled={!!capReason}
          onClick={() => draft.onToggleQueue(row.id)}
          sx={{ color: queued ? tokens.warning : tokens.muted, mx: -0.5 }}
        >
          {queued ? <StarIcon /> : <StarBorderIcon />}
        </IconButton>
      )}
      {showDraft && (
        <Button
          variant={capReason ? "outlined" : "contained"}
          color={armed ? "warning" : "primary"}
          aria-label={capReason ? undefined : armed ? `Confirm ${row.name}` : `Draft ${row.name}`}
          disabled={
            !draft.canPick || !draft.isConnected || draft.pendingPlayerId !== null || !!capReason
          }
          onClick={onDraft}
          sx={{
            minWidth: 68,
            px: 1.5,
            fontWeight: 700,
            lineHeight: 1.1,
            borderRadius: `${radii.mark + 2}px`,
          }}
        >
          {draftLabel}
        </Button>
      )}
    </Box>
  );
};

/**
 * The league's player list: scored by the league's settings, with search and filters. In the
 * draft room it also carries the Draft and queue buttons and the All/Available/Drafted filter.
 */
const PlayersView = ({ seasonId, year, picks, teams, myTeamId, draft }: Props) => {
  const pool = useDraftPool(seasonId);
  const stats = usePlayerSeasonStats<SeasonStatsRow>(String(year), seasonId);
  const settings = useLeagueSettings(seasonId).data;
  const flex = flexPositions(settings);

  const [search, setSearch] = useState("");
  const [position, setPosition] = useState<string | null>(null);
  const [nflTeam, setNflTeam] = useState<string | null>(null);
  const [fantasyTeamId, setFantasyTeamId] = useState<number | null>(null);
  const [availability, setAvailability] = useState<Availability>(draft ? "available" : "all");
  const [sortKey, setSortKey] = useState("points");
  const [armedId, setArmedId] = useState<number | null>(null);

  useEffect(() => {
    if (armedId === null) return;
    const timer = setTimeout(() => setArmedId(null), CONFIRM_WINDOW_MS);
    return () => clearTimeout(timer);
  }, [armedId]);

  const owners = useMemo(
    () => ownersByPlayer(picks, (id) => teams.find((team) => team.id === id)?.name ?? `Team ${id}`),
    [picks, teams],
  );
  const taken = useMemo(() => new Set(draft?.takenIds ?? []), [draft?.takenIds]);

  const rows = useMemo(
    () => buildPlayerRows(pool.data ?? [], stats.data ?? []),
    [pool.data, stats.data],
  );
  const nflTeams = useMemo(
    () => [...new Set(rows.map((row) => row.team))].sort((a, b) => a.localeCompare(b)),
    [rows],
  );
  const visible = useMemo(
    () =>
      sortRows(
        filterRows(
          rows.filter((row) => !taken.has(row.id)),
          { search, position, nflTeam, fantasyTeamId, availability },
          owners,
          flex,
        ),
        sortKey,
      ).slice(0, MAX_ROWS),
    [rows, taken, search, position, nflTeam, fantasyTeamId, availability, owners, flex, sortKey],
  );

  const choosePosition = (next: string | null) => {
    setPosition(next);
    // A stat sort only makes sense for the position it came from.
    setSortKey("points");
  };

  const handleDraft = (id: number) => {
    if (armedId !== id) {
      setArmedId(id);
      return;
    }
    setArmedId(null);
    draft?.onPick(id);
  };

  if (pool.isLoading || stats.isLoading) return <LoadingState what="players" />;
  if (pool.isError || stats.isError) {
    return (
      <ErrorState
        message="Couldn't load the players. Check your connection and try again."
        onRetry={() => {
          void pool.refetch();
          void stats.refetch();
        }}
      />
    );
  }

  const positions = POSITION_FILTERS.filter((pos) => pos !== "FLEX" || flex !== null);
  const availabilityChoices: { value: Availability; label: string }[] = [
    { value: "all", label: "All" },
    { value: "available", label: "Available" },
    { value: "drafted", label: "Drafted" },
  ];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
      <TextField
        fullWidth
        type="search"
        placeholder="Search players"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        slotProps={{
          htmlInput: { "aria-label": "Search players" },
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
      />
      <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
        {[null, ...positions].map((pos) => (
          <Chip
            key={pos ?? "All"}
            clickable
            variant="outlined"
            label={pos ?? "All"}
            aria-pressed={position === pos}
            onClick={() => choosePosition(pos)}
            sx={chipSx(position === pos)}
          />
        ))}
        <FilterMenu
          label="NFL team"
          value={nflTeam}
          options={[
            { value: "", label: "any" },
            ...nflTeams.map((team) => ({ value: team, label: team })),
          ]}
          onChange={(value) => setNflTeam(value || null)}
        />
      </Box>
      <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", alignItems: "center" }}>
        {draft &&
          availabilityChoices.map((choice) => (
            <Chip
              key={choice.value}
              clickable
              variant="outlined"
              label={choice.label}
              aria-pressed={availability === choice.value}
              onClick={() => setAvailability(choice.value)}
              sx={chipSx(availability === choice.value)}
            />
          ))}
        <FilterMenu
          label="Fantasy team"
          value={fantasyTeamId === null ? null : String(fantasyTeamId)}
          options={[
            { value: "", label: "any" },
            ...teams.map((team) => ({ value: String(team.id), label: team.name })),
          ]}
          onChange={(value) => setFantasyTeamId(value ? Number(value) : null)}
        />
        <Box sx={{ ml: "auto" }}>
          <FilterMenu
            label="Sort"
            value={sortKey}
            options={sortOptions(position, year).map(({ key, label }) => ({ value: key, label }))}
            onChange={setSortKey}
          />
        </Box>
      </Box>

      {visible.length === 0 ? (
        <EmptyState title="No players found" description="Clear the search or change a filter." />
      ) : (
        <Box
          component="ul"
          aria-label="Players"
          sx={{
            m: 0,
            p: 0,
            bgcolor: tokens.surface,
            border: `1px solid ${tokens.border}`,
            borderRadius: `${radii.card}px`,
            overflow: "hidden",
          }}
        >
          {visible.map((row) => (
            <PlayerListItem
              key={row.id}
              row={row}
              owner={owners.get(row.id)}
              myTeamId={myTeamId}
              year={year}
              draft={draft}
              armed={armedId === row.id}
              onDraft={() => handleDraft(row.id)}
            />
          ))}
        </Box>
      )}
    </Box>
  );
};

export default PlayersView;
