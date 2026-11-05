import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  type SelectChangeEvent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useConfig, usePlayerSeasonStats, useUserLeagues } from "../../api/queries";
import { useOptionalSeasonContext } from "../../contexts/SeasonContext";
import { useUser } from "../../contexts/UserContext";
import { tokens } from "../../theme";
import EmptyState from "../common/EmptyState";
import ErrorState from "../common/ErrorState";
import LoadingState from "../common/LoadingState";
import PlayerCardList from "./PlayerCardList";
import type { PlayerCardData } from "./playerCards";
import {
  filterPlayers,
  formatPoints,
  type PlayerSeasonStats,
  POSITIONS,
  type PositionFilter,
  STAT_COLUMNS,
  sortPlayers,
  statValue,
  teamOf,
} from "./playerStats";

const PlayersTable = () => {
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down("md"));
  const { userId } = useUser();
  const { data: config } = useConfig();
  const { data: leagues = [] } = useUserLeagues(userId !== null);
  const [searchParams, setSearchParams] = useSearchParams();

  const [pickedSeason, setPickedSeason] = useState<string | null>(null);
  const [position, setPosition] = useState<PositionFilter>("QB");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("fantasyPoints");

  // Follows the configured season until the user picks another one.
  const currentSeason = config?.season;
  const season = pickedSeason ?? (currentSeason ? String(currentSeason) : undefined);
  const seasonOptions = currentSeason
    ? [currentSeason, currentSeason - 1, currentSeason - 2].map(String)
    : [];

  // Under a season route its scoring applies; otherwise the member picks among their leagues.
  const pinned = useOptionalSeasonContext();
  const requestedLeague = searchParams.get("leagueId");
  const picked = leagues.find((l) => String(l.id) === requestedLeague) ?? leagues[0];
  const league = pinned
    ? { id: pinned.leagueId, seasonId: pinned.seasonId, name: pinned.season.leagueName }
    : picked;

  const stats = usePlayerSeasonStats<PlayerSeasonStats>(season, league?.seasonId);
  const columns = STAT_COLUMNS[position];
  const rows = useMemo(
    () => sortPlayers(filterPlayers(stats.data ?? [], position, search), sortKey),
    [stats.data, position, search, sortKey],
  );
  const hasPoints = league !== undefined;
  const cards = useMemo(
    () =>
      rows.map(
        (row): PlayerCardData => ({
          id: row.playerId,
          name: row.player?.name ?? "Unknown",
          position: row.player?.position ?? "",
          team: teamOf(row),
          points: hasPoints ? (row.fantasyPoints ?? null) : undefined,
          stats: columns.map((c) => ({ label: c.header, value: statValue(row, c.key) })),
        }),
      ),
    [rows, columns, hasPoints],
  );

  return (
    <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
      <Box
        sx={{
          display: "grid",
          gap: 1.5,
          gridTemplateColumns: { xs: "1fr", md: "140px 140px 1fr" },
          mb: 1.5,
        }}
      >
        <FormControl size="small">
          <InputLabel id="season-select-label">Season</InputLabel>
          <Select
            labelId="season-select-label"
            value={season ?? ""}
            label="Season"
            onChange={(e: SelectChangeEvent) => setPickedSeason(e.target.value)}
          >
            {seasonOptions.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {!isPhone && (
          <FormControl size="small">
            <InputLabel id="position-select-label">Position</InputLabel>
            <Select
              labelId="position-select-label"
              value={position}
              label="Position"
              onChange={(e: SelectChangeEvent) => setPosition(e.target.value as PositionFilter)}
            >
              {POSITIONS.map((pos) => (
                <MenuItem key={pos} value={pos}>
                  {pos}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        {!isPhone && (
          <TextField
            size="small"
            label="Search player"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        )}
      </Box>

      {hasPoints ? (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 1.5 }}>
          <Typography variant="body2" color="text.secondary">
            Fantasy points use
          </Typography>
          {!pinned && leagues.length > 1 ? (
            <Select
              size="small"
              value={String(league.id)}
              onChange={(e) => setSearchParams({ leagueId: e.target.value })}
              inputProps={{ "aria-label": "Scoring league" }}
            >
              {leagues.map((l) => (
                <MenuItem key={l.id} value={String(l.id)}>
                  {l.name}
                </MenuItem>
              ))}
            </Select>
          ) : (
            <Chip size="small" label={league.name} />
          )}
          <Typography variant="body2" color="text.secondary">
            scoring
          </Typography>
        </Box>
      ) : (
        <Alert severity="info" sx={{ mb: 1.5 }}>
          Join or create a league to see fantasy points under its scoring settings.
        </Alert>
      )}

      {stats.isLoading && <LoadingState what="player stats" />}
      {stats.isError && (
        <ErrorState
          message="Couldn't load player stats. Check your connection and try again."
          onRetry={() => stats.refetch()}
        />
      )}
      {stats.isSuccess && !isPhone && rows.length === 0 && (
        <EmptyState
          title="No players found"
          description={
            search
              ? "Clear the search or pick another position."
              : "Try another season or position."
          }
          action={
            search ? (
              <Button variant="outlined" onClick={() => setSearch("")}>
                Clear search
              </Button>
            ) : undefined
          }
        />
      )}

      {isPhone && stats.isSuccess && (
        <PlayerCardList
          label="Players"
          players={cards}
          search={search}
          onSearchChange={setSearch}
          includeAll={false}
          positions={POSITIONS}
          position={position}
          onPositionChange={(pos) => setPosition(pos as PositionFilter)}
          emptyText="No players found. Try another season or position."
        />
      )}

      {rows.length > 0 && !isPhone && (
        <TableContainer component={Paper}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell width={40}>#</TableCell>
                <TableCell>
                  <TableSortLabel
                    active={sortKey === "name"}
                    direction="asc"
                    onClick={() => setSortKey("name")}
                  >
                    Player
                  </TableSortLabel>
                </TableCell>
                <TableCell>Team</TableCell>
                {hasPoints && (
                  <TableCell align="right">
                    <TableSortLabel
                      active={sortKey === "fantasyPoints"}
                      direction="desc"
                      onClick={() => setSortKey("fantasyPoints")}
                    >
                      Fantasy Pts
                    </TableSortLabel>
                  </TableCell>
                )}
                {columns.map((column) => (
                  <TableCell key={column.key} align="right">
                    <TableSortLabel
                      active={sortKey === column.key}
                      direction="desc"
                      onClick={() => setSortKey(column.key)}
                    >
                      {column.header}
                    </TableSortLabel>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={row.playerId} hover>
                  <TableCell>{index + 1}</TableCell>
                  <TableCell>
                    <Typography sx={{ fontWeight: 600 }}>
                      {row.player?.name ?? "Unknown"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {row.player?.position}
                    </Typography>
                  </TableCell>
                  <TableCell>{teamOf(row)}</TableCell>
                  {hasPoints && (
                    <TableCell align="right" sx={{ color: tokens.accent, fontWeight: 700 }}>
                      {formatPoints(row.fantasyPoints)}
                    </TableCell>
                  )}
                  {columns.map((column) => (
                    <TableCell key={column.key} align="right">
                      {statValue(row, column.key)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default PlayersTable;
